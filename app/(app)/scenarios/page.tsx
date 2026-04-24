"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { AppShell } from "@/components/app-shell";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const GRADIENT = "linear-gradient(135deg, #6366f1, #8b5cf6 60%, #ec4899)";

type AdjType = "hire" | "revenue_change" | "delay_payment" | "loan_injection" | "custom";

type Adjustment = {
  id: string;
  type: AdjType;
  label: string;
  amount: number;
  startMonth: string;
  durationMonths: number;
};

type ProjPoint = { month: string; baselineCash: number; scenarioCash: number; delta: number };

type SimResult = {
  cashNow: number;
  horizon: number;
  projection: ProjPoint[];
  kpis: {
    finalBaseline: number;
    finalScenario: number;
    finalDelta: number;
    minBaseline: number;
    minScenario: number;
    baselineInRedMonths: number;
    scenarioInRedMonths: number;
  };
};

const PRESETS: Array<{ type: AdjType; icon: string; label: string; amount: number; duration: number; color: string }> = [
  { type: "hire", icon: "👥", label: "Embauche salarié", amount: -3000, duration: 12, color: "#ef4444" },
  { type: "revenue_change", icon: "📈", label: "Nouveau client récurrent", amount: 1500, duration: 12, color: "#10b981" },
  { type: "loan_injection", icon: "💰", label: "Injection emprunt", amount: 50000, duration: 1, color: "#6366f1" },
  { type: "custom", icon: "💳", label: "Charge mensuelle", amount: -500, duration: 6, color: "#f59e0b" },
];

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}
function monthLabel(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" }).format(new Date(iso));
}

