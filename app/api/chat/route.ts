import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { users, categories, forecasts, chatConversations, chatMessages } from "@/lib/schema";
import { and, eq, or, isNull } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const TOOLS = [
  {
    name: "list_categories",
    description: "Liste toutes les catégories disponibles (ID, label, direction). À utiliser AVANT toute modification.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "update_forecast",
    description: "Met à jour la prévision (Prévu) pour UNE catégorie et UN mois. Utilise montant NÉGATIF pour charges (salaires, loyer), POSITIF pour revenus.",
    input_schema: {
      type: "object" as const,
      properties: {
        category_id: { type: "string", description: "UUID de la catégorie" },
        month: { type: "string", pattern: "^\\d{4}-\\d{2}-01$", description: "Mois au format YYYY-MM-01" },
        amount: { type: "number", description: "Montant prévu (négatif pour outflow)" },
      },
      required: ["category_id", "month", "amount"],
    },
  },
  {
    name: "update_forecast_range",
    description: "Applique un montant sur une plage de mois (pour récurrences: salaires, loyers sur 12+ mois).",
    input_schema: {
      type: "object" as const,
      properties: {
        category_id: { type: "string" },
        start_month: { type: "string", pattern: "^\\d{4}-\\d{2}-01$" },
        end_month: { type: "string", pattern: "^\\d{4}-\\d{2}-01$" },
        amount: { type: "number" },
      },
      required: ["category_id", "start_month", "end_month", "amount"],
    },
  },
];

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

    const body = (await req.json()) as { message: string; conversationId?: string };
    if (!body.message) return NextResponse.json({ error: "Message requis" }, { status: 400 });

    let convId = body.conversationId;
    if (!convId) {
      const [conv] = await db.insert(chatConversations).values({
        orgId, userId: user.id, title: body.message.slice(0, 60),
      }).returning();
      convId = conv.id;
    }

    await db.insert(chatMessages).values({ conversationId: convId, role: "user", content: body.message });

    const history = await db.select().from(chatMessages)
      .where(eq(chatMessages.conversationId, convId))
      .orderBy(chatMessages.createdAt);

    const systemPrompt = `Tu es l'assistant IA de CashOptimize. Tu aides à mettre à jour les prévisions de trésorerie en langage naturel pour une TPE française.

RÈGLES :
- Appelle list_categories AVANT toute modification pour connaître les UUIDs.
- Montants NÉGATIFS pour charges (salaires, loyer, carburant), POSITIFS pour revenus (ventes).
- Pour récurrences (salaire mensuel, loyer), utilise update_forecast_range sur 12 à 24 mois.
- Si ambigu sur la catégorie, demande à l'utilisateur.
- Réponds en français, court et actionnable. Confirme les actions effectuées avec les montants.
- Date du jour : ${new Date().toISOString().slice(0, 10)}.`;

    const messages: Anthropic.MessageParam[] = history.map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

    let finalResponse = "";
    const maxIterations = 6;

    for (let i = 0; i < maxIterations; i++) {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: systemPrompt,
        tools: TOOLS,
        messages,
      });

      const toolUses = response.content.filter(b => b.type === "tool_use");
      const texts = response.content.filter(b => b.type === "text");

      if (toolUses.length === 0) {
        finalResponse = texts.map(b => (b as { text: string }).text).join("\n");
        break;
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        const tool = tu as Anthropic.ToolUseBlock;
        let result: unknown;
        try {
          if (tool.name === "list_categories") {
            result = await db
              .select({ id: categories.id, label: categories.label, direction: categories.direction })
              .from(categories)
              .where(or(eq(categories.orgId, orgId), isNull(categories.orgId)));
          } else if (tool.name === "update_forecast") {
            const { category_id, month, amount } = tool.input as { category_id: string; month: string; amount: number };
            await upsertForecast(orgId, category_id, month, amount);
            result = { ok: true, month, amount };
          } else if (tool.name === "update_forecast_range") {
            const { category_id, start_month, end_month, amount } = tool.input as { category_id: string; start_month: string; end_month: string; amount: number };
            let current = new Date(start_month);
            const end = new Date(end_month);
            let count = 0;
            while (current <= end && count < 24) {
              const monthStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-01`;
              await upsertForecast(orgId, category_id, monthStr, amount);
              current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
              count++;
            }
            result = { ok: true, monthsUpdated: count };
          }
        } catch (err) {
          result = { error: (err as Error).message };
        }
        toolResults.push({ type: "tool_result", tool_use_id: tool.id, content: JSON.stringify(result) });
      }

      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });
    }

    await db.insert(chatMessages).values({ conversationId: convId, role: "assistant", content: finalResponse });

    return NextResponse.json({ reply: finalResponse, conversationId: convId });
  } catch (err) {
    console.error("[chat]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

async function upsertForecast(orgId: string, categoryId: string, month: string, amount: number) {
  const existing = await db.select({ id: forecasts.id }).from(forecasts)
    .where(and(eq(forecasts.orgId, orgId), eq(forecasts.categoryId, categoryId), eq(forecasts.periodMonth, month)))
    .limit(1);
  if (existing[0]) {
    await db.update(forecasts).set({
      plannedAmount: amount.toFixed(2),
      userOverride: true,
      generatedBy: "user",
      generationReason: "Chat IA",
      confidence: 1,
      updatedAt: new Date(),
    }).where(eq(forecasts.id, existing[0].id));
  } else {
    await db.insert(forecasts).values({
      orgId,
      categoryId,
      periodMonth: month,
      plannedAmount: amount.toFixed(2),
      userOverride: true,
      generatedBy: "user",
      generationReason: "Chat IA",
      confidence: 1,
    });
  }
}