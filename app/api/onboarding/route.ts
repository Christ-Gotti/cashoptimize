import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { users, organizations, organizationMembers } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { sendWelcomeEmail } from "@/lib/email";

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

    if (userRow.defaultOrgId) {
      return NextResponse.json({ ok: true, orgId: userRow.defaultOrgId, existing: true });
    }

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

    await db.insert(organizationMembers).values({
      orgId: org.id,
      userId: user.id,
      role: "owner",
    });

    await db.update(users).set({ defaultOrgId: org.id }).where(eq(users.id, user.id));

    // Envoi email bienvenue (non bloquant)
    if (user.email) {
      sendWelcomeEmail({
        to: user.email,
        firstName: (user.user_metadata?.full_name as string)?.split(" ")[0],
        orgName: org.name,
      }).catch((e) => console.error("[onboarding] welcome email failed:", e));
    }

    return NextResponse.json({ ok: true, orgId: org.id });
  } catch (err) {
    console.error("[onboarding]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}