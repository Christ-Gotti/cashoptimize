// app/api/bridge/inspect/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations } from "@/lib/schema";
import { authenticateUser } from "@/lib/bridge";

export const dynamic = "force-dynamic";

export async function GET() {
  const orgs = await db.select().from(organizations).limit(1);
  const org = orgs[0];
  if (!org) return NextResponse.json({ error: "No org" }, { status: 404 });

  const settings = (org.settings as Record<string, unknown>) ?? {};
  const bridgeUserUuid = settings.bridgeUserUuid as string | undefined;
  if (!bridgeUserUuid) return NextResponse.json({ error: "No Bridge user UUID in org settings" }, { status: 400 });

  const { access_token } = await authenticateUser(bridgeUserUuid);

  const commonHeaders = {
    "Client-Id": process.env.BRIDGE_CLIENT_ID!,
    "Client-Secret": process.env.BRIDGE_CLIENT_SECRET!,
    "Bridge-Version": process.env.BRIDGE_API_VERSION ?? "2025-01-15",
    Authorization: `Bearer ${access_token}`,
    "Content-Type": "application/json",
  };

  // Test plusieurs endpoints possibles pour les transactions
  const endpoints = [
    "https://api.bridgeapi.io/v3/aggregation/transactions",
    "https://api.bridgeapi.io/v3/aggregation/transactions?limit=500",
    "https://api.bridgeapi.io/v3/aggregation/transactions/updated",
    "https://api.bridgeapi.io/v3/aggregation/accounts",
    "https://api.bridgeapi.io/v3/aggregation/items",
  ];

  const results = [];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers: commonHeaders });
      const text = await res.text();
      let parsed: unknown = null;
      try { parsed = JSON.parse(text); } catch {}
      const p = parsed as Record<string, unknown> | null;
      const resources = p?.resources as unknown[] | undefined;
      results.push({
        url: url.replace("https://api.bridgeapi.io", ""),
        status: res.status,
        ok: res.ok,
        responseKeys: p ? Object.keys(p) : null,
        resourcesCount: Array.isArray(resources) ? resources.length : null,
        pagination: p?.pagination ?? null,
        firstResource: Array.isArray(resources) && resources.length > 0 ? resources[0] : null,
        rawPreview: text.slice(0, 300),
      });
    } catch (err) {
      results.push({ url, error: (err as Error).message });
    }
  }

  return NextResponse.json({
    bridgeUserUuid: bridgeUserUuid.slice(0, 8) + "…",
    tokenPreview: access_token.slice(0, 10) + "…",
    endpoints: results,
  });
}