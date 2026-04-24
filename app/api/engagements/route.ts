// app/api/engagements/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { users, engagements } from "@/lib/schema";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// ----- GET : liste des engagements de l'org -----
export async function GET(req: Request) {
  const { orgId, error } = await authenticate(req);
  if (error) return error;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 400 });

  const list = await db
    .select()
    .from(engagements)
    .where(eq(engagements.orgId, orgId))
    .orderBy(engagements.startDate);

  return NextResponse.json({ engagements: list });
}

// ----- POST : créer un engagement -----
export async function POST(req: Request) {
  const { orgId, error } = await authenticate(req);
  if (error) return error;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 400 });

  const body = await req.json();
  if (!body.label || !body.type || !body.startDate || body.monthlyAmount == null) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const [created] = await db
    .insert(engagements)
    .values({
      orgId,
      type: body.type,
      label: body.label,
      counterparty: body.counterparty ?? null,
      startDate: body.startDate,
      endDate: body.endDate || null,
      monthlyAmount: String(body.monthlyAmount),
      tacitRenewal: !!body.tacitRenewal,
      earlyExitPenalty: body.earlyExitPenalty != null ? String(body.earlyExitPenalty) : null,
      notes: body.notes ?? null,
    })
    .returning();

  return NextResponse.json({ engagement: created });
}

// ----- PATCH : modifier un engagement -----
export async function PATCH(req: Request) {
  const { orgId, error } = await authenticate(req);
  if (error) return error;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 400 });

  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const payload: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(updates)) {
    if (v === undefined) continue;
    if (k === "monthlyAmount" || k === "earlyExitPenalty") payload[k] = v === null ? null : String(v);
    else if (k === "tacitRenewal") payload[k] = !!v;
    else payload[k] = v;
  }

  await db
    .update(engagements)
    .set(payload)
    .where(and(eq(engagements.id, id), eq(engagements.orgId, orgId)));

  return NextResponse.json({ ok: true });
}

// ----- DELETE : supprimer un engagement -----
export async function DELETE(req: Request) {
  const { orgId, error } = await authenticate(req);
  if (error) return error;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 400 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await db.delete(engagements).where(and(eq(engagements.id, id), eq(engagements.orgId, orgId)));
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