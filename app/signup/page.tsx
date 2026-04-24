"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const GRADIENT = "linear-gradient(135deg, #6366f1, #8b5cf6 60%, #ec4899)";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/onboarding` },
    });
    if (error) { setError(error.message); setLoading(false); return; }
    if (data.session) router.push("/onboarding");
    else { setSuccess(true); setLoading(false); }
  }

  return (
    <div style={S.page}>
      <div style={S.leftPanel}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.15, backgroundImage: "radial-gradient(circle at 20% 20%, white 0%, transparent 50%), radial-gradient(circle at 80% 80%, white 0%, transparent 50%)" }} />
        <div style={S.leftContent}>
          <div style={S.logo}>
            <div style={S.logoBadge}>⚡</div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>CashOptimize</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>Pilote ton cash</div>
            </div>
          </div>
          <div>
            <h2 style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.15, margin: 0, marginBottom: 32 }}>
              Anticipe tes trous de trésorerie <span style={{ opacity: 0.8 }}>3 mois avant</span> ton banquier.
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 14, opacity: 0.95 }}>
              <Feature icon="🔌" text="Branche tes comptes en 1 clic" />
              <Feature icon="🤖" text="IA qui catégorise et prévoit pour toi" />
              <Feature icon="📊" text="Vue Prévu vs Payé mois par mois" />
              <Feature icon="⚠️" text="Alertes avant les coups durs" />
            </div>
          </div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>19€/mois · sans engagement · TPE françaises</div>
        </div>
      </div>

      <div style={S.rightPanel}>
        <div style={S.formWrap}>
          <h1 style={S.title}>Crée ton compte</h1>
          <p style={S.subtitle}>Essai 14 jours · sans carte bancaire · accès immédiat</p>

          {success ? (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Vérifie ta boîte mail</h3>
              <p style={{ fontSize: 13, color: "#64748b", margin: 0, lineHeight: 1.5 }}>
                On vient d'envoyer un lien à <strong style={{ color: "#0f172a" }}>{email}</strong>.
              </p>
              <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>Clique dessus pour activer ton compte.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Field label="Prénom Nom" type="text" value={fullName} onChange={setFullName} placeholder="Christophe Dupont" />
              <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="toi@entreprise.com" />
              <Field label="Mot de passe" type="password" value={password} onChange={setPassword} placeholder="8 caractères minimum" minLength={8} />
              {error && <div style={S.error}>{error}</div>}
              <button type="submit" disabled={loading} style={{ ...S.button, opacity: loading ? 0.6 : 1 }}>
                {loading ? "Création…" : "Créer mon compte →"}
              </button>
              <p style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", lineHeight: 1.5, margin: 0 }}>
                En continuant, tu acceptes nos CGU et notre politique de confidentialité.
              </p>
            </form>
          )}

          <div style={S.divider}>
            Tu as déjà un compte ?{" "}
            <Link href="/login" style={{ color: "#6366f1", fontWeight: 600, textDecoration: "none" }}>Se connecter</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(255,255,255,0.15)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{icon}</div>
      <span>{text}</span>
    </div>
  );
}

function Field({ label, type, value, onChange, placeholder, minLength }: { label: string; type: string; value: string; onChange: (v: string) => void; placeholder: string; minLength?: number }) {
  return (
    <div>
      <label style={S.label}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} minLength={minLength} required style={S.input} />
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", display: "flex", background: "#f8fafc" },
  leftPanel: { display: "flex", width: "50%", position: "relative", overflow: "hidden", background: GRADIENT, color: "white" },
  leftContent: { position: "relative", zIndex: 10, padding: 48, display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%" },
  logo: { display: "flex", alignItems: "center", gap: 12 },
  logoBadge: { width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 },
  rightPanel: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 48 },
  formWrap: { width: "100%", maxWidth: 420 },
  title: { fontSize: 32, fontWeight: 800, margin: 0, marginBottom: 8, color: "#0f172a" },
  subtitle: { fontSize: 14, color: "#64748b", marginTop: 0, marginBottom: 32 },
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  input: { width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 14, outline: "none", background: "white", color: "#0f172a", boxSizing: "border-box" },
  button: { width: "100%", padding: "14px 16px", borderRadius: 12, border: "none", background: GRADIENT, color: "white", fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: "0 10px 30px rgba(99,102,241,0.3)" },
  error: { padding: 10, borderRadius: 10, background: "#fee2e2", color: "#b91c1c", fontSize: 13, border: "1px solid #fecaca" },
  divider: { marginTop: 24, paddingTop: 24, borderTop: "1px solid #f1f5f9", textAlign: "center", fontSize: 13, color: "#64748b" },
};