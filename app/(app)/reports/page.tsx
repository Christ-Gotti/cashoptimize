"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { AppShell } from "@/components/app-shell";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const GRADIENT = "linear-gradient(135deg, #6366f1, #8b5cf6 60%, #ec4899)";

type Row = {
  category: { label: string; direction: "inflow" | "outflow" };
  cells: Array<{ month: string; planned: number | null; realized: number | null }>;
};

type Totals = {
  month: string;
  inflowPlanned: number;
  inflowRealized: number;
  outflowPlanned: number;
  outflowRealized: number;
  netPlanned: number;
  netRealized: number;
};

type ReportData = {
  org: { name: string; siret: string | null; currency: string };
  generatedAt: string;
  months: string[];
  currentMonth: string;
  rows: Row[];
  totals: Totals[];
};

function fmt(n: number | null): string {
  if (n === null) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function monthLabel(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" }).format(new Date(iso));
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [past, setPast] = useState(6);
  const [future, setFuture] = useState(6);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`/api/reports?past=${past}&future=${future}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await res.json();
      if (res.ok) setData(body);
    } finally {
      setLoading(false);
    }
  }, [past, future]);

  useEffect(() => { load(); }, [load]);

  const inflowRows = data?.rows.filter(r => r.category.direction === "inflow") ?? [];
  const outflowRows = data?.rows.filter(r => r.category.direction === "outflow") ?? [];

  return (
    <AppShell>
      <div style={{ padding: 32, maxWidth: 1200, margin: "0 auto" }}>
        {/* Controls (masqués à l'impression) */}
        <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, background: GRADIENT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📄</span>
              Rapports
            </h1>
            <p style={{ fontSize: 14, color: "#64748b", marginTop: 6 }}>
              Export PDF de ton tableau P&L à envoyer à ton comptable ou banquier.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select value={past} onChange={(e) => setPast(parseInt(e.target.value))} style={selectStyle}>
              <option value={3}>3 mois passés</option>
              <option value={6}>6 mois passés</option>
              <option value={12}>12 mois passés</option>
            </select>
            <span style={{ color: "#64748b" }}>+</span>
            <select value={future} onChange={(e) => setFuture(parseInt(e.target.value))} style={selectStyle}>
              <option value={3}>3 mois futurs</option>
              <option value={6}>6 mois futurs</option>
              <option value={12}>12 mois futurs</option>
            </select>
            <button
              onClick={() => window.print()}
              disabled={loading || !data}
              style={{
                padding: "10px 20px",
                borderRadius: 10,
                border: "none",
                background: GRADIENT,
                color: "white",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(99,102,241,0.3)",
              }}
            >
              🖨️ Imprimer en PDF
            </button>
          </div>
        </div>

        {loading && !data && <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Chargement…</div>}

        {data && (
          <div id="report" style={{ background: "white", borderRadius: 12, border: "1px solid #e2e8f0", padding: 32, overflow: "auto", maxWidth: "100%" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #0f172a", paddingBottom: 16, marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Rapport P&L</div>
                <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{data.org.name}</h2>
                {data.org.siret && <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>SIRET : {data.org.siret}</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>CashOptimize</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                  Généré le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(data.generatedAt))}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>
                  Période : {monthLabel(data.months[0])} → {monthLabel(data.months[data.months.length - 1])}
                </div>
              </div>
            </div>

            {/* P&L Table */}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
                  <th style={th}>Catégorie</th>
                  {data.months.map((m) => (
                    <th key={m} colSpan={2} style={{ ...th, textAlign: "center", borderLeft: "1px solid #cbd5e1", background: m === data.currentMonth ? "#eef2ff" : "#f8fafc" }}>
                      {monthLabel(m)}
                    </th>
                  ))}
                </tr>
                <tr style={{ fontSize: 9, color: "#64748b", background: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
                  <th style={{ ...th, textTransform: "uppercase" }} />
                  {data.months.map((m) => (
                    <Fragment key={m}>
                      <th style={{ ...th, textAlign: "right", borderLeft: "1px solid #e2e8f0", fontWeight: 600 }}>Prévu</th>
                      <th style={{ ...th, textAlign: "right", fontWeight: 600 }}>Payé</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Encaissements */}
                <tr style={{ background: "#ecfdf5", fontWeight: 700 }}>
                  <td style={{ ...td, color: "#065f46" }}>💰 Encaissements</td>
                  {data.totals.map((t) => (
                    <Fragment key={t.month}>
                      <td style={{ ...td, textAlign: "right", color: "#065f46", borderLeft: "1px solid #d1fae5" }}>{fmt(t.inflowPlanned)}</td>
                      <td style={{ ...td, textAlign: "right", color: "#065f46" }}>{fmt(t.inflowRealized)}</td>
                    </Fragment>
                  ))}
                </tr>
                {inflowRows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ ...td, paddingLeft: 20 }}>{r.category.label}</td>
                    {r.cells.map((c) => (
                      <Fragment key={c.month}>
                        <td style={{ ...td, textAlign: "right", borderLeft: "1px solid #f1f5f9", color: "#475569" }}>{fmt(c.planned)}</td>
                        <td style={{ ...td, textAlign: "right", color: "#0f172a", fontWeight: 600 }}>{fmt(c.realized)}</td>
                      </Fragment>
                    ))}
                  </tr>
                ))}

                {/* Décaissements */}
                <tr style={{ background: "#fef2f2", fontWeight: 700 }}>
                  <td style={{ ...td, color: "#991b1b" }}>💸 Décaissements</td>
                  {data.totals.map((t) => (
                    <Fragment key={t.month}>
                      <td style={{ ...td, textAlign: "right", color: "#991b1b", borderLeft: "1px solid #fee2e2" }}>{fmt(t.outflowPlanned)}</td>
                      <td style={{ ...td, textAlign: "right", color: "#991b1b" }}>{fmt(t.outflowRealized)}</td>
                    </Fragment>
                  ))}
                </tr>
                {outflowRows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ ...td, paddingLeft: 20 }}>{r.category.label}</td>
                    {r.cells.map((c) => (
                      <Fragment key={c.month}>
                        <td style={{ ...td, textAlign: "right", borderLeft: "1px solid #f1f5f9", color: "#475569" }}>{fmt(c.planned)}</td>
                        <td style={{ ...td, textAlign: "right", color: "#0f172a", fontWeight: 600 }}>{fmt(c.realized)}</td>
                      </Fragment>
                    ))}
                  </tr>
                ))}

                {/* Net */}
                <tr style={{ background: "#0f172a", color: "white", fontWeight: 800 }}>
                  <td style={{ ...td, color: "white" }}>Trésorerie nette</td>
                  {data.totals.map((t) => (
                    <Fragment key={t.month}>
                      <td style={{ ...td, textAlign: "right", color: t.netPlanned >= 0 ? "#86efac" : "#fca5a5", borderLeft: "1px solid #334155" }}>{fmt(t.netPlanned)}</td>
                      <td style={{ ...td, textAlign: "right", color: t.netRealized >= 0 ? "#86efac" : "#fca5a5" }}>{fmt(t.netRealized)}</td>
                    </Fragment>
                  ))}
                </tr>
              </tbody>
            </table>

            {/* Footer */}
            <div style={{ marginTop: 24, paddingTop: 12, borderTop: "1px solid #e2e8f0", fontSize: 10, color: "#94a3b8", textAlign: "center" }}>
              Rapport généré par CashOptimize · cashoptimize.com
            </div>
          </div>
        )}

        <style>{`
          @media print {
            body { background: white !important; }
            .no-print { display: none !important; }
            aside, nav, header { display: none !important; }
            #report { border: none !important; padding: 0 !important; box-shadow: none !important; page-break-inside: avoid; }
            @page { size: A4 landscape; margin: 10mm; }
          }
        `}</style>
      </div>
    </AppShell>
  );
}

const th: React.CSSProperties = { padding: "8px 6px", textAlign: "left", fontWeight: 700 };
const td: React.CSSProperties = { padding: "6px 6px" };
const selectStyle: React.CSSProperties = { padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, background: "white" };