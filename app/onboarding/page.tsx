"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

const GRADIENT = "linear-gradient(135deg, #6366f1, #8b5cf6 60%, #ec4899)";

const INDUSTRIES = [
  "Services aux entreprises",
  "Commerce / e-commerce",
  "Restauration / hôtellerie",
  "BTP / construction",
  "Conseil / freelance",
  "Tech / SaaS",
  "Santé / bien-être",
  "Industrie / production",
  "Autre",
];

const COMPANY_SIZES = [
  { value: "solo", label: "Juste moi", emoji: "👤" },
  { value: "2-5", label: "2-5 personnes", emoji: "👥" },
  { value: "6-10", label: "6-10 personnes", emoji: "🏢" },
  { value: "10+", label: "10+", emoji: "🏛" },
];

type Step = "welcome" | "business" | "data" | "ready";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [firstName, setFirstName] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [size, setSize] = useState("");
  const [saving, setSaving] = useState(false);

  // Récupère le prénom du user
  useEffect(() => {
    async function load() {
      const supabase = createSupabaseBrowser();
      const { data } = await supabase.auth.getUser();
      const fn = (data.user?.user_metadata?.full_name as string | undefined) ?? data.user?.email ?? "";
      const firstWord = fn.split(/[\s@]/)[0];
      setFirstName(firstWord || "");

      // Pré-remplit le nom d'entreprise s'il existe déjà
      const company = (data.user?.user_metadata?.company_name as string | undefined) ?? "";
      if (company) setCompanyName(company);
    }
    load();
  }, []);

  async function saveAndComplete() {
    setSaving(true);
    const supabase = createSupabaseBrowser();
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;

    await fetch("/api/onboarding/complete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ companyName, industry, size }),
    });
    setSaving(false);
    setStep("ready");
  }

  function goToDashboard() {
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 640, background: "white", borderRadius: 24, border: "1px solid #e2e8f0", padding: 40, boxShadow: "0 4px 24px rgba(15, 23, 42, 0.06)" }}>
        <ProgressBar current={step} />

        {step === "welcome" && (
          <Step
            icon="👋"
            title={firstName ? `Bienvenue ${firstName} !` : "Bienvenue !"}
            description="On va configurer CashOptimize en 90 secondes pour qu'il pilote ta tréso comme tu le mérites. Trois petites questions et c'est parti."
          >
            <PrimaryButton onClick={() => setStep("business")}>C'est parti →</PrimaryButton>
          </Step>
        )}

        {step === "business" && (
          <Step
            icon="🏢"
            title="Parle-moi de ton entreprise"
            description="Ces infos servent à personnaliser tes prévisions et tes catégories."
          >
            <Field label="Nom de l'entreprise">
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ma Société SARL"
                style={inputStyle}
                onFocus={onFocus}
                onBlur={onBlur}
              />
            </Field>
            <Field label="Secteur d'activité">
              <select value={industry} onChange={(e) => setIndustry(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="">Choisis ton secteur</option>
                {INDUSTRIES.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
              </select>
            </Field>
            <Field label="Taille de l'équipe">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                {COMPANY_SIZES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSize(s.value)}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: `2px solid ${size === s.value ? "#6366f1" : "#e2e8f0"}`,
                      background: size === s.value ? "#eef2ff" : "white",
                      color: "#0f172a",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      transition: "all 0.15s",
                    }}
                  >
                    <span>{s.emoji}</span>
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </Field>

            <Navigation
              onBack={() => setStep("welcome")}
              onNext={() => setStep("data")}
              nextDisabled={!companyName || !industry || !size}
            />
          </Step>
        )}

        {step === "data" && (
          <Step
            icon="📊"
            title="Connecte tes données"
            description="Pour piloter ta tréso, on a besoin de ta réalité financière. Trois options :"
          >
            <OptionCard
              icon="🏦"
              title="Connecter ma banque"
              description="Synchronisation automatique en lecture seule (DSP2). Le plus rapide."
              recommended
              onClick={() => router.push("/banks?from=onboarding")}
            />
            <OptionCard
              icon="📥"
              title="Importer un CSV"
              description="Tu as un export bancaire ? Glisse-dépose, on s'occupe de la catégorisation."
              onClick={() => router.push("/import?from=onboarding")}
            />
            <OptionCard
              icon="✨"
              title="Plus tard, je veux juste explorer"
              description="On te crée un environnement de démo pour tester l'app."
              onClick={saveAndComplete}
              loading={saving}
            />

            <div style={{ marginTop: 16 }}>
              <button onClick={() => setStep("business")} style={ghostBtn}>← Retour</button>
            </div>
          </Step>
        )}

        {step === "ready" && (
          <Step
            icon="🚀"
            title="Tu es prêt !"
            description="CashOptimize est configuré. Tu peux maintenant explorer ton dashboard, générer ton premier forecast IA, et configurer tes alertes."
          >
            <PrimaryButton onClick={goToDashboard}>Aller au dashboard →</PrimaryButton>

            <div style={{ marginTop: 24, padding: 16, borderRadius: 12, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a", fontSize: 13.5, lineHeight: 1.6 }}>
              💡 <strong>Premier réflexe</strong> : va sur le <strong>Tableau P&L</strong> et clique sur <strong>"Générer le forecast IA"</strong>. Tu auras tes prévisions sur 6 mois en 30 secondes.
            </div>
          </Step>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function ProgressBar({ current }: { current: Step }) {
  const steps: Step[] = ["welcome", "business", "data", "ready"];
  const idx = steps.indexOf(current);
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 32 }}>
      {steps.map((s, i) => (
        <div
          key={s}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 999,
            background: i <= idx ? GRADIENT : "#e2e8f0",
            transition: "background 0.3s",
          }}
        />
      ))}
    </div>
  );
}

