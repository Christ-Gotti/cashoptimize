"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const GRADIENT = "linear-gradient(135deg, #6366f1, #8b5cf6 60%, #ec4899)";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);

  // Supabase met la session quand l'user arrive via le lien email
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    // Vérifie si déjà connecté (session active)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caractères");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setSuccess(true);
    setLoading(false);
    setTimeout(() => router.push("/dashboard"), 2000);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "#f8fafc", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420, background: "white", borderRadius: 20, padding: 40, boxShadow: "0 4px 30px rgba(15,23,42,0.06)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ display: "inline-flex", width: 48, height: 48, borderRadius: 12, background: GRADIENT, alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 16 }}>🔐</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: "#0f172a" }}>Nouveau mot de passe</h1>
          <p style={{ fontSize: 14, color: "#64748b", marginTop: 8 }}>
            Choisis un nouveau mot de passe solide.
          </p>
        </div>

        {success ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Mot de passe mis à jour</h3>
            <p style={{ fontSize: 13, color: "#64748b" }}>Redirection vers ton tableau de bord…</p>
          </div>
        ) : !ready ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: "#64748b", fontSize: 14 }}>
            Validation du lien… Si cette page reste bloquée, ton lien est peut-être expiré. <Link href="/forgot-password" style={{ color: "#6366f1", fontWeight: 600 }}>Demander un nouveau lien</Link>.
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>Nouveau mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8 caractères minimum"
                minLength={8}
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Confirmer</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Retape le même mot de passe"
                minLength={8}
                required
                style={inputStyle}
              />
            </div>

            {error && <div style={{ padding: 10, borderRadius: 10, background: "#fee2e2", color: "#b91c1c", fontSize: 13 }}>{error}</div>}

            <button
              type="submit"
              disabled={loading}
              style={{ padding: "14px 16px", borderRadius: 12, border: "none", background: GRADIENT, color: "white", fontWeight: 700, fontSize: 15, cursor: "pointer", opacity: loading ? 0.6 : 1, boxShadow: "0 10px 30px rgba(99,102,241,0.3)" }}
            >
              {loading ? "Mise à jour…" : "Changer mon mot de passe →"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 14, outline: "none", background: "white", color: "#0f172a", boxSizing: "border-box" };