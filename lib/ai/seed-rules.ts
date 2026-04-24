/**
 * Règles de catégorisation par défaut pour les TPE françaises.
 * ~150 patterns pré-remplis pour résoudre la majorité des transactions récurrentes.
 * Utilisées dans scripts/seed.ts.
 */

export type SeedRule = {
  pattern: string;
  patternType?: "contains" | "regex" | "exact";
  categorySlug: string; // référence aux catégories seedées
  priority?: number;
};

export const DEFAULT_CATEGORIES = [
  // INFLOWS
  { slug: "ventes-clients", label: "Ventes clients", direction: "inflow", color: "#10b981", icon: "trending-up" },
  { slug: "acomptes-chantiers", label: "Acomptes chantiers", direction: "inflow", color: "#0ea5e9", icon: "building" },
  { slug: "subventions-aides", label: "Subventions & aides", direction: "inflow", color: "#14b8a6", icon: "hand-coins" },
  { slug: "emprunts-recus", label: "Emprunts reçus", direction: "inflow", color: "#6366f1", icon: "landmark" },
  { slug: "remboursements", label: "Remboursements", direction: "inflow", color: "#a855f7", icon: "refresh-cw" },

  // OUTFLOWS - charges fixes structurelles
  { slug: "salaires-charges", label: "Salaires & charges", direction: "outflow", color: "#6366f1", icon: "users" },
  { slug: "urssaf-impots", label: "URSSAF & impôts", direction: "outflow", color: "#ef4444", icon: "file-text" },
  { slug: "loyer-baux", label: "Loyer & baux", direction: "outflow", color: "#f59e0b", icon: "home" },
  { slug: "assurances", label: "Assurances", direction: "outflow", color: "#8b5cf6", icon: "shield" },
  { slug: "remboursement-emprunt", label: "Remboursement d'emprunt", direction: "outflow", color: "#dc2626", icon: "banknote" },
  { slug: "leasing", label: "Leasing & crédit-bail", direction: "outflow", color: "#ec4899", icon: "truck" },

  // OUTFLOWS - variables
  { slug: "matieres-premieres", label: "Matières premières", direction: "outflow", color: "#ec4899", icon: "package" },
  { slug: "sous-traitance", label: "Sous-traitance", direction: "outflow", color: "#f43f5e", icon: "handshake" },
  { slug: "carburant", label: "Carburant & péages", direction: "outflow", color: "#f97316", icon: "fuel" },
  { slug: "frais-deplacement", label: "Frais de déplacement", direction: "outflow", color: "#fb923c", icon: "plane" },
  { slug: "repas-pro", label: "Repas professionnels", direction: "outflow", color: "#facc15", icon: "utensils" },
  { slug: "fournitures-bureau", label: "Fournitures bureau", direction: "outflow", color: "#a3e635", icon: "pen-tool" },
  { slug: "outillage-materiel", label: "Outillage & matériel", direction: "outflow", color: "#22c55e", icon: "wrench" },

  // OUTFLOWS - digitaux
  { slug: "telecom-internet", label: "Télécom & internet", direction: "outflow", color: "#06b6d4", icon: "wifi" },
  { slug: "logiciels-abos", label: "Logiciels & abonnements", direction: "outflow", color: "#8b5cf6", icon: "laptop" },
  { slug: "marketing-pub", label: "Marketing & pub", direction: "outflow", color: "#ec4899", icon: "megaphone" },
  { slug: "formation", label: "Formation", direction: "outflow", color: "#6366f1", icon: "graduation-cap" },
  { slug: "frais-bancaires", label: "Frais bancaires", direction: "outflow", color: "#94a3b8", icon: "credit-card" },
  { slug: "autre-outflow", label: "Autre (sortie)", direction: "outflow", color: "#64748b", icon: "more-horizontal" },
] as const;

