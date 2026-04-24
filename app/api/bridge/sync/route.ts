// app/api/bridge/sync/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { users, organizations, bankConnections, bankAccounts, transactions, categoryRules } from "@/lib/schema";
import { eq, and, or, isNull, desc } from "drizzle-orm";
import { authenticateUser, listItems, listAccounts } from "@/lib/bridge";

export const dynamic = "force-dynamic";

type BridgeTxV3 = {
  id: number;
  account_id: number;
  clean_description?: string;
  provider_description?: string;
  bank_description?: string;
  amount: number;
  currency_code: string;
  date: string;
  booking_date?: string;
  value_date?: string;
  deleted?: boolean;
  is_deleted?: boolean;
  future?: boolean;
  category_id?: number;
  operation_type?: string;
  counterparty?: { name?: string; iban?: string };
};

async function fetchAllTransactions(accessToken: string): Promise<BridgeTxV3[]> {
  const baseUrl = "https://api.bridgeapi.io/v3/aggregation/transactions?limit=500";
  const headers = {
    "Client-Id": process.env.BRIDGE_CLIENT_ID!,
    "Client-Secret": process.env.BRIDGE_CLIENT_SECRET!,
    "Bridge-Version": process.env.BRIDGE_API_VERSION ?? "2025-01-15",
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  const all: BridgeTxV3[] = [];
  let nextUrl: string | null = baseUrl;
  let pageCount = 0;
  while (nextUrl && pageCount < 20) {
    pageCount++;
    const res = await fetch(nextUrl, { headers });
    if (!res.ok) throw new Error(`listTransactions failed: ${res.status} ${await res.text()}`);
    const data: { resources?: BridgeTxV3[]; pagination?: { next_uri?: string | null } } = await res.json();
    if (Array.isArray(data.resources)) all.push(...data.resources);
    nextUrl = data.pagination?.next_uri ? `https://api.bridgeapi.io${data.pagination.next_uri}` : null;
  }
  return all;
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return NextResponse.json({ error: "Missing auth" }, { status: 401 });
    const token = authHeader.replace("Bearer ", "");

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const [userRow] = await db.select().from(users).where(eq(users.id, user.id));
    const orgId = userRow?.defaultOrgId;
    if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

    const settings = (org.settings as Record<string, unknown>) ?? {};
    const bridgeUserUuid = settings.bridgeUserUuid as string | undefined;
    if (!bridgeUserUuid) return NextResponse.json({ error: "No Bridge user — connect a bank first" }, { status: 400 });

    const { access_token } = await authenticateUser(bridgeUserUuid);

    // 1. Items
    const items = await listItems(access_token);
    const itemMap: Record<number, string> = {};
    for (const item of items) {
      const existing = await db.select().from(bankConnections)
        .where(and(eq(bankConnections.orgId, orgId), eq(bankConnections.providerItemId, String(item.id))))
        .limit(1);
      if (existing[0]) {
        itemMap[item.id] = existing[0].id;
        await db.update(bankConnections)
          .set({ status: String(item.status ?? "active"), lastSyncAt: new Date() })
          .where(eq(bankConnections.id, existing[0].id));
      } else {
        const [created] = await db.insert(bankConnections).values({
          orgId, provider: "bridge", providerItemId: String(item.id),
          bankName: item.bank?.name ?? "Banque",
          bankLogoUrl: item.bank?.logo_url ?? null,
          status: String(item.status ?? "active"),
          lastSyncAt: new Date(),
        }).returning({ id: bankConnections.id });
        itemMap[item.id] = created.id;
      }
    }

    // 2. Accounts
    const accounts = await listAccounts(access_token);
    const accountMap: Record<number, string> = {};
    for (const acc of accounts) {
      const connectionDbId = itemMap[acc.item_id];
      if (!connectionDbId) continue;
      const existing = await db.select().from(bankAccounts)
        .where(and(eq(bankAccounts.connectionId, connectionDbId), eq(bankAccounts.providerAccountId, String(acc.id))))
        .limit(1);
      if (existing[0]) {
        accountMap[acc.id] = existing[0].id;
        await db.update(bankAccounts)
          .set({ balance: String(acc.balance), lastBalanceAt: new Date() })
          .where(eq(bankAccounts.id, existing[0].id));
      } else {
        const [created] = await db.insert(bankAccounts).values({
          orgId, connectionId: connectionDbId,
          providerAccountId: String(acc.id),
          name: acc.name, iban: acc.iban ?? null,
          currency: acc.currency_code, balance: String(acc.balance),
          lastBalanceAt: new Date(),
        }).returning({ id: bankAccounts.id });
        accountMap[acc.id] = created.id;
      }
    }

    // 3. Règles
    const rules = await db.select({
      id: categoryRules.id,
      categoryId: categoryRules.categoryId,
      pattern: categoryRules.pattern,
    }).from(categoryRules)
      .where(or(eq(categoryRules.orgId, orgId), isNull(categoryRules.orgId)))
      .orderBy(desc(categoryRules.priority));

    // 4. Toutes les transactions avec pagination
    const allTxs = await fetchAllTransactions(access_token);
    console.log(`[bridge/sync] Total transactions from Bridge: ${allTxs.length}`);

    let imported = 0;
    let skipped = 0;
    let categorized = 0;
    let skippedNoAccount = 0;
    let skippedDeleted = 0;

    for (const tx of allTxs) {
      // Bridge v3 utilise "deleted" (pas "is_deleted")
      if (tx.deleted === true || tx.is_deleted === true) { skippedDeleted++; continue; }

      const accountDbId = accountMap[tx.account_id];
      if (!accountDbId) { skippedNoAccount++; continue; }

      const existing = await db.select({ id: transactions.id }).from(transactions)
        .where(and(eq(transactions.accountId, accountDbId), eq(transactions.providerTxId, String(tx.id))))
        .limit(1);
      if (existing.length > 0) { skipped++; continue; }

      // Bridge v3 : provider_description OU clean_description OU bank_description
      const rawLabel = (
        tx.provider_description?.trim() ||
        tx.bank_description?.trim() ||
        tx.clean_description?.trim() ||
        `Transaction #${tx.id}`
      );
      const cleanLabel = tx.clean_description?.trim() || rawLabel;

      // Catégorisation
      let categoryId: string | null = null;
      let confidence = 0;
      const labelUpper = rawLabel.toUpperCase();
      for (const rule of rules) {
        if (labelUpper.includes(rule.pattern.toUpperCase())) {
          categoryId = rule.categoryId;
          confidence = 0.88;
          break;
        }
      }
      if (categoryId) categorized++;

      await db.insert(transactions).values({
        orgId, accountId: accountDbId,
        providerTxId: String(tx.id), source: "bank_sync",
        bookedAt: tx.booking_date ?? tx.date,
        valueDate: tx.value_date ?? null,
        rawLabel, cleanLabel,
        amount: String(tx.amount), currency: tx.currency_code,
        categoryId, categoryConfidence: confidence,
        categorizationTier: categoryId ? 1 : null,
        counterpartyName: tx.counterparty?.name ?? null,
        counterpartyIban: tx.counterparty?.iban ?? null,
      });
      imported++;
    }

    return NextResponse.json({
      ok: true,
      summary: {
        connectionsCount: items.length,
        accountsCount: accounts.length,
        transactionsFetchedFromBridge: allTxs.length,
        transactionsImported: imported,
        transactionsSkipped: skipped,
        transactionsSkippedNoAccount: skippedNoAccount,
        transactionsSkippedDeleted: skippedDeleted,
        transactionsCategorized: categorized,
      },
    });
  } catch (err) {
    console.error("[bridge/sync]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}