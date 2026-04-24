"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const GRADIENT = "linear-gradient(135deg, #6366f1, #8b5cf6 60%, #ec4899)";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setSent(true);
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "#f8fafc", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420, background: "white", borderRadius: 20, padding: 40, boxShadow: "0 4px 30px rgba(15,23,42,0.06)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ display: "inline-flex", width: 48, height: 48, borderRadius: 12, background: GRADIENT, alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 16 }}>🔑</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: "#0f172a" }}>Mot de passe oublié ?</h1>
          <p style={{ fontSize: 14, color: "#64748b", marginTop: 8 }}>
            Pas de souci, on t&apos;envoie un lien pour le réinitialiser.
          </p>
        </div>

        {sent ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📬</div>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Check ta boîte mail</h3>
            <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
              On a envoyé un lien à <strong>{email}</strong>. Clique dessus pour définir un nouveau mot de passe.
            </p>
            <Link href="/login" style={{ display: "inline-block", marginTop: 20, color: "#6366f1", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
              ← Retour à la connexion
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="toi@entreprise.com"
                  required
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 14, outline: "none", background: "white", boxSizing: "border-box" }}
                />
              </div>

              {error && <div style={{ padding: 10, borderRadius: 10, background: "#fee2e2", color: "#b91c1c", fontSize: 13 }}>{error}</div>}

              <button
                type="submit"
                disabled={loading}
                style={{ padding: "14px 16px", borderRadius: 12, border: "none", background: GRADIENT, color: "white", fontWeight: 700, fontSize: 15, cursor: "pointer", opacity: loading ? 0.6 : 1, boxShadow: "0 10px 30px rgba(99,102,241,0.3)" }}
              >
                {loading ? "Envoi…" : "Envoyer le lien →"}
              </button>
            </form>

            <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid #f1f5f9", textAlign: "center", fontSize: 13, color: "#64748b" }}>
              <Link href="/login" style={{ color: "#6366f1", fontWeight: 600, textDecoration: "none" }}>← Retour à la connexion</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}