export default function ScenariosPage() {
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [result, setResult] = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [horizon, setHorizon] = useState(12);

  const currentMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }, []);

  const simulate = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ adjustments, horizon }),
      });
      const body = await res.json();
      if (res.ok) setResult(body);
    } finally {
      setLoading(false);
    }
  }, [adjustments, horizon]);

  useEffect(() => { simulate(); }, [simulate]);

  function addPreset(preset: typeof PRESETS[number]) {
    setAdjustments((a) => [...a, {
      id: Math.random().toString(36).slice(2),
      type: preset.type,
      label: preset.label,
      amount: preset.amount,
      startMonth: currentMonth,
      durationMonths: preset.duration,
    }]);
  }

  function updateAdj(id: string, patch: Partial<Adjustment>) {
    setAdjustments((a) => a.map(adj => adj.id === id ? { ...adj, ...patch } : adj));
  }

  function removeAdj(id: string) {
    setAdjustments((a) => a.filter(adj => adj.id !== id));
  }

  return (
    <AppShell>
      <div style={{ padding: 32, maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: GRADIENT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🧙</span>
            Simulateur de scénarios
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", marginTop: 6 }}>
            Ajoute des hypothèses (embauche, emprunt, nouveau client…) et vois instantanément l&apos;impact sur ta trésorerie.
          </p>
        </div>

        {/* Add preset buttons */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
          {PRESETS.map((p) => (
            <button
              key={p.type + p.label}
              onClick={() => addPreset(p)}
              style={{
                padding: "10px 16px",
                borderRadius: 12,
                border: `1px solid ${p.color}33`,
                background: `${p.color}0F`,
                color: p.color,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 16 }}>{p.icon}</span>
              + {p.label}
            </button>
          ))}
        </div>

        {/* Adjustments list */}
        {adjustments.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
              Tes hypothèses ({adjustments.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {adjustments.map((adj) => (
                <div key={adj.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 10, padding: 14, background: "white", borderRadius: 12, border: "1px solid #e2e8f0", alignItems: "center" }}>
                  <input
                    type="text"
                    value={adj.label}
                    onChange={(e) => updateAdj(adj.id, { label: e.target.value })}
                    style={{ padding: 8, border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, outline: "none" }}
                  />
                  <div>
                    <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 2 }}>Montant/mois</label>
                    <input
                      type="number"
                      value={adj.amount}
                      onChange={(e) => updateAdj(adj.id, { amount: parseFloat(e.target.value) || 0 })}
                      style={{ padding: 8, border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, width: "100%", outline: "none" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 2 }}>À partir de</label>
                    <input
                      type="month"
                      value={adj.startMonth.slice(0, 7)}
                      onChange={(e) => updateAdj(adj.id, { startMonth: `${e.target.value}-01` })}
                      style={{ padding: 8, border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, width: "100%", outline: "none" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 2 }}>Durée (mois)</label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={adj.durationMonths}
                      onChange={(e) => updateAdj(adj.id, { durationMonths: parseInt(e.target.value) || 1 })}
                      style={{ padding: 8, border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, width: "100%", outline: "none" }}
                    />
                  </div>
                  <button
                    onClick={() => removeAdj(adj.id)}
                    style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #fecaca", background: "white", color: "#dc2626", cursor: "pointer", fontSize: 13 }}
                  >🗑</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Horizon */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5 }}>Horizon</label>
          <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 10, padding: 4 }}>
            {[6, 12, 18, 24].map(h => (
              <button key={h} onClick={() => setHorizon(h)} style={{
                padding: "6px 14px", borderRadius: 8, border: "none",
                background: horizon === h ? "white" : "transparent",
                fontWeight: 600, fontSize: 13, cursor: "pointer",
                color: horizon === h ? "#6366f1" : "#64748b",
                boxShadow: horizon === h ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}>{h} mois</button>
            ))}
          </div>
          {loading && <span style={{ fontSize: 12, color: "#94a3b8" }}>Simulation…</span>}
        </div>

        {/* KPIs */}
        {result && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
            <Kpi label="Tréso finale (baseline)" value={fmt(result.kpis.finalBaseline)} color="#64748b" />
            <Kpi label="Tréso finale (scénario)" value={fmt(result.kpis.finalScenario)} color={result.kpis.finalScenario >= 0 ? "#10b981" : "#ef4444"} />
            <Kpi label="Impact du scénario" value={(result.kpis.finalDelta >= 0 ? "+" : "") + fmt(result.kpis.finalDelta)} color={result.kpis.finalDelta >= 0 ? "#10b981" : "#ef4444"} />
            <Kpi label="Mois en négatif" value={`${result.kpis.scenarioInRedMonths} / ${result.projection.length}`} color={result.kpis.scenarioInRedMonths > 0 ? "#ef4444" : "#10b981"} />
          </div>
        )}

        {/* Graph */}
        {result && result.projection.length > 0 && (
          <div style={{ background: "white", borderRadius: 16, border: "1px solid #e2e8f0", padding: 24, marginBottom: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Trésorerie cumulée · Baseline vs Scénario</div>
            <Chart projection={result.projection} />
            <div style={{ display: "flex", gap: 20, marginTop: 12, fontSize: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 14, height: 3, background: "#94a3b8", borderRadius: 2 }} />
                <span style={{ color: "#475569" }}>Baseline (ton Prévu actuel)</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 14, height: 3, background: "#6366f1", borderRadius: 2 }} />
                <span style={{ color: "#475569" }}>Avec tes hypothèses</span>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        {result && (
          <div style={{ background: "white", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "auto" }}>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: 10, textAlign: "left", fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Mois</th>
                  <th style={{ padding: 10, textAlign: "right", fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Baseline</th>
                  <th style={{ padding: 10, textAlign: "right", fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Scénario</th>
                  <th style={{ padding: 10, textAlign: "right", fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Écart</th>
                </tr>
              </thead>
              <tbody>
                {result.projection.map((p) => (
                  <tr key={p.month} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: 10, fontWeight: 600 }}>{monthLabel(p.month)}</td>
                    <td style={{ padding: 10, textAlign: "right", color: p.baselineCash < 0 ? "#dc2626" : "#334155" }}>{fmt(p.baselineCash)}</td>
                    <td style={{ padding: 10, textAlign: "right", fontWeight: 700, color: p.scenarioCash < 0 ? "#dc2626" : "#334155" }}>{fmt(p.scenarioCash)}</td>
                    <td style={{ padding: 10, textAlign: "right", color: p.delta >= 0 ? "#10b981" : "#ef4444", fontWeight: 600 }}>
                      {(p.delta >= 0 ? "+" : "") + fmt(p.delta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ padding: 16, background: "white", borderRadius: 12, border: "1px solid #e2e8f0" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function Chart({ projection }: { projection: ProjPoint[] }) {
  const w = 800;
  const h = 260;
  const pad = { top: 20, right: 20, bottom: 30, left: 60 };
  const iw = w - pad.left - pad.right;
  const ih = h - pad.top - pad.bottom;

  const allVals = projection.flatMap(p => [p.baselineCash, p.scenarioCash]);
  const min = Math.min(0, ...allVals);
  const max = Math.max(0, ...allVals);
  const range = max - min || 1;

  const xAt = (i: number) => pad.left + (iw * i) / Math.max(projection.length - 1, 1);
  const yAt = (v: number) => pad.top + ih * (1 - (v - min) / range);

  const lineBase = projection.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(p.baselineCash)}`).join(" ");
  const lineScen = projection.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(p.scenarioCash)}`).join(" ");
  const zeroY = yAt(0);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {/* Zero line */}
      <line x1={pad.left} y1={zeroY} x2={w - pad.right} y2={zeroY} stroke="#cbd5e1" strokeDasharray="4 4" strokeWidth={1} />
      <text x={pad.left - 6} y={zeroY + 4} fontSize={10} fill="#94a3b8" textAnchor="end">0€</text>

      {/* Y labels */}
      <text x={pad.left - 6} y={pad.top + 4} fontSize={10} fill="#94a3b8" textAnchor="end">{fmt(max)}</text>
      <text x={pad.left - 6} y={pad.top + ih + 4} fontSize={10} fill="#94a3b8" textAnchor="end">{fmt(min)}</text>

      {/* X labels */}
      {projection.map((p, i) => (
        i % Math.ceil(projection.length / 6) === 0 && (
          <text key={p.month} x={xAt(i)} y={h - 8} fontSize={10} fill="#94a3b8" textAnchor="middle">{monthLabel(p.month)}</text>
        )
      ))}

      {/* Baseline */}
      <path d={lineBase} fill="none" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 2" />
      {/* Scenario */}
      <path d={lineScen} fill="none" stroke="#6366f1" strokeWidth={3} />

      {/* Points scenario */}
      {projection.map((p, i) => (
        <circle key={p.month} cx={xAt(i)} cy={yAt(p.scenarioCash)} r={3} fill="#6366f1" />
      ))}
    </svg>
  );
}