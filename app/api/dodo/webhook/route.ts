import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { organizations } from "@/lib/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

function verifySignature(body: string, headers: Headers): boolean {
  const secret = process.env.DODO_WEBHOOK_SECRET;
  if (!secret) return true; // pas de secret → on skip la vérif (dev)

  const signature = headers.get("webhook-signature");
  const webhookId = headers.get("webhook-id");
  const webhookTimestamp = headers.get("webhook-timestamp");
  if (!signature || !webhookId || !webhookTimestamp) return false;

  const cleanSecret = secret.replace(/^whsec_/, "");
  const signedPayload = `${webhookId}.${webhookTimestamp}.${body}`;
  let expected: string;
  try {
    expected = crypto.createHmac("sha256", Buffer.from(cleanSecret, "base64")).update(signedPayload).digest("base64");
  } catch {
    expected = crypto.createHmac("sha256", cleanSecret).update(signedPayload).digest("base64");
  }

  const sigs = signature.split(" ").map((s) => s.split(",")[1]);
  return sigs.includes(expected);
}

type DodoEvent = {
  type: string;
  data?: {
    object?: {
      id?: string;
      status?: string;
      customer?: { email?: string };
      metadata?: { org_id?: string; user_id?: string };
    };
  };
};

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const isValid = verifySignature(body, req.headers);
    if (!isValid) {
      console.warn("[dodo/webhook] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(body) as DodoEvent;
    const orgId = event.data?.object?.metadata?.org_id;

    console.log(`[dodo/webhook] ${event.type}`, { orgId, status: event.data?.object?.status });

    if (!orgId) {
      return NextResponse.json({ received: true, note: "No org_id in metadata" });
    }

    const t = event.type;

    if (t === "subscription.created" || t === "subscription.active" || t === "subscription.renewed" || t === "payment.succeeded") {
      await db.update(organizations)
        .set({ plan: "starter", updatedAt: new Date() })
        .where(eq(organizations.id, orgId));
    } else if (t === "subscription.canceled" || t === "subscription.failed") {
      await db.update(organizations)
        .set({ plan: "canceled", updatedAt: new Date() })
        .where(eq(organizations.id, orgId));
    } else if (t === "subscription.on_hold" || t === "subscription.expired" || t === "payment.failed") {
      await db.update(organizations)
        .set({ plan: "trial", updatedAt: new Date() })
        .where(eq(organizations.id, orgId));
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[dodo/webhook]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}