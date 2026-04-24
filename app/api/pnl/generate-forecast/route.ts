import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { users, categories, forecasts } from "@/lib/schema";
import { and, eq, or, isNull, sql } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

type HistoryPoint = { categoryId: string; month: string; amount: number };
type CategoryRow = { id: string; label: string; direction: "inflow" | "outflow" };
type Prediction = { categoryId: string; month: string; amount: number; confidence: number };

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
    if (!orgId) return NextResponse.json({ error: "Aucune organisation liée" }, { status: 400 });

    const body = (await req.json().catch(() => ({}))) as { horizonMonths?: number };
    const horizonMonths = Math.min(Math.max(body.horizonMonths ?? 6, 1), 12);

    const orgCats = await db
      .select({ id: categories.id, label: categories.label, direction: categories.direction })
      .from(categories)
      .where(or(eq(categories.orgId, orgId), isNull(categories.orgId)));

    if (orgCats.length === 0) return NextResponse.json({ error: "Aucune catégorie" }, { status: 400 });

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    twelveMonthsAgo.setDate(1);

    const histResult = await db.execute(sql`
      SELECT
        category_id AS "categoryId",
        to_char(date_trunc('month', booked_at), 'YYYY-MM-01') AS "month",
        SUM(amount)::text AS "total"
      FROM transactions
      WHERE org_id = ${orgId}
        AND booked_at >= ${twelveMonthsAgo.toISOString().slice(0, 10)}
        AND category_id IS NOT NULL
      GROUP BY category_id, date_trunc('month', booked_at)
    `);
    const rawHist = histResult as unknown;
    const histRows: Array<{ categoryId: string; month: string; total: string }> = Array.isArray(rawHist)
      ? (rawHist as Array<{ categoryId: string; month: string; total: string }>)
      : rawHist && typeof rawHist === "object" && "rows" in (rawHist as object)
        ? (rawHist as { rows: Array<{ categoryId: string; month: string; total: string }> }).rows
        : [];

    const history: HistoryPoint[] = histRows.map((r) => ({
      categoryId: r.categoryId,
      month: r.month,
      amount: parseFloat(r.total ?? "0"),
    }));

    if (history.length === 0) {
      return NextResponse.json(
        { error: "Pas assez de transactions catégorisées. Fais d'abord l'import + catégorisation." },
        { status: 400 }
      );
    }

    const now = new Date();
    const targetMonths = Array.from({ length: horizonMonths }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      return d.toISOString().slice(0, 10);
    });

    const activeCategoryIds = new Set(history.map((h) => h.categoryId));
    const activeCats = orgCats.filter((c) => activeCategoryIds.has(c.id));

    let predictions: Prediction[] = [];
    let source: "claude" | "fallback" = "claude";
    let claudeError: string | null = null;

    try {
      predictions = await claudeToolUse(activeCats, history, targetMonths);
      if (predictions.length === 0) throw new Error("empty_result");
    } catch (err) {
      claudeError = (err as Error).message;
      predictions = movingAverageForecast(activeCats, history, targetMonths);
      source = "fallback";
    }

    let created = 0;
    let skipped = 0;

    for (const p of predictions) {
      const existing = await db
        .select({ id: forecasts.id, userOverride: forecasts.userOverride })
        .from(forecasts)
        .where(
          and(
            eq(forecasts.orgId, orgId),
            eq(forecasts.categoryId, p.categoryId),
            eq(forecasts.periodMonth, p.month)
          )
        )
        .limit(1);

      if (existing[0]?.userOverride) {
        skipped++;
        continue;
      }

      if (existing[0]) {
        await db
          .update(forecasts)
          .set({
            plannedAmount: p.amount.toFixed(2),
            confidence: p.confidence,
            generatedBy: source === "claude" ? "ai" : "rule",
            generationReason: source === "claude" ? "Claude Sonnet" : "Moyenne mobile (fallback)",
            updatedAt: new Date(),
          })
          .where(eq(forecasts.id, existing[0].id));
      } else {
        await db.insert(forecasts).values({
          orgId,
          categoryId: p.categoryId,
          periodMonth: p.month,
          plannedAmount: p.amount.toFixed(2),
          confidence: p.confidence,
          generatedBy: source === "claude" ? "ai" : "rule",
          generationReason: source === "claude" ? "Claude Sonnet" : "Moyenne mobile (fallback)",
          userOverride: false,
        });
      }
      created++;
    }

    return NextResponse.json({ ok: true, source, claudeError, created, skipped, horizon: horizonMonths, categoriesUsed: activeCats.length });
  } catch (err) {
    console.error("[generate-forecast]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

async function claudeToolUse(cats: CategoryRow[], history: HistoryPoint[], targetMonths: string[]): Promise<Prediction[]> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY manquante");

  const byCategory = new Map<string, { label: string; direction: string; months: Map<string, number> }>();
  for (const c of cats) byCategory.set(c.id, { label: c.label, direction: c.direction, months: new Map() });
  for (const h of history) {
    const e = byCategory.get(h.categoryId);
    if (e) e.months.set(h.month, (e.months.get(h.month) ?? 0) + h.amount);
  }

  const historyLines: string[] = [];
  for (const [id, v] of byCategory.entries()) {
    if (v.months.size === 0) continue;
    const monthsStr = [...v.months.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([m, a]) => `${m.slice(0, 7)}=${Math.round(a)}`)
      .join(",");
    historyLines.push(`${id}|${v.label}|${v.direction}|${monthsStr}`);
  }

  const targetMonthsShort = targetMonths.map((m) => m.slice(0, 7)).join(",");

  const systemPrompt = `Tu es un expert en prévision de trésorerie pour une TPE française. inflow → positif, outflow → négatif. Tiens compte saisonnalité/tendance. Appelle submit_forecasts avec TOUTES les prédictions.`;
  const userPrompt = `Historique (format: category_id|label|direction|YYYY-MM=montant,...) :\n\n${historyLines.join("\n")}\n\nMois à prédire : ${targetMonthsShort}\n\nAppelle submit_forecasts avec ${byCategory.size} catégories × ${targetMonths.length} mois = ${byCategory.size * targetMonths.length} prédictions.`;

  const tool = {
    name: "submit_forecasts",
    description: "Soumet la liste complète des prédictions mensuelles par catégorie",
    input_schema: {
      type: "object" as const,
      properties: {
        forecasts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category_id: { type: "string" },
              month: { type: "string", pattern: "^\\d{4}-\\d{2}-01$" },
              amount: { type: "number" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["category_id", "month", "amount", "confidence"],
          },
        },
      },
      required: ["forecasts"],
    },
  };

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 16000,
    system: systemPrompt,
    tools: [tool],
    tool_choice: { type: "tool", name: "submit_forecasts" },
    messages: [{ role: "user", content: userPrompt }],
  });

  const toolUseBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
    throw new Error(`No tool_use block (stop_reason=${response.stop_reason})`);
  }

  const input = toolUseBlock.input as { forecasts: Array<{ category_id: string; month: string; amount: number; confidence: number }> };
  if (!Array.isArray(input.forecasts)) throw new Error("forecasts not an array");

  const validCatIds = new Set(cats.map((c) => c.id));
  return input.forecasts
    .filter((f) => validCatIds.has(f.category_id) && /^\d{4}-\d{2}-01$/.test(f.month))
    .map((f) => ({
      categoryId: f.category_id,
      month: f.month,
      amount: Number.isFinite(f.amount) ? f.amount : 0,
      confidence: Math.max(0, Math.min(1, f.confidence ?? 0.5)),
    }));
}

function movingAverageForecast(cats: CategoryRow[], history: HistoryPoint[], targetMonths: string[]): Prediction[] {
  const byCat = new Map<string, Map<string, number>>();
  for (const h of history) {
    if (!byCat.has(h.categoryId)) byCat.set(h.categoryId, new Map());
    byCat.get(h.categoryId)!.set(h.month, (byCat.get(h.categoryId)!.get(h.month) ?? 0) + h.amount);
  }

  const out: Prediction[] = [];
  for (const c of cats) {
    const months = byCat.get(c.id);
    if (!months || months.size === 0) continue;
    const sorted = [...months.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const last3 = sorted.slice(-3).map(([, v]) => v);
    const weights = last3.length === 3 ? [0.2, 0.3, 0.5] : last3.length === 2 ? [0.4, 0.6] : [1];
    const weighted = last3.reduce((s, v, i) => s + v * weights[i], 0);
    const confidence = sorted.length >= 6 ? 0.7 : sorted.length >= 3 ? 0.55 : 0.3;
    for (const m of targetMonths) {
      out.push({ categoryId: c.id, month: m, amount: Math.round(weighted), confidence });
    }
  }
  return out;
}