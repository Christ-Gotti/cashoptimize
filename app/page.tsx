import Link from "next/link";

const GRADIENT = "linear-gradient(135deg, #6366f1, #8b5cf6 60%, #ec4899)";

export default function HomePage() {
  return (
    <main style={{ background: "#ffffff", color: "#0f172a", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,0.8)", backdropFilter: "blur(12px)", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: GRADIENT, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 16 }}>⚡</div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>CashOptimize</div>
          </div>
          <div style={{ display: "flex", gap: 20, alignItems: "center", fontSize: 14 }}>
            <Link href="/pricing" style={{ color: "#475569", textDecoration: "none", fontWeight: 500 }}>Tarifs</Link>
            <Link href="/login" style={{ color: "#475569", textDecoration: "none", fontWeight: 500 }}>Connexion</Link>
            <Link href="/signup" style={{ ...BTN_PRIMARY, fontSize: 13, padding: "8px 16px" }}>Essai gratuit →</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ position: "relative", overflow: "hidden", padding: "80px 24px 96px" }}>
        <div style={{ position: "absolute", top: -200, left: "50%", transform: "translateX(-50%)", width: 800, height: 800, background: GRADIENT, opacity: 0.08, filter: "blur(80px)", borderRadius: "50%" }} />
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center", position: "relative" }}>
          <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 999, background: "#eef2ff", color: "#4338ca", fontSize: 12, fontWeight: 700, marginBottom: 24 }}>
            ✨ Nouveau · Propulsé par Claude AI
          </div>
          <h1 style={{ fontSize: "clamp(36px, 6vw, 60px)", fontWeight: 800, lineHeight: 1.1, margin: 0, letterSpacing: -1.5 }}>
            Anticipe tes trous de trésorerie{" "}
            <span style={{ background: GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>3 mois avant</span>{" "}
            ton banquier.
          </h1>
          <p style={{ fontSize: 19, color: "#475569", lineHeight: 1.6, maxWidth: 640, margin: "24px auto 36px" }}>
            CashOptimize branche tes comptes bancaires, catégorise tes dépenses avec l'IA et te dit exactement combien tu auras en caisse chaque mois. <strong style={{ color: "#0f172a" }}>Conçu pour les TPE françaises.</strong>
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/signup" style={{ ...BTN_PRIMARY, fontSize: 15, padding: "14px 28px" }}>Essai 14 jours gratuit →</Link>
            <Link href="/pricing" style={{ ...BTN_OUTLINE, fontSize: 15, padding: "14px 28px" }}>Voir les tarifs</Link>
          </div>
          <div style={{ marginTop: 20, fontSize: 13, color: "#94a3b8" }}>
            🔒 Sans carte bancaire · Sans engagement · Données hébergées en Europe
          </div>
        </div>

        {/* Mock screenshot */}
        <div style={{ maxWidth: 1000, margin: "64px auto 0", padding: "0 16px" }}>
          <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 30px 80px rgba(15,23,42,0.18), 0 10px 30px rgba(99,102,241,0.2)", border: "1px solid #e2e8f0", background: "white" }}>
            <div style={{ padding: 8, background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 999, background: "#ef4444" }} />
              <div style={{ width: 10, height: 10, borderRadius: 999, background: "#f59e0b" }} />
              <div style={{ width: 10, height: 10, borderRadius: 999, background: "#10b981" }} />
            </div>
            <div style={{ padding: 24, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              <MockKpi label="Trésorerie" value="2 717 €" color="#6366f1" />
              <MockKpi label="Mois en cours" value="−4 583 €" color="#ef4444" />
              <MockKpi label="3 mois prévu" value="−14 806 €" color="#f59e0b" />
              <MockKpi label="Mois à risque" value="4" color="#ef4444" />
            </div>
            <div style={{ padding: "0 24px 24px" }}>
              <div style={{ padding: 12, background: "#f8fafc", borderRadius: 8, fontSize: 11, color: "#64748b" }}>📊 Vue P&L Prévu vs Payé · 12 mois · Claude prédit ton cash mois par mois</div>
            </div>
          </div>
        </div>
      </section>

      {/* PROBLÈMES */}
      <section style={{ padding: "64px 24px", background: "#f8fafc" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Le vrai problème</div>
            <h2 style={{ fontSize: 36, fontWeight: 800, margin: 0, letterSpacing: -1 }}>En TPE, on pilote son cash à l'instinct.</h2>
            <p style={{ fontSize: 16, color: "#64748b", marginTop: 12 }}>Et c'est là qu'on se plante.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            <Pain icon="😰" title="Tu découvres le trou…" text="…le jour où ton banquier t'appelle. Trop tard pour négocier, pour relancer, pour reporter une charge." />
            <Pain icon="📚" title="Ta compta a 2 mois de retard" text="Quand tu reçois ton grand livre, le mal est fait. Tu pilotes dans le rétro, pas vers l'avant." />
            <Pain icon="📊" title="Excel = 3h par mois" text="Tu passes ton dimanche soir à copier-coller tes relevés, catégoriser à la main, refaire les totaux. Épuisant." />
          </div>
        </div>
      </section>

      {/* COMMENT ÇA MARCHE */}
      <section style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Comment ça marche</div>
            <h2 style={{ fontSize: 36, fontWeight: 800, margin: 0, letterSpacing: -1 }}>En 5 minutes, tu pilotes ton cash comme un pro.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
            <Step num="1" icon="🔌" title="Connecte tes comptes" text="Branche ta banque en 1 clic (Bridge, DSP2 agréé) ou importe un CSV. BNP, Qonto, Crédit Agricole, SG, LCL… tout marche." />
            <Step num="2" icon="🤖" title="L'IA fait le sale boulot" text="Claude catégorise toutes tes transactions, détecte les récurrences (loyer, abonnements, salaires), apprend de tes corrections." />
            <Step num="3" icon="🔮" title="Claude prédit ton futur" text="Prévu vs Payé mois par mois. Alerte si ton solde passe en dessous d'un seuil dans 3 mois. Scénarios what-if en 1 clic." />
          </div>
        </div>
      </section>

      {/* PRICING TEASER */}
      <section style={{ padding: "80px 24px", background: "#0f172a", color: "white", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -200, right: -200, width: 600, height: 600, background: GRADIENT, opacity: 0.3, filter: "blur(80px)", borderRadius: "50%" }} />
        <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center", position: "relative" }}>
          <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 999, background: "rgba(255,255,255,0.1)", fontSize: 12, fontWeight: 700, marginBottom: 24, color: "#a5b4fc" }}>
            💸 Tarif unique
          </div>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1 }}>
            19<span style={{ fontSize: 32 }}>€</span>
            <span style={{ fontSize: 18, color: "#94a3b8", fontWeight: 500 }}>/mois</span>
          </div>
          <p style={{ fontSize: 17, color: "#cbd5e1", marginTop: 16, marginBottom: 32 }}>
            Tout inclus. Sans engagement. Essai 14 jours sans carte.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/signup" style={{ ...BTN_PRIMARY, fontSize: 15, padding: "14px 28px" }}>Commencer mon essai →</Link>
            <Link href="/pricing" style={{ fontSize: 14, color: "#a5b4fc", textDecoration: "none", padding: "14px 20px", fontWeight: 600 }}>Comparer en détail</Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: "80px 24px", background: "#f8fafc" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, textAlign: "center", margin: 0, marginBottom: 40, letterSpacing: -1 }}>Les questions qu'on nous pose</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Faq q="Mes données bancaires sont-elles en sécurité ?" a="Oui. On ne voit jamais tes identifiants bancaires. L'accès à tes comptes passe par Bridge, agréé DSP2 par l'ACPR. Tes données sont chiffrées et hébergées en Europe." />
            <Faq q="Dois-je avoir une banque spécifique ?" a="Non. Bridge supporte 300+ banques françaises (BNP, Crédit Agricole, LCL, SG, Qonto, Revolut…). Tu peux aussi importer un CSV si tu préfères." />
            <Faq q="Comment l'IA catégorise-t-elle ?" a="3 étages : règles (70%, immédiat), similarité (20%, 50ms), Claude 4.5 Haiku (10%, complexe). Elle apprend de tes corrections et devient plus précise chaque semaine." />
            <Faq q="Je peux annuler à tout moment ?" a="Oui, sans engagement. Tu payes uniquement les mois où tu utilises. Annulation en 2 clics depuis ton espace." />
            <Faq q="Pour quelle taille d'entreprise ?" a="De l'auto-entrepreneur à la PME jusqu'à 20 salariés. Tu as plusieurs sociétés ? Un seul compte suffit, on gère le multi-tenant." />
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{ padding: "80px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, margin: 0, letterSpacing: -1, lineHeight: 1.2 }}>
            Arrête de piloter dans le brouillard.
          </h2>
          <p style={{ fontSize: 17, color: "#64748b", marginTop: 16, marginBottom: 32 }}>
            En 5 minutes tu as ton tableau de bord. En 14 jours tu sais si ça vaut 19€.
          </p>
          <Link href="/signup" style={{ ...BTN_PRIMARY, fontSize: 16, padding: "16px 32px", display: "inline-block" }}>Commencer maintenant →</Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: "40px 24px", borderTop: "1px solid #f1f5f9", background: "#f8fafc", textAlign: "center", fontSize: 13, color: "#64748b" }}>
        <div style={{ marginBottom: 8 }}>CashOptimize © 2026 · Tous droits réservés</div>
        <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
          <Link href="/pricing" style={{ color: "#64748b", textDecoration: "none" }}>Tarifs</Link>
          <Link href="/login" style={{ color: "#64748b", textDecoration: "none" }}>Connexion</Link>
          <Link href="/signup" style={{ color: "#64748b", textDecoration: "none" }}>Essai gratuit</Link>
        </div>
      </footer>
    </main>
  );
}

function MockKpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ padding: 12, background: "#f8fafc", borderRadius: 10, border: "1px solid #f1f5f9" }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function Pain({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div style={{ padding: 28, background: "white", borderRadius: 16, border: "1px solid #f1f5f9", boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
      <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, marginBottom: 8 }}>{title}</h3>
      <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, margin: 0 }}>{text}</p>
    </div>
  );
}

function Step({ num, icon, title, text }: { num: string; icon: string; title: string; text: string }) {
  return (
    <div style={{ padding: 28, background: "white", borderRadius: 16, border: "1px solid #f1f5f9", position: "relative" }}>
      <div style={{ position: "absolute", top: -16, left: 24, width: 32, height: 32, borderRadius: 999, background: GRADIENT, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14 }}>{num}</div>
      <div style={{ fontSize: 36, marginBottom: 12, marginTop: 8 }}>{icon}</div>
      <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, marginBottom: 8 }}>{title}</h3>
      <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, margin: 0 }}>{text}</p>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details style={{ padding: 20, background: "white", borderRadius: 12, border: "1px solid #f1f5f9", cursor: "pointer" }}>
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
const BTN_OUTLINE: React.CSSProperties = {
  background: "white",
  color: "#475569",
  textDecoration: "none",
  fontWeight: 600,
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  display: "inline-block",
};