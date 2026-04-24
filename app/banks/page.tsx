// app/banks/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { AppShell } from "@/components/app-shell";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const GRADIENT = "linear-gradient(135deg, #6366f1, #8b5cf6 60%, #ec4899)";

type Connection = { id: string; provider: string; bankName: string; status: string; lastSyncAt: string | null; nextReauthAt: string | null; createdAt: string };
type Account = { id: string; connectionId: string; name: string; iban: string | null; balance: string; currency: string; lastBalanceAt: string | null; enabled: boolean };

export default function BanksPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBalance, setEditingBalance] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [showSyncAfterReturn, setShowSyncAfterReturn] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push("/login");
      setToken(session.access_token);
      await refresh(session.access_token);
      setLoading(false);

      if (searchParams.get("connect") === "success") {
        setBanner({ type: "success", text: "✓ Connexion bancaire autorisée. Clique maintenant sur 'Synchroniser maintenant' pour récupérer tes transactions." });
        setShowSyncAfterReturn(true);
      }
    })();
  }, [router, searchParams]);

  async function refresh(t: string) {
    const res = await fetch("/api/banks", { headers: { Authorization: `Bearer ${t}` } });
    if (res.ok) { const json = await res.json(); setConnections(json.connections || []); setAccounts(json.accounts || []); }
  }

  async function handleAdd(data: { bankName: string; accountName: string; iban: string; balance: number }): Promise<string | null> {
    if (!token) return "Session expirée";
    const res = await fetch("/api/banks", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(data) });
    if (!res.ok) { const text = await res.text(); try { return JSON.parse(text).error ?? `Erreur ${res.status}`; } catch { return `Erreur ${res.status}`; } }
    await refresh(token);
    setModalOpen(false);
    return null;
  }

  async function handleUpdateBalance(accountId: string, newBalance: number) {
    if (!token) return;
    await fetch("/api/banks", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ accountId, balance: newBalance }) });
    await refresh(token);
  }

  async function handleDelete(connectionId: string) {
    if (!token || !confirm("Supprimer cette banque et tous ses comptes ?")) return;
    await fetch(`/api/banks?id=${connectionId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    await refresh(token);
  }

  async function handleConnectBridge() {
    if (!token) return;
    setConnecting(true);
    setBanner(null);
    try {
      const res = await fetch("/api/bridge/connect", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Erreur ${res.status}`);
      window.location.href = json.redirectUrl;
    } catch (err) {
      setBanner({ type: "error", text: `❌ Erreur Bridge : ${(err as Error).message}` });
      setConnecting(false);
    }
  }

  async function handleSync() {
    if (!token) return;
    setSyncing(true);
    setBanner({ type: "info", text: "🔄 Synchronisation en cours..." });
    try {
      const res = await fetch("/api/bridge/sync", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Erreur ${res.status}`);
      const s = json.summary;
      setBanner({
        type: s.transactionsFetchedFromBridge === 0 ? "info" : "success",
        text: `✓ Sync : ${s.accountsCount} comptes · Bridge a renvoyé ${s.transactionsFetchedFromBridge ?? 0} transactions · ${s.transactionsImported} importées · ${s.transactionsCategorized} catégorisées auto · ${s.transactionsSkipped} déjà en base`,
      });
      await refresh(token);
    } catch (err) {
      setBanner({ type: "error", text: `❌ Sync échouée : ${(err as Error).message}` });
    } finally {
      setSyncing(false);
    }
  }

  if (loading) return <AppShell><div style={{ padding: 32 }}>Chargement…</div></AppShell>;

  const totalBalance = accounts.reduce((s, a) => s + parseFloat(a.balance), 0);
  const bridgeConnected = connections.some((c) => c.provider === "bridge");
  const canSync = bridgeConnected || showSyncAfterReturn;
  const byConnection = connections.map((c) => ({ ...c, accounts: accounts.filter((a) => a.connectionId === c.id) }));

  return (
    <AppShell>
      <div style={{ padding: 32 }}>
        <div style={card({ padding: 24, marginBottom: 20, overflow: "hidden", position: "relative" })}>
          <div style={{ position: "absolute", top: 0, right: 0, width: 384, height: 384, borderRadius: "50%", background: GRADIENT, opacity: 0.08, filter: "blur(48px)" }} />
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: GRADIENT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "white" }}>🏦</div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Comptes bancaires</h1>
              <p style={{ fontSize: 14, color: "#64748b", marginTop: 4 }}>Connecte ta banque via Bridge DSP2 pour synchroniser automatiquement, ou ajoute manuellement un compte.</p>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 20 }}>
            <KpiBox label="Solde consolidé" value={fmt(totalBalance) + " €"} sub="sur tous tes comptes" bg="rgba(16,185,129,0.08)" color="#059669" />
            <KpiBox label="Comptes actifs" value={String(accounts.length)} sub={`${connections.length} banque${connections.length > 1 ? "s" : ""}`} bg="rgba(99,102,241,0.08)" color="#4338ca" />
            <KpiBox label="Sync Bridge DSP2" value={bridgeConnected ? "Active" : "Inactive"} sub={bridgeConnected ? "Transactions temps réel" : "Clique Connecter Bridge"} bg="rgba(245,158,11,0.08)" color="#b45309" />
          </div>
        </div>

        {banner && (
          <div style={{ padding: "12px 18px", marginBottom: 16, borderRadius: 12, background: banner.type === "success" ? "rgba(16,185,129,0.1)" : banner.type === "error" ? "rgba(239,68,68,0.1)" : "rgba(99,102,241,0.1)", border: `1px solid ${banner.type === "success" ? "#10b98155" : banner.type === "error" ? "#ef444455" : "#6366f155"}`, fontSize: 13, color: banner.type === "success" ? "#059669" : banner.type === "error" ? "#b91c1c" : "#4338ca", fontWeight: 600 }}>
            {banner.text}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <button onClick={handleConnectBridge} disabled={connecting} style={{ ...btnPrimary, padding: "12px 20px", fontSize: 14, opacity: connecting ? 0.5 : 1 }}>
            {connecting ? "🔄 Redirection..." : "🔐 Connecter ma banque via Bridge"}
          </button>
          {canSync && (
            <button onClick={handleSync} disabled={syncing} style={{ padding: "12px 20px", borderRadius: 12, background: "#10b981", color: "white", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: syncing ? 0.5 : 1, boxShadow: "0 4px 12px rgba(16,185,129,0.3)" }}>
              {syncing ? "🔄 Sync en cours..." : "↻ Synchroniser maintenant"}
            </button>
          )}
          <button onClick={() => setModalOpen(true)} style={{ ...btnSecondary, padding: "12px 20px", fontSize: 14 }}>✏️ Ajouter un compte manuellement</button>
        </div>

        {byConnection.length === 0 ? (
          <div style={card({ padding: 48, textAlign: "center" })}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏦</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>Aucun compte bancaire pour l'instant</h3>
            <p style={{ fontSize: 14, color: "#64748b", maxWidth: 500, margin: "0 auto 20px" }}>
              {canSync ? "Tu es revenu de Bridge, clique sur le bouton vert 'Synchroniser maintenant' ci-dessus pour importer tes transactions." : 'Clique "Connecter ma banque via Bridge" pour une sync auto (recommandé), ou ajoute un compte manuellement.'}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {byConnection.map((conn) => conn.accounts.map((acc) => (
              <AccountCard key={acc.id} connection={conn} account={acc} editing={editingBalance === acc.id} onStartEdit={() => setEditingBalance(acc.id)} onStopEdit={() => setEditingBalance(null)} onSaveBalance={(v) => handleUpdateBalance(acc.id, v)} onDeleteConnection={() => handleDelete(conn.id)} />
            )))}
          </div>
        )}

        {modalOpen && <AddBankModal onClose={() => setModalOpen(false)} onSave={handleAdd} />}
      </div>
    </AppShell>
  );
}

function AccountCard({ connection, account, editing, onStartEdit, onStopEdit, onSaveBalance, onDeleteConnection }: { connection: Connection; account: Account; editing: boolean; onStartEdit: () => void; onStopEdit: () => void; onSaveBalance: (v: number) => void; onDeleteConnection: () => void }) {
  const [local, setLocal] = useState(parseFloat(account.balance).toString());
  useEffect(() => setLocal(parseFloat(account.balance).toString()), [account.balance]);
  const isManual = connection.provider === "manual";
  const iban = account.iban ?? "";
  const maskedIban = iban.length > 8 ? `${iban.slice(0, 4)} **** ${iban.slice(-4)}` : iban || "Pas d'IBAN";
  const lastSync = account.lastBalanceAt ? timeSince(new Date(account.lastBalanceAt)) : "jamais";

  return (
    <div style={card({ padding: 20, position: "relative", overflow: "hidden" })}>
      <div style={{ position: "absolute", top: 0, right: 0, width: 120, height: 120, borderRadius: "50%", background: isManual ? "#f1f5f9" : "rgba(99,102,241,0.1)", opacity: 0.6 }} />
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: isManual ? "#475569" : "#6366f1", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16 }}>{connection.bankName[0]?.toUpperCase() ?? "?"}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{connection.bankName}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{account.name}</div>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: isManual ? "#f1f5f9" : "rgba(16,185,129,0.15)", color: isManual ? "#475569" : "#059669" }}>{isManual ? "Manuel" : "Bridge"}</span>
        </div>
        {editing ? (
          <div style={{ marginBottom: 12 }}>
            <input type="number" value={local} onChange={(e) => setLocal(e.target.value)} autoFocus style={{ fontSize: 28, fontWeight: 800, width: "100%", padding: "8px 12px", border: "2px solid #6366f1", borderRadius: 10, outline: "none", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button onClick={() => { const v = parseFloat(local); if (!isNaN(v)) onSaveBalance(v); onStopEdit(); }} style={btnPrimary}>Sauvegarder</button>
              <button onClick={onStopEdit} style={btnSecondary}>Annuler</button>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4, cursor: isManual ? "pointer" : "default" }} onClick={() => isManual && onStartEdit()}>{fmt(parseFloat(account.balance))} <span style={{ fontSize: 20 }}>€</span></div>
        )}
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>
          <div>{maskedIban}</div>
          <div>Dernière MAJ : {lastSync}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {isManual && <button onClick={onStartEdit} style={{ ...btnSecondary, flex: 1 }}>Modifier le solde</button>}
          <button onClick={onDeleteConnection} style={{ ...btnSecondary, color: "#b91c1c", flex: isManual ? undefined : 1 }}>Supprimer</button>
        </div>
      </div>
    </div>
  );
}

function AddBankModal({ onClose, onSave }: { onClose: () => void; onSave: (data: { bankName: string; accountName: string; iban: string; balance: number }) => Promise<string | null> }) {
  const [form, setForm] = useState({ bankName: "", accountName: "Compte principal", iban: "", balance: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const COMMON_BANKS = ["Qonto", "BNP Paribas", "Crédit Agricole", "Crédit Mutuel", "Société Générale", "LCL", "Boursorama", "Shine", "Revolut", "N26"];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.bankName.trim()) return setError("Nom de la banque requis");
    const bal = parseFloat(form.balance);
    if (isNaN(bal)) return setError("Solde invalide");
    setSaving(true);
    const err = await onSave({ bankName: form.bankName.trim(), accountName: form.accountName.trim() || "Compte principal", iban: form.iban.trim(), balance: bal });
    setSaving(false);
    if (err) setError(err);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }} onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 20, padding: 28, width: "100%", maxWidth: 480, boxShadow: "0 24px 48px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Ajouter un compte bancaire</h2>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}>✕</button>
        </div>
        <p style={{ fontSize: 12, color: "#92400e", margin: "0 0 16px", padding: "10px 12px", borderRadius: 8, background: "#fef3c7", border: "1px solid #fcd34d" }}>💡 <strong>Mode manuel :</strong> tu renseignes le solde à la main. Pour une sync auto des transactions, utilise "Connecter via Bridge".</p>
        {error && (<div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#b91c1c", fontSize: 13, marginBottom: 16 }}>⚠ {error}</div>)}
        <Label>Nom de la banque *</Label><Input value={form.bankName} onChange={(v) => setForm({ ...form, bankName: v })} placeholder="Ex: Qonto, BNP Paribas…" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, marginBottom: 4 }}>
          {COMMON_BANKS.map((b) => (<button key={b} type="button" onClick={() => setForm({ ...form, bankName: b })} style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, border: "1px solid #e2e8f0", background: form.bankName === b ? "#6366f1" : "white", color: form.bankName === b ? "white" : "#475569", cursor: "pointer", fontWeight: 600 }}>{b}</button>))}
        </div>
        <Label>Nom du compte</Label><Input value={form.accountName} onChange={(v) => setForm({ ...form, accountName: v })} placeholder="Compte principal…" />
        <Label>IBAN (optionnel)</Label><Input value={form.iban} onChange={(v) => setForm({ ...form, iban: v })} placeholder="FR76 1234 5678…" />
        <Label>Solde actuel (€) *</Label><Input type="number" value={form.balance} onChange={(v) => setForm({ ...form, balance: v })} placeholder="12500" />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button type="button" onClick={onClose} style={btnSecondary}>Annuler</button>
          <button type="submit" disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>{saving ? "Ajout…" : "Ajouter le compte"}</button>
        </div>
      </form>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) { return <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginTop: 12, marginBottom: 6 }}>{children}</div>; }
function Input({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (<input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box" }} onFocus={(e) => { e.target.style.borderColor = "#6366f1"; e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.15)"; }} onBlur={(e) => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "none"; }} />);
}
function KpiBox({ label, value, sub, bg, color }: { label: string; value: string; sub: string; bg: string; color: string }) {
  return (<div style={{ padding: 14, borderRadius: 12, background: bg }}><div style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div><div style={{ fontSize: 20, fontWeight: 800, color, marginTop: 4 }}>{value}</div><div style={{ fontSize: 11, color, opacity: 0.7, marginTop: 2 }}>{sub}</div></div>);
}
function fmt(n: number) { return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }); }
function timeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "à l'instant";
  if (seconds < 3600) return `il y a ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `il y a ${Math.floor(seconds / 3600)} h`;
  return `il y a ${Math.floor(seconds / 86400)} j`;
}
const card = (s: React.CSSProperties = {}): React.CSSProperties => ({ background: "white", border: "1px solid #eef0f6", borderRadius: 16, boxShadow: "0 1px 2px rgba(15,23,42,0.04)", ...s });
const btnPrimary: React.CSSProperties = { padding: "8px 16px", borderRadius: 12, background: GRADIENT, color: "white", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const btnSecondary: React.CSSProperties = { padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, border: "1px solid #e2e8f0", background: "white", color: "#475569", cursor: "pointer" };