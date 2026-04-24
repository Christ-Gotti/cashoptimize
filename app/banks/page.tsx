"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { AppShell } from "@/components/app-shell";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const GRADIENT = "linear-gradient(135deg, #6366f1, #8b5cf6 60%, #ec4899)";

type BankAccount = {
  id: string;
  name: string;
  balance: string;
  currency: string;
  iban: string | null;
};

export default function BanksPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Non connecté");
        setLoading(false);
        return;
      }
      const res = await fetch("/api/banks", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      setAccounts(body.accounts ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <AppShell>
      <div style={{ padding: 32, maxWidth: 1000 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Comptes bancaires</h1>
        <p style={{ fontSize: 14, color: "#64748b", marginTop: 8, marginBottom: 24 }}>
          Tes comptes connectés. Pour ajouter un compte, utilise l&apos;import CSV.
        </p>

        {loading && <div style={{ color: "#64748b" }}>Chargement…</div>}

        {error && (
          <div style={{ padding: 12, borderRadius: 10, background: "#fee2e2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: 13 }}>
            {error}
          </div>
        )}

        {!loading && !error && accounts.length === 0 && (
          <div style={{ padding: 40, background: "white", borderRadius: 16, border: "1px solid #e2e8f0", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏦</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Aucun compte connecté</div>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
              Importe un CSV depuis ta banque pour commencer.
            </p>
            <a href="/import-csv" style={{ display: "inline-block", padding: "10px 20px", borderRadius: 10, background: GRADIENT, color: "white", textDecoration: "none", fontWeight: 700, fontSize: 14 }}>
              Importer un CSV →
            </a>
          </div>
        )}

        {!loading && !error && accounts.length > 0 && (
          <div style={{ background: "white", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: 12, textAlign: "left", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5 }}>Compte</th>
                  <th style={{ padding: 12, textAlign: "left", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5 }}>IBAN</th>
                  <th style={{ padding: 12, textAlign: "right", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5 }}>Solde</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: 12, fontSize: 14 }}>{a.name}</td>
                    <td style={{ padding: 12, fontSize: 13, color: "#64748b", fontFamily: "monospace" }}>{a.iban ?? "—"}</td>
                    <td style={{ padding: 12, textAlign: "right", fontSize: 14, fontWeight: 700 }}>
                      {parseFloat(a.balance).toLocaleString("fr-FR", { style: "currency", currency: a.currency })}
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