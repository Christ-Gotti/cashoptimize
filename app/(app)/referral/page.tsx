/**
 * POST /api/dodo/webhook
 *   - subscription.created    → active le plan + envoie email confirmation
 *   - subscription.updated    → maintient le plan
 *   - subscription.cancelled  → passe à "canceled" (le parrain perd ses 10%)
 *   - subscription.renewed    → renouvelle, garde le plan
 *   - invoice.paid            → log
 *   - invoice.payment_failed  → log warning
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { verifyDodoSignature, resolvePlanFromProductId } from "@/lib/dodo";

type DodoEvent = {
  type:
    | "subscription.created"
    | "subscription.updated"
    | "subscription.cancelled"
    | "subscription.renewed"
    | "invoice.paid"
    | "invoice.payment_failed";
  data: {
    id: string;
    customer_id?: string;
    product_id?: string;
    status?: string;
    current_period_end?: string;
    metadata?: Record<string, string>;
  };
};

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("Dodo-Signature");

  if (!sig || !process.env.DODO_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }
  if (!verifyDodoSignature(body, sig, process.env.DODO_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(body) as DodoEvent;
  const orgId = event.data.metadata?.org_id;

  if (!orgId) {
    return NextResponse.json({ ok: true, note: "No org_id in metadata" });
  }

  switch (event.type) {
    case "subscription.created":
    case "subscription.updated":
    case "subscription.renewed": {
      const plan = event.data.product_id ? resolvePlanFromProductId(event.data.product_id) : null;
      await db
        .update(organizations)
        .set({
          plan: plan ?? "trial",
          dodoCustomerId: event.data.customer_id ?? null,
          dodoSubscriptionId: event.data.id,
          planRenewalAt: event.data.current_period_end ? new Date(event.data.current_period_end) : null,
        })
        .where(eq(organizations.id, orgId));
      break;
    }

    case "subscription.cancelled":
      await db
        .update(organizations)
        .set({ plan: "canceled", dodoSubscriptionId: null })
        .where(eq(organizations.id, orgId));
      break;

    case "invoice.payment_failed":
      console.warn(`[dodo/webhook] Payment failed for org ${orgId}`);
      break;

    case "invoice.paid":
      // Optional: log/analytics
      break;
  }

  return NextResponse.json({ ok: true });
}