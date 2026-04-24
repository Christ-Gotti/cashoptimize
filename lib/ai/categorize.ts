/**
 * CashOptimize — Catégorisation automatique à 3 étages
 *
 *  Étage 1 : règles déterministes (regex / contains)
 *    → ~70% des transactions, coût nul, <1 ms
 *  Étage 2 : similarité vectorielle (OpenAI embeddings + nearest neighbor)
 *    → ~20% des transactions, ~0.00001€, ~50 ms
 *  Étage 3 : LLM fallback (Claude Haiku)
 *    → ~10% des transactions, ~0.001€, ~500 ms
 */

import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { categoryRules, transactions, categories } from "@/lib/schema";
import { and, eq, isNull, or, sql, desc } from "drizzle-orm";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export type CategorizationResult = {
  categoryId: string | null;
  confidence: number; // 0..1
  tier: 1 | 2 | 3 | 4; // 1=rule, 2=vector, 3=llm, 4=user
  reason?: string;
};

export type CategorizationInput = {
  orgId: string;
  rawLabel: string;
  amount: number; // signed
  counterpartyName?: string;
  bookedAt?: Date;
};

// ============================================================
// ÉTAGE 1 — RÈGLES DÉTERMINISTES
// ============================================================
async function tier1_rules(input: CategorizationInput): Promise<CategorizationResult | null> {
  const normalized = input.rawLabel.toUpperCase().trim();

  // Org-specific rules come first (higher priority), then global rules
  const rows = await db
    .select({
      id: categoryRules.id,
      categoryId: categoryRules.categoryId,
      pattern: categoryRules.pattern,
      patternType: categoryRules.patternType,
      priority: categoryRules.priority,
      learnedFromUser: categoryRules.learnedFromUser,
    })
    .from(categoryRules)
    .where(or(eq(categoryRules.orgId, input.orgId), isNull(categoryRules.orgId)))
    .orderBy(desc(categoryRules.learnedFromUser), desc(categoryRules.priority));

  for (const rule of rows) {
    const p = rule.pattern.toUpperCase();
    let matched = false;

    if (rule.patternType === "exact" && normalized === p) matched = true;
    else if (rule.patternType === "regex") {
      try {
        matched = new RegExp(rule.pattern, "i").test(input.rawLabel);
      } catch {
        // bad regex, skip silently
      }
    } else if (rule.patternType === "contains" && normalized.includes(p)) {
      matched = true;
    }

    if (matched) {
      // bump hit count async
      db.update(categoryRules)
        .set({ hitCount: sql`${categoryRules.hitCount} + 1` })
        .where(eq(categoryRules.id, rule.id))
        .catch(() => {});

      return {
        categoryId: rule.categoryId,
        confidence: rule.learnedFromUser ? 0.97 : 0.88,
        tier: 1,
        reason: `Matched rule "${rule.pattern}"`,
      };
    }
  }

  return null;
}

// ============================================================
// ÉTAGE 2 — SIMILARITÉ VECTORIELLE
// ============================================================
async function tier2_vector(input: CategorizationInput): Promise<CategorizationResult | null> {
  // Generate embedding for the current transaction label
  const emb = await getEmbedding(input.rawLabel);
  if (!emb) return null;

  // Find nearest neighbor among org's already-categorized transactions
  // (require pgvector extension; fallback to JSON cosine if not available)
  const neighbors = await db.execute(sql`
    SELECT
      t.category_id AS "categoryId",
      t.clean_label AS "cleanLabel",
      1 - (t.embedding::vector <=> ${JSON.stringify(emb)}::vector) AS similarity
    FROM transactions t
    WHERE t.org_id = ${input.orgId}
      AND t.category_id IS NOT NULL
      AND t.embedding IS NOT NULL
      AND t.user_override = true
    ORDER BY t.embedding::vector <=> ${JSON.stringify(emb)}::vector
    LIMIT 3
  `).catch(() => ({ rows: [] as Array<{ categoryId: string | null; similarity: number }> }));

  const best = (neighbors as { rows: Array<{ categoryId: string | null; similarity: number }> }).rows?.[0];
  if (!best || !best.categoryId || best.similarity < 0.75) return null;

  return {
    categoryId: best.categoryId,
    confidence: Math.min(0.9, best.similarity),
    tier: 2,
    reason: `Similar to existing transactions (${(best.similarity * 100).toFixed(0)}%)`,
  };
}

