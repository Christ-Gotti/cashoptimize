/**
 * POST /api/billing/portal
 *   Génère un lien vers le Customer Portal Dodo
 *   pour gérer abonnement, paiement, factures.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { users, organizations } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { createCustomerPortalLink } from "@/lib/dodo";

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

    const [userRow] = await db.select().from(users).where(eq(users.id, authData.user.id)).limit(1);
    if (!userRow?.defaultOrgId) return NextResponse.json({ error: "Pas d'org" }, { status: 400 });

    const [org] = await db.select().from(organizations).where(eq(organizations.id, userRow.defaultOrgId)).limit(1);
    if (!org?.dodoCustomerId) return NextResponse.json({ error: "Pas d'abonnement actif" }, { status: 400 });

    const { url } = await createCustomerPortalLink(
      org.dodoCustomerId,
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`
    );

    return NextResponse.json({ url });
  } catch (err) {
    console.error("[POST /api/billing/portal]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}