"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { AppShell } from "@/components/app-shell";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const GRADIENT = "linear-gradient(135deg, #6366f1, #8b5cf6 60%, #ec4899)";

type DashboardData = {
  user: { id: string; email: string; fullName: string | null };
  org: { id: string; name: string; country: string; plan: string } | null;
  stats: {
    totalBalance: number;
    accountsCount: number;
    activeAlertsCount: number;
    engagementsCount: number;
    monthlyCommitments: number;
    transactionsCount: number;
  };
};

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push("/login");
      const res = await fetch("/api/dashboard", { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (res.ok) setData(await res.json());
      setLoading(false);
    })();
  }, [router]);

  if (loading) return <AppShell><div style={{ padding: 32 }}>Chargement…</div></AppShell>;
  if (!data) return <AppShell><div style={{ padding: 32 }}>Erreur de chargement</div></AppShell>;

  const firstName = data.user?.fullName?.split(" ")[0] ?? "Christophe";
  const totalBalance = data.stats?.totalBalance ?? 0;
  const accountsCount = data.stats?.accountsCount ?? 0;
  const activeAlertsCount = data.stats?.activeAlertsCount ?? 0;
  const engagementsCount = data.stats?.engagementsCount ?? 0;
  const monthlyCommitments = data.stats?.monthlyCommitments ?? 0;
  const transactionsCount = data.stats?.transactionsCount ?? 0;
  const hasData = totalBalance > 0 || accountsCount > 0;

  return (
    <AppShell>
      <div style={{ padding: 32 }}>
        <div style={{ ...cardStyle, padding: 24, marginBottom: 24, overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, right: 0, width: 384, height: 384, borderRadius: "50%", background: GRADIENT, opacity: 0.1, filter: "blur(48px)" }} />
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: GRADIENT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: "white", boxShadow: "0 4px 16px rgba(99,102,241,0.3)" }}>📈</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 999, background: "#10b981" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: 1.5 }}>Trésorerie en temps réel</span>
              </div>
              <h2 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>
                Bonjour {firstName}, ton cash aujourd&apos;hui :{" "}
                <span style={{ background: GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {totalBalance.toLocaleString("fr-FR")} €
                </span>
              </h2>
              <p style={{ fontSize: 14, color: "#64748b", marginTop: 6 }}>
                {hasData ? "Tes comptes bancaires sont synchronisés. 🔥" : "Ajoute ta première banque dans Comptes bancaires pour voir ton cash réel."}
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 24 }}>
          <KpiCard label="Solde actuel" value={`${totalBalance.toLocaleString("fr-FR")} €`} iconBg="#e0e7ff" iconColor="#6366f1" icon="💰" trend={hasData ? "Sync OK" : "Aucune donnée"} />
          <KpiCard label="Comptes connectés" value={accountsCount.toString()} iconBg="#fce7f3" iconColor="#ec4899" icon="🏦" trend={accountsCount === 0 ? "À configurer" : "Actifs"} />
          <KpiCard label="Engagements en cours" value={engagementsCount.toString()} iconBg="#ddd6fe" iconColor="#8b5cf6" icon="🛣" trend={`-${monthlyCommitments.toLocaleString("fr-FR")} €/mois`} />
          <KpiCard label="Alertes actives" value={activeAlertsCount.toString()} iconBg="#fee2e2" iconColor="#ef4444" icon="🚨" trend={activeAlertsCount === 0 ? "Tout est calme" : "Action requise"} />
        </div>

        <div style={{ padding: 16, borderRadius: 12, background: "#eef2ff", fontSize: 12, color: "#64748b" }}>
          <strong style={{ color: "#4338ca" }}>État système :</strong> user <code>{data.user?.id?.slice(0, 8) ?? "—"}…</code> · org <code>{data.org?.id?.slice(0, 8) ?? "—"}</code> · {transactionsCount} transactions en base · {accountsCount} banques connectées
        </div>
      </div>
    </AppShell>
  );
}

function KpiCard({ label, value, icon, iconBg, iconColor, trend }: { label: string; value: string; icon: string; iconBg: string; iconColor: string; trend: string }) {
  return (
    <div style={{ ...cardStyle, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{icon}</div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: iconColor }}>{value}</div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{trend}</div>
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: "white", border: "1px solid #eef0f6", borderRadius: 20, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" };