"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const GRADIENT = "linear-gradient(135deg, #6366f1, #8b5cf6 60%, #ec4899)";

export function SmartNav() {
  const [isAuth, setIsAuth] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setIsAuth(!!data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setIsAuth(!!s));
    return () => subscription.unsubscribe();
  }, []);

  return (
    <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,0.8)", backdropFilter: "blur(12px)", borderBottom: "1px solid #f1f5f9" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "#0f172a" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: GRADIENT, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 16 }}>⚡</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>CashOptimize</div>
        </Link>

        {isAuth === null ? (
          <div style={{ width: 200, height: 20 }} />
        ) : isAuth ? (
          <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 14 }}>
            <Link href="/dashboard" style={{ padding: "8px 16px", borderRadius: 10, background: GRADIENT, color: "white", textDecoration: "none", fontWeight: 700, fontSize: 13 }}>← Retour à mon tableau</Link>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 20, alignItems: "center", fontSize: 14 }}>
            <Link href="/" style={{ color: "#475569", textDecoration: "none", fontWeight: 500 }}>Accueil</Link>
            <Link href="/login" style={{ color: "#475569", textDecoration: "none", fontWeight: 500 }}>Connexion</Link>
            <Link href="/signup" style={{ padding: "8px 16px", borderRadius: 10, background: GRADIENT, color: "white", textDecoration: "none", fontWeight: 700, fontSize: 13 }}>Essai gratuit →</Link>
          </div>
        )}
      </div>
    </nav>
  );
}