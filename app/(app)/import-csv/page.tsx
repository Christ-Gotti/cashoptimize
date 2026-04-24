"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { AppShell } from "@/components/app-shell";
import Papa from "papaparse";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const GRADIENT = "linear-gradient(135deg, #6366f1, #8b5cf6 60%, #ec4899)";

type ParsedRow = Record<string, string>;
type Mapping = { date: string | null; label: string | null; amount: string | null; debit: string | null; credit: string | null; counterparty: string | null };

function normalize(s: string) { return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }

function detectColumns(headers: string[]): Mapping {
  const find = (keys: string[]) => headers.find(h => keys.some(k => normalize(h).includes(k))) ?? null;
  return {
    date: find(["date operat", "date valeur", "date comptab"]) ?? headers.find(h => normalize(h) === "date") ?? null,
    label: find(["libelle", "description", "communication", "tiers", "reference"]) ?? null,
    amount: find(["montant euro", "montant operation"]) ?? headers.find(h => normalize(h) === "montant" || normalize(h) === "amount") ?? null,
    debit: find(["debit"]) ?? null,
    credit: find(["credit"]) ?? null,
    counterparty: find(["contrepartie", "beneficiaire", "emetteur"]) ?? null,
  };
}

function parseDate(s: string): string | null {
  const t = s?.trim() ?? "";
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = t.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

function parseAmount(s: string): number | null {
  if (!s) return null;
  const c = s.trim().replace(/\s|\u00a0/g, "").replace(",", ".");
  const n = parseFloat(c);
  return Number.isFinite(n) ? n : null;
}

export default function ImportCsvPage() {
  const router = useRouter();
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Mapping>({ date: null, label: null, amount: null, debit: null, credit: null, counterparty: null });
  const [accountName, setAccountName] = useState("Compte principal");
  const [status, setStatus] = useState<"idle" | "parsing" | "preview" | "importing" | "done">("idle");
  const [result, setResult] = useState<{ imported: number; skipped: number; categorized: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File) {
    setFileName(file.name);
    setStatus("parsing");
    setError(null);
    Papa.parse<ParsedRow>(file, {
      header: true,
      skipEmptyLines: true,
      delimitersToGuess: [",", ";", "\t", "|"],
      encoding: "UTF-8",
      complete: (results) => {
        const data = results.data;
        const hdrs = results.meta.fields ?? [];
        if (hdrs.length === 0 || data.length === 0) {
          setError("Impossible de lire le CSV. Vérifie l'en-tête et les données.");
          setStatus("idle");
          return;
        }
        setHeaders(hdrs);
        setRows(data);
        setMapping(detectColumns(hdrs));
        setStatus("preview");
      },
      error: (err) => { setError(`Parsing: ${err.message}`); setStatus("idle"); },
    });
  }

  async function handleImport() {
    if (!mapping.date || !mapping.label) { setError("Date et libellé sont obligatoires."); return; }
    if (!mapping.amount && (!mapping.debit || !mapping.credit)) { setError("Soit une colonne montant signé, soit débit + crédit."); return; }
    setStatus("importing");
    setError(null);

    const prepared = rows.map((row) => {
      const date = parseDate(row[mapping.date!] ?? "");
      const label = (row[mapping.label!] ?? "").trim();
      let amount: number | null = null;
      if (mapping.amount) {
        amount = parseAmount(row[mapping.amount]);
      } else if (mapping.debit && mapping.credit) {
        const d = parseAmount(row[mapping.debit]) ?? 0;
        const c = parseAmount(row[mapping.credit]) ?? 0;
        amount = c !== 0 ? Math.abs(c) : d !== 0 ? -Math.abs(d) : null;
      }
      return {
        date,
        label,
        amount,
        counterparty: mapping.counterparty ? ((row[mapping.counterparty] ?? "").trim() || undefined) : undefined,
      };
    }).filter(r => r.date && r.label && Number.isFinite(r.amount));

    if (prepared.length === 0) {
      setError("Aucune ligne valide. Vérifie le mapping.");
      setStatus("preview");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/transactions/import-csv", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ rows: prepared, accountName: accountName.trim() }),
    });
    const body = await res.json();
    if (!res.ok) { setError(body.error ?? "Erreur import"); setStatus("preview"); return; }
    setResult({ imported: body.imported, skipped: body.skipped, categorized: body.categorized });
    setStatus("done");
  }

  function reset() {
    setFileName(""); setHeaders([]); setRows([]);
    setMapping({ date: null, label: null, amount: null, debit: null, credit: null, counterparty: null });
    setStatus("idle"); setResult(null); setError(null);
  }

  return (
    <AppShell>
      <div style={{ padding: 32, maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Importer tes transactions</h1>
        <p style={{ fontSize: 14, color: "#64748b", marginTop: 8, marginBottom: 24 }}>
          Exporte un CSV depuis ta banque (BNP, Crédit Agricole, Qonto, SG, LCL, Crédit Mutuel…), dépose-le ici, on fait le reste.
        </p>

        {status === "idle" && <DropZone onFile={handleFile} />}

        {status === "parsing" && (
          <Panel>Parsing du CSV…</Panel>
        )}

        {status === "preview" && (
          <div style={{ background: "white", borderRadius: 16, border: "1px solid #e2e8f0" }}>
            <div style={{ padding: 20, borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700 }}>📄 {fileName}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{rows.length} lignes détectées</div>
              </div>
              <button onClick={reset} style={BTN_OUTLINE}>Changer de fichier</button>
            </div>

            <div style={{ padding: 20, borderBottom: "1px solid #f1f5f9" }}>
              <div style={LABEL_SECTION}>Mapping des colonnes</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <MappingField label="Date *" value={mapping.date} options={headers} onChange={(v) => setMapping({ ...mapping, date: v })} />
                <MappingField label="Libellé *" value={mapping.label} options={headers} onChange={(v) => setMapping({ ...mapping, label: v })} />
                <MappingField label="Montant signé (si 1 colonne)" value={mapping.amount} options={headers} onChange={(v) => setMapping({ ...mapping, amount: v })} />
                <MappingField label="Contrepartie (optionnel)" value={mapping.counterparty} options={headers} onChange={(v) => setMapping({ ...mapping, counterparty: v })} />
                {!mapping.amount && (
                  <>
                    <MappingField label="Débit (si séparé)" value={mapping.debit} options={headers} onChange={(v) => setMapping({ ...mapping, debit: v })} />
                    <MappingField label="Crédit (si séparé)" value={mapping.credit} options={headers} onChange={(v) => setMapping({ ...mapping, credit: v })} />
                  </>
                )}
              </div>
              <div style={{ marginTop: 16 }}>
                <label style={LABEL}>Nom du compte (visible dans /banks)</label>
                <input type="text" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="ex: BNP Pro" style={INPUT} />
              </div>
            </div>

            <div style={{ padding: 20, overflowX: "auto" }}>
              <div style={LABEL_SECTION}>Aperçu (5 premières lignes)</div>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr>{headers.map((h) => <th key={h} style={{ padding: 8, textAlign: "left", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", fontWeight: 700 }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((row, i) => (
                    <tr key={i}>{headers.map((h) => <td key={h} style={{ padding: 8, borderBottom: "1px solid #f1f5f9", color: "#475569", whiteSpace: "nowrap" }}>{row[h]}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ padding: 20, borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={handleImport} style={{ ...BTN_PRIMARY, fontSize: 15 }}>
                Importer {rows.length} transactions →
              </button>
            </div>
          </div>
        )}

        {status === "importing" && (
          <Panel>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚡</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Import en cours…</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>
              On importe et on catégorise avec Claude. 10 à 60 secondes selon le volume.
            </div>
          </Panel>
        )}

        {status === "done" && result && (
          <Panel>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, marginBottom: 8 }}>Import terminé</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, margin: "24px 0" }}>
              <Stat value={result.imported} label="Importées" color="#6366f1" />
              <Stat value={result.categorized} label="Catégorisées" color="#10b981" />
              <Stat value={result.skipped} label="Ignorées (déjà là)" color="#94a3b8" />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
              <button onClick={reset} style={BTN_OUTLINE}>Importer un autre fichier</button>
              <button onClick={() => router.push("/pnl")} style={BTN_PRIMARY}>Voir mon tableau →</button>
            </div>
          </Panel>
        )}

        {error && (
          <div style={{ padding: 12, borderRadius: 10, background: "#fee2e2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: 13, marginTop: 16 }}>
            {error}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function DropZone({ onFile }: { onFile: (f: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const inp = useRef<HTMLInputElement>(null);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); }}
      onClick={() => inp.current?.click()}
      style={{ padding: "60px 24px", background: dragging ? "#eef2ff" : "white", border: `2px dashed ${dragging ? "#6366f1" : "#cbd5e1"}`, borderRadius: 16, textAlign: "center", cursor: "pointer", transition: "all 0.2s" }}
    >
      <div style={{ fontSize: 48, marginBottom: 12 }}>📂</div>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Glisse ton CSV ici</div>
      <div style={{ fontSize: 13, color: "#64748b" }}>ou clique pour sélectionner un fichier</div>
      <input ref={inp} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      <div style={{ marginTop: 24, fontSize: 11, color: "#94a3b8" }}>Séparateur auto-détecté (virgule, point-virgule, tab)</div>
    </div>
  );
}

function MappingField({ label, value, options, onChange }: { label: string; value: string | null; options: string[]; onChange: (v: string | null) => void }) {
  return (
    <div>
      <label style={LABEL}>{label}</label>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} style={INPUT}>
        <option value="">—</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{ padding: 16, background: "#f8fafc", borderRadius: 12 }}>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 600, letterSpacing: 0.5, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 48, textAlign: "center", background: "white", borderRadius: 16, border: "1px solid #e2e8f0" }}>{children}</div>;
}

const LABEL: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 };
const LABEL_SECTION: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 };
const INPUT: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 14, background: "white", outline: "none", color: "#0f172a" };
const BTN_PRIMARY: React.CSSProperties = { padding: "10px 18px", borderRadius: 12, border: "none", background: GRADIENT, color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer" };
const BTN_OUTLINE: React.CSSProperties = { padding: "10px 18px", borderRadius: 12, border: "1px solid #e2e8f0", background: "white", color: "#475569", fontWeight: 600, fontSize: 14, cursor: "pointer" };