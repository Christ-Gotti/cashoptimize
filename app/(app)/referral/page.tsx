"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { AppShell } from "@/components/app-shell";

const GRADIENT = "linear-gradient(135deg, #6366f1, #8b5cf6 60%, #ec4899)";

type Referral = {
  email: string;
  signupDate: string;
  status: "active" | "pending" | "lost";
  plan: string;
};

type Data = {
  code: string;
  link: string;
  totalReferrals: number;
  activeReferrals: number;
  pendingReferrals: number;
  lostReferrals: number;
  discountPercent: number;
  effectivePrice: number;
  basePrice: number;
  referrals: Referral[];
};

const STATUS_STYLES: Record<Referral["status"], { bg: string; color: string; label: string }> = {
  active: { bg: "#ecfdf5", color: "#065f46", label: "Actif (-10%)" },
  pending: { bg: "#fef3c7", color: "#92400e", label: "En essai" },
  lost: { bg: "#fee2e2", color: "#991b1b", label: "Résilié" },
};

export default function ReferralPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;

    const res = await fetch("/api/referrals", {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: "no-store",
    });

    if (res.ok) {
      const json = (await res.json()) as Data;
      setData(json);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function copyLink() {
    if (!data?.link) return;
    try {
      await navigator.clipboard.writeText(data.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard refusée */
    }
  }

  const isLoading = loading || !data;

  return (
    <AppShell>
      <div style={{ padding: "32px", maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "8px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: GRADIENT,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "26px",
            }}
          >
            🎁
          </div>
          <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a", margin: 0 }}>
            Programme parrainage
          </h1>
        </div>
        <p style={{ color: "#64748b", marginTop: "8px", marginBottom: "32px", fontSize: "15px", lineHeight: 1.6 }}>
          Partage ton lien. Pour chaque filleul qui devient client payant, tu gagnes{" "}
          <strong style={{ color: "#0f172a" }}>-10 % sur ton abonnement</strong>, tant qu'il reste client. Jusqu'à 10
          filleuls actifs = <strong style={{ color: "#0f172a" }}>abonnement offert</strong>.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
          <KpiCard label="Filleuls en attente" value={data?.pendingReferrals ?? 0} accent="#d97706" loading={isLoading} />
          <KpiCard label="Filleuls actifs" value={data?.activeReferrals ?? 0} accent="#059669" loading={isLoading} />
          <KpiCard label="Réduction actuelle" value={`${data?.discountPercent ?? 0}%`} accent="#6366f1" loading={isLoading} />
          <KpiCard label="Ton prix" value={`${(data?.effectivePrice ?? 19).toFixed(2)} €/mois`} accent="#0f172a" loading={isLoading} highlight />
        </div>

        <Card>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "12px" }}>
            Ton lien de parrainage
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <div
              style={{
                flex: 1,
                padding: "14px 16px",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                fontFamily: "monospace",
                fontSize: "14px",
                color: "#0f172a",
                overflowX: "auto",
                whiteSpace: "nowrap",
              }}
            >
              {data?.link ?? "—"}
            </div>
            <button
              onClick={copyLink}
              disabled={!data?.link}
              style={{
                padding: "0 24px",
                borderRadius: "12px",
                border: "none",
                background: GRADIENT,
                color: "white",
                fontWeight: 700,
                fontSize: "14px",
                cursor: data?.link ? "pointer" : "not-allowed",
                opacity: data?.link ? 1 : 0.5,
                whiteSpace: "nowrap",
              }}
            >
              {copied ? "✅ Copié !" : "📋 Copier"}
            </button>
          </div>
          <div style={{ marginTop: "12px", fontSize: "13px", color: "#64748b" }}>
            Ton code : <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#6366f1" }}>{data?.code ?? "—"}</span>
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", marginBottom: "20px" }}>
            Tes filleuls ({data?.totalReferrals ?? 0})
          </div>

          {isLoading && (
            <div style={{ color: "#64748b", textAlign: "center", padding: "32px" }}>Chargement…</div>
          )}

          {!isLoading && data && data.referrals.length === 0 && (
            <div style={{ color: "#64748b", textAlign: "center", padding: "32px", fontSize: "14px" }}>
              Pas encore de filleul. Partage ton lien avec tes clients ou amis entrepreneurs !
            </div>
          )}

          {!isLoading && data && data.referrals.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {data.referrals.map((r, i) => {
                const style = STATUS_STYLES[r.status];
                const date = new Date(r.signupDate).toLocaleDateString("fr-FR", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                });
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "14px 16px",
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      background: "white",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: "#0f172a", fontSize: "14px" }}>{r.email}</div>
                      <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "2px" }}>Inscrit le {date}</div>
                    </div>
                    <div
                      style={{
                        padding: "4px 12px",
                        borderRadius: "999px",
                        background: style.bg,
                        color: style.color,
                        fontSize: "12px",
                        fontWeight: 700,
                      }}
                    >
                      {style.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div
          style={{
            marginTop: "24px",
            padding: "16px 20px",
            borderRadius: "12px",
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            color: "#1e3a8a",
            fontSize: "13.5px",
            lineHeight: 1.6,
          }}
        >
          <strong>Comment ça marche :</strong> ta réduction est calculée chaque mois selon le nombre de filleuls
          actuellement payants. Si un filleul résilie, sa contribution de -10 % disparaît automatiquement le mois
          suivant. Aucune action de ta part — tout est calculé en temps réel.
        </div>
      </div>
    </AppShell>
  );
}

function KpiCard({
  label,
  value,
  accent,
  loading,
  highlight,
}: {
  label: string;
  value: string | number;
  accent: string;
  loading?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        padding: "20px",
        borderRadius: "16px",
        border: "1px solid #e2e8f0",
        background: highlight ? "linear-gradient(135deg, #f8fafc, #ffffff)" : "white",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          fontWeight: 700,
          color: "#64748b",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          marginBottom: "12px",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "24px", fontWeight: 800, color: accent }}>
        {loading ? "…" : value}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "24px",
        borderRadius: "16px",
        border: "1px solid #e2e8f0",
        background: "white",
        marginBottom: "20px",
      }}
    >
      {children}
    </div>
  );
}