function Step({ icon, title, description, children }: { icon: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 56, marginBottom: 16, lineHeight: 1 }}>{icon}</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", margin: 0, lineHeight: 1.2 }}>{title}</h1>
      <p style={{ fontSize: 15, color: "#64748b", marginTop: 12, marginBottom: 28, lineHeight: 1.6 }}>{description}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>{label}</label>
      {children}
    </div>
  );
}

function OptionCard({ icon, title, description, recommended, onClick, loading }: { icon: string; title: string; description: string; recommended?: boolean; onClick: () => void; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        textAlign: "left",
        width: "100%",
        padding: 16,
        borderRadius: 14,
        border: `2px solid ${recommended ? "#a5b4fc" : "#e2e8f0"}`,
        background: recommended ? "linear-gradient(135deg, #eef2ff 0%, #faf5ff 100%)" : "white",
        cursor: loading ? "wait" : "pointer",
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        position: "relative",
        opacity: loading ? 0.6 : 1,
        transition: "all 0.15s",
      }}
    >
      <div style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
          {title}
          {recommended && <span style={{ fontSize: 10, fontWeight: 700, color: "#4338ca", background: "#e0e7ff", padding: "2px 8px", borderRadius: 999 }}>RECOMMANDÉ</span>}
        </div>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 4, lineHeight: 1.5 }}>{description}</div>
      </div>
      <div style={{ color: "#6366f1", fontSize: 18, alignSelf: "center" }}>→</div>
    </button>
  );
}

function PrimaryButton({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: "100%",
      padding: "14px 22px",
      borderRadius: 12,
      border: "none",
      background: GRADIENT,
      color: "white",
      fontSize: 15,
      fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      boxShadow: "0 8px 24px rgba(99, 102, 241, 0.25)",
    }}>
      {children}
    </button>
  );
}

function Navigation({ onBack, onNext, nextDisabled, nextLabel }: { onBack: () => void; onNext: () => void; nextDisabled?: boolean; nextLabel?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
      <button onClick={onBack} style={ghostBtn}>← Retour</button>
      <button onClick={onNext} disabled={nextDisabled} style={{
        padding: "12px 20px",
        borderRadius: 10,
        border: "none",
        background: GRADIENT,
        color: "white",
        fontSize: 14,
        fontWeight: 700,
        cursor: nextDisabled ? "not-allowed" : "pointer",
        opacity: nextDisabled ? 0.5 : 1,
        boxShadow: "0 4px 12px rgba(99, 102, 241, 0.25)",
      }}>
        {nextLabel ?? "Continuer →"}
      </button>
    </div>
  );
}

const ghostBtn: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "none",
  background: "transparent",
  color: "#64748b",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 14, color: "#0f172a", background: "white", outline: "none", transition: "border-color 150ms, box-shadow 150ms", boxSizing: "border-box" };

const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.currentTarget.style.borderColor = "#a5b4fc"; e.currentTarget.style.boxShadow = "0 0 0 4px rgba(99, 102, 241, 0.1)"; };
const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "none"; };