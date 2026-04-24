"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { AppShell } from "@/components/app-shell";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function authHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

function fmt(n: number | null | undefined, opts: { signed?: boolean } = {}): string {
  if (n === null || n === undefined) return "—";
  const abs = Math.round(Math.abs(n));
  const formatted = abs.toLocaleString("fr-FR") + " €";
  if (opts.signed && n !== 0) return (n > 0 ? "+" : "−") + formatted;
  return n < 0 ? "−" + formatted : formatted;
}

function monthLabel(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" }).format(new Date(iso));
}

type Cell = { month: string; planned: number | null; realized: number | null; userOverride: boolean; confidence: number | null };
type CategoryMeta = { id: string; label: string; direction: "inflow" | "outflow"; color: string; slug: string; isGlobal: boolean };
type Row = { category: CategoryMeta; cells: Cell[] };
type Totals = { month: string; inflow: { planned: number; realized: number }; outflow: { planned: number; realized: number }; net: { planned: number; realized: number } };
type Kpis = {
  cashNow: number;
  currentMonth: { month: string; planned: number; realized: number; gap: number } | null;
  next3MonthsPlanned: number;
  riskCount: number;
  minCash: number;
  minCashMonth: string | null;
};
type PnlData = { months: string[]; currentMonth: string; rows: Row[]; totals: Totals[]; kpis: Kpis };

const HORIZON_CONFIG: Record<number, [number, number]> = { 3: [0, 2], 6: [1, 4], 12: [3, 8] };

