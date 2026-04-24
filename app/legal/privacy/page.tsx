import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main style={{ background: "#f8fafc", minHeight: "100vh", padding: "40px 24px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", background: "white", borderRadius: 20, padding: 48, boxShadow: "0 4px 30px rgba(15,23,42,0.04)" }}>
        <Link href="/" style={{ fontSize: 13, color: "#6366f1", textDecoration: "none", fontWeight: 600 }}>← Retour à l&apos;accueil</Link>

        <h1 style={{ fontSize: 32, fontWeight: 800, marginTop: 24, marginBottom: 8, color: "#0f172a" }}>Politique de confidentialité</h1>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 32 }}>Dernière mise à jour : {new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })}</p>

        <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.7 }}>
          <h2 style={H2}>1. Qui sommes-nous ?</h2>
          <p>CashOptimize est un service SaaS de gestion de trésorerie destiné aux TPE. Le responsable du traitement des données est Christophe Gotti, éditeur de CashOptimize.</p>

          <h2 style={H2}>2. Quelles données collectons-nous ?</h2>
          <p>Dans le cadre de l&apos;utilisation de CashOptimize, nous collectons :</p>
          <ul style={UL}>
            <li><strong>Données d&apos;identification</strong> : nom, prénom, email, mot de passe chiffré.</li>
            <li><strong>Données d&apos;entreprise</strong> : nom de société, SIRET, secteur d&apos;activité (si renseignés).</li>
            <li><strong>Données bancaires agrégées</strong> : solde des comptes, historique des transactions (si tu importes un CSV ou connectes ta banque).</li>
            <li><strong>Données de facturation</strong> : gérées par notre prestataire de paiement Dodo Payments (nous ne stockons pas ta carte bancaire).</li>
          </ul>

          <h2 style={H2}>3. Pourquoi collectons-nous ces données ?</h2>
          <ul style={UL}>
            <li>Te fournir le service : catégorisation, prévisions, alertes, chat IA.</li>
            <li>Gérer ton abonnement et la facturation.</li>
            <li>Te contacter pour le support client.</li>
            <li>Améliorer le produit (données anonymisées uniquement).</li>
          </ul>

          <h2 style={H2}>4. Où vivent tes données ?</h2>
          <p>Tes données sont hébergées sur <strong>Supabase</strong> (base PostgreSQL, région européenne) et <strong>Vercel</strong> (hébergement applicatif, région européenne). Elles ne sont jamais envoyées à des serveurs hors UE sans ton consentement explicite.</p>
          <p>Pour l&apos;IA de catégorisation, nous utilisons <strong>Anthropic (Claude)</strong>. Les requêtes sont chiffrées en transit et Anthropic s&apos;engage à ne pas utiliser ces données pour entraîner ses modèles.</p>

          <h2 style={H2}>5. Cookies utilisés</h2>
          <p>Nous utilisons uniquement des cookies <strong>essentiels</strong> au fonctionnement de l&apos;application :</p>
          <ul style={UL}>
            <li>Cookies d&apos;authentification (Supabase) : maintenir ta session connectée.</li>
            <li>Cookies techniques Next.js / Vercel : bon affichage du site.</li>
          </ul>
          <p><strong>Nous n&apos;utilisons aucun cookie publicitaire, aucun tracker tiers, aucun outil d&apos;analyse comportementale.</strong></p>

          <h2 style={H2}>6. Tes droits (RGPD)</h2>
          <p>Conformément au RGPD, tu disposes des droits suivants :</p>
          <ul style={UL}>
            <li>Droit d&apos;accès à tes données.</li>
            <li>Droit de rectification.</li>
            <li>Droit à l&apos;effacement (suppression de compte).</li>
            <li>Droit à la portabilité (export de tes données).</li>
            <li>Droit d&apos;opposition au traitement.</li>
          </ul>
          <p>Pour exercer tes droits, écris-nous à <a href="mailto:dopeweb.saas@gmail.com" style={{ color: "#6366f1" }}>dopeweb.saas@gmail.com</a>. Réponse sous 30 jours max.</p>

          <h2 style={H2}>7. Durée de conservation</h2>
          <p>Tes données sont conservées tant que ton compte est actif. À la suppression de compte, toutes tes données sont effacées sous 30 jours (hors obligations légales de conservation comptable).</p>

          <h2 style={H2}>8. Contact</h2>
          <p>Pour toute question sur cette politique, contacte-nous à <a href="mailto:dopeweb.saas@gmail.com" style={{ color: "#6366f1" }}>dopeweb.saas@gmail.com</a>.</p>
        </div>
      </div>
    </main>
  );
}

const H2: React.CSSProperties = { fontSize: 18, fontWeight: 800, color: "#0f172a", marginTop: 32, marginBottom: 12 };
const UL: React.CSSProperties = { paddingLeft: 24, marginBottom: 16 };