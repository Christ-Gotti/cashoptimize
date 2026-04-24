// app/api/bridge/diagnose/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const clientId = process.env.BRIDGE_CLIENT_ID!;
  const clientSecret = process.env.BRIDGE_CLIENT_SECRET!;
  const version = process.env.BRIDGE_API_VERSION ?? "2025-01-15";

  const baseHeaders = {
    "Client-Id": clientId,
    "Client-Secret": clientSecret,
    "Bridge-Version": version,
    "Content-Type": "application/json",
  };

  // 1. Créer un user de diagnostic
  const userRes = await fetch("https://api.bridgeapi.io/v3/aggregation/users", {
    method: "POST",
    headers: baseHeaders,
    body: JSON.stringify({ external_user_id: `diag-${Date.now()}` }),
  });
  if (!userRes.ok) {
    return NextResponse.json({ step: "createUser", status: userRes.status, error: (await userRes.text()).slice(0, 300) }, { status: 500 });
  }
  const { uuid: userUuid } = await userRes.json();

  // 2. Récupérer un token d'auth pour ce user
  const tokenRes = await fetch("https://api.bridgeapi.io/v3/aggregation/authorization/token", {
    method: "POST",
    headers: baseHeaders,
    body: JSON.stringify({ user_uuid: userUuid }),
  });
  if (!tokenRes.ok) {
    return NextResponse.json({ step: "getToken", status: tokenRes.status, error: (await tokenRes.text()).slice(0, 300) }, { status: 500 });
  }
  const { access_token } = await tokenRes.json();

  const authHeaders = { ...baseHeaders, Authorization: `Bearer ${access_token}` };

  // 3. Tester plusieurs variantes de body pour connect-sessions
  const variants: Array<{ name: string; body: Record<string, unknown> }> = [
    { name: "empty_body", body: {} },
    { name: "user_email_only", body: { user_email: "test@example.com" } },
    { name: "user_uuid_only", body: { user_uuid: userUuid } },
    { name: "prefilled_email", body: { prefilled_email: "test@example.com" } },
    { name: "user_obj", body: { user: { email: "test@example.com" } } },
    { name: "country_code", body: { country_code: "FR" } },
    { name: "email_and_country", body: { user_email: "test@example.com", country_code: "FR" } },
  ];

  const results: Array<Record<string, unknown>> = [];
  for (const v of variants) {
    try {
      const r = await fetch("https://api.bridgeapi.io/v3/aggregation/connect-sessions", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(v.body),
      });
      const text = await r.text();
      results.push({
        variant: v.name,
        status: r.status,
        ok: r.ok,
        bodySent: v.body,
        response: text.slice(0, 400),
      });
    } catch (err) {
      results.push({ variant: v.name, error: (err as Error).message });
    }
  }

  return NextResponse.json({
    bridgeUserCreated: userUuid,
    tokenReceived: !!access_token,
    variantsTested: results,
  }, { status: 200 });
}