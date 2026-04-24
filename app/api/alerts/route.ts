import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { users, bankAccounts, forecasts, categories } from "@/lib/schema";
import { and, eq, gte, or, isNull, sql } from "drizzle-orm";

export const runtime = "nodejs";

type Alert = {
  id: string;
  severity: "critical" | "warning" | "info";
  icon: string;
  title: string;
  message: string;
  month?: string;
  amount?: number;
  actionLabel?: string;
  actionHref?: string;
};

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return NextResponse.json({ error: "Missing auth" }, { status: 401 });
    const token = authHeader.replace("Bearer ", "");

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const [userRow] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    const orgId = userRow?.defaultOrgId;
    if (!orgId) return NextResponse.json({ error: "Aucune organisation" }, { status: 400 });

    const alerts: Alert[] = [];

    // Cash now
    const [bal] = await db
      .select({ total: sql<string>`COALESCE(SUM(${bankAccounts.balance}), 0)::text` })
      .from(bankAccounts)
      .where(and(eq(bankAccounts.orgId, orgId), eq(bankAccounts.enabled, true)));
    const cashNow = parseFloat(bal?.total ?? "0");

    // Projection 12 mois
    const now = new Date();
    const months: string[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
    }
    const start = months[0];

    const fcRows = await db
      .select({
        categoryId: forecasts.categoryId,
        periodMonth: forecasts.periodMonth,
        plannedAmount: forecasts.plannedAmount,
      })
      .from(forecasts)
      .where(and(eq(forecasts.orgId, orgId), gte(forecasts.periodMonth, start)));

    const netByMonth = new Map<string, number>();
    const inflowByMonth = new Map<string, number>();
    const outflowByMonth = new Map<string, number>();
    for (const m of months) {
      netByMonth.set(m, 0);
      inflowByMonth.set(m, 0);
      outflowByMonth.set(m, 0);
    }

    // Categorize by direction
    const cats = await db
      .select({ id: categories.id, direction: categories.direction })
      .from(categories)
      .where(or(eq(categories.orgId, orgId), isNull(categories.orgId)));
    const directionMap = new Map(cats.map((c) => [c.id, c.direction]));

    for (const f of fcRows) {
      const m = typeof f.periodMonth === "string" ? f.periodMonth.slice(0, 10) : String(f.periodMonth).slice(0, 10);
      if (!netByMonth.has(m)) continue;
      const amount = parseFloat(f.plannedAmount ?? "0");
      netByMonth.set(m, (netByMonth.get(m) ?? 0) + amount);
      const dir = f.categoryId ? directionMap.get(f.categoryId) : null;
      if (dir === "inflow") inflowByMonth.set(m, (inflowByMonth.get(m) ?? 0) + amount);
      else if (dir === "outflow") outflowByMonth.set(m, (outflowByMonth.get(m) ?? 0) + amount);
    }

    // Projection cumulée
    let running = cashNow;
    const cumul: Array<{ month: string; cash: number }> = [];
    for (const m of months) {
      running += netByMonth.get(m) ?? 0;
      cumul.push({ month: m, cash: running });
    }

    // Alerte 1 : Tréso négative
    const firstNegative = cumul.find((p) => p.cash < 0);
    if (firstNegative) {
      alerts.push({
        id: `neg-cash-${firstNegative.month}`,
        severity: "critical",
        icon: "🚨",
        title: "Trésorerie négative prévue",
        message: `Ton solde passera sous zéro en ${monthLabel(firstNegative.month)} (${fmt(firstNegative.cash)}). Il faut agir MAINTENANT : relance clients, reporte charges, découvert négocié.`,
        month: firstNegative.month,
        amount: firstNegative.cash,
        actionLabel: "Simuler des actions",
        actionHref: "/scenarios",
      });
    }

    // Alerte 2 : Creux important (minimum de tréso dans les 12 mois)
    const minPoint = cumul.reduce((min, p) => (p.cash < min.cash ? p : min), cumul[0]);
    if (minPoint && minPoint.cash > 0 && minPoint.cash < cashNow * 0.3 && minPoint.cash < 5000) {
      alerts.push({
        id: `low-cash-${minPoint.month}`,
        severity: "warning",
        icon: "⚠️",
        title: "Creux de trésorerie à surveiller",
        message: `Ton solde atteindra un minimum de ${fmt(minPoint.cash)} en ${monthLabel(minPoint.month)}. Prévois un matelas de sécurité.`,
        month: minPoint.month,
        amount: minPoint.cash,
      });
    }

    // Alerte 3 : Mois avec charges > revenus (déficit mensuel)
    const deficitMonths = months.filter((m) => {
      const io = inflowByMonth.get(m) ?? 0;
      const oo = outflowByMonth.get(m) ?? 0;
      return io > 0 && Math.abs(oo) > io * 1.5;
    });
    if (deficitMonths.length > 0) {
      const m = deficitMonths[0];
      alerts.push({
        id: `deficit-${m}`,
        severity: "warning",
        icon: "📉",
        title: "Mois déficitaire structurel",
        message: `En ${monthLabel(m)}, tes charges prévues (${fmt(Math.abs(outflowByMonth.get(m) ?? 0))}) dépassent largement tes revenus (${fmt(inflowByMonth.get(m) ?? 0)}).`,
        month: m,
      });
    }

    // Alerte 4 : Aucune prévision (forecast vide)
    if (fcRows.length === 0) {
      alerts.push({
        id: "no-forecasts",
        severity: "info",
        icon: "💡",
        title: "Pas encore de prévisions",
        message: "Génère tes prévisions IA sur /pnl pour que les alertes deviennent utiles.",
        actionLabel: "Aller sur P&L",
        actionHref: "/pnl",
      });
    }

    // Alerte 5 : Tout va bien
    if (alerts.length === 0) {
      alerts.push({
        id: "all-good",
        severity: "info",
        icon: "✅",
        title: "Trésorerie sous contrôle",
        message: `Tes 12 prochains mois sont sains. Solde final prévu : ${fmt(cumul[cumul.length - 1].cash)}.`,
      });
    }

    return NextResponse.json({ cashNow, alerts, projection: cumul });
  } catch (err) {
    console.error("[alerts]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

function fmt(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function monthLabel(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(iso));
}