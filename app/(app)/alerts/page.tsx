"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { AppShell } from "@/components/app-shell";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const GRADIENT = "linear-gradient(135deg, #6366f1, #8b5cf6 60%, #ec4899)";

type Alert = {
  id: string;
  severity: "critical" | "warning" | "info";
  icon: string;
  title: string;
  message: string;
  month?: string;
  amount?: number;
  actionLabel?: string;
  actionHref?: string;
};

type Data = {
  cashNow: number;
  alerts: Alert[];
  projection: Array<{ month: string; cash: number }>;
};

const SEVERITY_STYLES = {
  critical: { bg: "#fef2f2", border: "#fecaca", title: "#991b1b", accent: "#dc2626" },
  warning: { bg: "#fffbeb", border: "#fde68a", title: "#92400e", accent: "#f59e0b" },
  info: { bg: "#eff6ff", border: "#bfdbfe", title: "#1e40af", accent: "#3b82f6" },
} as const;

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export default function AlertsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Non connecté");
        return;
      }
      const res = await fetch("/api/alerts", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Erreur");
      setData(body);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const criticalCount = data?.alerts.filter(a => a.severity === "critical").length ?? 0;
  const warningCount = data?.alerts.filter(a => a.severity === "warning").length ?? 0;

  return (
    <AppShell>
      <div style={{ padding: 32, maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, background: GRADIENT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🔔</span>
              Alertes anticipées
            </h1>
            <p style={{ fontSize: 14, color: "#64748b", marginTop: 6 }}>
              Claude scanne tes 12 prochains mois pour détecter les risques avant qu&apos;ils n&apos;arrivent.
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              background: "white",
              fontSize: 13,
              fontWeight: 600,
              color: "#475569",
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Analyse…" : "🔄 Actualiser"}
          </button>
        </div>

        {/* Summary */}
        {data && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
            <SummaryCard label="Trésorerie actuelle" value={fmt(data.cashNow)} color="#6366f1" />
            <SummaryCard label="Critiques" value={criticalCount.toString()} color={criticalCount > 0 ? "#dc2626" : "#10b981"} />
            <SummaryCard label="Avertissements" value={warningCount.toString()} color={warningCount > 0 ? "#f59e0b" : "#10b981"} />
            <SummaryCard label="Tréso dans 12 mois" value={fmt(data.projection[data.projection.length - 1]?.cash ?? 0)} color={(data.projection[data.projection.length - 1]?.cash ?? 0) < 0 ? "#dc2626" : "#10b981"} />
          </div>
        )}

        {error && (
          <div style={{ padding: 14, borderRadius: 10, background: "#fee2e2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {loading && !data && <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Analyse en cours…</div>}

        {/* Alerts */}
        {data && data.alerts.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {data.alerts.map((a) => {
              const style = SEVERITY_STYLES[a.severity];
              return (
                <div key={a.id} style={{
                  padding: 20,
                  borderRadius: 14,
                  background: style.bg,
                  border: `1px solid ${style.border}`,
                  display: "flex",
                  gap: 14,
                  alignItems: "flex-start",
                }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: style.accent,
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    flexShrink: 0,
                  }}>
                    {a.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 800, color: style.title, margin: 0 }}>{a.title}</h3>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: style.accent,
                        color: "white",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}>
                        {a.severity === "critical" ? "Critique" : a.severity === "warning" ? "Attention" : "Info"}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: "#475569", margin: 0, lineHeight: 1.6 }}>
                      {a.message}
                    </p>
                    {a.actionLabel && a.actionHref && (
                      <Link
                        href={a.actionHref}
                        style={{
                          display: "inline-block",
                          marginTop: 12,
                          padding: "8px 16px",
                          borderRadius: 8,
                          background: style.accent,
                          color: "white",
                          textDecoration: "none",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {a.actionLabel} →
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Projection chart */}
        {data && data.projection.length > 0 && (
          <div style={{ marginTop: 32, padding: 20, background: "white", borderRadius: 14, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Projection trésorerie 12 mois</div>
            <ProjectionChart points={data.projection} />
          </div>
        )}
      </div>
    </AppShell>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ padding: 14, background: "white", borderRadius: 12, border: "1px solid #e2e8f0" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function ProjectionChart({ points }: { points: Array<{ month: string; cash: number }> }) {
  const w = 800;
  const h = 180;
  const pad = { top: 16, right: 16, bottom: 24, left: 56 };
  const iw = w - pad.left - pad.right;
  const ih = h - pad.top - pad.bottom;

  const values = points.map(p => p.cash);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;

  const xAt = (i: number) => pad.left + (iw * i) / Math.max(points.length - 1, 1);
  const yAt = (v: number) => pad.top + ih * (1 - (v - min) / range);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(p.cash)}`).join(" ");
  const zeroY = yAt(0);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {/* Negative zone */}
      {min < 0 && (
        <rect x={pad.left} y={zeroY} width={iw} height={pad.top + ih - zeroY} fill="#fef2f2" />
      )}
      <line x1={pad.left} y1={zeroY} x2={w - pad.right} y2={zeroY} stroke="#cbd5e1" strokeDasharray="4 4" strokeWidth={1} />
      <text x={pad.left - 6} y={zeroY + 4} fontSize={10} fill="#94a3b8" textAnchor="end">0€</text>
      <text x={pad.left - 6} y={pad.top + 4} fontSize={10} fill="#94a3b8" textAnchor="end">{fmt(max)}</text>
      <text x={pad.left - 6} y={pad.top + ih + 4} fontSize={10} fill="#94a3b8" textAnchor="end">{fmt(min)}</text>

      <path d={line} fill="none" stroke="#6366f1" strokeWidth={2.5} />
      {points.map((p, i) => (
        <circle key={p.month} cx={xAt(i)} cy={yAt(p.cash)} r={3} fill={p.cash < 0 ? "#dc2626" : "#6366f1"} />
      ))}
    </svg>
  );
}