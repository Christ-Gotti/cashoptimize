// app/api/banks/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { users, bankConnections, bankAccounts } from "@/lib/schema";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET : liste des connexions + comptes
export async function GET(req: Request) {
  const { orgId, error } = await authenticate(req);
  if (error) return error;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 400 });

  const connections = await db.select().from(bankConnections).where(eq(bankConnections.orgId, orgId));
  const accounts = await db.select().from(bankAccounts).where(eq(bankAccounts.orgId, orgId));

  return NextResponse.json({ connections, accounts });
}

// POST : ajout manuel d'une banque
export async function POST(req: Request) {
  const { orgId, error } = await authenticate(req);
  if (error) return error;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 400 });

  const body = await req.json();
  const { bankName, accountName, iban, balance, currency = "EUR" } = body;

  if (!bankName || !accountName || balance == null) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const uniqueId = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const [connection] = await db
    .insert(bankConnections)
    .values({
      orgId,
      provider: "manual",
      providerItemId: uniqueId,
      bankName,
      status: "active",
      lastSyncAt: new Date(),
    })
    .returning();

  const [account] = await db
    .insert(bankAccounts)
    .values({
      orgId,
      connectionId: connection.id,
      providerAccountId: uniqueId,
      name: accountName,
      iban: iban || null,
      balance: String(balance),
      currency,
      lastBalanceAt: new Date(),
    })
    .returning();

  return NextResponse.json({ connection, account });
}

// PATCH : modifier le solde d'un compte
export async function PATCH(req: Request) {
  const { orgId, error } = await authenticate(req);
  if (error) return error;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 400 });

  const body = await req.json();
  const { accountId, balance } = body;
  if (!accountId || balance == null) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  await db
    .update(bankAccounts)
    .set({ balance: String(balance), lastBalanceAt: new Date() })
    .where(and(eq(bankAccounts.id, accountId), eq(bankAccounts.orgId, orgId)));

  return NextResponse.json({ ok: true });
}

// DELETE : supprime une connexion (cascade sur les comptes)
export async function DELETE(req: Request) {
  const { orgId, error } = await authenticate(req);
  if (error) return error;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 400 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await db.delete(bankConnections).where(and(eq(bankConnections.id, id), eq(bankConnections.orgId, orgId)));
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