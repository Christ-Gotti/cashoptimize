import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { users, organizations, organizationMembers } from "@/lib/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

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

    const body = (await req.json()) as { name?: string; siret?: string; industry?: string };
    if (!body.name || body.name.trim().length === 0) {
      return NextResponse.json({ error: "Nom de l'entreprise requis" }, { status: 400 });
    }

    // Crée user row si pas existe (trigger devrait le faire, mais on sécurise)
    let [userRow] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (!userRow) {
      [userRow] = await db
        .insert(users)
        .values({
          id: user.id,
          email: user.email ?? `${user.id}@unknown.local`,
          fullName: (user.user_metadata?.full_name as string) ?? null,
        })
        .returning();
    }

    // Si il a déjà une org par défaut, on le laisse passer
    if (userRow.defaultOrgId) {
      return NextResponse.json({ ok: true, orgId: userRow.defaultOrgId, existing: true });
    }

    // Crée l'organisation
    const [org] = await db
      .insert(organizations)
      .values({
        name: body.name.trim(),
        siret: body.siret?.trim() || null,
        industry: body.industry?.trim() || null,
        country: "FR",
        currency: "EUR",
        plan: "trial",
      })
      .returning();

    // Lie user → org en tant qu'owner
    await db.insert(organizationMembers).values({
      orgId: org.id,
      userId: user.id,
      role: "owner",
    });

    // Set defaultOrgId
    await db.update(users).set({ defaultOrgId: org.id }).where(eq(users.id, user.id));

    return NextResponse.json({ ok: true, orgId: org.id });
  } catch (err) {
    console.error("[onboarding]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}