import Link from "next/link";
import { CheckoutButton } from "./checkout-button";

const GRADIENT = "linear-gradient(135deg, #6366f1, #8b5cf6 60%, #ec4899)";

export default function PricingPage() {
  return (
    <main style={{ background: "#ffffff", color: "#0f172a", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,0.8)", backdropFilter: "blur(12px)", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "#0f172a" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: GRADIENT, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 16 }}>⚡</div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>CashOptimize</div>
          </Link>
          <div style={{ display: "flex", gap: 20, alignItems: "center", fontSize: 14 }}>
            <Link href="/" style={{ color: "#475569", textDecoration: "none", fontWeight: 500 }}>Accueil</Link>
            <Link href="/login" style={{ color: "#475569", textDecoration: "none", fontWeight: 500 }}>Connexion</Link>
            <CheckoutButton style={{ ...BTN_PRIMARY, fontSize: 13, padding: "8px 16px" }}>Essai gratuit →</CheckoutButton>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ padding: "80px 24px 40px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -200, left: "50%", transform: "translateX(-50%)", width: 800, height: 800, background: GRADIENT, opacity: 0.06, filter: "blur(80px)", borderRadius: "50%" }} />
        <div style={{ position: "relative", maxWidth: 760, margin: "0 auto" }}>
          <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 999, background: "#eef2ff", color: "#4338ca", fontSize: 12, fontWeight: 700, marginBottom: 20 }}>
            💸 Un prix, tout inclus
          </div>
          <h1 style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 800, margin: 0, letterSpacing: -1, lineHeight: 1.15 }}>
            Un seul tarif.{" "}
            <span style={{ background: GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Toutes les fonctionnalités.</span>
          </h1>
          <p style={{ fontSize: 17, color: "#64748b", marginTop: 20, lineHeight: 1.6 }}>
            Pas de plan Pro verrouillé, pas d&apos;upsell surprise. Un abonnement mensuel, sans engagement, annulable en 2 clics.
          </p>
        </div>
      </section>

      {/* CARTE PRICING */}
      <section style={{ padding: "20px 24px 80px" }}>
        <div style={{ maxWidth: 520, margin: "0 auto", position: "relative" }}>
          <div style={{ position: "absolute", inset: -2, background: GRADIENT, borderRadius: 28, opacity: 0.2, filter: "blur(24px)" }} />
          <div style={{ position: "relative", padding: 40, background: "white", borderRadius: 24, border: "2px solid #e2e8f0", boxShadow: "0 30px 60px rgba(15,23,42,0.08)" }}>
            <div style={{ textAlign: "center", paddingBottom: 24, borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>CashOptimize</div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4 }}>
                <span style={{ fontSize: 72, fontWeight: 800, lineHeight: 1, background: GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>19</span>
                <span style={{ fontSize: 32, fontWeight: 800, color: "#0f172a" }}>€</span>
                <span style={{ fontSize: 16, color: "#64748b", fontWeight: 500, marginLeft: 4 }}>/mois HT</span>
              </div>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 12 }}>
                Essai 14 jours gratuit · Sans carte bancaire
              </div>
            </div>

            <div style={{ padding: "28px 0 24px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 16 }}>Tout inclus</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                <Check text="Connexion bancaire illimitée (300+ banques françaises via Bridge DSP2)" />
                <Check text="Import CSV toutes banques" />
                <Check text="Catégorisation IA (Claude) de toutes tes transactions" />
                <Check text="Tableau P&L Prévu vs Payé · 12 mois glissants" />
                <Check text="Prévisions de trésorerie générées par IA" />
                <Check text="Scénarios what-if (embauche, emprunt, retard client)" />
                <Check text="Alertes anticipées sur les creux de trésorerie" />
                <Check text="Gestion des engagements (leasing, loyers, crédits)" />
                <Check text="Support par email en français, réponse sous 24h" />
                <Check text="Mises à jour continues, nouvelles fonctionnalités incluses" />
              </ul>
            </div>

            <CheckoutButton style={{ ...BTN_PRIMARY, display: "block", width: "100%", textAlign: "center", fontSize: 15, padding: "14px", marginTop: 8 }}>
              Commencer mon essai gratuit →
            </CheckoutButton>
            <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", marginTop: 12 }}>
              🔒 Paiement sécurisé · Facturation mensuelle · Annulable à tout moment
            </div>
          </div>
        </div>
      </section>

      {/* COMPARAISON */}
      <section style={{ padding: "60px 24px", background: "#f8fafc" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: -1 }}>Pourquoi 19€/mois quand la concurrence est à 60–200€ ?</h2>
            <p style={{ fontSize: 15, color: "#64748b", marginTop: 12 }}>
              Parce qu&apos;on a construit CashOptimize spécifiquement pour les TPE françaises. Pas pour des ETI avec des besoins complexes qu&apos;on va vous facturer au prix fort.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            <Competitor name="Agicap" price="à partir de 150€/mois" note="Pensé pour les PME et ETI avec équipes finance dédiées" />
            <Competitor name="Fygr" price="à partir de 49€/mois" note="Bonne approche TPE, mais IA limitée et moins de prévisions" highlight="2e place" />
            <Competitor name="CashOptimize" price="19€/mois" note="Tout inclus, IA Claude de dernière génération, multi-tenant" featured />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, textAlign: "center", margin: 0, marginBottom: 40, letterSpacing: -1 }}>Facturation &amp; engagement</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Faq q="Comment se passe l'essai gratuit ?" a="14 jours, sans carte bancaire. À l'issue de l'essai, si tu veux continuer, tu renseignes ta carte et tu es débité du premier mois. Sinon, ton compte est simplement désactivé, sans frais." />
            <Faq q="Puis-je annuler à tout moment ?" a="Oui, en 2 clics depuis ton espace. Aucun engagement de durée. Le mois en cours reste dû, puis tu n'es plus prélevé." />
            <Faq q="Y a-t-il des frais cachés ?" a="Non. 19€ HT/mois, tout inclus. Les seuls coûts additionnels sont les taxes applicables selon ton pays (TVA notamment)." />
            <Faq q="Facturation mensuelle ou annuelle ?" a="Mensuelle par défaut. Une formule annuelle avec remise sera proposée plus tard." />
            <Faq q="Puis-je gérer plusieurs sociétés avec un seul compte ?" a="Oui. Le multi-tenant est inclus : tu peux gérer plusieurs entreprises depuis le même espace, chacune avec ses comptes bancaires et ses catégories." />
            <Faq q="Quels moyens de paiement acceptez-vous ?" a="Carte bancaire (Visa, Mastercard, Amex) via notre prestataire de paiement sécurisé. Le virement SEPA est possible sur demande pour les abonnements annuels." />
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{ padding: "80px 24px", background: "#0f172a", color: "white", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -200, right: -200, width: 600, height: 600, background: GRADIENT, opacity: 0.3, filter: "blur(80px)", borderRadius: "50%" }} />
        <div style={{ position: "relative", maxWidth: 640, margin: "0 auto" }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: -1, lineHeight: 1.2 }}>Prêt à prendre le contrôle de ta trésorerie ?</h2>
          <p style={{ fontSize: 16, color: "#cbd5e1", marginTop: 16, marginBottom: 32 }}>
            14 jours gratuits suffisent pour savoir si CashOptimize vaut 19€/mois.
          </p>
          <CheckoutButton style={{ ...BTN_PRIMARY, fontSize: 16, padding: "16px 32px" }}>
            Commencer mon essai →
          </CheckoutButton>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: "40px 24px", borderTop: "1px solid #f1f5f9", background: "#f8fafc", textAlign: "center", fontSize: 13, color: "#64748b" }}>
        <div style={{ marginBottom: 8 }}>CashOptimize © 2026 · Tous droits réservés</div>
        <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
          <Link href="/" style={{ color: "#64748b", textDecoration: "none" }}>Accueil</Link>
          <Link href="/login" style={{ color: "#64748b", textDecoration: "none" }}>Connexion</Link>
          <Link href="/signup" style={{ color: "#64748b", textDecoration: "none" }}>Essai gratuit</Link>
        </div>
      </footer>
    </main>
  );
}

