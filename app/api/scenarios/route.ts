import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { users, bankAccounts, forecasts } from "@/lib/schema";
import { and, eq, gte, sql } from "drizzle-orm";

export const runtime = "nodejs";

type Adjustment = {
  id: string;
  type: "hire" | "revenue_change" | "delay_payment" | "loan_injection" | "custom";
  label: string;
  amount: number;
  startMonth: string;
  durationMonths: number;
};

export async function POST(req: Request) {
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

    const body = (await req.json()) as { adjustments: Adjustment[]; horizon?: number };
    const horizon = Math.min(Math.max(body.horizon ?? 12, 3), 24);

    const [bal] = await db
      .select({ total: sql<string>`COALESCE(SUM(${bankAccounts.balance}), 0)::text` })
      .from(bankAccounts)
      .where(and(eq(bankAccounts.orgId, orgId), eq(bankAccounts.enabled, true)));
    const cashNow = parseFloat(bal?.total ?? "0");

    const now = new Date();
    const months: string[] = [];
    for (let i = 0; i < horizon; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
    }

    const start = months[0];

    const fcRows = await db
      .select({
        periodMonth: forecasts.periodMonth,
        plannedAmount: forecasts.plannedAmount,
      })
      .from(forecasts)
      .where(and(
        eq(forecasts.orgId, orgId),
        gte(forecasts.periodMonth, start),
      ));

    const netByMonth = new Map<string, number>();
    for (const m of months) netByMonth.set(m, 0);
    for (const f of fcRows) {
      const m = typeof f.periodMonth === "string" ? f.periodMonth.slice(0, 10) : String(f.periodMonth).slice(0, 10);
      if (netByMonth.has(m)) {
        netByMonth.set(m, (netByMonth.get(m) ?? 0) + parseFloat(f.plannedAmount ?? "0"));
      }
    }

    const scenarioNet = new Map<string, number>(netByMonth);
    for (const adj of body.adjustments) {
      const startIdx = months.indexOf(adj.startMonth);
      if (startIdx === -1) continue;
      for (let i = 0; i < adj.durationMonths && startIdx + i < months.length; i++) {
        const m = months[startIdx + i];
        scenarioNet.set(m, (scenarioNet.get(m) ?? 0) + adj.amount);
      }
    }

    let baselineRunning = cashNow;
    let scenarioRunning = cashNow;
    const projection = months.map((m) => {
      baselineRunning += netByMonth.get(m) ?? 0;
      scenarioRunning += scenarioNet.get(m) ?? 0;
      return {
        month: m,
        baselineNet: netByMonth.get(m) ?? 0,
        scenarioNet: scenarioNet.get(m) ?? 0,
        baselineCash: baselineRunning,
        scenarioCash: scenarioRunning,
        delta: scenarioRunning - baselineRunning,
      };
    });

    const minBaseline = Math.min(...projection.map((p) => p.baselineCash));
    const minScenario = Math.min(...projection.map((p) => p.scenarioCash));
    const finalBaseline = projection[projection.length - 1].baselineCash;
    const finalScenario = projection[projection.length - 1].scenarioCash;

    return NextResponse.json({
      cashNow,
      horizon,
      projection,
      kpis: {
        finalBaseline,
        finalScenario,
        finalDelta: finalScenario - finalBaseline,
        minBaseline,
        minScenario,
        baselineInRedMonths: projection.filter((p) => p.baselineCash < 0).length,
        scenarioInRedMonths: projection.filter((p) => p.scenarioCash < 0).length,
      },
    });
  } catch (err) {
    console.error("[scenarios]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}