/**
 * GET /auth/callback?code=XXX
 *
 * Route handler côté serveur qui :
 *   1. Reçoit le code OAuth (Google) ou le code de confirmation email
 *   2. L'échange contre une session via Supabase
 *   3. Set le cookie de session côté serveur (proprement)
 *   4. Redirige vers /dashboard (ou /login en cas d'erreur)
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=callback`);
  }

  // Prépare la réponse de redirection (on l'utilisera pour set les cookies)
  const response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] OAuth exchange error:", error.message);
    return NextResponse.redirect(
      `${origin}/login?error=oauth&msg=${encodeURIComponent(error.message)}`
    );
  }

  // Session créée et cookies bien posés → redirige vers dashboard
  return response;
}