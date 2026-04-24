import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { users, engagements } from "@/lib/schema";
import { and, eq } from "drizzle-orm";

export const runtime = "nodejs";

async function authenticate(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return NextResponse.json({ error: "Missing auth" }, { status: 401 });
  const token = authHeader.replace("Bearer ", "");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  const [u] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!u?.defaultOrgId) return NextResponse.json({ error: "Aucune organisation" }, { status: 400 });
  return u.defaultOrgId;
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const orgId = await authenticate(req);
    if (typeof orgId !== "string") return orgId;

    const result = await db.delete(engagements)
      .where(and(eq(engagements.id, id), eq(engagements.orgId, orgId)))
      .returning();

    if (result.length === 0) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const orgId = await authenticate(req);
    if (typeof orgId !== "string") return orgId;

    const body = (await req.json()) as { label?: string; monthlyAmount?: number; notes?: string };
    const updates: Record<string, unknown> = {};
    if (body.label !== undefined) updates.label = body.label;
    if (body.monthlyAmount !== undefined) updates.monthlyAmount = body.monthlyAmount.toFixed(2);
    if (body.notes !== undefined) updates.notes = body.notes;
    updates.updatedAt = new Date();

    const result = await db.update(engagements)
      .set(updates)
      .where(and(eq(engagements.id, id), eq(engagements.orgId, orgId)))
      .returning();

    if (result.length === 0) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    return NextResponse.json({ ok: true, engagement: result[0] });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}