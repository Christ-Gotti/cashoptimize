"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#f8fafc" }} />}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createSupabaseBrowser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [notice, setNotice] = useState<{ tone: "info" | "success" | "warning"; text: string } | null>(null);

  const nextPath = searchParams.get("next") || "/dashboard";

  function friendlyError(msg: string): { tone: "warning" | "info"; text: string } {
    const m = msg.toLowerCase();
    if (m.includes("invalid login") || m.includes("invalid credentials")) return { tone: "warning", text: "Email ou mot de passe incorrect." };
    if (m.includes("email not confirmed")) return { tone: "warning", text: "Tu n'as pas encore confirmé ton email. Vérifie ta boîte mail." };
    if (m.includes("rate limit")) return { tone: "info", text: "Trop de tentatives. Patiente quelques minutes avant de réessayer." };
    if (m.includes("network") || m.includes("fetch")) return { tone: "info", text: "Souci de connexion. Vérifie ton réseau et réessaie." };
    return { tone: "info", text: "Une erreur est survenue. Réessaie dans un instant." };
  }

  async function loginWithGoogle() {
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

  async function loginWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setNotice(friendlyError(error.message)); return; }
    router.push(nextPath);
    router.refresh();
  }

  async function loginWithMagicLink() {
    if (!email) {
      setNotice({ tone: "warning", text: "Saisis ton email d'abord." });
      return;
    }
    setMagicLoading(true);
    setNotice(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setMagicLoading(false);
    if (error) { setNotice(friendlyError(error.message)); return; }
    setNotice({ tone: "success", text: "Lien magique envoyé. Vérifie ta boîte mail (et tes spams)." });
  }

  const toneStyles = {
    info: { background: "#eff6ff", borderColor: "#bfdbfe", color: "#1e3a8a" },
    success: { background: "#ecfdf5", borderColor: "#a7f3d0", color: "#065f46" },
    warning: { background: "#fffbeb", borderColor: "#fde68a", color: "#78350f" },
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={iconStyle}>⚡</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: 0 }}>Bon retour 👋</h1>
          <p style={{ color: "#64748b", fontSize: 14, marginTop: 8, marginBottom: 0 }}>Connecte-toi pour piloter ta tréso.</p>
        </div>

        {/* Bouton Google */}
        <button onClick={loginWithGoogle} disabled={googleLoading} type="button" style={googleBtnStyle(googleLoading)}>
          <GoogleIcon />
          <span>{googleLoading ? "Connexion…" : "Continuer avec Google"}</span>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
          <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
          <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, letterSpacing: "0.05em" }}>OU</span>
          <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
        </div>

        <form onSubmit={loginWithPassword} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Email">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="toi@entreprise.fr" style={inputStyle} onFocus={onInputFocus} onBlur={onInputBlur} />
          </Field>
          <Field label="Mot de passe">
            <PasswordInput value={password} onChange={setPassword} show={showPassword} onToggle={() => setShowPassword(!showPassword)} placeholder="••••••••" />
          </Field>

          <div style={{ textAlign: "right", marginTop: -8 }}>
            <Link href="/forgot-password" style={{ color: "#6366f1", fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}>Mot de passe oublié ?</Link>
          </div>

          {notice && (
            <div style={{ padding: "12px 14px", borderRadius: 12, border: `1px solid ${toneStyles[notice.tone].borderColor}`, background: toneStyles[notice.tone].background, color: toneStyles[notice.tone].color, fontSize: 13.5, lineHeight: 1.5 }}>
              {notice.text}
            </div>
          )}

          <button type="submit" disabled={loading} style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)", color: "white", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, transition: "opacity 150ms", boxShadow: "0 8px 24px rgba(99, 102, 241, 0.25)" }}>
            {loading ? "Connexion…" : "Se connecter →"}
          </button>
        </form>

        <button onClick={loginWithMagicLink} disabled={magicLoading} type="button" style={{ width: "100%", marginTop: 12, padding: "12px 16px", borderRadius: 12, border: "1px solid #e2e8f0", background: "white", color: "#0f172a", fontSize: 13.5, fontWeight: 600, cursor: magicLoading ? "not-allowed" : "pointer", opacity: magicLoading ? 0.6 : 1 }}>
          {magicLoading ? "Envoi…" : "✨ Recevoir un lien magique par email"}
        </button>

        <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #f1f5f9", textAlign: "center" }}>
          <span style={{ fontSize: 14, color: "#64748b" }}>Pas encore de compte ? </span>
          <Link href="/signup" style={{ color: "#6366f1", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>Crée ton accès</Link>
        </div>
      </div>
    </div>
  );
}

function PasswordInput({ value, onChange, show, onToggle, placeholder }: { value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; placeholder: string }) {
  return (
    <div style={{ position: "relative" }}>
      <input type={show ? "text" : "password"} required value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, paddingRight: 44 }} onFocus={onInputFocus} onBlur={onInputBlur} />
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