"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { AppShell } from "@/components/app-shell";

const GRADIENT = "linear-gradient(135deg, #6366f1, #8b5cf6 60%, #ec4899)";

type BillingData = {
  plan: "trial" | "starter" | "pro" | "business" | "canceled";
  planLabel: string;
  basePrice: number;
  effectivePrice: number;
  discountPercent: number;
  activeReferrals: number;
  renewalAt: string | null;
  hasSubscription: boolean;
};

export default function BillingPage() {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [notice, setNotice] = useState<{ tone: "info" | "warning"; text: string } | null>(null);

  async function load() {
    setLoading(true);
    const supabase = createSupabaseBrowser();
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    const res = await fetch("/api/billing/info", {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: "no-store",
    });
    if (res.ok) setData((await res.json()) as BillingData);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function openPortal() {
    setOpeningPortal(true);
    setNotice(null);
    const supabase = createSupabaseBrowser();
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    const res = await fetch("/api/billing/portal", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    setOpeningPortal(false);
    if (!res.ok) {
      setNotice({ tone: "warning", text: "Impossible d'ouvrir le portail de gestion. Réessaie ou contacte-nous." });
      return;
    }
    const { url } = await res.json();
    if (url) window.location.href = url;
  }

  const planInfo = data
    ? PLAN_INFOS[data.plan] ?? PLAN_INFOS.trial
    : PLAN_INFOS.trial;

  return (
    <AppShell>
      <div style={{ padding: 32, maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: GRADIENT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, color: "white" }}>💳</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", margin: 0 }}>Abonnement & facturation</h1>
        </div>
        <p style={{ color: "#64748b", marginTop: 8, marginBottom: 24, fontSize: 15 }}>Gère ton abonnement, ton mode de paiement et tes factures.</p>

        <Link href="/settings" style={{ color: "#6366f1", fontSize: 13, fontWeight: 600, textDecoration: "none", marginBottom: 24, display: "inline-block" }}>← Retour aux paramètres</Link>

        {notice && (
          <div style={{ marginBottom: 20, padding: "12px 14px", borderRadius: 12, border: `1px solid ${notice.tone === "warning" ? "#fde68a" : "#bfdbfe"}`, background: notice.tone === "warning" ? "#fffbeb" : "#eff6ff", color: notice.tone === "warning" ? "#78350f" : "#1e3a8a", fontSize: 13.5 }}>
            {notice.text}
          </div>
        )}

        {/* Plan actuel */}
        <div style={{ background: "white", borderRadius: 16, border: "1px solid #e2e8f0", padding: 28, marginBottom: 20, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -50, right: -50, width: 200, height: 200, borderRadius: "50%", background: planInfo.bgGradient, opacity: 0.08, filter: "blur(40px)" }} />
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.05em", textTransform: "uppercase" }}>Plan actuel</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", margin: 0 }}>{planInfo.label}</h2>
              <span style={{ padding: "4px 10px", borderRadius: 999, background: planInfo.badgeBg, color: planInfo.badgeText, fontSize: 11, fontWeight: 700 }}>{planInfo.badge}</span>
            </div>

            {loading && <div style={{ color: "#94a3b8", marginTop: 16 }}>Chargement…</div>}

            {!loading && data && (
              <>
                <div style={{ marginTop: 20, display: "flex", alignItems: "baseline", gap: 8 }}>
                  {data.discountPercent > 0 && (
                    <span style={{ fontSize: 18, color: "#94a3b8", textDecoration: "line-through" }}>{data.basePrice.toFixed(2)} €</span>
                  )}
                  <span style={{ fontSize: 36, fontWeight: 800, color: "#0f172a" }}>{data.effectivePrice.toFixed(2)} €</span>
                  <span style={{ fontSize: 14, color: "#64748b" }}>/ mois</span>
                </div>

                {data.discountPercent > 0 && (
                  <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", fontSize: 13, display: "inline-block" }}>
                    🎁 <strong>-{data.discountPercent} %</strong> grâce à {data.activeReferrals} filleul{data.activeReferrals > 1 ? "s" : ""} actif{data.activeReferrals > 1 ? "s" : ""}
                  </div>
                )}

                {data.renewalAt && (
                  <div style={{ marginTop: 16, fontSize: 13, color: "#64748b" }}>
                    Prochain renouvellement le <strong style={{ color: "#0f172a" }}>{new Date(data.renewalAt).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })}</strong>
                  </div>
                )}

                <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
                  {data.hasSubscription ? (
                    <button onClick={openPortal} disabled={openingPortal} style={primaryBtn(openingPortal)}>
                      {openingPortal ? "Ouverture…" : "Gérer mon abonnement"}
                    </button>
                  ) : (
                    <Link href="/pricing" style={{ ...primaryBtnStatic, textDecoration: "none", display: "inline-block" }}>
                      Choisir un plan
                    </Link>
                  )}
                  {data.hasSubscription && data.plan !== "business" && (
                    <Link href="/pricing" style={{ ...secondaryBtnStatic, textDecoration: "none", display: "inline-block" }}>
                      Changer de plan
                    </Link>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Section avantages parrainage */}
        {!loading && data && data.activeReferrals < 10 && (
          <div style={{ background: "white", borderRadius: 16, border: "1px solid #e2e8f0", padding: 24, marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: 0 }}>Réduis ta facture</h2>
            <p style={{ fontSize: 14, color: "#64748b", marginTop: 6, marginBottom: 20, lineHeight: 1.6 }}>
              Chaque filleul qui devient client te fait gagner -10 % sur ton abonnement (à vie tant qu'il reste client). 10 filleuls actifs = abonnement gratuit.
            </p>
            <Link href="/referral" style={{ ...secondaryBtnStatic, textDecoration: "none", display: "inline-block" }}>
              🎁 Voir mon programme parrainage
            </Link>
          </div>
        )}

        {/* Info facturation */}
        <div style={{ background: "white", borderRadius: 16, border: "1px solid #e2e8f0", padding: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: 0 }}>Factures et paiement</h2>
          <p style={{ fontSize: 14, color: "#64748b", marginTop: 6, marginBottom: 16, lineHeight: 1.6 }}>
            Tes factures, ton mode de paiement et l'historique de tes prélèvements sont gérés directement chez notre partenaire de paiement Dodo Payments.
          </p>
          {data?.hasSubscription ? (
            <button onClick={openPortal} disabled={openingPortal} style={secondaryBtnStatic}>
              📄 Voir mes factures
            </button>
          ) : (
            <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>Tu n'as pas encore d'abonnement actif. Souscris à un plan pour accéder à tes factures.</p>
          )}
        </div>

        {/* Politique de remboursement */}
        <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 24, textAlign: "center", lineHeight: 1.6 }}>
          Tu peux annuler à tout moment. Pas de frais cachés.{" "}
          <Link href="/legal/refund" style={{ color: "#64748b", textDecoration: "underline" }}>Politique de remboursement</Link>
        </p>
      </div>
    </AppShell>
  );
}

