"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function SignupPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#f8fafc" }} />}>
      <SignupInner />
    </Suspense>
  );
}

function SignupInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createSupabaseBrowser();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [refCode, setRefCode] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "info" | "success" | "warning"; text: string } | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      const normalized = ref.trim().toUpperCase().slice(0, 7);
      if (/^[A-Z0-9]{5,7}$/.test(normalized)) {
        setRefCode(normalized);
        try { localStorage.setItem("cashopt_ref", normalized); } catch {}
      }
    } else {
      try {
        const stored = localStorage.getItem("cashopt_ref");
        if (stored && /^[A-Z0-9]{5,7}$/.test(stored)) setRefCode(stored);
      } catch {}
    }
  }, [searchParams]);

  function friendlyError(msg: string): { tone: "warning" | "info"; text: string } {
    const m = msg.toLowerCase();
    if (m.includes("already registered") || m.includes("already exists") || m.includes("user already")) return { tone: "warning", text: "Un compte existe déjà avec cette adresse email." };
    if (m.includes("password") && (m.includes("weak") || m.includes("short"))) return { tone: "warning", text: "Mot de passe trop faible. Minimum 8 caractères." };
    if (m.includes("invalid") && m.includes("email")) return { tone: "warning", text: "Cette adresse email n'a pas un format valide." };
    if (m.includes("rate limit")) return { tone: "info", text: "Trop de tentatives. Patiente quelques minutes avant de réessayer." };
    if (m.includes("database") || m.includes("server")) return { tone: "info", text: "Souci temporaire de notre côté. Réessaie dans un instant." };
    return { tone: "info", text: "Une erreur est survenue. Réessaie dans un instant." };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    if (password.length < 8) {
      setNotice({ tone: "warning", text: "Mot de passe : 8 caractères minimum." });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { full_name: fullName || null, referred_by_code: refCode || null },
      },
    });
    setLoading(false);
    if (error) { setNotice(friendlyError(error.message)); return; }
    try { localStorage.removeItem("cashopt_ref"); } catch {}
    if (data.session) { router.push("/onboarding"); router.refresh(); }
    else { setEmailSent(true); }
  }

  const toneStyles = {
    info: { background: "#eff6ff", borderColor: "#bfdbfe", color: "#1e3a8a" },
    success: { background: "#ecfdf5", borderColor: "#a7f3d0", color: "#065f46" },
    warning: { background: "#fffbeb", borderColor: "#fde68a", color: "#78350f" },
  };

  if (emailSent) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={iconStyle}>📧</div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: 0 }}>Vérifie ta boîte mail</h1>
            <p style={{ color: "#64748b", fontSize: 14, marginTop: 8, marginBottom: 0, lineHeight: 1.6 }}>
              On t'a envoyé un lien de confirmation à <strong style={{ color: "#0f172a" }}>{email}</strong>.<br />
              Clique dessus pour activer ton compte.
            </p>
          </div>
          <div style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e3a8a", fontSize: 13, lineHeight: 1.5, textAlign: "center" }}>
            Tu ne le vois pas ? Vérifie le dossier <strong>spam</strong> ou <strong>promotions</strong>.
          </div>
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #f1f5f9", textAlign: "center" }}>
            <Link href="/login" style={{ color: "#6366f1", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>← Retour à la connexion</Link>
          </div>
          <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 12, marginTop: 20, marginBottom: 0 }}>
            Besoin d'aide ? <a href="mailto:dopeweb.saas@gmail.com?subject=Aide%20CashOptimize" style={{ color: "#6366f1", textDecoration: "none", fontWeight: 600 }}>Contactez-nous</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={iconStyle}>⚡</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: 0 }}>Crée ton compte</h1>
          <p style={{ color: "#64748b", fontSize: 14, marginTop: 8, marginBottom: 0 }}>Essai 14 jours · sans carte bancaire · accès immédiat</p>
        </div>

        {refCode && (
          <div style={{ marginBottom: 20, padding: "12px 14px", borderRadius: 12, border: "1px solid #c7d2fe", background: "linear-gradient(135deg, #eef2ff 0%, #ecfeff 100%)", display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>🎁</span>
            <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700, color: "#1e293b" }}>Tu as été parrainé par <span style={{ color: "#4f46e5" }}>{refCode}</span></div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Ton parrain bénéficiera de -10 % sur son abonnement quand tu deviendras client.</div>
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Prénom Nom">
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Christophe Gotti" style={inputStyle} onFocus={onInputFocus} onBlur={onInputBlur} />
          </Field>
          <Field label="Email pro">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="toi@entreprise.fr" style={inputStyle} onFocus={onInputFocus} onBlur={onInputBlur} />
          </Field>
          <Field label="Mot de passe">
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8 caractères minimum" style={inputStyle} onFocus={onInputFocus} onBlur={onInputBlur} />
          </Field>

          {notice && (
            <div style={{ padding: "12px 14px", borderRadius: 12, border: `1px solid ${toneStyles[notice.tone].borderColor}`, background: toneStyles[notice.tone].background, color: toneStyles[notice.tone].color, fontSize: 13.5, lineHeight: 1.5 }}>
              {notice.text}
            </div>
          )}

          <button type="submit" disabled={loading} style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)", color: "white", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, transition: "opacity 150ms", boxShadow: "0 8px 24px rgba(99, 102, 241, 0.25)" }}>
            {loading ? "Création…" : "Créer mon compte →"}
          </button>
        </form>

        <p style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 14, marginBottom: 0, textAlign: "center", lineHeight: 1.5 }}>
          En créant un compte, tu acceptes nos <Link href="/legal/terms" style={{ color: "#64748b", textDecoration: "underline" }}>CGU</Link> et notre <Link href="/legal/privacy" style={{ color: "#64748b", textDecoration: "underline" }}>politique de confidentialité</Link>.
        </p>

        <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #f1f5f9", textAlign: "center" }}>
          <span style={{ fontSize: 14, color: "#64748b" }}>Déjà un compte ? </span>
          <Link href="/login" style={{ color: "#6366f1", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>Connecte-toi</Link>
        </div>

        <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 12, marginTop: 20, marginBottom: 0 }}>
          Besoin d'aide ? <a href="mailto:dopeweb.saas@gmail.com?subject=Aide%20CashOptimize" style={{ color: "#6366f1", textDecoration: "none", fontWeight: 600 }}>Contactez-nous</a>
        </p>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", padding: 24 };
const cardStyle: React.CSSProperties = { width: "100%", maxWidth: 460, background: "white", borderRadius: 20, border: "1px solid #e2e8f0", padding: "40px 32px", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)" };
const iconStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)", fontSize: 28, marginBottom: 16, color: "white" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "14px 16px", borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 15, color: "#0f172a", background: "white", outline: "none", transition: "border-color 150ms, box-shadow 150ms", boxSizing: "border-box" };
const onInputFocus = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = "#a5b4fc"; e.currentTarget.style.boxShadow = "0 0 0 4px rgba(99, 102, 241, 0.1)"; };
const onInputBlur = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "none"; };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>{label}</label>
      {children}
    </div>
  );
}