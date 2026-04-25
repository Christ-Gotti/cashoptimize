/**
 * GET /api/billing/info
 *   Renvoie les infos de facturation du user connecté :
 *   plan, prix de base, prix effectif (après réduction parrainage),
 *   date de renouvellement, status abonnement.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { users, organizations } from "@/lib/schema";
import { eq, inArray } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE_PRICE = 19;
const DISCOUNT_PER_REFERRAL = 10;
const MAX_DISCOUNT = 100;

const PLAN_LABELS: Record<string, string> = {
  trial: "Essai gratuit",
  starter: "Starter",
  pro: "Pro",
  business: "Business",
  canceled: "Résilié",
};

function codeFromUserId(userId: string): string {
  return userId.replace(/-/g, "").slice(0, 7).toUpperCase();
}

export async function GET(req: Request) {
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
    const me = authData.user;

    // Récupère l'org du user
    const [userRow] = await db.select().from(users).where(eq(users.id, me.id)).limit(1);
    if (!userRow?.defaultOrgId) {
      return NextResponse.json({
        plan: "trial",
        planLabel: PLAN_LABELS.trial,
        basePrice: BASE_PRICE,
        effectivePrice: BASE_PRICE,
        discountPercent: 0,
        activeReferrals: 0,
        renewalAt: null,
        hasSubscription: false,
      });
    }

    const [org] = await db.select().from(organizations).where(eq(organizations.id, userRow.defaultOrgId)).limit(1);
    if (!org) return NextResponse.json({ error: "Org introuvable" }, { status: 404 });

    // Compte les filleuls actifs pour la réduction
    const myCode = codeFromUserId(me.id);
    let activeReferrals = 0;
    try {
      const { data: usersList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const filleulsIds = (usersList?.users ?? [])
        .filter((u) => (u.user_metadata?.referred_by_code as string | undefined) === myCode)
        .map((u) => u.id);
      if (filleulsIds.length > 0) {
        const rows = await db
          .select({ plan: organizations.plan })
          .from(users)
          .leftJoin(organizations, eq(users.defaultOrgId, organizations.id))
          .where(inArray(users.id, filleulsIds));
        activeReferrals = rows.filter((r) => ["starter", "pro", "business"].includes(r.plan ?? "")).length;
      }
    } catch (e) {
      console.warn("[billing/info] active referrals calc failed:", e);
    }

    const discountPercent = Math.min(activeReferrals * DISCOUNT_PER_REFERRAL, MAX_DISCOUNT);
    const effectivePrice = +(BASE_PRICE * (1 - discountPercent / 100)).toFixed(2);

    return NextResponse.json({
      plan: org.plan,
      planLabel: PLAN_LABELS[org.plan] ?? org.plan,
      basePrice: BASE_PRICE,
      effectivePrice,
      discountPercent,
      activeReferrals,
      renewalAt: org.planRenewalAt ? new Date(org.planRenewalAt).toISOString() : null,
      hasSubscription: !!org.dodoSubscriptionId && org.plan !== "trial" && org.plan !== "canceled",
    });
  } catch (err) {
    console.error("[GET /api/billing/info]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}