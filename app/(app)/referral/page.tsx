"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { AppShell } from "@/components/app-shell";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const GRADIENT = "linear-gradient(135deg, #6366f1, #8b5cf6 60%, #ec4899)";

type Data = {
  code: string;
  link: string;
  totalReferrals: number;
  activeReferrals: number;
  discountPercent: number;
  effectivePrice: number;
  referrals: Array<{ email: string; signupDate: string; status: "active" | "pending" }>;
};

export default function ReferralPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/referrals", { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function copyLink() {
    if (!data) return;
    navigator.clipboard.writeText(data.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <AppShell>
      <div style={{ padding: 32, maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: GRADIENT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🎁</span>
            Programme parrainage
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", marginTop: 6 }}>
            Partage ton lien. Chaque client que tu ramènes te fait gagner <strong>-10%</strong> à vie. Jusqu&apos;à 10 parrains = <strong>gratuit à vie</strong>.
          </p>
        </div>

        {loading && <div style={{ padding: 32, textAlign: "center", color: "#64748b" }}>Chargement…</div>}

        {data && (
          <>
            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
              <Kpi label="Filleuls en attente" value={`${data.totalReferrals - data.activeReferrals}`} color="#f59e0b" />
              <Kpi label="Filleuls actifs" value={`${data.activeReferrals}`} color="#10b981" />
              <Kpi label="Réduction actuelle" value={`${data.discountPercent}%`} color="#6366f1" />
              <Kpi label="Ton prix" value={`${data.effectivePrice.toFixed(2)} €/mois`} color={data.effectivePrice === 0 ? "#10b981" : "#0f172a"} />
            </div>

            {/* Lien de parrainage */}
            <div style={{ padding: 24, background: "white", borderRadius: 16, border: "1px solid #e2e8f0", marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Ton lien de parrainage</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  readOnly
                  value={data.link}
                  style={{ flex: 1, minWidth: 280, padding: "12px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "monospace", background: "#f8fafc", color: "#0f172a" }}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={copyLink}
                  style={{ padding: "12px 20px", borderRadius: 10, border: "none", background: copied ? "#10b981" : GRADIENT, color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                >
                  {copied ? "✓ Copié" : "📋 Copier"}
                </button>
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 12 }}>
                Ton code : <strong style={{ fontFamily: "monospace", color: "#6366f1" }}>{data.code}</strong>
              </div>
            </div>

            {/* Filleuls */}
            <div style={{ background: "white", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", fontWeight: 700, fontSize: 14 }}>Tes filleuls ({data.referrals.length})</div>
              {data.referrals.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: "#64748b", fontSize: 13 }}>
                  Pas encore de filleul. Partage ton lien avec tes clients ou amis entrepreneurs !
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th style={th}>Email</th>
                      <th style={th}>Date d&apos;inscription</th>
                      <th style={{ ...th, textAlign: "right" }}>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.referrals.map((r, i) => (
                      <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                        <td style={{ padding: 14 }}>{r.email}</td>
                        <td style={{ padding: 14, color: "#64748b", fontSize: 12 }}>
                          {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(r.signupDate))}
                        </td>
                        <td style={{ padding: 14, textAlign: "right" }}>
                          <span style={{
                            padding: "3px 10px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            background: r.status === "active" ? "#ecfdf5" : "#fef3c7",
                            color: r.status === "active" ? "#065f46" : "#92400e",
                          }}>
                            {r.status === "active" ? "✓ Actif" : "⏳ En attente"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ padding: 16, background: "white", borderRadius: 12, border: "1px solid #e2e8f0" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

const th: React.CSSProperties = { padding: 12, textAlign: "left", fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5 };