// ============================================================
// ÉTAGE 3 — LLM FALLBACK (Claude Haiku)
// ============================================================
async function tier3_llm(input: CategorizationInput, orgCategories: { id: string; label: string }[]): Promise<CategorizationResult | null> {
  const catsList = orgCategories.map((c) => `- ${c.label} (id: ${c.id})`).join("\n");
  const sign = input.amount >= 0 ? "entrant" : "sortant";

  const response = await anthropic.messages.create({
    model: "claude-3-5-haiku-latest",
    max_tokens: 150,
    system: `Tu es un expert en catégorisation de transactions bancaires pour une petite entreprise française.
Tu reçois un libellé bancaire brut et tu dois choisir la catégorie la plus probable parmi la liste fournie.
Réponds UNIQUEMENT au format JSON : {"category_id": "<uuid>", "confidence": 0.XX, "reason": "brève raison"}
Si aucune catégorie ne correspond clairement, retourne {"category_id": null, "confidence": 0.3, "reason": "ambigu"}.`,
    messages: [
      {
        role: "user",
        content: `Libellé bancaire : "${input.rawLabel}"
Montant : ${input.amount.toFixed(2)} EUR (${sign})
${input.counterpartyName ? `Contrepartie : ${input.counterpartyName}` : ""}

Catégories disponibles :
${catsList}

Choisis la meilleure catégorie.`,
      },
    ],
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text : "";
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { category_id: string | null; confidence: number; reason?: string };
    if (!parsed.category_id) return null;
    return {
      categoryId: parsed.category_id,
      confidence: Math.max(0.4, Math.min(0.9, parsed.confidence)),
      tier: 3,
      reason: parsed.reason ?? "LLM classification",
    };
  } catch {
    return null;
  }
}

// ============================================================
// PIPELINE — orchestration des 3 étages
// ============================================================
export async function categorizeTransaction(input: CategorizationInput): Promise<CategorizationResult> {
  // Tier 1
  const r1 = await tier1_rules(input);
  if (r1) return r1;

  // Tier 2
  const r2 = await tier2_vector(input);
  if (r2 && r2.confidence >= 0.75) return r2;

  // Tier 3
  const orgCategories = await db
    .select({ id: categories.id, label: categories.label })
    .from(categories)
    .where(or(eq(categories.orgId, input.orgId), isNull(categories.orgId)));

  const r3 = await tier3_llm(input, orgCategories);
  if (r3) return r3;

  // Fallback: uncategorized
  return { categoryId: null, confidence: 0, tier: 3, reason: "No match" };
}

// ============================================================
// OPENAI EMBEDDINGS (utilisé par étage 2)
// ============================================================
async function getEmbedding(text: string): Promise<number[] | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text,
        dimensions: 256, // réduire pour économiser l'espace de stockage
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data: { embedding: number[] }[] };
    return data.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

// ============================================================
// CLASSIFICATION FIXE / VARIABLE / SEMI-VARIABLE
// Basé sur l'historique des transactions de la catégorie
// ============================================================
export type KindClassification = {
  kind: "fixed" | "variable" | "semi_variable";
  periodicityDays?: number;
  amountVariance?: number;
  confidence: number;
};

export async function classifyKind(orgId: string, categoryId: string): Promise<KindClassification | null> {
  const rows = await db
    .select({
      bookedAt: transactions.bookedAt,
      amount: transactions.amount,
    })
    .from(transactions)
    .where(and(eq(transactions.orgId, orgId), eq(transactions.categoryId, categoryId)))
    .orderBy(desc(transactions.bookedAt))
    .limit(24);

  if (rows.length < 3) return null;

  // Temporal regularity
  const dates = rows.map((r) => new Date(r.bookedAt).getTime()).sort((a, b) => a - b);
  const intervals: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    intervals.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24)); // in days
  }
  const meanInterval = avg(intervals);
  const stdInterval = std(intervals);
  const intervalCV = stdInterval / meanInterval;

  // Amount stability
  const amounts = rows.map((r) => Math.abs(parseFloat(r.amount)));
  const meanAmount = avg(amounts);
  const stdAmount = std(amounts);
  const amountCV = stdAmount / meanAmount;

  // Classification
  const regular = intervalCV < 0.15; // intervalles stables
  const stable = amountCV < 0.15; // montants stables

  let kind: KindClassification["kind"];
  let confidence: number;

  if (regular && stable) {
    kind = "fixed";
    confidence = 0.9 - (intervalCV + amountCV);
  } else if (regular && !stable) {
    kind = "semi_variable";
    confidence = 0.75 - intervalCV;
  } else {
    kind = "variable";
    confidence = 0.8;
  }

  // Round periodicity to nearest common (30, 90, 365)
  let periodicityDays: number | undefined;
  if (regular) {
    if (Math.abs(meanInterval - 30) < 5) periodicityDays = 30;
    else if (Math.abs(meanInterval - 90) < 10) periodicityDays = 90;
    else if (Math.abs(meanInterval - 365) < 20) periodicityDays = 365;
    else periodicityDays = Math.round(meanInterval);
  }

  return {
    kind,
    periodicityDays,
    amountVariance: amountCV,
    confidence: Math.max(0.5, Math.min(0.95, confidence)),
  };
}

function avg(xs: number[]): number { return xs.reduce((a, b) => a + b, 0) / xs.length; }
function std(xs: number[]): number {
  const m = avg(xs);
  return Math.sqrt(avg(xs.map((x) => (x - m) ** 2)));
}

// ============================================================
// APPRENTISSAGE DEPUIS LES CORRECTIONS UTILISATEUR
// Appelé quand l'utilisateur corrige une catégorie
// ============================================================
export async function learnFromUserCorrection(params: {
  orgId: string;
  transactionId: string;
  newCategoryId: string;
  rawLabel: string;
}) {
  // Si le libellé contient un pattern distinctif (nom propre, reference),
  // on crée une règle org-specific pour éviter de reposer la question.
  const tokens = params.rawLabel
    .toUpperCase()
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !/^\d+$/.test(t));

  // On prend le token le plus distinctif (souvent le nom du créancier)
  const bestToken = tokens.sort((a, b) => b.length - a.length)[0];
  if (!bestToken) return;

  // Create an org-specific learned rule
  await db
    .insert(categoryRules)
    .values({
      orgId: params.orgId,
      categoryId: params.newCategoryId,
      pattern: bestToken,
      patternType: "contains",
      priority: 200, // learned rules override defaults
      learnedFromUser: true,
    })
    .onConflictDoNothing()
    .catch(() => {});
}
