// app/api/transactions/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { users, transactions, bankAccounts, categories, categoryRules } from "@/lib/schema";
import { eq, and, desc, or, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { orgId, error } = await authenticate(req);
  if (error) return error;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 400 });

  const txs = await db
    .select({
      id: transactions.id,
      bookedAt: transactions.bookedAt,
      rawLabel: transactions.rawLabel,
      cleanLabel: transactions.cleanLabel,
      amount: transactions.amount,
      currency: transactions.currency,
      categoryId: transactions.categoryId,
      categoryConfidence: transactions.categoryConfidence,
      categorizationTier: transactions.categorizationTier,
      userOverride: transactions.userOverride,
      accountId: transactions.accountId,
      counterpartyName: transactions.counterpartyName,
    })
    .from(transactions)
    .where(eq(transactions.orgId, orgId))
    .orderBy(desc(transactions.bookedAt))
    .limit(500);

  const cats = await db
    .select({ id: categories.id, label: categories.label, direction: categories.direction, color: categories.color })
    .from(categories)
    .where(or(isNull(categories.orgId), eq(categories.orgId, orgId)))
    .orderBy(categories.direction, categories.label);

  const accts = await db
    .select({ id: bankAccounts.id, name: bankAccounts.name })
    .from(bankAccounts)
    .where(eq(bankAccounts.orgId, orgId));

  return NextResponse.json({ transactions: txs, categories: cats, accounts: accts });
}

export async function PATCH(req: Request) {
  const { orgId, error } = await authenticate(req);
  if (error) return error;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 400 });

  const body = await req.json();
  const { transactionId, categoryId } = body;
  if (!transactionId) return NextResponse.json({ error: "Missing transactionId" }, { status: 400 });

  const [tx] = await db
    .update(transactions)
    .set({
      categoryId: categoryId ?? null,
      categoryConfidence: categoryId ? 1 : 0,
      categorizationTier: categoryId ? 4 : null,
      userOverride: true,
    })
    .where(and(eq(transactions.id, transactionId), eq(transactions.orgId, orgId)))
    .returning();

  if (categoryId && tx) {
    const tokens = tx.rawLabel
      .toUpperCase()
      .split(/\s+/)
      .filter((t) => t.length >= 4 && !/^\d+$/.test(t));
    const bestToken = tokens.sort((a, b) => b.length - a.length)[0];
    if (bestToken) {
      await db
        .insert(categoryRules)
        .values({ orgId, categoryId, pattern: bestToken, patternType: "contains", priority: 200, learnedFromUser: true })
        .onConflictDoNothing()
        .catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}

async function authenticate(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { error: NextResponse.json({ error: "Missing auth" }, { status: 401 }) };
  const token = authHeader.replace("Bearer ", "");
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return { error: NextResponse.json({ error: "Invalid token" }, { status: 401 }) };
  const [userRow] = await db.select().from(users).where(eq(users.id, user.id));
  return { user, orgId: userRow?.defaultOrgId ?? null };
}