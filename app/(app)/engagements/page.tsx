"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { AppShell } from "@/components/app-shell";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const GRADIENT = "linear-gradient(135deg, #6366f1, #8b5cf6 60%, #ec4899)";

type Engagement = {
  id: string;
  type: string;
  label: string;
  counterparty: string | null;
  startDate: string;
  endDate: string | null;
  monthlyAmount: string;
  categoryId: string | null;
  tacitRenewal: boolean;
  notes: string | null;
};

const TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
  loan: { label: "Emprunt", icon: "🏦", color: "#dc2626" },
  leasing: { label: "Leasing", icon: "🚗", color: "#f59e0b" },
  consumer_credit: { label: "Crédit conso", icon: "💳", color: "#ec4899" },
  lease_commercial: { label: "Bail commercial", icon: "🏢", color: "#6366f1" },
  insurance: { label: "Assurance", icon: "🛡️", color: "#10b981" },
  subscription: { label: "Abonnement", icon: "🔄", color: "#8b5cf6" },
  contract_cdd: { label: "Contrat", icon: "📝", color: "#0ea5e9" },
  other: { label: "Autre", icon: "📌", color: "#64748b" },
};

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export default function EngagementsPage() {
  const [engs, setEngs] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/engagements", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await res.json();
      if (res.ok) setEngs(body.engagements ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function detectAuto() {
    setDetecting(true);
    setMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/engagements", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Erreur");
      setMsg({ kind: "ok", text: `🎯 Détection : ${body.created} nouveaux engagements, ${body.updated} mis à jour (sur ${body.scanned} transactions analysées).` });
      await load();
    } catch (e) {
      setMsg({ kind: "err", text: `Erreur : ${(e as Error).message}` });
    } finally {
      setDetecting(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Supprimer cet engagement ?")) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch(`/api/engagements/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      await load();
    } catch {}
  }

  const totalMonthly = useMemo(
    () => engs.reduce((s, e) => s + parseFloat(e.monthlyAmount), 0),
    [engs]
  );

  const byType = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of engs) {
      map.set(e.type, (map.get(e.type) ?? 0) + parseFloat(e.monthlyAmount));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [engs]);

  return (
    <AppShell>
      <div style={{ padding: 32, maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, background: GRADIENT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🛣️</span>
              Engagements
            </h1>
            <p style={{ fontSize: 14, color: "#64748b", marginTop: 6 }}>
              Tes charges récurrentes : leasings, abonnements, loyers, emprunts. Claude les détecte automatiquement depuis ton historique.
            </p>
          </div>
          <button
            onClick={detectAuto}
            disabled={detecting}
            style={{
              padding: "12px 20px",
              borderRadius: 12,
              border: "none",
              background: GRADIENT,
              color: "white",
              fontSize: 14,
              fontWeight: 700,
              cursor: detecting ? "wait" : "pointer",
              opacity: detecting ? 0.6 : 1,
              boxShadow: "0 4px 12px rgba(99,102,241,0.3)",
            }}
          >
            {detecting ? "Analyse en cours…" : "🔍 Détecter automatiquement"}
          </button>
        </div>

        {msg && (
          <div style={{
            padding: 14,
            borderRadius: 10,
            marginBottom: 24,
            background: msg.kind === "ok" ? "#ecfdf5" : "#fee2e2",
            border: `1px solid ${msg.kind === "ok" ? "#a7f3d0" : "#fecaca"}`,
            color: msg.kind === "ok" ? "#065f46" : "#991b1b",
            fontSize: 13,
          }}>
            {msg.text}
          </div>
        )}

        {/* Summary */}
        {engs.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
            <Card label="Total mensuel" value={fmt(totalMonthly)} sub={`${engs.length} engagement${engs.length > 1 ? "s" : ""}`} color="#6366f1" />
            <Card label="Annualisé" value={fmt(totalMonthly * 12)} sub="Coût total sur 12 mois" color="#8b5cf6" />
            {byType[0] && (
              <Card
                label={`Plus gros poste`}
                value={fmt(byType[0][1])}
                sub={TYPE_META[byType[0][0]]?.label ?? byType[0][0]}
                color="#ec4899"
              />
            )}
          </div>
        )}

        {loading && !engs.length && <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Chargement…</div>}

        {/* Empty state */}
        {!loading && engs.length === 0 && (
          <div style={{ padding: 48, background: "white", borderRadius: 16, border: "1px solid #e2e8f0", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🛣️</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Aucun engagement détecté</div>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
              Clique sur &quot;Détecter automatiquement&quot; et Claude va scanner tes 12 derniers mois de transactions pour trouver tes charges récurrentes.
            </p>
            <button
              onClick={detectAuto}
              disabled={detecting}
              style={{ padding: "10px 20px", borderRadius: 10, background: GRADIENT, color: "white", border: "none", fontWeight: 700, cursor: "pointer", fontSize: 13 }}
            >
              {detecting ? "Analyse…" : "🔍 Lancer la détection"}
            </button>
          </div>
        )}

        {/* List */}
        {engs.length > 0 && (
          <div style={{ background: "white", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={th}>Type</th>
                  <th style={th}>Libellé</th>
                  <th style={th}>Contrepartie</th>
                  <th style={{ ...th, textAlign: "right" }}>Mensuel</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {engs.map((e) => {
                  const meta = TYPE_META[e.type] ?? TYPE_META.other;
                  return (
                    <tr key={e.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: 14 }}>
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "4px 10px",
                          borderRadius: 999,
                          background: `${meta.color}15`,
                          color: meta.color,
                          fontSize: 12,
                          fontWeight: 600,
                        }}>
                          <span>{meta.icon}</span>
                          {meta.label}
                        </span>
                      </td>
                      <td style={{ padding: 14, fontWeight: 600 }}>{e.label}</td>
                      <td style={{ padding: 14, color: "#64748b", fontSize: 12 }}>{e.counterparty ?? "—"}</td>
                      <td style={{ padding: 14, textAlign: "right", fontWeight: 700, color: "#dc2626" }}>
                        {fmt(parseFloat(e.monthlyAmount))}
                      </td>
                      <td style={{ padding: 14, textAlign: "right" }}>
                        <button
                          onClick={() => remove(e.id)}
                          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #fecaca", background: "white", color: "#dc2626", cursor: "pointer", fontSize: 12 }}
                        >🗑</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Card({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ padding: 16, background: "white", borderRadius: 12, border: "1px solid #e2e8f0" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: "#94a3b8" }}>{sub}</div>
    </div>
  );
}

const th: React.CSSProperties = { padding: 12, textAlign: "left", fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5 };