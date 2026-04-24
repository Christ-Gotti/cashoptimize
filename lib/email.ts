import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM = process.env.EMAIL_FROM ?? "CashOptimize <no-reply@send.cashoptimize.com>";
const SUPPORT = process.env.EMAIL_SUPPORT ?? "dopeweb.saas@gmail.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://cashoptimize.com";

function wrap(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;padding:0 20px;">
    <div style="background:white;border-radius:20px;padding:40px;box-shadow:0 4px 20px rgba(15,23,42,0.06);">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px;">
        <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6 60%,#ec4899);display:flex;align-items:center;justify-content:center;font-size:20px;">⚡</div>
        <div>
          <div style="font-weight:800;font-size:18px;color:#0f172a;">CashOptimize</div>
          <div style="font-size:11px;color:#64748b;">Pilote ton cash</div>
        </div>
      </div>
      ${body}
      <div style="margin-top:32px;padding-top:20px;border-top:1px solid #f1f5f9;font-size:12px;color:#94a3b8;line-height:1.5;">
        Une question ? Réponds simplement à ce mail, on te répond sous 24h.<br/>
        <a href="${APP_URL}" style="color:#6366f1;text-decoration:none;">cashoptimize.com</a> · Tous droits réservés
      </div>
    </div>
  </div>
</body>
</html>`;
}

function button(text: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;padding:14px 28px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#8b5cf6 60%,#ec4899);color:white;font-weight:700;text-decoration:none;font-size:15px;">${text}</a>`;
}

// ============================================================
// TEMPLATES
// ============================================================

export async function sendWelcomeEmail(params: { to: string; firstName?: string | null; orgName?: string | null }) {
  if (!resend) { console.warn("[email] RESEND_API_KEY absent, email non envoyé"); return; }
  const name = params.firstName?.trim() || "toi";
  const org = params.orgName?.trim() || "ton entreprise";
  const body = `
    <h1 style="font-size:24px;font-weight:800;color:#0f172a;margin:0 0 12px;">Bienvenue sur CashOptimize, ${name} 👋</h1>
    <p style="font-size:15px;color:#475569;line-height:1.6;margin:0 0 20px;">
      Ton espace pour <strong>${org}</strong> est prêt. Tu as <strong>14 jours d'essai gratuit</strong> pour tester toutes les fonctionnalités, sans carte bancaire.
    </p>
    <div style="padding:16px;background:#eef2ff;border-radius:12px;margin:24px 0;">
      <div style="font-size:13px;font-weight:700;color:#4338ca;margin-bottom:8px;">📋 Pour commencer :</div>
      <ul style="margin:0;padding-left:20px;font-size:14px;color:#334155;line-height:1.7;">
        <li>Importe un CSV bancaire sur <a href="${APP_URL}/import-csv" style="color:#6366f1;">/import-csv</a></li>
        <li>Laisse Claude IA catégoriser tes transactions</li>
        <li>Génère ton prévisionnel sur <a href="${APP_URL}/pnl" style="color:#6366f1;">/pnl</a></li>
      </ul>
    </div>
    <p style="text-align:center;margin:32px 0;">${button("Accéder à mon tableau de bord →", `${APP_URL}/dashboard`)}</p>
    <p style="font-size:13px;color:#64748b;line-height:1.6;margin:16px 0 0;">
      Besoin d'un coup de main ? Écris-moi à <a href="mailto:${SUPPORT}" style="color:#6366f1;">${SUPPORT}</a> et je te réponds perso dans la journée.
    </p>
  `;
  return await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: "Bienvenue sur CashOptimize 👋",
    html: wrap("Bienvenue sur CashOptimize", body),
    replyTo: SUPPORT,
  });
}

export async function sendPaymentReceivedEmail(params: { to: string; firstName?: string | null; amount?: number }) {
  if (!resend) { console.warn("[email] RESEND_API_KEY absent"); return; }
  const name = params.firstName?.trim() || "toi";
  const amount = params.amount ?? 19;
  const body = `
    <h1 style="font-size:24px;font-weight:800;color:#0f172a;margin:0 0 12px;">Paiement reçu 🎉</h1>
    <p style="font-size:15px;color:#475569;line-height:1.6;margin:0 0 20px;">
      Merci ${name} ! Ton abonnement CashOptimize est actif. Ton compte a été débité de <strong>${amount}€</strong>.
    </p>
    <div style="padding:16px;background:#ecfdf5;border-radius:12px;margin:24px 0;border-left:4px solid #10b981;">
      <div style="font-size:13px;color:#065f46;line-height:1.6;">
        ✅ Accès complet à toutes les fonctionnalités<br/>
        ✅ Sans engagement, annulable à tout moment<br/>
        ✅ Prochain prélèvement dans 30 jours
      </div>
    </div>
    <p style="text-align:center;margin:32px 0;">${button("Aller sur mon tableau de bord", `${APP_URL}/dashboard`)}</p>
  `;
  return await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: "Paiement confirmé — Bienvenue dans CashOptimize",
    html: wrap("Paiement confirmé", body),
    replyTo: SUPPORT,
  });
}

export async function sendTrialEndingEmail(params: { to: string; firstName?: string | null; daysLeft: number }) {
  if (!resend) { console.warn("[email] RESEND_API_KEY absent"); return; }
  const name = params.firstName?.trim() || "toi";
  const body = `
    <h1 style="font-size:24px;font-weight:800;color:#0f172a;margin:0 0 12px;">Ton essai se termine dans ${params.daysLeft} jours ⏳</h1>
    <p style="font-size:15px;color:#475569;line-height:1.6;margin:0 0 20px;">
      Salut ${name}, ton essai gratuit CashOptimize se termine bientôt. Pour continuer à piloter ta trésorerie, active ton abonnement en 2 clics.
    </p>
    <div style="padding:20px;background:#f8fafc;border-radius:12px;margin:24px 0;text-align:center;border:1px solid #e2e8f0;">
      <div style="font-size:36px;font-weight:800;color:#6366f1;">19€<span style="font-size:16px;color:#64748b;">/mois</span></div>
      <div style="font-size:12px;color:#64748b;margin-top:4px;">Sans engagement · Annulable à tout moment</div>
    </div>
    <p style="text-align:center;margin:32px 0;">${button("Activer mon abonnement →", `${APP_URL}/pricing`)}</p>
    <p style="font-size:13px;color:#64748b;line-height:1.6;">
      Une question ? Écris-moi à <a href="mailto:${SUPPORT}" style="color:#6366f1;">${SUPPORT}</a>.
    </p>
  `;
  return await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `Ton essai CashOptimize se termine dans ${params.daysLeft} jours`,
    html: wrap("Fin d'essai", body),
    replyTo: SUPPORT,
  });
}