"use client";

import { useState } from "react";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createSupabaseBrowser();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ tone: "info" | "success" | "warning"; text: string } | null>(null);

  /**
   * Traduit les messages Supabase en français, sans jamais révéler
   * si l'email existe ou non (best practice sécurité).
   */
  function friendlyMessage(err: string): { tone: "warning" | "info"; text: string } {
    const msg = err.toLowerCase();

    if (msg.includes("email rate limit") || msg.includes("rate limit")) {
      return {
        tone: "info",
        text: "Tu as déjà fait une demande récemment. Patiente quelques minutes avant de réessayer.",
      };
    }
    if (msg.includes("invalid") && msg.includes("email")) {
      return { tone: "warning", text: "Cette adresse email n'a pas un format valide." };
    }
    if (msg.includes("recovery") || msg.includes("smtp") || msg.includes("sending")) {
      return {
        tone: "info",
        text: "On n'a pas pu envoyer l'email pour l'instant. Réessaie dans quelques minutes, ou contacte le support si le souci persiste.",
      };
    }
    return {
      tone: "info",
      text: "Une erreur temporaire est survenue. Réessaie dans un instant.",
    };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setNotice(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (error) {
      setNotice(friendlyMessage(error.message));
      return;
    }

    // Toujours afficher un message de succès générique (sécurité)
    setNotice({
      tone: "success",
      text: "Si un compte est associé à cette adresse, un lien de réinitialisation vient d'être envoyé. Vérifie ta boîte mail (et tes spams).",
    });
  }

  // Palette douce : jamais de rouge pour ce genre d'écran
  const toneStyles = {
    info: {
      background: "#eff6ff",
      borderColor: "#bfdbfe",
      color: "#1e3a8a",
    },
    success: {
      background: "#ecfdf5",
      borderColor: "#a7f3d0",
      color: "#065f46",
    },
    warning: {
      background: "#fffbeb",
      borderColor: "#fde68a",
      color: "#78350f",
    },
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "440px",
          background: "white",
          borderRadius: "20px",
          border: "1px solid #e2e8f0",
          padding: "40px 32px",
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "64px",
              height: "64px",
              borderRadius: "18px",
              background: "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)",
              fontSize: "28px",
              marginBottom: "16px",
            }}
          >
            🔑
          </div>
          <h1 style={{ fontSize: "26px", fontWeight: 800, color: "#0f172a", margin: 0 }}>
            Mot de passe oublié ?
          </h1>
          <p style={{ color: "#64748b", fontSize: "14px", marginTop: "8px", marginBottom: 0 }}>
            Pas de souci, on t'envoie un lien pour le réinitialiser.
          </p>
        </div>

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label
              htmlFor="email"
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 700,
                color: "#475569",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                marginBottom: "8px",
              }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="toi@entreprise.fr"
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                fontSize: "15px",
                color: "#0f172a",
                background: "white",
                outline: "none",
                transition: "border-color 150ms, box-shadow 150ms",
                boxSizing: "border-box",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#a5b4fc";
                e.currentTarget.style.boxShadow = "0 0 0 4px rgba(99, 102, 241, 0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#e2e8f0";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          {notice && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "12px",
                border: `1px solid ${toneStyles[notice.tone].borderColor}`,
                background: toneStyles[notice.tone].background,
                color: toneStyles[notice.tone].color,
                fontSize: "13.5px",
                lineHeight: "1.5",
              }}
            >
              {notice.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: "12px",
              border: "none",
              background: "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)",
              color: "white",
              fontSize: "15px",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
              transition: "opacity 150ms, transform 150ms",
              boxShadow: "0 8px 24px rgba(99, 102, 241, 0.25)",
            }}
          >
            {loading ? "Envoi en cours…" : "Envoyer le lien →"}
          </button>
        </form>

        <div
          style={{
            marginTop: "24px",
            paddingTop: "20px",
            borderTop: "1px solid #f1f5f9",
            textAlign: "center",
          }}
        >
          <Link
            href="/login"
            style={{
              color: "#6366f1",
              fontSize: "14px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            ← Retour à la connexion
          </Link>
        </div>

        <p style={{ textAlign: "center", color: "#94a3b8", fontSize: "12px", marginTop: "20px", marginBottom: 0 }}>
          Besoin d'aide ? Écris-nous à{" "}
          <a href="mailto:dopeweb.saas@gmail.com" style={{ color: "#6366f1", textDecoration: "none" }}>
            dopeweb.saas@gmail.com
          </a>
        </p>
      </div>
    </div>
  );
}