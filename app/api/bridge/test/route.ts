// app/api/bridge/test/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const clientId = process.env.BRIDGE_CLIENT_ID;
  const clientSecret = process.env.BRIDGE_CLIENT_SECRET;
  const version = process.env.BRIDGE_API_VERSION ?? "2025-01-15";

  if (!clientId || !clientSecret) {
    return NextResponse.json({
      ok: false,
      error: "Missing BRIDGE_CLIENT_ID or BRIDGE_CLIENT_SECRET in .env.local",
    }, { status: 500 });
  }

  try {
    const res = await fetch("https://api.bridgeapi.io/v3/aggregation/users?limit=1", {
      headers: {
        "Client-Id": clientId,
        "Client-Secret": clientSecret,
        "Bridge-Version": version,     // ← renommé de Bankin-Version vers Bridge-Version
        "Content-Type": "application/json",
      },
    });

    const text = await res.text();

    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      version,
      clientIdPreview: clientId.slice(0, 12) + "…",
      bridgeResponse: text.slice(0, 400),
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: (err as Error).message,
    }, { status: 500 });
  }
}