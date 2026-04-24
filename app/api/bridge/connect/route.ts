import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req: Request) {
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

    return NextResponse.json(
      {
        error: "Connexion bancaire Bridge sera activée après validation du compte Bridge production. En attendant, utilise l'import CSV.",
      },
      { status: 501 }
    );
  } catch (err) {
    console.error("[bridge/connect]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}