/**
 * DELETE /api/account/delete
 *   Supprime définitivement le compte de l'utilisateur connecté
 *   ainsi que toutes ses données (organisation, transactions, etc.)
 *   via le CASCADE déjà en place sur auth.users.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function DELETE(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    // Client public pour vérifier l'identité
    const supabasePublic = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: authData, error: authErr } = await supabasePublic.auth.getUser(token);
    if (authErr || !authData.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Client admin pour supprimer
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    if (delErr) {
      console.error("[account/delete]", delErr);
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[account/delete]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}