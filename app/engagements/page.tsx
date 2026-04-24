"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { AppShell } from "@/components/app-shell";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const GRADIENT = "linear-gradient(135deg, #6366f1, #8b5cf6 60%, #ec4899)";

const ENGAGEMENT_TYPES = [
  { value: "loan", label: "Emprunt bancaire", icon: "🏦", color: "linear-gradient(135deg, #6366f1, #4f46e5)" },
  { value: "leasing", label: "Leasing / Crédit-bail", icon: "🚚", color: "linear-gradient(135deg, #ec4899, #db2777)" },
  { value: "consumer_credit", label: "Crédit conso", icon: "💳", color: "linear-gradient(135deg, #ef4444, #dc2626)" },
  { value: "lease_commercial", label: "Bail commercial", icon: "🏢", color: "linear-gradient(135deg, #f59e0b, #d97706)" },
  { value: "insurance", label: "Assurance pro", icon: "🛡", color: "linear-gradient(135deg, #10b981, #059669)" },
  { value: "subscription", label: "Abonnement pro", icon: "📱", color: "linear-gradient(135deg, #8b5cf6, #7c3aed)" },
  { value: "contract_cdd", label: "Contrat CDD", icon: "📝", color: "linear-gradient(135deg, #06b6d4, #0891b2)" },
  { value: "other", label: "Autre", icon: "📄", color: "linear-gradient(135deg, #64748b, #475569)" },
] as const;

type EngType = (typeof ENGAGEMENT_TYPES)[number]["value"];
type Engagement = { id: string; type: EngType; label: string; counterparty: string | null; startDate: string; endDate: string | null; monthlyAmount: string; tacitRenewal: boolean; earlyExitPenalty: string | null; notes: string | null };

export default function EngagementsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [list, setList] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Engagement | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push("/login");
      setToken(session.access_token);
      await refresh(session.access_token);
      setLoading(false);
    })();
  }, [router]);

  async function refresh(t: string) {
    const res = await fetch("/api/engagements", { headers: { Authorization: `Bearer ${t}` } });
    if (res.ok) { const json = await res.json(); setList(json.engagements); }
  }

  const handleSave = useCallback(async (payload: Record<string, unknown> & { id?: string }): Promise<string | null> => {
    if (!token) return "Session expirée, reconnecte-toi";
    const isEdit = !!payload.id;
    const res = await fetch("/api/engagements", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      try { const j = JSON.parse(text); return j.error ?? `Erreur ${res.status}`; } catch { return `Erreur ${res.status}`; }
    }
    await refresh(token);
    setModalOpen(false);
    setEditing(null);
    return null;
  }, [token]);

  const handleDelete = useCallback(async (id: string) => {
    if (!token || !confirm("Supprimer cet engagement ?")) return;
    await fetch(`/api/engagements?id=${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    await refresh(token);
  }, [token]);

  if (loading) return <AppShell><div style={{ padding: 32 }}>Chargement…</div></AppShell>;

  const today = new Date();
  const active = list.filter((e) => {
    const start = new Date(e.startDate);
    const end = e.endDate ? new Date(e.endDate) : null;
    return start <= today && (!end || end >= today);
  });
  const totalMonthly = active.reduce((s, e) => s + parseFloat(e.monthlyAmount), 0);
  const totalDebt = active.reduce((s, e) => {
    if (!e.endDate) return s;
    const end = new Date(e.endDate);
    const monthsLeft = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    return s + monthsLeft * parseFloat(e.monthlyAmount);
  }, 0);
  const nextEnding = [...active].filter((e) => e.endDate).sort((a, b) => new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime())[0];
  const fiveYearsFromNow = new Date(today.getFullYear() + 5, today.getMonth(), 1);
  const freedIn5y = active.reduce((s, e) => { if (!e.endDate) return s; const end = new Date(e.endDate); return end <= fiveYearsFromNow ? s + parseFloat(e.monthlyAmount) : s; }, 0);

  const tlStart = new Date(today.getFullYear(), 0, 1);
  const tlEnd = new Date(today.getFullYear() + 5, 11, 31);
  const tlTotalMs = tlEnd.getTime() - tlStart.getTime();
  const todayOffset = ((today.getTime() - tlStart.getTime()) / tlTotalMs) * 100;

  return (
    <AppShell>
      <div style={{ padding: 32 }}>
        <div style={card({ padding: 24, marginBottom: 20, overflow: "hidden", position: "relative" })}>
          <div style={{ position: "absolute", top: 0, right: 0, width: 384, height: 384, borderRadius: "50%", background: GRADIENT, opacity: 0.08, filter: "blur(48px)" }} />
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: GRADIENT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "white", boxShadow: "0 4px 16px rgba(99,102,241,0.3)" }}>🛣</div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Roadmap des engagements</h1>
              <p style={{ fontSize: 14, color: "#64748b", marginTop: 4 }}>Visualise tous tes contrats à durée déterminée. Les prévisions s'ajustent automatiquement quand un engagement arrive à terme.</p>
            </div>
            <button onClick={() => { setEditing(null); setModalOpen(true); }} style={{ ...btnPrimary, padding: "10px 18px" }}>+ Ajouter un engagement</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 20 }}>
            <KpiBox label="Dette contractuelle" value={fmt(totalDebt) + " €"} sub="sur la durée totale" bg="rgba(239,68,68,0.08)" color="#b91c1c" />
            <KpiBox label="Mensualités engagées" value={fmt(totalMonthly) + " €/mois"} sub="aujourd'hui" bg="rgba(239,68,68,0.08)" color="#b91c1c" />
            <KpiBox label="Cash libéré dans 5 ans" value={"+" + fmt(freedIn5y) + " €/mois"} sub="si rien n'est renouvelé" bg="rgba(16,185,129,0.08)" color="#059669" />
            <KpiBox label="Prochaine échéance" value={nextEnding ? formatMonth(nextEnding.endDate!) : "—"} sub={nextEnding?.label ?? "Aucune"} bg="rgba(245,158,11,0.08)" color="#b45309" />
          </div>
        </div>

        <div style={card({ padding: 24, marginBottom: 20 })}>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>Timeline de tes engagements</h3>
          <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 20px" }}>Chaque barre représente un contrat actif · clique pour modifier</p>
          {list.length === 0 ? (<EmptyState onAdd={() => { setEditing(null); setModalOpen(true); }} />) : (
            <div>
              <div style={{ display: "flex", paddingLeft: 160, marginBottom: 8, fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>
                {Array.from({ length: 6 }).map((_, i) => (<div key={i} style={{ flex: 1, borderLeft: "1px solid #e2e8f0", paddingLeft: 6 }}>{today.getFullYear() + i}</div>))}
              </div>
              <div style={{ position: "relative", paddingLeft: 160 }}>
                <div style={{ position: "absolute", top: 0, bottom: 0, left: `calc(160px + ${todayOffset}%)`, width: 2, background: "#6366f1", zIndex: 10 }}>
                  <div style={{ position: "absolute", top: -18, left: -20, fontSize: 10, fontWeight: 700, color: "#6366f1", whiteSpace: "nowrap" }}>Aujourd'hui</div>
                  <div style={{ position: "absolute", top: -3, left: -3, width: 8, height: 8, borderRadius: 999, background: "#6366f1" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 8 }}>
                  {list.map((e) => {
                    const type = ENGAGEMENT_TYPES.find((t) => t.value === e.type)!;
                    const start = new Date(e.startDate);
                    const end = e.endDate ? new Date(e.endDate) : tlEnd;
                    const left = Math.max(0, ((start.getTime() - tlStart.getTime()) / tlTotalMs) * 100);
                    const right = Math.min(100, ((end.getTime() - tlStart.getTime()) / tlTotalMs) * 100);
                    const width = Math.max(2, right - left);
                    return (
                      <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: -160 }}>
                        <div style={{ width: 160, textAlign: "right", paddingRight: 12 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{e.label}</div>
                          <div style={{ fontSize: 10, color: "#94a3b8" }}>{fmt(parseFloat(e.monthlyAmount))} €/mois</div>
                        </div>
                        <div style={{ flex: 1, height: 40, background: "#f1f5f9", borderRadius: 10, position: "relative", overflow: "hidden" }}>
                          <div onClick={() => { setEditing(e); setModalOpen(true); }} style={{ position: "absolute", left: `${left}%`, width: `${width}%`, height: "100%", background: type.color, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", color: "white", fontSize: 11, fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", transition: "transform 0.15s" }} onMouseEnter={(ev) => (ev.currentTarget.style.transform = "scale(1.02)")} onMouseLeave={(ev) => (ev.currentTarget.style.transform = "scale(1)")}>
                            <span>{type.icon} {e.counterparty ?? type.label}</span>
                            <span>{e.endDate ? `fin ${formatMonth(e.endDate)}` : "sans fin"}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {list.length > 0 && (
          <div style={card({ padding: 24 })}>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 16px" }}>Détail des engagements</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {list.map((e) => {
                const type = ENGAGEMENT_TYPES.find((t) => t.value === e.type)!;
                return (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 16px", borderRadius: 12, border: "1px solid #eef0f6", background: "white" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: type.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "white" }}>{type.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{e.label}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{e.counterparty && <>{e.counterparty} · </>}{formatDate(e.startDate)} → {e.endDate ? formatDate(e.endDate) : "sans date de fin"}{e.tacitRenewal && " · tacite reconduction"}</div>
                    </div>
                    <div style={{ fontWeight: 700, color: "#b91c1c" }}>-{fmt(parseFloat(e.monthlyAmount))} €/mois</div>
                    <button onClick={() => { setEditing(e); setModalOpen(true); }} style={btnSecondary}>Modifier</button>
                    <button onClick={() => handleDelete(e.id)} style={{ ...btnSecondary, color: "#b91c1c" }}>Supprimer</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {modalOpen && (<EngagementModal initial={editing} onClose={() => { setModalOpen(false); setEditing(null); }} onSave={handleSave} />)}
      </div>
    </AppShell>
  );
}

function EngagementModal({ initial, onClose, onSave }: { initial: Engagement | null; onClose: () => void; onSave: (payload: Record<string, unknown> & { id?: string }) => Promise<string | null> }) {
  const [form, setForm] = useState({
    type: (initial?.type ?? "leasing") as EngType,
    label: initial?.label ?? "",
    counterparty: initial?.counterparty ?? "",
    startDate: initial?.startDate ?? new Date().toISOString().slice(0, 10),
    endDate: initial?.endDate ?? "",
    monthlyAmount: initial ? parseFloat(initial.monthlyAmount).toString() : "",
    tacitRenewal: initial?.tacitRenewal ?? false,
    notes: initial?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.label.trim()) return setError("Le libellé est obligatoire");
    const amount = parseFloat(form.monthlyAmount);
    if (isNaN(amount) || amount <= 0) return setError("Montant mensuel invalide");
    if (!form.startDate) return setError("Date de début obligatoire");
    if (form.endDate && form.endDate < form.startDate) return setError("La date de fin doit être après la date de début");
    setSaving(true);
    const errMsg = await onSave({ ...(initial ? { id: initial.id } : {}), type: form.type, label: form.label.trim(), counterparty: form.counterparty.trim() || null, startDate: form.startDate, endDate: form.endDate || null, monthlyAmount: amount, tacitRenewal: form.tacitRenewal, notes: form.notes.trim() || null });
    setSaving(false);
    if (errMsg) setError(errMsg);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }} onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 20, padding: 28, width: "100%", maxWidth: 560, boxShadow: "0 24px 48px rgba(0,0,0,0.3)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{initial ? "Modifier l'engagement" : "Nouvel engagement"}</h2>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}>✕</button>
        </div>
        {error && (<div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#b91c1c", fontSize: 13, marginBottom: 16 }}>⚠ {error}</div>)}

        <Label>Type d'engagement</Label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, marginBottom: 16 }}>
          {ENGAGEMENT_TYPES.map((t) => (
            <button key={t.value} type="button" onClick={() => setForm({ ...form, type: t.value })} style={{ padding: "10px 12px", borderRadius: 10, border: form.type === t.value ? "2px solid #6366f1" : "1px solid #e2e8f0", background: form.type === t.value ? "rgba(99,102,241,0.08)" : "white", cursor: "pointer", fontSize: 12, fontWeight: 600, color: form.type === t.value ? "#4338ca" : "#475569", textAlign: "left" }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <Label>Libellé interne *</Label><Input value={form.label} onChange={(v) => setForm({ ...form, label: v })} placeholder="Ex: Leasing Peugeot Boxer" />
        <Label>Contrepartie (organisme)</Label><Input value={form.counterparty} onChange={(v) => setForm({ ...form, counterparty: v })} placeholder="Ex: BNP Paribas, Arval, MAAF…" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><Label>Date de début *</Label><Input type="date" value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} /></div>
          <div><Label>Date de fin</Label><Input type="date" value={form.endDate} onChange={(v) => setForm({ ...form, endDate: v })} placeholder="Sans fin fixe" /></div>
        </div>
        <Label>Montant mensuel (€) *</Label><Input type="number" value={form.monthlyAmount} onChange={(v) => setForm({ ...form, monthlyAmount: v })} placeholder="450" />

        <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, background: "#f8fafc", marginTop: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={form.tacitRenewal} onChange={(e) => setForm({ ...form, tacitRenewal: e.target.checked })} style={{ width: 16, height: 16 }} />
          <div><div style={{ fontSize: 13, fontWeight: 600 }}>Tacite reconduction</div><div style={{ fontSize: 11, color: "#64748b" }}>Le contrat se renouvelle automatiquement à la date de fin</div></div>
        </label>

        <Label>Notes (optionnel)</Label>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Ex: option de rachat 3200€…" rows={3} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit", resize: "vertical", marginBottom: 20, boxSizing: "border-box" }} />

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" onClick={onClose} style={btnSecondary}>Annuler</button>
          <button type="submit" disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>{saving ? "Sauvegarde…" : initial ? "Mettre à jour" : "Ajouter l'engagement"}</button>
        </div>
      </form>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) { return <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginTop: 12, marginBottom: 6 }}>{children}</div>; }
function Input({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (<input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", transition: "all 0.15s", boxSizing: "border-box" }} onFocus={(e) => { e.target.style.borderColor = "#6366f1"; e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.15)"; }} onBlur={(e) => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "none"; }} />);
}
function KpiBox({ label, value, sub, bg, color }: { label: string; value: string; sub: string; bg: string; color: string }) {
  return (<div style={{ padding: 14, borderRadius: 12, background: bg }}><div style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div><div style={{ fontSize: 20, fontWeight: 800, color, marginTop: 4 }}>{value}</div><div style={{ fontSize: 11, color, opacity: 0.7, marginTop: 2 }}>{sub}</div></div>);
}
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (<div style={{ padding: 48, textAlign: "center", background: "#fafbff", borderRadius: 12, border: "2px dashed #e2e8f0" }}><div style={{ fontSize: 48, marginBottom: 12 }}>📅</div><h4 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px" }}>Aucun engagement pour l'instant</h4><p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px", maxWidth: 400, marginLeft: "auto", marginRight: "auto" }}>Ajoute tes leasings, emprunts, baux ou abonnements pour voir leur roadmap et anticiper quand ton cash se libère.</p><button onClick={onAdd} style={btnPrimary}>+ Ajouter mon premier engagement</button></div>);
}
function fmt(n: number) { return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }); }
function formatDate(iso: string) { return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }); }
function formatMonth(iso: string) { return new Date(iso).toLocaleDateString("fr-FR", { month: "short", year: "numeric" }); }
const card = (s: React.CSSProperties = {}): React.CSSProperties => ({ background: "white", border: "1px solid #eef0f6", borderRadius: 16, boxShadow: "0 1px 2px rgba(15,23,42,0.04)", ...s });
const btnPrimary: React.CSSProperties = { padding: "8px 16px", borderRadius: 12, background: GRADIENT, color: "white", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const btnSecondary: React.CSSProperties = { padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, border: "1px solid #e2e8f0", background: "white", color: "#475569", cursor: "pointer" };