export default function PnlPage() {
  const [horizon, setHorizon] = useState<3 | 6 | 12>(6);
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<PnlData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [basePast, baseFuture] = HORIZON_CONFIG[horizon];
      const params = new URLSearchParams({ past: String(basePast), future: String(baseFuture), offset: String(offset) });
      const res = await fetch(`/api/pnl?${params}`, { headers: await authHeaders(), cache: "no-store" });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setData(body as PnlData);
    } catch (e) {
      setMsg({ kind: "err", text: `Chargement : ${(e as Error).message}` });
    } finally {
      setLoading(false);
    }
  }, [horizon, offset]);

  useEffect(() => { load(); }, [load]);

  async function generateForecast() {
    setGenerating(true);
    setMsg(null);
    try {
      const res = await fetch("/api/pnl/generate-forecast", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ horizonMonths: 6 }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setMsg({ kind: "ok", text: `✨ ${body.created} prévisions · ${body.skipped} protégées · ${body.source === "claude" ? "Claude Sonnet" : "moyenne mobile"}` });
      await load();
    } catch (e) {
      setMsg({ kind: "err", text: `IA : ${(e as Error).message}` });
    } finally {
      setGenerating(false);
    }
  }

  async function saveCell(categoryId: string, month: string, planned: number) {
    try {
      const res = await fetch("/api/pnl/cell", {
        method: "PATCH",
        headers: await authHeaders(),
        body: JSON.stringify({ categoryId, month, plannedAmount: planned }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (e) {
      setMsg({ kind: "err", text: `Cellule : ${(e as Error).message}` });
    }
  }

  async function createCategory(label: string, direction: "inflow" | "outflow") {
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ label, direction }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Erreur");
      await load();
    } catch (e) {
      setMsg({ kind: "err", text: `Création : ${(e as Error).message}` });
    }
  }

  async function renameCategory(id: string, label: string) {
    try {
      const res = await fetch(`/api/categories/${id}`, { method: "PATCH", headers: await authHeaders(), body: JSON.stringify({ label }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Erreur");
      await load();
    } catch (e) {
      setMsg({ kind: "err", text: `Renommage : ${(e as Error).message}` });
    }
  }

  async function deleteCategory(id: string) {
    if (!confirm("Supprimer cette catégorie ? Les transactions liées seront décatégorisées.")) return;
    try {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE", headers: await authHeaders() });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Erreur");
      await load();
    } catch (e) {
      setMsg({ kind: "err", text: `Suppression : ${(e as Error).message}` });
    }
  }

  if (loading && !data) return <AppShell><div className="p-8">Chargement…</div></AppShell>;
  if (!data) return <AppShell><div className="p-8 text-red-600">{msg?.text || "Aucune donnée"}</div></AppShell>;

  const kpis = data.kpis ?? { cashNow: 0, currentMonth: null, next3MonthsPlanned: 0, riskCount: 0, minCash: 0, minCashMonth: null };
  const inflowRows = data.rows.filter((r) => r.category.direction === "inflow");
  const outflowRows = data.rows.filter((r) => r.category.direction === "outflow");

  return (
    <AppShell>
      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-2xl font-extrabold">Tableau P&L</h1>
          <p className="text-sm text-slate-500">Pilote ta trésorerie mois par mois. Saisis tes prévisions, laisse l&apos;IA te les générer, ou mixe les deux.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Trésorerie actuelle" value={fmt(kpis.cashNow)} sub="Solde consolidé de tes comptes" color="indigo" />
          <KpiCard
            label="Mois en cours (Payé)"
            value={fmt(kpis.currentMonth?.realized ?? 0, { signed: true })}
            sub={kpis.currentMonth ? `Prévu : ${fmt(kpis.currentMonth.planned, { signed: true })} · Écart : ${fmt(kpis.currentMonth.gap, { signed: true })}` : "—"}
            color={!kpis.currentMonth ? "indigo" : kpis.currentMonth.gap >= 0 ? "emerald" : "red"}
          />
          <KpiCard
            label="3 prochains mois (Prévu)"
            value={fmt(kpis.next3MonthsPlanned, { signed: true })}
            sub="Solde net prévisionnel cumulé"
            color={kpis.next3MonthsPlanned >= 0 ? "emerald" : "amber"}
          />
          <KpiCard
            label="Mois à risque"
            value={`${kpis.riskCount}`}
            sub={kpis.minCashMonth ? `Creux : ${fmt(kpis.minCash)} en ${monthLabel(kpis.minCashMonth)}` : "Tréso positive sur la période"}
            color={kpis.riskCount > 0 ? "red" : "emerald"}
          />
        </div>

        <div className="flex items-center flex-wrap gap-3 p-3 bg-white rounded-xl border">
          <div className="flex items-center gap-1">
            <button onClick={() => setOffset((o) => o - 1)} className="px-2 py-1 rounded hover:bg-slate-100" title="Mois précédent">◀</button>
            <button onClick={() => setOffset(0)} disabled={offset === 0} className="px-3 py-1 text-sm rounded hover:bg-slate-100 disabled:opacity-40">Aujourd&apos;hui</button>
            <button onClick={() => setOffset((o) => o + 1)} className="px-2 py-1 rounded hover:bg-slate-100" title="Mois suivant">▶</button>
          </div>
          <div className="h-6 w-px bg-slate-200" />
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {([3, 6, 12] as const).map((h) => (
              <button
                key={h}
                onClick={() => setHorizon(h)}
                className={`px-3 py-1 text-sm rounded-md font-medium transition ${horizon === h ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
              >{h} mois</button>
            ))}
          </div>
          <div className="flex-1" />
          <button
            onClick={generateForecast}
            disabled={generating}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 text-sm"
          >{generating ? "Génération…" : "✨ Générer prévisionnel IA"}</button>
        </div>

        {msg && (
          <div className={`p-3 rounded-lg text-sm ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
            {msg.text}
          </div>
        )}

        <div className="bg-white rounded-xl border overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3 min-w-[240px] sticky left-0 bg-white z-10 font-semibold text-xs uppercase text-slate-500">Catégorie</th>
                {data.months.map((m) => <MonthHeader key={m} month={m} isCurrent={m === data.currentMonth} isNearFuture={isNearFuture(m, data.currentMonth, data.months)} />)}
              </tr>
              <tr className="border-b text-[10px] uppercase font-bold">
                <th className="sticky left-0 bg-white z-10" />
                {data.months.map((m) => (
                  <Fragment key={m}>
                    <th className="px-1 py-1 border-l text-amber-700 bg-amber-50/60 min-w-[85px]">Prévu</th>
                    <th className="px-1 py-1 text-blue-700 bg-blue-50/60 min-w-[85px]">Payé</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              <SectionTotal label="💰 Encaissements" direction="inflow" months={data.months} totals={data.totals} currentMonth={data.currentMonth} />
              {inflowRows.map((r) => <CatRow key={r.category.id} row={r} onSaveCell={saveCell} onRename={renameCategory} onDelete={deleteCategory} currentMonth={data.currentMonth} />)}
              <AddCategoryRow direction="inflow" onCreate={createCategory} months={data.months} />

              <SectionTotal label="💸 Décaissements" direction="outflow" months={data.months} totals={data.totals} currentMonth={data.currentMonth} />
              {outflowRows.map((r) => <CatRow key={r.category.id} row={r} onSaveCell={saveCell} onRename={renameCategory} onDelete={deleteCategory} currentMonth={data.currentMonth} />)}
              <AddCategoryRow direction="outflow" onCreate={createCategory} months={data.months} />

              <tr className="border-t-2 bg-slate-100 font-bold">
                <td className="p-3 sticky left-0 bg-slate-100 z-10">Trésorerie nette</td>
                {data.months.map((m) => {
                  const t = data.totals.find((tt) => tt.month === m)!;
                  const isCurrent = m === data.currentMonth;
                  return (
                    <Fragment key={m}>
                      <td className={`p-2 text-center text-xs border-l ${t.net.planned >= 0 ? "text-emerald-700" : "text-red-600"} ${isCurrent ? "bg-indigo-100" : ""}`}>{fmt(t.net.planned, { signed: true })}</td>
                      <td className={`p-2 text-center text-xs ${t.net.realized >= 0 ? "text-emerald-700" : "text-red-600"} ${isCurrent ? "bg-indigo-100" : ""}`}>{fmt(t.net.realized, { signed: true })}</td>
                    </Fragment>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="text-xs text-slate-500">📌 = saisie manuelle (l&apos;IA ne l&apos;écrasera pas) · Passe la souris sur une catégorie perso pour la renommer/supprimer.</div>
      </div>
    </AppShell>
  );
}

function isNearFuture(m: string, currentMonth: string, months: string[]): boolean {
  const idx = months.indexOf(m);
  const cur = months.indexOf(currentMonth);
  return cur >= 0 && idx > cur && idx <= cur + 3;
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: "indigo" | "emerald" | "red" | "amber" }) {
  const colorText = {
    indigo: "text-indigo-700",
    emerald: "text-emerald-700",
    red: "text-red-700",
    amber: "text-amber-700",
  }[color];
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">{label}</div>
      <div className={`text-2xl font-extrabold ${colorText}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-1">{sub}</div>
    </div>
  );
}

function MonthHeader({ month, isCurrent, isNearFuture }: { month: string; isCurrent: boolean; isNearFuture: boolean }) {
  let bg = "";
  let tag = "";
  if (isCurrent) { bg = "bg-indigo-100"; tag = "En cours"; }
  else if (isNearFuture) { bg = "bg-amber-50"; tag = "À venir"; }
  return (
    <th colSpan={2} className={`text-center p-2 border-l ${bg}`}>
      <div className="text-xs font-bold">{monthLabel(month)}</div>
      {tag && <div className="text-[9px] text-slate-500 uppercase">{tag}</div>}
    </th>
  );
}

function SectionTotal({ label, direction, months, totals, currentMonth }: { label: string; direction: "inflow" | "outflow"; months: string[]; totals: Totals[]; currentMonth: string }) {
  return (
    <tr className="bg-slate-50 font-bold border-b">
      <td className="p-3 sticky left-0 bg-slate-50 z-10">{label}</td>
      {months.map((m) => {
        const t = totals.find((tt) => tt.month === m)!;
        const p = direction === "inflow" ? t.inflow.planned : t.outflow.planned;
        const r = direction === "inflow" ? t.inflow.realized : t.outflow.realized;
        const highlight = m === currentMonth;
        return (
          <Fragment key={m}>
            <td className={`p-2 text-center text-xs border-l text-amber-800 ${highlight ? "bg-indigo-50" : "bg-amber-50/30"}`}>{p !== 0 ? fmt(p, { signed: true }) : "—"}</td>
            <td className={`p-2 text-center text-xs text-blue-800 ${highlight ? "bg-indigo-50" : "bg-blue-50/30"}`}>{r !== 0 ? fmt(r, { signed: true }) : "—"}</td>
          </Fragment>
        );
      })}
    </tr>
  );
}

function CatRow({ row, onSaveCell, onRename, onDelete, currentMonth }: {
  row: Row;
  onSaveCell: (c: string, m: string, p: number) => void;
  onRename: (id: string, label: string) => void;
  onDelete: (id: string) => void;
  currentMonth: string;
}) {
  const [editingLabel, setEditingLabel] = useState(false);
  const [draft, setDraft] = useState(row.category.label);

  return (
    <tr className="border-b hover:bg-slate-50/50 group">
      <td className="p-2 sticky left-0 bg-white group-hover:bg-slate-50/50 z-10">
        {editingLabel ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              setEditingLabel(false);
              if (draft.trim() && draft !== row.category.label) onRename(row.category.id, draft.trim());
              else setDraft(row.category.label);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") { setDraft(row.category.label); setEditingLabel(false); }
            }}
            className="w-full px-1 py-0.5 border border-indigo-400 rounded text-sm"
          />
        ) : (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.category.color }} />
            <span className="truncate flex-1">{row.category.label}</span>
            {!row.category.isGlobal && (
              <span className="opacity-0 group-hover:opacity-100 flex gap-1 transition">
                <button onClick={() => setEditingLabel(true)} className="text-xs text-slate-500 hover:text-indigo-600" title="Renommer">✏️</button>
                <button onClick={() => onDelete(row.category.id)} className="text-xs text-slate-500 hover:text-red-600" title="Supprimer">🗑</button>
              </span>
            )}
          </div>
        )}
      </td>
      {row.cells.map((cell) => {
        const isCurrent = cell.month === currentMonth;
        return (
          <Fragment key={cell.month}>
            <td className={`p-0 border-l ${isCurrent ? "bg-indigo-50/60" : "bg-amber-50/20"}`}>
              <EditCell value={cell.planned} userOverride={cell.userOverride} onSave={(v) => onSaveCell(row.category.id, cell.month, v)} />
            </td>
            <td className={`p-1 text-center text-xs ${isCurrent ? "bg-indigo-50/60" : "bg-blue-50/20"}`}>
              {cell.realized !== null ? <span className={cell.realized < 0 ? "text-red-600" : "text-emerald-700"}>{fmt(cell.realized)}</span> : <span className="text-slate-300">—</span>}
            </td>
          </Fragment>
        );
      })}
    </tr>
  );
}

function EditCell({ value, userOverride, onSave }: { value: number | null; userOverride: boolean; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value?.toString() ?? "");
  useEffect(() => { setDraft(value?.toString() ?? ""); }, [value]);

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          const n = parseFloat(draft);
          if (Number.isFinite(n) && n !== value) onSave(n);
          else setDraft(value?.toString() ?? "");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { setDraft(value?.toString() ?? ""); setEditing(false); }
        }}
        className="w-full text-center px-1 py-1 text-xs border border-amber-500 rounded bg-white"
      />
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="w-full text-center px-1 py-1 text-xs hover:bg-white flex items-center justify-center gap-1 min-h-[28px]">
      {userOverride && <span className="text-[9px]">📌</span>}
      <span className={value !== null && value < 0 ? "text-red-700" : "text-amber-900"}>{fmt(value)}</span>
    </button>
  );
}

function AddCategoryRow({ direction, onCreate, months }: { direction: "inflow" | "outflow"; onCreate: (label: string, dir: "inflow" | "outflow") => void; months: string[] }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  return (
    <tr className="border-b">
      <td className="p-2 sticky left-0 bg-white z-10">
        {adding ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (draft.trim()) onCreate(draft.trim(), direction);
              setDraft("");
              setAdding(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") { setDraft(""); setAdding(false); }
            }}
            placeholder="Nom de la catégorie…"
            className="px-2 py-1 border border-indigo-400 rounded text-sm w-full max-w-xs"
          />
        ) : (
          <button onClick={() => setAdding(true)} className="text-xs text-slate-500 hover:text-indigo-600 font-medium">+ Nouvelle catégorie</button>
        )}
      </td>
      {months.map((m) => (
        <Fragment key={m}>
          <td className="border-l bg-slate-50/30" />
          <td className="bg-slate-50/30" />
        </Fragment>
      ))}
    </tr>
  );
}