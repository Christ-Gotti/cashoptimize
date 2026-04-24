/**
 * Moteur de chat IA conversationnel pour CashOptimize.
 *
 * Architecture RAG :
 *   1. Le user envoie une question
 *   2. On récupère un contexte "tréso" structuré (solde actuel, prévu, alertes, engagements)
 *   3. On passe ce contexte à Claude Sonnet qui formule une réponse
 *   4. L'IA peut appeler des "tools" (liste clients en retard, calcul scénario)
 *
 * Règle d'or : l'IA ne RECALCULE jamais les chiffres, elle les LIT depuis le contexte.
 */

import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { bankAccounts, alerts, forecasts, transactions, engagements } from "@/lib/schema";
import { and, eq, gte, lte, sql, desc } from "drizzle-orm";
import { formatCurrency } from "@/lib/utils";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export type ChatContext = {
  currentBalance: number;
  plannedEndOfMonth: number;
  activeAlerts: Array<{ title: string; severity: string; impactAmount?: string | null }>;
  next90DaysInflow: number;
  next90DaysOutflow: number;
  overdueInvoices: Array<{ counterparty: string; amount: number; daysLate: number }>;
  upcomingEngagements: Array<{ label: string; amount: string; monthsRemaining: number }>;
};

export async function buildContext(orgId: string): Promise<ChatContext> {
  // 1. Current balance
  const [balanceRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${bankAccounts.balance}), 0)` })
    .from(bankAccounts)
    .where(eq(bankAccounts.orgId, orgId));
  const currentBalance = parseFloat(balanceRow?.total ?? "0");

  // 2. Planned end of current month (sum of realized ytd + forecasts this month)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const monthForecast = await db
    .select({
      planned: sql<string>`COALESCE(SUM(${forecasts.plannedAmount}), 0)`,
    })
    .from(forecasts)
    .where(and(eq(forecasts.orgId, orgId), eq(forecasts.periodMonth, monthStart.toISOString().slice(0, 10))));
  const plannedEndOfMonth = currentBalance + parseFloat(monthForecast[0]?.planned ?? "0");

  // 3. Active alerts
  const alertRows = await db
    .select({ title: alerts.title, severity: alerts.severity, impactAmount: alerts.impactAmount })
    .from(alerts)
    .where(and(eq(alerts.orgId, orgId), eq(alerts.status, "active")))
    .orderBy(desc(alerts.createdAt))
    .limit(5);

  // 4. Next 90 days flows
  const in90 = new Date();
  in90.setDate(in90.getDate() + 90);

  const [inflowRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.orgId, orgId),
        gte(transactions.bookedAt, monthStart.toISOString().slice(0, 10)),
        lte(transactions.bookedAt, in90.toISOString().slice(0, 10)),
        sql`${transactions.amount} > 0`
      )
    );

  const [outflowRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.orgId, orgId),
        gte(transactions.bookedAt, monthStart.toISOString().slice(0, 10)),
        lte(transactions.bookedAt, in90.toISOString().slice(0, 10)),
        sql`${transactions.amount} < 0`
      )
    );

  // 5. Engagements upcoming end
  const engagementRows = await db
    .select({
      label: engagements.label,
      amount: engagements.monthlyAmount,
      endDate: engagements.endDate,
    })
    .from(engagements)
    .where(eq(engagements.orgId, orgId))
    .limit(10);

  const upcomingEngagements = engagementRows.map((e) => {
    const end = e.endDate ? new Date(e.endDate) : null;
    const monthsRemaining = end ? Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30))) : 99;
    return { label: e.label, amount: e.amount, monthsRemaining };
  });

  return {
    currentBalance,
    plannedEndOfMonth,
    activeAlerts: alertRows,
    next90DaysInflow: parseFloat(inflowRow?.total ?? "0"),
    next90DaysOutflow: parseFloat(outflowRow?.total ?? "0"),
    overdueInvoices: [], // TODO: implémenter quand on a la gestion des factures
    upcomingEngagements,
  };
}

export function formatContextForPrompt(ctx: ChatContext): string {
  return `
État actuel de la trésorerie :
- Solde disponible aujourd'hui : ${formatCurrency(ctx.currentBalance)}
- Projection fin du mois courant : ${formatCurrency(ctx.plannedEndOfMonth)}
- Encaissements prévus 90 j : ${formatCurrency(ctx.next90DaysInflow)}
- Décaissements prévus 90 j : ${formatCurrency(ctx.next90DaysOutflow)}

Alertes actives :
${ctx.activeAlerts.length > 0
  ? ctx.activeAlerts.map((a) => `- [${a.severity}] ${a.title}${a.impactAmount ? ` (impact : ${formatCurrency(a.impactAmount)})` : ""}`).join("\n")
  : "- Aucune alerte active"}

Engagements en cours :
${ctx.upcomingEngagements.length > 0
  ? ctx.upcomingEngagements.map((e) => `- ${e.label} : ${formatCurrency(e.amount)}/mois, ${e.monthsRemaining} mois restants`).join("\n")
  : "- Aucun engagement enregistré"}
`.trim();
}

const SYSTEM_PROMPT = `Tu es CashOptimize AI, l'assistant de pilotage trésorerie intégré à l'application CashOptimize.
Tu t'adresses à des dirigeants de TPE ou indépendants français.

RÈGLES ABSOLUES :
- Réponds TOUJOURS en français.
- Tu ne recalcules JAMAIS les chiffres : tu utilises uniquement ceux du contexte fourni.
- Sois concret, actionnable, et direct. Évite le jargon financier.
- Quand tu proposes une action, suggère-la clairement avec un bullet.
- Quand tu n'es pas sûr, DIS-LE : "Je n'ai pas assez d'infos pour répondre précisément."
- Reste bienveillant mais lucide. Un dirigeant de TPE n'aime pas les faux optimismes.
- Format : texte court, bullet points autorisés, pas de markdown tableaux.

Tu réponds à des questions comme :
- "Puis-je embaucher en juin ?"
- "Pourquoi ma tréso a baissé ce mois-ci ?"
- "Mes clients en retard ?"
- "Comment économiser 500€/mois ?"
- "Quel est mon cash minimum dans 3 mois ?"`;

export async function streamChatResponse(params: {
  orgId: string;
  userMessage: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}) {
  const ctx = await buildContext(params.orgId);
  const contextBlock = formatContextForPrompt(ctx);

  const messages = [
    ...(params.history ?? []).map((m) => ({ role: m.role, content: m.content })),
    {
      role: "user" as const,
      content: `Contexte trésorerie actuel :\n\n${contextBlock}\n\n---\n\nQuestion : ${params.userMessage}`,
    },
  ];

  return anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages,
  });
}
