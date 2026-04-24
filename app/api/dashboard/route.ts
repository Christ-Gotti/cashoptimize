import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { users, categories, transactions, forecasts } from "@/lib/schema";
import { and, eq, gte, lte, or, isNull, sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return NextResponse.json({ error: "Missing auth" }, { status: 401 });
    const token = authHeader.replace("Bearer ", "");

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const [userRow] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    const orgId = userRow?.defaultOrgId;
    if (!orgId) return NextResponse.json({ error: "Aucune organisation liée à ton compte" }, { status: 400 });

    const url = new URL(req.url);
    const pastMonths = Math.min(Math.max(parseInt(url.searchParams.get("past") ?? "6", 10), 1), 24);
    const futureMonths = Math.min(Math.max(parseInt(url.searchParams.get("future") ?? "6", 10), 1), 24);

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - pastMonths, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + futureMonths, 1);
    const months: string[] = [];
    for (let d = new Date(start); d <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      months.push(d.toISOString().slice(0, 10));
    }

    const cats = await db
      .select({
        id: categories.id,
        label: categories.label,
        direction: categories.direction,
        color: categories.color,
        icon: categories.icon,
        slug: categories.slug,
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
      .where(
        and(
          eq(forecasts.orgId, orgId),
          gte(forecasts.periodMonth, start.toISOString().slice(0, 10)),
          lte(forecasts.periodMonth, end.toISOString().slice(0, 10))
        )
      );

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
      category: c,
      cells: months.map((m) => {
        const cell = cells.get(key(c.id, m)) ?? { planned: null, realized: null, userOverride: false, confidence: null };
        return { month: m, ...cell };
      }),
    }));

    const totals = months.map((m) => {
      let inflowPlanned = 0, inflowReal = 0, outflowPlanned = 0, outflowReal = 0;
      for (const r of rows) {
        const cell = r.cells.find((cc) => cc.month === m);
        if (!cell) continue;
        if (r.category.direction === "inflow") {
          inflowPlanned += cell.planned ?? 0;
          inflowReal += cell.realized ?? 0;
        } else {
          outflowPlanned += cell.planned ?? 0;
          outflowReal += cell.realized ?? 0;
        }
      }
      return {
        month: m,
        inflow: { planned: inflowPlanned, realized: inflowReal },
        outflow: { planned: outflowPlanned, realized: outflowReal },
        net: { planned: inflowPlanned + outflowPlanned, realized: inflowReal + outflowReal },
      };
    });

    return NextResponse.json({ months, rows, totals });
  } catch (err) {
    console.error("[GET /api/pnl]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}