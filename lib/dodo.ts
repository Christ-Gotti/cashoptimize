/**
 * Wrapper client pour Dodo Payments (Merchant of Record).
 * Docs : https://docs.dodopayments.com
 *
 *  Particularité : Dodo est MoR → ils facturent le client final,
 *  gèrent la TVA EU, et nous reversent. On stocke côté DB les events
 *  pour maintenir le statut d'abonnement à jour.
 */

import crypto from "crypto";

const DODO_BASE = process.env.DODO_API_BASE ?? "https://api.dodopayments.com";

function headers() {
  if (!process.env.DODO_API_KEY) throw new Error("DODO_API_KEY not set");
  return {
    Authorization: `Bearer ${process.env.DODO_API_KEY}`,
    "Content-Type": "application/json",
  };
}

// ============================================================
// CHECKOUT SESSION
// ============================================================
export type DodoCheckoutParams = {
  productId: string;
  customerEmail: string;
  customerName?: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
  discountCode?: string; // 🎁 code coupon parrainage (REF10, REF20, etc.)
};

export async function createCheckoutSession(
  params: DodoCheckoutParams
): Promise<{ id: string; url: string }> {
  const body: Record<string, unknown> = {
    product_id: params.productId,
    customer: { email: params.customerEmail, name: params.customerName },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: params.metadata ?? {},
  };

  if (params.discountCode) {
    body.discount_code = params.discountCode;
  }

  const res = await fetch(`${DODO_BASE}/v1/checkout/sessions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Dodo checkout failed: ${res.status} ${t}`);
  }
  return (await res.json()) as { id: string; url: string };
}

// ============================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================
export async function cancelSubscription(subscriptionId: string) {
  const res = await fetch(
    `${DODO_BASE}/v1/subscriptions/${subscriptionId}/cancel`,
    {
      method: "POST",
      headers: headers(),
    }
  );
  if (!res.ok) throw new Error(`Dodo cancel failed: ${res.status}`);
  return (await res.json()) as { status: string };
}

export async function createCustomerPortalLink(
  customerId: string,
  returnUrl: string
) {
  const res = await fetch(`${DODO_BASE}/v1/customers/${customerId}/portal`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ return_url: returnUrl }),
  });
  if (!res.ok) throw new Error(`Dodo portal failed: ${res.status}`);
  return (await res.json()) as { url: string };
}

// ============================================================
// WEBHOOK SIGNATURE VERIFICATION
// ============================================================
export function verifyDodoSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  const expected = hmac.update(payload).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ============================================================
// PLAN MAPPING
// ============================================================
/**
 * Résout le plan CashOptimize à partir du Dodo product ID.
 * Pour grille modulaire complexe, il faudrait passer côté line items.
 * Ici on mappe 1 product_id = 1 plan de base, les add-ons sont ajoutés séparément.
 */
export function resolvePlanFromProductId(
  productId: string
): "starter" | "pro" | "business" | null {
  if (productId === process.env.DODO_PRODUCT_ID_STARTER) return "starter";
  if (productId === process.env.DODO_PRODUCT_ID_PRO) return "pro";
  if (productId === process.env.DODO_PRODUCT_ID_BUSINESS) return "business";
  return null;
}