function Check({ text }: { text: string }) {
  return (
    <li style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
      <div style={{ width: 20, height: 20, borderRadius: 999, background: "#ecfdf5", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>✓</div>
      <span style={{ fontSize: 14, color: "#334155", lineHeight: 1.5 }}>{text}</span>
    </li>
  );
}

function Competitor({ name, price, note, featured, highlight }: { name: string; price: string; note: string; featured?: boolean; highlight?: string }) {
  return (
    <div style={{
      padding: 24,
      background: "#ffffff",
      borderRadius: 16,
      border: featured ? "2px solid #6366f1" : "1px solid #e2e8f0",
      position: "relative",
      boxShadow: featured ? "0 10px 30px rgba(99,102,241,0.15)" : "none",
    }}>
      {featured && <div style={{ position: "absolute", top: -10, right: 12, padding: "2px 10px", borderRadius: 999, background: GRADIENT, color: "white", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>Nous</div>}
      {highlight && !featured && <div style={{ position: "absolute", top: -10, right: 12, padding: "2px 10px", borderRadius: 999, background: "#64748b", color: "white", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>{highlight}</div>}
      <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 4 }}>{name}</div>
      <div style={{ fontSize: 13, color: featured ? "#6366f1" : "#64748b", fontWeight: 600, marginBottom: 10 }}>{price}</div>
      <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{note}</div>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details style={{ padding: 20, background: "#f8fafc", borderRadius: 12, border: "1px solid #f1f5f9", cursor: "pointer" }}>
      <summary style={{ fontWeight: 700, fontSize: 15, listStyle: "none", cursor: "pointer" }}>{q}</summary>
      <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, marginTop: 12, marginBottom: 0 }}>{a}</p>
    </details>
  );
}

const BTN_PRIMARY: React.CSSProperties = {
  background: GRADIENT,
  color: "white",
  textDecoration: "none",
  fontWeight: 700,
  borderRadius: 12,
  boxShadow: "0 10px 30px rgba(99,102,241,0.3)",
  display: "inline-block",
};