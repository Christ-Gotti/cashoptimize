// app/import/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { AppShell } from "@/components/app-shell";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const GRADIENT = "linear-gradient(135deg, #6366f1, #8b5cf6 60%, #ec4899)";

type Transaction = { id: string; bookedAt: string; rawLabel: string; cleanLabel: string | null; amount: string; currency: string; categoryId: string | null; categoryConfidence: number | null; categorizationTier: number | null; userOverride: boolean; accountId: string; counterpartyName: string | null };
type Category = { id: string; label: string; direction: "inflow" | "outflow"; color: string };
type Account = { id: string; name: string };
type Filter = "all" | "uncategorized" | "categorized";

export default function ImportPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("uncategorized");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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
    const res = await fetch("/api/transactions", { headers: { Authorization: `Bearer ${t}` } });
    if (res.ok) {
      const json = await res.json();
      setTxs(json.transactions);
      setCategories(json.categories);
      setAccounts(json.accounts);
    }
  }

  async function updateCategory(transactionId: string, categoryId: string | null) {
    if (!token) return;
    setUpdatingId(transactionId);
    await fetch("/api/transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ transactionId, categoryId }),
    });
    setTxs((prev) => prev.map((t) => t.id === transactionId ? { ...t, categoryId, categoryConfidence: categoryId ? 1 : 0, categorizationTier: categoryId ? 4 : null, userOverride: true } : t));
    setUpdatingId(null);
    if (categoryId) {
      setBanner({ type: "success", text: "✓ Catégorie mise à jour. Trezo a appris — prochaine transaction similaire sera auto-catégorisée." });
      setTimeout(() => setBanner(null), 3000);
    }
  }

  async function handleSync() {
    if (!token) return;
    setSyncing(true);
    setBanner({ type: "info", text: "🔄 Synchronisation Bridge en cours..." });
    const res = await fetch("/api/bridge/sync", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    if (res.ok) {
      setBanner({ type: "success", text: `✓ ${json.summary.transactionsImported} nouvelles transactions importées` });
      await refresh(token);
    } else {
      setBanner({ type: "error", text: `❌ ${json.error}` });
    }
    setSyncing(false);
  }

  async function handleCategorizeAI() {
    if (!token) return;
    setAiRunning(true);
    setBanner({ type: "info", text: "🧙 Claude AI catégorise tes transactions (env. 10-20 secondes)..." });
    try {
      const res = await fetch("/api/transactions/categorize-ai", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Erreur ${res.status}`);

      const { processed, categorized, errors, remaining } = json;
      if (processed === 0) {
        setBanner({ type: "info", text: "✓ Toutes tes transactions sont déjà catégorisées !" });
      } else if (remaining > 0) {
        setBanner({
          type: "success",
          text: `✨ Claude a catégorisé ${categorized}/${processed} transactions · Il en reste ${remaining} à traiter · Clique à nouveau "Catégoriser avec Claude" pour continuer.`,
        });
      } else {
        setBanner({
          type: "success",
          text: `🎉 Claude a catégorisé ${categorized}/${processed} transactions ! ${errors > 0 ? `(${errors} erreurs batch)` : ""}`,
        });
      }
      await refresh(token);
    } catch (err) {
      setBanner({ type: "error", text: `❌ Erreur IA : ${(err as Error).message}` });
    } finally {
      setAiRunning(false);
    }
  }

  const filtered = useMemo(() => {
    let list = txs;
    if (filter === "uncategorized") list = list.filter((t) => !t.categoryId);
    else if (filter === "categorized") list = list.filter((t) => !!t.categoryId);
    if (accountFilter !== "all") list = list.filter((t) => t.accountId === accountFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.rawLabel.toLowerCase().includes(q) || (t.counterpartyName ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [txs, filter, accountFilter, search]);

  if (loading) return <AppShell><div style={{ padding: 32 }}>Chargement…</div></AppShell>;

  const total = txs.length;
  const categorized = txs.filter((t) => !!t.categoryId).length;
  const uncategorized = total - categorized;
  const autoRate = total > 0 ? Math.round((categorized / total) * 100) : 0;
  const learnedCount = txs.filter((t) => t.userOverride).length;
  const aiCount = txs.filter((t) => t.categorizationTier === 3).length;

  const catById = Object.fromEntries(categories.map((c) => [c.id, c]));

  return (
    <AppShell>
      <div style={{ padding: 32 }}>
        <div style={card({ padding: 24, marginBottom: 20, overflow: "hidden", position: "relative" })}>
          <div style={{ position: "absolute", top: 0, right: 0, width: 384, height: 384, borderRadius: "50%", background: GRADIENT, opacity: 0.08, filter: "blur(48px)" }} />
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: GRADIENT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "white" }}>✨</div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Import intelligent</h1>
              <p style={{ fontSize: 14, color: "#64748b", marginTop: 4 }}>Catégorisation automatique par règles + IA Claude. Corrige les cas incertains → Trezo apprend à chaque clic.</p>
            </div>
            <button onClick={handleCategorizeAI} disabled={aiRunning || uncategorized === 0} style={{ padding: "10px 18px", borderRadius: 12, background: GRADIENT, color: "white", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: aiRunning || uncategorized === 0 ? 0.5 : 1, boxShadow: "0 4px 12px rgba(99,102,241,0.3)" }}>
              {aiRunning ? "🧙 Claude analyse..." : `🧙 Catégoriser avec Claude AI${uncategorized > 0 ? ` (${uncategorized})` : ""}`}
            </button>
            <button onClick={handleSync} disabled={syncing} style={{ padding: "10px 18px", borderRadius: 12, background: "#10b981", color: "white", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: syncing ? 0.5 : 1 }}>
              {syncing ? "🔄 Sync..." : "↻ Synchroniser"}
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 20 }}>
            <KpiBox label="Total transactions" value={total.toString()} sub="90 derniers jours" bg="rgba(99,102,241,0.08)" color="#4338ca" />
            <KpiBox label="Catégorisées" value={categorized.toString()} sub={`${autoRate}% au total`} bg="rgba(16,185,129,0.08)" color="#059669" />
            <KpiBox label="Par Claude IA" value={aiCount.toString()} sub="tier 3 - sémantique" bg="rgba(139,92,246,0.08)" color="#7c3aed" />
            <KpiBox label="À catégoriser" value={uncategorized.toString()} sub="1 clic pour chaque" bg="rgba(245,158,11,0.08)" color="#b45309" />
            <KpiBox label="Corrigées par toi" value={learnedCount.toString()} sub="Trezo a appris" bg="rgba(236,72,153,0.08)" color="#be185d" />
          </div>
        </div>

        {banner && (
          <div style={{ padding: "12px 18px", marginBottom: 16, borderRadius: 12, background: banner.type === "success" ? "rgba(16,185,129,0.1)" : banner.type === "error" ? "rgba(239,68,68,0.1)" : "rgba(99,102,241,0.1)", border: `1px solid ${banner.type === "success" ? "#10b98155" : banner.type === "error" ? "#ef444455" : "#6366f155"}`, fontSize: 13, color: banner.type === "success" ? "#059669" : banner.type === "error" ? "#b91c1c" : "#4338ca", fontWeight: 600 }}>
            {banner.text}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>Toutes ({total})</FilterButton>
          <FilterButton active={filter === "uncategorized"} onClick={() => setFilter("uncategorized")} warn>⚠ À catégoriser ({uncategorized})</FilterButton>
          <FilterButton active={filter === "categorized"} onClick={() => setFilter("categorized")}>Catégorisées ({categorized})</FilterButton>
          <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid #e2e8f0", fontSize: 12, fontWeight: 600, background: "white" }}>
            <option value="all">Tous les comptes</option>
            {accounts.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
          </select>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Rechercher..." style={{ flex: 1, minWidth: 200, padding: "8px 14px", borderRadius: 999, border: "1px solid #e2e8f0", fontSize: 13 }} />
        </div>

        {filtered.length === 0 ? (
          <div style={card({ padding: 48, textAlign: "center" })}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✨</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>{txs.length === 0 ? "Pas encore de transactions" : "Aucune transaction ne correspond"}</h3>
            <p style={{ fontSize: 14, color: "#64748b" }}>{txs.length === 0 ? "Connecte ta banque via Bridge et synchronise." : "Change de filtre ou ajuste ta recherche."}</p>
          </div>
        ) : (
          <div style={card({ padding: 0, overflow: "hidden" })}>
            {filtered.map((tx, i) => {
              const amount = parseFloat(tx.amount);
              const isIn = amount > 0;
              const cat = tx.categoryId ? catById[tx.categoryId] : null;
              const accountName = accounts.find((a) => a.id === tx.accountId)?.name ?? "—";
              return (
                <div key={tx.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderTop: i === 0 ? "none" : "1px solid #eef0f6", transition: "background 0.15s" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(99,102,241,0.03)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  <div style={{ width: 64, fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>
                    {new Date(tx.bookedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.cleanLabel ?? tx.rawLabel}</div>
                    {tx.counterpartyName && <div style={{ fontSize: 11, color: "#94a3b8" }}>{tx.counterpartyName}</div>}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", width: 120, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{accountName}</div>
                  <div style={{ width: 200 }}>
                    <select
                      value={tx.categoryId ?? ""}
                      onChange={(e) => updateCategory(tx.id, e.target.value || null)}
                      disabled={updatingId === tx.id}
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: tx.categoryId ? `1px solid ${cat?.color ?? "#e2e8f0"}` : "1px dashed #ef4444",
                        background: tx.categoryId ? `${cat?.color ?? "#e2e8f0"}15` : "rgba(239,68,68,0.05)",
                        color: tx.categoryId ? cat?.color ?? "#475569" : "#b91c1c",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <option value="">⚠ Non catégorisé</option>
                      <optgroup label="↓ Encaissements">
                        {categories.filter((c) => c.direction === "inflow").map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
                      </optgroup>
                      <optgroup label="↑ Décaissements">
                        {categories.filter((c) => c.direction === "outflow").map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
                      </optgroup>
                    </select>
                  </div>
                  <div style={{ width: 80, textAlign: "right" }}>
                    {tx.categoryId && (
                      tx.userOverride ? (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 999, background: "rgba(99,102,241,0.15)", color: "#4338ca" }}>✓ Manuel</span>
                      ) : tx.categorizationTier === 3 ? (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 999, background: "rgba(139,92,246,0.15)", color: "#7c3aed" }}>🧙 Claude</span>
                      ) : tx.categorizationTier === 1 ? (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 999, background: "rgba(16,185,129,0.15)", color: "#059669" }}>Règle</span>
                      ) : (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 999, background: "rgba(245,158,11,0.15)", color: "#b45309" }}>IA</span>
                      )
                    )}
                    {tx.categoryConfidence !== null && tx.categoryConfidence < 0.7 && tx.categoryId && !tx.userOverride && (
                      <div style={{ fontSize: 9, color: "#b45309", marginTop: 2 }}>⚠ {Math.round(tx.categoryConfidence * 100)}%</div>
                    )}
                  </div>
                  <div style={{ width: 100, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: isIn ? "#059669" : "#0f172a", fontSize: 13 }}>
                    {isIn ? "+" : ""}{amount.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} {tx.currency === "EUR" ? "€" : tx.currency}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function FilterButton({ children, active, onClick, warn }: { children: React.ReactNode; active: boolean; onClick: () => void; warn?: boolean }) {
  return (
    <button onClick={onClick} style={{ padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600, border: "1px solid", borderColor: active ? (warn ? "#f59e0b" : "#0f172a") : "#e2e8f0", background: active ? (warn ? "#f59e0b" : "#0f172a") : "white", color: active ? "white" : "#475569", cursor: "pointer" }}>
      {children}
    </button>
  );
}

function KpiBox({ label, value, sub, bg, color }: { label: string; value: string; sub: string; bg: string; color: string }) {
  return (<div style={{ padding: 14, borderRadius: 12, background: bg }}><div style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div><div style={{ fontSize: 22, fontWeight: 800, color, marginTop: 4 }}>{value}</div><div style={{ fontSize: 11, color, opacity: 0.7, marginTop: 2 }}>{sub}</div></div>);
}

const card = (s: React.CSSProperties = {}): React.CSSProperties => ({ background: "white", border: "1px solid #eef0f6", borderRadius: 16, boxShadow: "0 1px 2px rgba(15,23,42,0.04)", ...s });