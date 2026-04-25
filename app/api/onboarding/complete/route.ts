/**
 * POST /api/onboarding/complete
 *   Met à jour l'organisation du user avec les infos d'onboarding
 *   et marque l'onboarding comme complété.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { users, organizations } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: authData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authData.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const body = (await req.json()) as { companyName?: string; industry?: string; size?: string };

    const [userRow] = await db.select().from(users).where(eq(users.id, authData.user.id)).limit(1);
    if (!userRow?.defaultOrgId) return NextResponse.json({ error: "Pas d'org" }, { status: 400 });

    await db.update(organizations)
      .set({
        name: body.companyName?.trim() || sql`name`,
        industry: body.industry || null,
        settings: sql`COALESCE(settings, '{}'::jsonb) || jsonb_build_object('size', ${body.size ?? null}, 'onboarding_completed', true)`,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, userRow.defaultOrgId));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/onboarding/complete]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}