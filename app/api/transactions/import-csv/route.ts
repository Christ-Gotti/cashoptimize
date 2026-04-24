import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { users, bankConnections, bankAccounts, transactions } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { categorizeTransaction } from "@/lib/ai/categorize";

export const runtime = "nodejs";
export const maxDuration = 60;

type ImportRow = {
  date: string;        // ISO YYYY-MM-DD
  label: string;
  amount: number;      // signé : + = entrée, - = sortie
  counterparty?: string;
};

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return NextResponse.json({ error: "Missing auth" }, { status: 401 });
    const token = authHeader.replace("Bearer ", "");

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const [userRow] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    const orgId = userRow?.defaultOrgId;
    if (!orgId) return NextResponse.json({ error: "Aucune organisation liée" }, { status: 400 });

    const body = (await req.json()) as { rows: ImportRow[]; accountName?: string };
    if (!Array.isArray(body.rows) || body.rows.length === 0) {
      return NextResponse.json({ error: "Aucune ligne à importer" }, { status: 400 });
    }

    // ----- 1. Trouve/crée une bank connection "manual" -----
    let [conn] = await db
      .select()
      .from(bankConnections)
      .where(and(eq(bankConnections.orgId, orgId), eq(bankConnections.provider, "manual")))
      .limit(1);

    if (!conn) {
      [conn] = await db
        .insert(bankConnections)
        .values({
          orgId,
          provider: "manual",
          providerItemId: `manual-${orgId}`,
          bankName: "Import manuel",
          status: "active",
        })
        .returning();
    }

    // ----- 2. Trouve/crée un bank account "Import CSV" -----
    let [account] = await db
      .select()
      .from(bankAccounts)
      .where(and(eq(bankAccounts.orgId, orgId), eq(bankAccounts.connectionId, conn.id)))
      .limit(1);

    const accountName = body.accountName?.trim() || "Compte principal (CSV)";
    if (!account) {
      [account] = await db
        .insert(bankAccounts)
        .values({
          orgId,
          connectionId: conn.id,
          providerAccountId: `manual-${orgId}`,
          name: accountName,
          currency: "EUR",
          balance: "0",
          enabled: true,
        })
        .returning();
    }

    // ----- 3. Insère avec dédoublonnage (hash date+amount+label) -----
    let imported = 0;
    let skipped = 0;
    const toCategorize: Array<{ id: string; rawLabel: string; amount: number; bookedAt: string }> = [];

    for (const row of body.rows) {
      if (!row.date || !row.label || !Number.isFinite(row.amount)) {
        skipped++;
        continue;
      }

      const providerTxId = `csv-${row.date}-${row.amount.toFixed(2)}-${row.label.slice(0, 30).replace(/[^a-z0-9]/gi, "")}`;

      // Check si existe déjà
      const existing = await db
        .select({ id: transactions.id })
        .from(transactions)
        .where(and(eq(transactions.accountId, account.id), eq(transactions.providerTxId, providerTxId)))
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      const [inserted] = await db
        .insert(transactions)
        .values({
          orgId,
          accountId: account.id,
          providerTxId,
          source: "import_csv",
          bookedAt: row.date,
          rawLabel: row.label.trim(),
          cleanLabel: row.label.trim(),
          amount: row.amount.toFixed(2),
          currency: "EUR",
          counterpartyName: row.counterparty?.trim() || null,
        })
        .returning({ id: transactions.id });

      toCategorize.push({
        id: inserted.id,
        rawLabel: row.label,
        amount: row.amount,
        bookedAt: row.date,
      });
      imported++;
    }

    // ----- 4. Catégorisation auto (tier 1 rules rapide, puis Claude pour le reste) -----
    let categorized = 0;
    for (const tx of toCategorize) {
      try {
        const result = await categorizeTransaction({
          orgId,
          rawLabel: tx.rawLabel,
          amount: tx.amount,
          bookedAt: new Date(tx.bookedAt),
        });
        if (result.categoryId) {
          await db
            .update(transactions)
            .set({
              categoryId: result.categoryId,
              categoryConfidence: result.confidence,
              categorizationTier: result.tier,
            })
            .where(eq(transactions.id, tx.id));
          categorized++;
        }
      } catch {
        // continue, catégorisation facultative
      }
    }

    return NextResponse.json({
      ok: true,
      imported,
      skipped,
      categorized,
      accountId: account.id,
    });
  } catch (err) {
    console.error("[import-csv]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}