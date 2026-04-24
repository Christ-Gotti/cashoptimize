import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

// Génère un code court depuis un user.id UUID
export function codeFromUserId(userId: string): string {
  return userId.replace(/-/g, "").slice(0, 7).toUpperCase();
}

export async function GET(req: Request) {
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

    const myCode = codeFromUserId(user.id);

    // Liste tous les users qui ont referred_by_code = myCode
    const { data: allUsers, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) throw listErr;

    const referrals = (allUsers.users ?? []).filter((u) => {
      const meta = u.user_metadata as Record<string, unknown> | undefined;
      return meta?.referred_by_code === myCode;
    });

    // Check quels filleuls ont une org active (= signup complet)
    const referralsData = await Promise.all(
      referrals.map(async (r) => {
        const [row] = await db.select({ defaultOrgId: users.defaultOrgId }).from(users).where(eq(users.id, r.id)).limit(1);
        return {
          email: r.email,
          signupDate: r.created_at,
          hasOrg: !!row?.defaultOrgId,
        };
      })
    );

    const activeCount = referralsData.filter((r) => r.hasOrg).length;
    const discountPercent = Math.min(activeCount * 10, 100);
    const effectivePrice = Math.max(0, 19 * (1 - discountPercent / 100));

    return NextResponse.json({
      code: myCode,
      link: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://cashoptimize.com"}/signup?ref=${myCode}`,
      totalReferrals: referrals.length,
      activeReferrals: activeCount,
      discountPercent,
      effectivePrice,
      referrals: referralsData.map((r) => ({
        email: r.email,
        signupDate: r.signupDate,
        status: r.hasOrg ? "active" : "pending",
      })),
    });
  } catch (err) {
    console.error("[referrals]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}