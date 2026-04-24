import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { users, engagements, transactions, categories } from "@/lib/schema";
import { and, eq, gte, or, isNull, sql } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 60;

// ============================================================
// GET — liste les engagements de l'org
// ============================================================
export async function GET(req: Request) {
  try {
    const orgId = await authenticate(req);
    if (typeof orgId !== "string") return orgId;

    const rows = await db
      .select({
        id: engagements.id,
        type: engagements.type,
        label: engagements.label,
        counterparty: engagements.counterparty,
        startDate: engagements.startDate,
        endDate: engagements.endDate,
        monthlyAmount: engagements.monthlyAmount,
        categoryId: engagements.categoryId,
        tacitRenewal: engagements.tacitRenewal,
        notes: engagements.notes,
      })
      .from(engagements)
      .where(eq(engagements.orgId, orgId))
      .orderBy(sql`${engagements.monthlyAmount}::numeric DESC`);

    return NextResponse.json({ engagements: rows });
  } catch (err) {
    console.error("[engagements GET]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// ============================================================
// POST — détection automatique des récurrences
// ============================================================
export async function POST(req: Request) {
  try {
    const orgId = await authenticate(req);
    if (typeof orgId !== "string") return orgId;

    // Fenêtre d'analyse : 12 derniers mois
    const sinceDate = new Date();
    sinceDate.setMonth(sinceDate.getMonth() - 12);
    const sinceStr = sinceDate.toISOString().slice(0, 10);

    // Récupère les transactions catégorisées
    const txs = await db
      .select({
        id: transactions.id,
        bookedAt: transactions.bookedAt,
        rawLabel: transactions.rawLabel,
        cleanLabel: transactions.cleanLabel,
        amount: transactions.amount,
        counterpartyName: transactions.counterpartyName,
        categoryId: transactions.categoryId,
      })
      .from(transactions)
      .where(and(
        eq(transactions.orgId, orgId),
        gte(transactions.bookedAt, sinceStr),
      ));

    // Groupe par clé (counterparty ou token distinctif du label)
    const groups = new Map<string, typeof txs>();
    for (const tx of txs) {
      const key = extractKey(tx.counterpartyName ?? tx.cleanLabel ?? tx.rawLabel);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(tx);
    }

    // Détecte les récurrences (≥3 occurrences, intervalles stables)
    let created = 0;
    let updated = 0;
    for (const [key, txList] of groups.entries()) {
      if (txList.length < 3) continue;
      const sorted = [...txList].sort((a, b) => a.bookedAt.localeCompare(b.bookedAt));

      // Intervalles en jours
      const intervals: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        const d1 = new Date(sorted[i - 1].bookedAt).getTime();
        const d2 = new Date(sorted[i].bookedAt).getTime();
        intervals.push((d2 - d1) / (1000 * 60 * 60 * 24));
      }
      const meanInterval = avg(intervals);
      const intervalCV = std(intervals) / (meanInterval || 1);
      if (meanInterval < 20 || meanInterval > 400) continue;
      if (intervalCV > 0.35) continue; // trop irrégulier

      // Periodicity classification
      let period: "monthly" | "quarterly" | "annual" = "monthly";
      let monthlyAmount = 0;
      const amounts = sorted.map((t) => parseFloat(t.amount));
      const avgAmount = avg(amounts);

      if (Math.abs(meanInterval - 30) < 7) {
        period = "monthly";
        monthlyAmount = avgAmount;
      } else if (Math.abs(meanInterval - 90) < 15) {
        period = "quarterly";
        monthlyAmount = avgAmount / 3;
      } else if (Math.abs(meanInterval - 365) < 30) {
        period = "annual";
        monthlyAmount = avgAmount / 12;
      } else {
        continue;
      }

      // Determine type
      const type = classifyType(sorted[0].rawLabel, avgAmount);
      const categoryId = sorted[0].categoryId;
      const counterparty = sorted[0].counterpartyName ?? key;
      const label = (sorted[0].cleanLabel ?? sorted[0].rawLabel).slice(0, 100);
      const firstDate = sorted[0].bookedAt;

      // Upsert par clé (label + counterparty + monthlyAmount approximé)
      const existing = await db
        .select({ id: engagements.id })
        .from(engagements)
        .where(and(
          eq(engagements.orgId, orgId),
          eq(engagements.label, label),
        ))
        .limit(1);

      if (existing[0]) {
        await db.update(engagements)
          .set({
            monthlyAmount: Math.abs(monthlyAmount).toFixed(2),
            counterparty,
            categoryId: categoryId ?? null,
            updatedAt: new Date(),
            notes: `Auto-détecté · ${sorted.length} occurrences · périodicité ~${Math.round(meanInterval)}j`,
          })
          .where(eq(engagements.id, existing[0].id));
        updated++;
      } else {
        await db.insert(engagements).values({
          orgId,
          type,
          label,
          counterparty,
          startDate: firstDate,
          monthlyAmount: Math.abs(monthlyAmount).toFixed(2),
          categoryId: categoryId ?? null,
          tacitRenewal: true,
          reminderDaysBefore: 30,
          notes: `Auto-détecté · ${sorted.length} occurrences · périodicité ~${Math.round(meanInterval)}j`,
        });
        created++;
      }
    }

    return NextResponse.json({ ok: true, created, updated, scanned: txs.length });
  } catch (err) {
    console.error("[engagements POST]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// ============================================================
// HELPERS
// ============================================================
async function authenticate(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return NextResponse.json({ error: "Missing auth" }, { status: 401 });
  const token = authHeader.replace("Bearer ", "");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  const [u] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!u?.defaultOrgId) return NextResponse.json({ error: "Aucune organisation" }, { status: 400 });
  return u.defaultOrgId;
}

function extractKey(label: string): string {
  if (!label) return "";
  // Normalise et prend les 2-3 premiers tokens alphabétiques les plus distinctifs
  const tokens = label
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[\s\-_,;:./\\]+/)
    .filter((t) => t.length >= 4 && !/^\d+$/.test(t) && !COMMON_WORDS.has(t));
  if (tokens.length === 0) return "";
  // On prend le plus long (généralement le plus distinctif : nom du créancier)
  return tokens.sort((a, b) => b.length - a.length).slice(0, 2).join("_");
}

const COMMON_WORDS = new Set([
  "PRLV", "PRELEVEMENT", "VIREMENT", "VIR", "SEPA", "CARTE", "CB",
  "FACTURE", "REGLEMENT", "PAIEMENT", "MANDAT", "REFERENCE", "CLIENT",
  "COMPTE", "TRANSACTION", "OPERATION", "EUROPEEN", "COMMISSION"
]);

function classifyType(label: string, amount: number): "loan" | "leasing" | "consumer_credit" | "lease_commercial" | "insurance" | "subscription" | "contract_cdd" | "other" {
  const l = label.toUpperCase();
  if (/LOYER|BAIL/.test(l)) return "lease_commercial";
  if (/LEASING|LOA|LLD/.test(l)) return "leasing";
  if (/EMPRUNT|CREDIT|PRET/.test(l) && amount < 0) return "loan";
  if (/ASSURANCE|MUTUELLE/.test(l)) return "insurance";
  if (/ABONNEMENT|ABO|NETFLIX|SPOTIFY|OVH|GOOGLE|MICROSOFT|ADOBE|SAAS/.test(l)) return "subscription";
  if (/SALAIRE|SAL\./.test(l)) return "contract_cdd";
  return "other";
}

function avg(xs: number[]): number { return xs.reduce((a, b) => a + b, 0) / (xs.length || 1); }
function std(xs: number[]): number {
  const m = avg(xs);
  return Math.sqrt(avg(xs.map((x) => (x - m) ** 2)));
}