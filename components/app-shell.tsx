"use client";

import { useEffect, useState, ReactNode } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const GRADIENT = "linear-gradient(135deg, #6366f1, #8b5cf6 60%, #ec4899)";

const NAV: Array<{ href: string; icon: string; label: string; soon?: boolean }> = [
  { href: "/dashboard", icon: "📊", label: "Dashboard" },
  { href: "/pnl", icon: "📋", label: "Tableau P&L" },
  { href: "/import", icon: "✨", label: "Import intelligent", soon: true },
  { href: "/chat", icon: "💬", label: "Assistant IA" },
  { href: "/engagements", icon: "🛣", label: "Engagements" },
  { href: "/scenarios", icon: "🧙", label: "Scénarios", soon: true },
  { href: "/alerts", icon: "🔔", label: "Alertes", soon: true },
  { href: "/banks", icon: "🏦", label: "Comptes bancaires" },
  { href: "/reports", icon: "📄", label: "Rapports", soon: true },
  { href: "/referral", icon: "🎁", label: "Parrainage" },
  { href: "/pricing", icon: "🏷", label: "Tarifs", soon: true },
];

type UserInfo = { id: string; email: string; fullName: string | null };
type OrgInfo = { id: string; name: string; plan: string; country: string };

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [org, setOrg] = useState<OrgInfo | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      try {
        const res = await fetch("/api/dashboard", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const json = await res.json();
          setUser(json.user);
          setOrg(json.org);
        }
      } catch (e) {
        console.error("[AppShell]", e);
      }
    })();
  }, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const initials = (() => {
  const source = user?.fullName ?? user?.email ?? "";
  const parts = source.replace(/@.*$/, "").split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return "•";
})();

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f7f8fc", fontFamily: "'Inter', system-ui, sans-serif", color: "#0f172a" }}>
      <aside style={sidebarStyle}>
        <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32, textDecoration: "none", color: "inherit" }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: GRADIENT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "white", boxShadow: "0 4px 12px rgba(99,102,241,0.3)" }}>⚡</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>CashOptimize</div>
            <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500, marginTop: -2 }}>Pilote ton cash</div>
          </div>
        </Link>

        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} style={{ ...navItemStyle, ...(active ? navItemActiveStyle : {}) }}>
                <span style={{ width: 20, textAlign: "center" }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.soon && (
                  <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 999, background: "rgba(245,158,11,0.12)", color: "#b45309" }}>Bientôt</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div style={{ marginTop: "auto" }}>
          <div style={{ padding: 1, borderRadius: 16, background: GRADIENT }}>
            <div style={{ background: "white", borderRadius: 15, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span>🚀</span>
                <span style={{ fontWeight: 700, fontSize: 14 }}>CashOptimize Pro</span>
              </div>
              <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 12px" }}>Déverrouille l'IA prédictive et les scénarios illimités.</p>
              <Link href="/pricing" style={{ display: "block", textAlign: "center", textDecoration: "none", padding: "8px 12px", borderRadius: 8, background: GRADIENT, color: "white", fontSize: 12, fontWeight: 700 }}>Passer à Pro</Link>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, padding: 8, borderRadius: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 999, background: GRADIENT, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
            
              <div style={{ fontSize: 11, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{org?.name ?? "…"}</div>
            </div>
            <button onClick={signOut} title="Déconnexion" style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16, padding: 4 }}>⎋</button>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
    </div>
  );
}

export function ComingSoon({ icon, title, description, sprint }: { icon: string; title: string; description: string; sprint: string }) {
  return (
    <div style={{ padding: 32 }}>
      <div style={{ maxWidth: 720, margin: "80px auto", padding: 48, textAlign: "center", background: "white", borderRadius: 24, border: "1px solid #eef0f6", boxShadow: "0 1px 2px rgba(15,23,42,0.04)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, right: 0, width: 320, height: 320, borderRadius: "50%", background: GRADIENT, opacity: 0.06, filter: "blur(48px)" }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 72, marginBottom: 16 }}>{icon}</div>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 8px" }}>{title}</h1>
          <p style={{ fontSize: 15, color: "#64748b", maxWidth: 520, margin: "0 auto 24px", lineHeight: 1.6 }}>{description}</p>
          <span style={{ display: "inline-block", padding: "8px 20px", borderRadius: 999, background: "rgba(99,102,241,0.1)", color: "#4338ca", fontSize: 12, fontWeight: 700 }}>🚧 Prévu pour {sprint}</span>
        </div>
      </div>
    </div>
  );
}

const sidebarStyle: React.CSSProperties = { width: 260, background: "white", borderRight: "1px solid #eef0f6", padding: 20, display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" };
const navItemStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 12, color: "#64748b", fontWeight: 500, fontSize: 14, cursor: "pointer", textDecoration: "none", transition: "all 0.15s" };
const navItemActiveStyle: React.CSSProperties = { background: "linear-gradient(135deg, rgba(99,102,241,.12), rgba(236,72,153,.08))", color: "#4f46e5", fontWeight: 700 };