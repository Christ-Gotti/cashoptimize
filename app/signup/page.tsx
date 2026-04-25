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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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

  async function signUpWithGoogle() {
    setGoogleLoading(true);
    setNotice(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setNotice({ tone: "warning", text: "Impossible de se connecter avec Google. Réessaie." });
      setGoogleLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);

    if (password.length < 8) {
      setNotice({ tone: "warning", text: "Mot de passe : 8 caractères minimum." });
      return;
    }
    if (password !== confirmPassword) {
      setNotice({ tone: "warning", text: "Les deux mots de passe ne correspondent pas." });
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

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

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
          <p style={{ color: "#64748b", fontSize: 14, marginTop: 8, marginBottom: 0 }}>Essai 14 jours · sans carte bancaire</p>
        </div>

        {refCode && (
          <div style={{ marginBottom: 20, padding: "12px 14px", borderRadius: 12, border: "1px solid #c7d2fe", background: "linear-gradient(135deg, #eef2ff 0%, #ecfeff 100%)", display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>🎁</span>
            <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700, color: "#1e293b" }}>Tu as été parrainé par <span style={{ color: "#4f46e5" }}>{refCode}</span></div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Ton parrain bénéficiera de -10 % sur son abonnement.</div>
            </div>
          </div>
        )}

        <button onClick={signUpWithGoogle} disabled={googleLoading} type="button" style={googleBtnStyle(googleLoading)}>
          <GoogleIcon />
          <span>{googleLoading ? "Connexion…" : "Continuer avec Google"}</span>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
          <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
          <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, letterSpacing: "0.05em" }}>OU</span>
          <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
        </div>

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Prénom Nom">
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Christophe Gotti" style={inputStyle} onFocus={onInputFocus} onBlur={onInputBlur} />
          </Field>
          <Field label="Email pro">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="toi@entreprise.fr" style={inputStyle} onFocus={onInputFocus} onBlur={onInputBlur} />
          </Field>
          <Field label="Mot de passe">
            <PasswordInput value={password} onChange={setPassword} show={showPassword} onToggle={() => setShowPassword(!showPassword)} placeholder="8 caractères minimum" minLength={8} />
            {password.length > 0 && password.length < 8 && (
              <div style={{ fontSize: 11, color: "#92400e", marginTop: 6 }}>Encore {8 - password.length} caractère{8 - password.length > 1 ? "s" : ""}</div>
            )}
          </Field>
          <Field label="Confirme le mot de passe">
            <PasswordInput value={confirmPassword} onChange={setConfirmPassword} show={showConfirm} onToggle={() => setShowConfirm(!showConfirm)} placeholder="Retape-le" />
            {passwordsMatch && <div style={{ fontSize: 11, color: "#065f46", marginTop: 6 }}>✓ Les mots de passe correspondent</div>}
            {passwordsMismatch && <div style={{ fontSize: 11, color: "#92400e", marginTop: 6 }}>✗ Les mots de passe ne correspondent pas</div>}
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

function PasswordInput({ value, onChange, show, onToggle, placeholder, minLength }: { value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; placeholder: string; minLength?: number }) {
  return (
    <div style={{ position: "relative" }}>
      <input type={show ? "text" : "password"} required minLength={minLength} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, paddingRight: 44 }} onFocus={onInputFocus} onBlur={onInputBlur} />
      <button type="button" onClick={onToggle} aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16, padding: 4 }}>
        {show ? "🙈" : "👁"}
      </button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

const pageStyle: React.CSSProperties = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", padding: 24 };
const cardStyle: React.CSSProperties = { width: "100%", maxWidth: 460, background: "white", borderRadius: 20, border: "1px solid #e2e8f0", padding: "40px 32px", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)" };
const iconStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)", fontSize: 28, marginBottom: 16, color: "white" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "14px 16px", borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 15, color: "#0f172a", background: "white", outline: "none", transition: "border-color 150ms, box-shadow 150ms", boxSizing: "border-box" };
const onInputFocus = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = "#a5b4fc"; e.currentTarget.style.boxShadow = "0 0 0 4px rgba(99, 102, 241, 0.1)"; };
const onInputBlur = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "none"; };

const googleBtnStyle = (disabled: boolean): React.CSSProperties => ({
  width: "100%",
  padding: "12px 16px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  background: "white",
  color: "#0f172a",
  fontSize: 14,
  fontWeight: 600,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.6 : 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  transition: "background 0.15s",
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>{label}</label>
      {children}
    </div>
  );
}