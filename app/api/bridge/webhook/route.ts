/**
 * POST /api/bridge/webhook
 *   Reçoit les événements de Bridge :
 *   - item.created / item.updated / item.refreshed → re-sync accounts + transactions
 *   - item.account.synced → re-sync transactions de l'account
 *   - item.error → marque connection comme "needs_auth"
 */

import { NextResponse } from "next/server";
import { verifyWebhookSignature, listAccounts, listTransactions, authenticateUser } from "@/lib/bridge";
import { db } from "@/lib/db";
import { bankConnections, bankAccounts, transactions, organizations } from "@/lib/schema";
import { and, eq, sql } from "drizzle-orm";
import { categorizeTransaction } from "@/lib/ai/categorize";

type BridgeWebhookEvent = {
  type:
    | "item.created"
    | "item.refreshed"
    | "item.account.synced"
    | "item.error"
    | "item.credentials.expired";
  content: {
    item_id: number;
    user_uuid: string;
    account_id?: number;
  };
};

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("BridgeApi-Signature");

  if (!signature || !process.env.BRIDGE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  if (!verifyWebhookSignature(body, signature, process.env.BRIDGE_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(body) as BridgeWebhookEvent;

  // Find the org from bridge user_uuid
  const orgsWithBridge = await db
    .select()
    .from(organizations)
    .where(sql`${organizations.settings}->>'bridgeUserUuid' = ${event.content.user_uuid}`)
    .limit(1);

  const org = orgsWithBridge[0];
  if (!org) {
    return NextResponse.json({ ok: true, reason: "org not found, ignored" });
  }

  const { access_token } = await authenticateUser(event.content.user_uuid);

  switch (event.type) {
    case "item.created":
    case "item.refreshed":
    case "item.account.synced":
      await syncItem(org.id, access_token, event.content.item_id);
      break;
    case "item.error":
    case "item.credentials.expired":
      await db
        .update(bankConnections)
        .set({ status: "needs_auth" })
        .where(and(eq(bankConnections.orgId, org.id), eq(bankConnections.providerItemId, String(event.content.item_id))));
      break;
  }

  return NextResponse.json({ ok: true });
}

async function syncItem(orgId: string, accessToken: string, itemId: number) {
  const accounts = await listAccounts(accessToken);
  const itemAccounts = accounts.filter((a) => a.item_id === itemId);

  for (const acc of itemAccounts) {
    // Upsert account
    await db
      .insert(bankAccounts)
      .values({
        orgId,
        connectionId: await getOrCreateConnection(orgId, itemId, acc.bank_name ?? "Banque"),
        providerAccountId: String(acc.id),
        name: acc.name,
        iban: acc.iban,
        currency: acc.currency_code,
        balance: String(acc.balance),
        lastBalanceAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [bankAccounts.connectionId, bankAccounts.providerAccountId],
        set: {
          balance: String(acc.balance),
          lastBalanceAt: new Date(),
        },
      });

    // Fetch transactions since last sync
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const txs = await listTransactions({ accessToken, accountId: acc.id, since: since.toISOString() });

    const accountRow = await db
      .select()
      .from(bankAccounts)
      .where(and(eq(bankAccounts.orgId, orgId), eq(bankAccounts.providerAccountId, String(acc.id))))
      .limit(1);

    if (!accountRow[0]) continue;

    for (const tx of txs) {
      if (tx.is_deleted) continue;

      // Check if already exists
      const exists = await db
        .select({ id: transactions.id })
        .from(transactions)
        .where(and(eq(transactions.accountId, accountRow[0].id), eq(transactions.providerTxId, String(tx.id))))
        .limit(1);

      if (exists.length > 0) continue;

      // Categorize
      const cat = await categorizeTransaction({
        orgId,
        rawLabel: tx.raw_description ?? tx.description,
        amount: tx.amount,
        counterpartyName: tx.counterparty?.name,
        bookedAt: new Date(tx.date),
      });

      await db.insert(transactions).values({
        orgId,
        accountId: accountRow[0].id,
        providerTxId: String(tx.id),
        source: "bank_sync",
        bookedAt: tx.date,
        valueDate: tx.value_date,
        rawLabel: tx.raw_description ?? tx.description,
        cleanLabel: tx.description,
        amount: String(tx.amount),
        currency: tx.currency_code,
        categoryId: cat.categoryId,
        categoryConfidence: cat.confidence,
        categorizationTier: cat.tier,
        counterpartyName: tx.counterparty?.name,
        counterpartyIban: tx.counterparty?.iban,
      });
    }
  }

  // Update last sync
  await db
    .update(bankConnections)
    .set({ lastSyncAt: new Date(), status: "active" })
    .where(and(eq(bankConnections.orgId, orgId), eq(bankConnections.providerItemId, String(itemId))));
}

async function getOrCreateConnection(orgId: string, itemId: number, bankName: string): Promise<string> {
  const existing = await db
    .select()
    .from(bankConnections)
    .where(and(eq(bankConnections.orgId, orgId), eq(bankConnections.providerItemId, String(itemId))))
    .limit(1);

  if (existing[0]) return existing[0].id;

  const [created] = await db
    .insert(bankConnections)
    .values({
      orgId,
      provider: "bridge",
      providerItemId: String(itemId),
      bankName,
      status: "active",
    })
    .returning({ id: bankConnections.id });

  return created.id;
}
