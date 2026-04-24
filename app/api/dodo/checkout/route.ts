import { NextResponse } from "next/server";
import DodoPayments from "dodopayments";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { users, organizations } from "@/lib/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // ---- Auth ----
    // Auth : essaie Bearer header, sinon cookie Supabase
let user = null;
const authHeader = req.headers.get("Authorization");
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

if (authHeader) {
  const token = authHeader.replace("Bearer ", "");
  const { data } = await admin.auth.getUser(token);
  user = data.user;
}

if (!user) {
  // Fallback : essaie de lire la session via cookies Supabase
  try {
    const { createServerClient } = await import("@supabase/ssr");
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const srv = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );
    const { data } = await srv.auth.getUser();
    user = data.user;
  } catch (e) {
    console.warn("[checkout] cookie auth failed", e);
  }
}

if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // ---- Récup org ----
    const [userRow] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    const orgId = userRow?.defaultOrgId;
    if (!orgId) return NextResponse.json({ error: "Aucune organisation liée" }, { status: 400 });

    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
    if (!org) return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 });

    // ---- Env vars ----
    const productId = process.env.DODO_PRODUCT_ID_STARTER;
    if (!productId) return NextResponse.json({ error: "DODO_PRODUCT_ID_STARTER manquant dans .env" }, { status: 500 });
    if (!process.env.DODO_API_KEY) return NextResponse.json({ error: "DODO_API_KEY manquant dans .env" }, { status: 500 });

    // ---- Création session Dodo ----
    const dodo = new DodoPayments({
      bearerToken: process.env.DODO_API_KEY,
      environment: process.env.DODO_MODE === "live" ? "live_mode" : "test_mode",
    });

    const origin = req.headers.get("origin") ?? new URL(req.url).origin;

    const session = await dodo.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: {
        email: user.email!,
        name: userRow.fullName ?? org.name,
      },
      metadata: {
        org_id: orgId,
        user_id: user.id,
      },
      return_url: `${origin}/dashboard?subscription=success`,
    });

    // Le SDK peut retourner checkout_url ou url selon la version, on sécurise
    const rawSession = session as unknown as Record<string, unknown>;
    const checkoutUrl = (rawSession.checkout_url as string) ?? (rawSession.url as string) ?? (rawSession.payment_link as string);
    if (!checkoutUrl) {
      console.error("[dodo/checkout] No URL in response:", session);
      return NextResponse.json({ error: "URL de checkout absente (voir logs serveur)" }, { status: 500 });
    }

    return NextResponse.json({ checkoutUrl });
  } catch (err) {
    console.error("[dodo/checkout]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}