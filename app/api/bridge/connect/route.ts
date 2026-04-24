// app/api/bridge/connect/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { users, organizations } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { authenticateUser, createBridgeUser, createConnectSession } from "@/lib/bridge";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return NextResponse.json({ error: "Missing auth" }, { status: 401 });
    const token = authHeader.replace("Bearer ", "");

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const [userRow] = await db.select().from(users).where(eq(users.id, user.id));
    const orgId = userRow?.defaultOrgId;
    if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

    const settings = (org.settings as Record<string, unknown>) ?? {};
    let bridgeUserUuid = settings.bridgeUserUuid as string | undefined;

    if (!bridgeUserUuid) {
      console.log("[bridge/connect] Creating Bridge user for org", orgId);
      const bridgeUser = await createBridgeUser(orgId);
      bridgeUserUuid = bridgeUser.uuid;
      await db.update(organizations)
        .set({ settings: { ...settings, bridgeUserUuid } })
        .where(eq(organizations.id, orgId));
    }

    const { access_token } = await authenticateUser(bridgeUserUuid);
    const { url } = await createConnectSession({
      accessToken: access_token,
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/banks?connect=success`,
      userEmail: user.email ?? `user-${user.id}@cashoptimize.local`,
      country: "fr",
    });

    return NextResponse.json({ redirectUrl: url });
  } catch (err) {
    console.error("[bridge/connect]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}