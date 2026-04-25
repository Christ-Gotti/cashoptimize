/**
 * GET /api/referrals
 *
 * Renvoie pour le user connecté :
 *   - code        : son code de parrainage (7 chars dérivés de son user.id)
 *   - link        : lien à partager (utilise NEXT_PUBLIC_APP_URL si défini)
 *   - referrals   : liste des filleuls avec status (active | pending | lost)
 *   - totalReferrals    : tous filleuls confondus
 *   - activeReferrals   : filleuls dont l'organisation a un plan payant non résilié
 *   - pendingReferrals  : filleuls en essai gratuit (plan=trial)
 *   - lostReferrals     : filleuls résiliés (plan=canceled)
 *   - discountPercent   : 10 × activeReferrals, capé à 100
 *   - effectivePrice    : 19 × (1 - discountPercent / 100)
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { users, organizations, organizationMembers } from "@/lib/schema";
import { and, eq, inArray } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE_PRICE = 19;
const DISCOUNT_PER_REFERRAL = 10;
const MAX_DISCOUNT = 100;

/** Code de parrainage déterministe : 7 chars dérivés de l'UUID Supabase */
export function codeFromUserId(userId: string): string {
  return userId.replace(/-/g, "").slice(0, 7).toUpperCase();
}

export async function GET(req: Request) {
  try {
    // 1. Auth via Bearer token (cohérent avec le reste de l'app)
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: authData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authData.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const me = authData.user;
    const myCode = codeFromUserId(me.id);

    // 2. Lien à partager (priorité à l'env var, fallback sur l'host de la requête)
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      `${new URL(req.url).protocol}//${new URL(req.url).host}`;
    const link = `${appUrl}/signup?ref=${myCode}`;

    // 3. Trouver tous les users dont user_metadata.referred_by_code === myCode
    const { data: usersList, error: listErr } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listErr) {
      return NextResponse.json({ error: listErr.message }, { status: 500 });
    }

    const myReferralUsers = usersList.users.filter(
      (u) => (u.user_metadata?.referred_by_code as string | undefined) === myCode
    );

    // 4. Pour chaque filleul, on regarde le plan de son organisation
    const referrals: Array<{
      email: string;
      signupDate: string;
      status: "active" | "pending" | "lost";
      plan: string;
    }> = [];

    if (myReferralUsers.length > 0) {
      const ids = myReferralUsers.map((u) => u.id);

      // Récupère pour chaque user son default_org → plan
      const rows = await db
        .select({
          userId: users.id,
          email: users.email,
          createdAt: users.createdAt,
          plan: organizations.plan,
        })
        .from(users)
        .leftJoin(organizations, eq(users.defaultOrgId, organizations.id))
        .where(inArray(users.id, ids));

      const byUserId = new Map(rows.map((r) => [r.userId, r]));

      for (const u of myReferralUsers) {
        const r = byUserId.get(u.id);
        const plan = r?.plan ?? "trial";

        let status: "active" | "pending" | "lost";
        if (plan === "canceled") status = "lost";
        else if (plan === "trial") status = "pending";
        else status = "active"; // starter, pro, business

        referrals.push({
          email: r?.email ?? u.email ?? "—",
          signupDate: (r?.createdAt ?? u.created_at ?? new Date()).toString(),
          status,
          plan,
        });
      }
    }

    // 5. Compteurs et tarif effectif
    const totalReferrals = referrals.length;
    const activeReferrals = referrals.filter((r) => r.status === "active").length;
    const pendingReferrals = referrals.filter((r) => r.status === "pending").length;
    const lostReferrals = referrals.filter((r) => r.status === "lost").length;

    const discountPercent = Math.min(
      activeReferrals * DISCOUNT_PER_REFERRAL,
      MAX_DISCOUNT
    );
    const effectivePrice = +(BASE_PRICE * (1 - discountPercent / 100)).toFixed(2);

    return NextResponse.json({
      code: myCode,
      link,
      referrals,
      totalReferrals,
      activeReferrals,
      pendingReferrals,
      lostReferrals,
      discountPercent,
      effectivePrice,
      basePrice: BASE_PRICE,
    });
  } catch (err) {
    console.error("[GET /api/referrals] ERROR", err);
    return NextResponse.json(
      { error: (err as Error).message ?? "Erreur serveur" },
      { status: 500 }
    );
  }
}