const PLAN_INFOS: Record<BillingData["plan"], { label: string; badge: string; badgeBg: string; badgeText: string; bgGradient: string }> = {
  trial: { label: "Essai gratuit", badge: "TRIAL", badgeBg: "#fef3c7", badgeText: "#92400e", bgGradient: "linear-gradient(135deg, #fbbf24, #f59e0b)" },
  starter: { label: "Starter", badge: "ACTIF", badgeBg: "#ecfdf5", badgeText: "#065f46", bgGradient: GRADIENT },
  pro: { label: "Pro", badge: "ACTIF", badgeBg: "#ecfdf5", badgeText: "#065f46", bgGradient: GRADIENT },
  business: { label: "Business", badge: "ACTIF", badgeBg: "#ecfdf5", badgeText: "#065f46", bgGradient: GRADIENT },
  canceled: { label: "Abonnement résilié", badge: "RÉSILIÉ", badgeBg: "#fee2e2", badgeText: "#991b1b", bgGradient: "linear-gradient(135deg, #94a3b8, #64748b)" },
};

const primaryBtn = (disabled: boolean): React.CSSProperties => ({ padding: "12px 22px", borderRadius: 10, border: "none", background: GRADIENT, color: "white", fontSize: 14, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 });

const primaryBtnStatic: React.CSSProperties = { padding: "12px 22px", borderRadius: 10, border: "none", background: GRADIENT, color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer" };

const secondaryBtnStatic: React.CSSProperties = { padding: "12px 22px", borderRadius: 10, border: "1px solid #e2e8f0", background: "white", color: "#0f172a", fontSize: 14, fontWeight: 600, cursor: "pointer" };