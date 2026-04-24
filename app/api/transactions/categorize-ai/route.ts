// app/api/transactions/categorize-ai/route.ts
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { users, transactions, categories } from "@/lib/schema";
import { eq, and, isNull, or } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: Request) {
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

    const [userRow] = await db.select().from(users).where(eq(users.id, user.id));
    const orgId = userRow?.defaultOrgId;
    if (!orgId) return NextResponse.json({ error: "No org" }, { status: 400 });

    // Récupère les transactions non catégorisées (max 100 par run pour tenir dans le timeout)
    const uncat = await db
      .select({
        id: transactions.id,
        rawLabel: transactions.rawLabel,
        amount: transactions.amount,
        currency: transactions.currency,
      })
      .from(transactions)
      .where(and(eq(transactions.orgId, orgId), isNull(transactions.categoryId)))
      .limit(100);

    if (uncat.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, categorized: 0, remaining: 0, message: "Aucune transaction à catégoriser" });
    }

    // Récupère les catégories disponibles
    const cats = await db
      .select({ id: categories.id, label: categories.label, direction: categories.direction })
      .from(categories)
      .where(or(isNull(categories.orgId), eq(categories.orgId, orgId)));

    if (cats.length === 0) {
      return NextResponse.json({ error: "Aucune catégorie configurée" }, { status: 400 });
    }

    const catsList = cats.map((c) => `- ${c.label} (id: ${c.id}, direction: ${c.direction})`).join("\n");

    let categorized = 0;
    let errors = 0;

    // Traite par batches de 10 pour limiter les appels API
    const batchSize = 10;
    for (let i = 0; i < uncat.length; i += batchSize) {
      const batch = uncat.slice(i, i + batchSize);
      const txList = batch
        .map((tx) => `[tx_id: ${tx.id}] "${tx.rawLabel}" · ${parseFloat(tx.amount)} ${tx.currency}`)
        .join("\n");

      try {
        const response = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2000,
          system: `Tu es un expert-comptable français qui catégorise les transactions bancaires d'une TPE. Pour chaque transaction listée, choisis la catégorie la plus pertinente parmi celles disponibles. Réponds UNIQUEMENT au format JSON array strict, sans markdown ni explication. Format exact: [{"tx_id":"UUID","category_id":"UUID","confidence":0.XX}, ...]. Si tu n'es pas sûr à plus de 60%, mets confidence < 0.6. Respecte la direction (inflow pour entrées d'argent, outflow pour dépenses).`,
          messages: [{
            role: "user",
            content: `Catégories disponibles :
${catsList}

Transactions à catégoriser :
${txList}

Renvoie UNIQUEMENT le JSON array avec un objet par transaction.`,
          }],
        });

        const text = response.content[0]?.type === "text" ? response.content[0].text : "";
        const match = text.match(/\[[\s\S]*\]/);
        if (!match) { errors++; continue; }

        const parsed = JSON.parse(match[0]) as Array<{ tx_id: string; category_id: string; confidence: number }>;

        for (const p of parsed) {
          const catExists = cats.some((c) => c.id === p.category_id);
          if (!catExists) continue;

          await db
            .update(transactions)
            .set({
              categoryId: p.category_id,
              categoryConfidence: Math.min(0.95, Math.max(0.1, p.confidence)),
              categorizationTier: 3,
            })
            .where(and(eq(transactions.id, p.tx_id), eq(transactions.orgId, orgId)));
          categorized++;
        }
      } catch (err) {
        console.error("[categorize-ai] batch error:", err);
        errors++;
      }
    }

    // Compte combien il reste
    const remainingRows = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(eq(transactions.orgId, orgId), isNull(transactions.categoryId)));

    return NextResponse.json({
      ok: true,
      processed: uncat.length,
      categorized,
      errors,
      remaining: remainingRows.length,
    });
  } catch (err) {
    console.error("[categorize-ai]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}