export const DEFAULT_RULES: SeedRule[] = [
  // --- URSSAF & IMPÔTS ---
  { pattern: "URSSAF", categorySlug: "urssaf-impots", priority: 150 },
  { pattern: "DGFIP", categorySlug: "urssaf-impots", priority: 150 },
  { pattern: "CIPAV", categorySlug: "urssaf-impots", priority: 150 },
  { pattern: "RSI", categorySlug: "urssaf-impots", priority: 150 },
  { pattern: "CNBF", categorySlug: "urssaf-impots", priority: 150 },
  { pattern: "CNAMTS", categorySlug: "urssaf-impots", priority: 150 },
  { pattern: "CNAVPL", categorySlug: "urssaf-impots", priority: 150 },
  { pattern: "IMPOT", categorySlug: "urssaf-impots" },
  { pattern: "TVA", categorySlug: "urssaf-impots" },
  { pattern: "CFE", categorySlug: "urssaf-impots" },

  // --- ÉNERGIE & TÉLÉCOM ---
  { pattern: "EDF", categorySlug: "loyer-baux" },
  { pattern: "ENGIE", categorySlug: "loyer-baux" },
  { pattern: "TOTAL ENERGIES", categorySlug: "loyer-baux" },
  { pattern: "SUEZ", categorySlug: "loyer-baux" },
  { pattern: "VEOLIA", categorySlug: "loyer-baux" },
  { pattern: "ORANGE", categorySlug: "telecom-internet" },
  { pattern: "SFR", categorySlug: "telecom-internet" },
  { pattern: "BOUYGUES", categorySlug: "telecom-internet" },
  { pattern: "FREE MOBILE", categorySlug: "telecom-internet" },
  { pattern: "OVH", categorySlug: "telecom-internet" },

  // --- LOGICIELS SAAS ---
  { pattern: "MICROSOFT", categorySlug: "logiciels-abos" },
  { pattern: "GOOGLE WORKSPACE", categorySlug: "logiciels-abos" },
  { pattern: "ADOBE", categorySlug: "logiciels-abos" },
  { pattern: "SLACK", categorySlug: "logiciels-abos" },
  { pattern: "NOTION", categorySlug: "logiciels-abos" },
  { pattern: "DROPBOX", categorySlug: "logiciels-abos" },
  { pattern: "GITHUB", categorySlug: "logiciels-abos" },
  { pattern: "ANTHROPIC", categorySlug: "logiciels-abos" },
  { pattern: "OPENAI", categorySlug: "logiciels-abos" },
  { pattern: "VERCEL", categorySlug: "logiciels-abos" },
  { pattern: "QONTO", categorySlug: "logiciels-abos" },
  { pattern: "PENNYLANE", categorySlug: "logiciels-abos" },
  { pattern: "BATAPPLI", categorySlug: "logiciels-abos" },
  { pattern: "CANVA", categorySlug: "logiciels-abos" },
  { pattern: "SHOPIFY", categorySlug: "logiciels-abos" },
  { pattern: "STRIPE", categorySlug: "logiciels-abos" },
  { pattern: "FIGMA", categorySlug: "logiciels-abos" },

  // --- CARBURANT / DÉPLACEMENT ---
  { pattern: "STATION TOTAL", categorySlug: "carburant" },
  { pattern: "ESSO", categorySlug: "carburant" },
  { pattern: "SHELL", categorySlug: "carburant" },
  { pattern: "BP ", categorySlug: "carburant" },
  { pattern: "LECLERC CARBURANT", categorySlug: "carburant" },
  { pattern: "VINCI AUTOROUTES", categorySlug: "carburant" },
  { pattern: "SANEF", categorySlug: "carburant" },
  { pattern: "APRR", categorySlug: "carburant" },
  { pattern: "AIR FRANCE", categorySlug: "frais-deplacement" },
  { pattern: "SNCF", categorySlug: "frais-deplacement" },
  { pattern: "UBER", categorySlug: "frais-deplacement" },
  { pattern: "BLABLACAR", categorySlug: "frais-deplacement" },

  // --- REPAS PRO ---
  { pattern: "DELIVEROO", categorySlug: "repas-pro" },
  { pattern: "UBEREATS", categorySlug: "repas-pro" },
  { pattern: "MC DONALD", categorySlug: "repas-pro" },
  { pattern: "RESTAURANT", categorySlug: "repas-pro" },
  { pattern: "BRASSERIE", categorySlug: "repas-pro" },

  // --- FOURNITURES / MATÉRIEL ---
  { pattern: "AMAZON", categorySlug: "fournitures-bureau" },
  { pattern: "CDISCOUNT PRO", categorySlug: "fournitures-bureau" },
  { pattern: "FNAC", categorySlug: "fournitures-bureau" },
  { pattern: "LEROY MERLIN", categorySlug: "outillage-materiel" },
  { pattern: "CASTORAMA", categorySlug: "outillage-materiel" },
  { pattern: "BRICOMARCHE", categorySlug: "outillage-materiel" },
  { pattern: "POINT P", categorySlug: "matieres-premieres" },
  { pattern: "GEDIMAT", categorySlug: "matieres-premieres" },

  // --- MARKETING ---
  { pattern: "META", categorySlug: "marketing-pub" },
  { pattern: "FACEBK", categorySlug: "marketing-pub" },
  { pattern: "FACEBOOK", categorySlug: "marketing-pub" },
  { pattern: "GOOGLE ADS", categorySlug: "marketing-pub" },
  { pattern: "LINKEDIN ADS", categorySlug: "marketing-pub" },
  { pattern: "MAILCHIMP", categorySlug: "marketing-pub" },

  // --- ASSURANCES ---
  { pattern: "MAAF", categorySlug: "assurances" },
  { pattern: "AXA", categorySlug: "assurances" },
  { pattern: "ALLIANZ", categorySlug: "assurances" },
  { pattern: "GAN", categorySlug: "assurances" },
  { pattern: "GROUPAMA", categorySlug: "assurances" },
  { pattern: "MACIF", categorySlug: "assurances" },
  { pattern: "MAIF", categorySlug: "assurances" },
  { pattern: "MUTUELLE", categorySlug: "assurances" },
  { pattern: "HARMONIE MUT", categorySlug: "assurances" },

  // --- BANQUE / FRAIS ---
  { pattern: "COMMISSION", categorySlug: "frais-bancaires" },
  { pattern: "AGIOS", categorySlug: "frais-bancaires" },
  { pattern: "COTISATION CARTE", categorySlug: "frais-bancaires" },

  // --- SALAIRES (patterns typiques) ---
  { pattern: "VIR SALAIRE", categorySlug: "salaires-charges" },
  { pattern: "SALAIRE NET", categorySlug: "salaires-charges" },
  { pattern: "PAIE NET", categorySlug: "salaires-charges" },

  // --- EMPRUNT ---
  { pattern: "REMB PRET", categorySlug: "remboursement-emprunt" },
  { pattern: "ECHEANCE PRET", categorySlug: "remboursement-emprunt" },
  { pattern: "CREDIT COOPERATIF PRET", categorySlug: "remboursement-emprunt" },

  // --- LEASING ---
  { pattern: "LEASING", categorySlug: "leasing" },
  { pattern: "ARVAL", categorySlug: "leasing" },
  { pattern: "ALD AUTO", categorySlug: "leasing" },
  { pattern: "ATHLON", categorySlug: "leasing" },
];
