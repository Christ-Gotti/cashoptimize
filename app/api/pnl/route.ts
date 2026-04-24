import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { users, categories, transactions, forecasts, bankAccounts } from "@/lib/schema";
import { and, eq, gte, lte, or, isNull, sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    if (!orgId) return NextResponse.json({ error: "Aucune organisation liée" }, { status: 400 });

    const url = new URL(req.url);
    const pastMonths = Math.min(Math.max(parseInt(url.searchParams.get("past") ?? "1", 10), 0), 24);
    const futureMonths = Math.min(Math.max(parseInt(url.searchParams.get("future") ?? "4", 10), 0), 24);
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + offset - pastMonths, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + offset + futureMonths, 1);
    const toMonthISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
const months: string[] = [];
for (let d = new Date(start); d <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
  months.push(toMonthISO(d));
}
const currentMonth = toMonthISO(new Date(now.getFullYear(), now.getMonth(), 1));
    const cats = await db
      .select({
        id: categories.id,
        label: categories.label,
        direction: categories.direction,
        color: categories.color,
        icon: categories.icon,
        slug: categories.slug,
        orgId: categories.orgId,
      })
      .from(categories)
      .where(or(eq(categories.orgId, orgId), isNull(categories.orgId)))
      .orderBy(categories.direction, categories.label);

    const fcRows = await db
      .select({
        categoryId: forecasts.categoryId,
        periodMonth: forecasts.periodMonth,
        plannedAmount: forecasts.plannedAmount,
        confidence: forecasts.confidence,
        userOverride: forecasts.userOverride,
      })
      .from(forecasts)
      .where(and(eq(forecasts.orgId, orgId), gte(forecasts.periodMonth, start.toISOString().slice(0, 10)), lte(forecasts.periodMonth, end.toISOString().slice(0, 10))));

    const txResult = await db.execute(sql`
      SELECT
        category_id AS "categoryId",
        to_char(date_trunc('month', booked_at), 'YYYY-MM-01') AS "month",
        SUM(amount)::text AS "total"
      FROM transactions
      WHERE org_id = ${orgId}
        AND booked_at >= ${start.toISOString().slice(0, 10)}
        AND booked_at <= ${end.toISOString().slice(0, 10)}
      GROUP BY category_id, date_trunc('month', booked_at)
    `);
    const rawTx = txResult as unknown;
    const txRows: Array<{ categoryId: string | null; month: string; total: string | null }> = Array.isArray(rawTx)
      ? (rawTx as Array<{ categoryId: string | null; month: string; total: string | null }>)
      : rawTx && typeof rawTx === "object" && "rows" in (rawTx as object)
        ? (rawTx as { rows: Array<{ categoryId: string | null; month: string; total: string | null }> }).rows
        : [];

    const [balanceRow] = await db
      .select({ total: sql<string>`COALESCE(SUM(${bankAccounts.balance}), 0)::text` })
      .from(bankAccounts)
      .where(and(eq(bankAccounts.orgId, orgId), eq(bankAccounts.enabled, true)));
    const cashNow = parseFloat(balanceRow?.total ?? "0");

    type Cell = { planned: number | null; realized: number | null; userOverride: boolean; confidence: number | null };
    const cells = new Map<string, Cell>();
    const key = (c: string | null, m: string) => `${c ?? "null"}|${m}`;

    for (const f of fcRows) {
      const monthStr = typeof f.periodMonth === "string" ? f.periodMonth.slice(0, 10) : String(f.periodMonth).slice(0, 10);
      cells.set(key(f.categoryId, monthStr), {
        planned: parseFloat(f.plannedAmount ?? "0"),
        realized: null,
        userOverride: f.userOverride,
        confidence: f.confidence ?? null,
      });
    }
    for (const t of txRows) {
      const k = key(t.categoryId, t.month);
      const existing = cells.get(k) ?? { planned: null, realized: null, userOverride: false, confidence: null };
      existing.realized = parseFloat(t.total ?? "0");
      cells.set(k, existing);
    }

    const rows = cats.map((c) => ({
      category: { id: c.id, label: c.label, direction: c.direction, color: c.color, slug: c.slug, isGlobal: c.orgId === null },
      cells: months.map((m) => {
        const cell = cells.get(key(c.id, m)) ?? { planned: null, realized: null, userOverride: false, confidence: null };
        return { month: m, ...cell };
      }),
    }));

    const totals = months.map((m) => {
      let ip = 0, ir = 0, op = 0, or_ = 0;
      for (const r of rows) {
        const cell = r.cells.find((cc) => cc.month === m);
        if (!cell) continue;
        if (r.category.direction === "inflow") {
          ip += cell.planned ?? 0;
          ir += cell.realized ?? 0;
        } else {
          op += cell.planned ?? 0;
          or_ += cell.realized ?? 0;
        }
      }
      return { month: m, inflow: { planned: ip, realized: ir }, outflow: { planned: op, realized: or_ }, net: { planned: ip + op, realized: ir + or_ } };
    });

    const currentIdx = months.indexOf(currentMonth);
    const currentTotals = currentIdx >= 0 ? totals[currentIdx] : null;
    const next3 = totals.slice(Math.max(0, currentIdx + 1), Math.max(0, currentIdx + 1) + 3);
    const next3Net = next3.reduce((s, t) => s + t.net.planned, 0);
    const futureTotals = currentIdx >= 0 ? totals.slice(currentIdx + 1) : totals;

    let projectedCash = cashNow;
    let minCash = cashNow;
    let minCashMonth: string | null = null;
    let runningCash = cashNow;
    let riskCount = 0;
    for (const t of futureTotals) {
      projectedCash += t.net.planned;
      if (projectedCash < minCash) {
        minCash = projectedCash;
        minCashMonth = t.month;
      }
      runningCash += t.net.planned;
      if (runningCash < 0) riskCount++;
    }

    const kpis = {
      cashNow,
      currentMonth: currentTotals
        ? {
            month: currentMonth,
            planned: currentTotals.net.planned,
            realized: currentTotals.net.realized,
            gap: currentTotals.net.realized - currentTotals.net.planned,
          }
        : null,
      next3MonthsPlanned: next3Net,
      riskCount,
      minCash,
      minCashMonth,
    };

    return NextResponse.json({ months, currentMonth, rows, totals, kpis });
  } catch (err) {
    console.error("[GET /api/pnl]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}