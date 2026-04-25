"use client";

export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    async function handleCallback() {
      const supabase = createSupabaseBrowser();

      // Cas 1 : OAuth (Google) → code dans les query params
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error("[auth/callback] OAuth exchange error:", error);
          router.replace("/login?error=oauth");
          return;
        }

        // Si un ref code traîne en localStorage et que le user n'en a pas, on le sauve
        try {
          const storedRef = localStorage.getItem("cashopt_ref");
          if (storedRef && /^[A-Z0-9]{5,7}$/.test(storedRef)) {
            const { data: userData } = await supabase.auth.getUser();
            const existingRef = userData.user?.user_metadata?.referred_by_code;
            if (!existingRef) {
              await supabase.auth.updateUser({ data: { referred_by_code: storedRef } });
            }
            localStorage.removeItem("cashopt_ref");
          }
        } catch {}

        router.replace("/dashboard");
        return;
      }

      // Cas 2 : Email confirmation → tokens dans le hash de l'URL
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          console.error("[auth/callback] setSession error:", error);
          router.replace("/login?error=callback");
          return;
        }
        router.replace("/dashboard");
        return;
      }

      // Aucun code ni token → lien expiré ou accès direct
      router.replace("/login");
    }

    handleCallback();
  }, [router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: "linear-gradient(135deg, #6366f1, #8b5cf6 60%, #ec4899)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 26,
          color: "white",
        }}
      >
        ⚡
      </div>
      <div style={{ color: "#64748b", fontSize: 14 }}>Connexion en cours…</div>
    </div>
  );
}