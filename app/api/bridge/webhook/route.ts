import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.text();
    console.log("[bridge/webhook] received payload of", body.length, "chars");
    // TODO: vérifier signature + traiter events quand on sera en prod Bridge
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[bridge/webhook]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "bridge webhook endpoint ready" });
}