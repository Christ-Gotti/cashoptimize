import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  date,
  integer,
  numeric,
  boolean,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
  real,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ============================================================
// ENUMS
// ============================================================
export const planEnum = pgEnum("plan", ["trial", "starter", "pro", "business", "canceled"]);
export const categoryKindEnum = pgEnum("category_kind", ["fixed", "variable", "semi_variable"]);
export const categoryDirectionEnum = pgEnum("category_direction", ["inflow", "outflow"]);
export const engagementTypeEnum = pgEnum("engagement_type", [
  "loan",
  "leasing",
  "consumer_credit",
  "lease_commercial",
  "insurance",
  "subscription",
  "contract_cdd",
  "other",
]);
export const scenarioKindEnum = pgEnum("scenario_kind", ["delay_payment", "revenue_change", "hire", "loan_injection", "custom"]);
export const alertSeverityEnum = pgEnum("alert_severity", ["info", "warning", "critical", "opportunity"]);
export const alertStatusEnum = pgEnum("alert_status", ["active", "dismissed", "resolved"]);
export const bankProviderEnum = pgEnum("bank_provider", ["bridge", "powens", "gocardless", "manual"]);
export const transactionSourceEnum = pgEnum("transaction_source", ["bank_sync", "manual", "import_csv"]);
export const userRoleEnum = pgEnum("user_role", ["owner", "admin", "member", "accountant_viewer"]);

// ============================================================
// ORGANIZATIONS (une org = une entreprise, multi-tenant)
// ============================================================
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  legalName: text("legal_name"),
  siret: text("siret"),
  industry: text("industry"),
  country: text("country").notNull().default("FR"),
  currency: text("currency").notNull().default("EUR"),
  plan: planEnum("plan").notNull().default("trial"),
  planRenewalAt: timestamp("plan_renewal_at", { withTimezone: true }),
  dodoCustomerId: text("dodo_customer_id"),
  dodoSubscriptionId: text("dodo_subscription_id"),
  fiscalYearStart: integer("fiscal_year_start").notNull().default(1), // month 1-12
  settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// USERS (lié à auth.users de Supabase via id)
// ============================================================
export const users = pgTable("users", {
  id: uuid("id").primaryKey(), // same as auth.users.id
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  avatarUrl: text("avatar_url"),
  locale: text("locale").notNull().default("fr"),
  defaultOrgId: uuid("default_org_id").references(() => organizations.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const organizationMembers = pgTable(
  "organization_members",
  {
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: userRoleEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.orgId, t.userId] }) })
);

// ============================================================
// BANK CONNECTIONS + ACCOUNTS
// ============================================================
export const bankConnections = pgTable(
  "bank_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    provider: bankProviderEnum("provider").notNull().default("bridge"),
    providerUserId: text("provider_user_id"),
    providerItemId: text("provider_item_id").notNull(),
    bankName: text("bank_name").notNull(),
    bankLogoUrl: text("bank_logo_url"),
    status: text("status").notNull().default("active"), // active, needs_auth, error
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    nextReauthAt: timestamp("next_reauth_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byOrg: index("bank_connections_org_idx").on(t.orgId),
    uniqItem: uniqueIndex("bank_connections_item_uq").on(t.provider, t.providerItemId),
  })
);

export const bankAccounts = pgTable(
  "bank_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id").notNull().references(() => bankConnections.id, { onDelete: "cascade" }),
    providerAccountId: text("provider_account_id").notNull(),
    name: text("name").notNull(),
    iban: text("iban"),
    currency: text("currency").notNull().default("EUR"),
    balance: numeric("balance", { precision: 14, scale: 2 }).notNull().default("0"),
    lastBalanceAt: timestamp("last_balance_at", { withTimezone: true }),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byOrg: index("bank_accounts_org_idx").on(t.orgId),
    uniq: uniqueIndex("bank_accounts_provider_uq").on(t.connectionId, t.providerAccountId),
  })
);

// ============================================================
// CATEGORIES
// ============================================================
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }), // null = global
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    direction: categoryDirectionEnum("direction").notNull(),
    kind: categoryKindEnum("kind"), // may be null until analyzed
    color: text("color").notNull().default("#6366f1"),
    icon: text("icon"),
    parentId: uuid("parent_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byOrg: index("categories_org_idx").on(t.orgId),
    uniqSlug: uniqueIndex("categories_org_slug_uq").on(t.orgId, t.slug),
  })
);

// Règles de catégorisation déterministes (étage 1)
export const categoryRules = pgTable(
  "category_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }), // null = global
    categoryId: uuid("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
    pattern: text("pattern").notNull(), // regex ou plain text (ILIKE)
    patternType: text("pattern_type").notNull().default("contains"), // contains, regex, exact
    priority: integer("priority").notNull().default(100),
    learnedFromUser: boolean("learned_from_user").notNull().default(false),
    hitCount: integer("hit_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byCat: index("category_rules_cat_idx").on(t.categoryId),
    byOrg: index("category_rules_org_idx").on(t.orgId),
  })
);

// ============================================================
// TRANSACTIONS
// ============================================================
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").notNull().references(() => bankAccounts.id, { onDelete: "cascade" }),
    providerTxId: text("provider_tx_id"),
    source: transactionSourceEnum("source").notNull().default("bank_sync"),
    bookedAt: date("booked_at").notNull(),
    valueDate: date("value_date"),
    rawLabel: text("raw_label").notNull(),
    cleanLabel: text("clean_label"),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("EUR"),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    categoryConfidence: real("category_confidence"), // 0 - 1
    categorizationTier: integer("categorization_tier"), // 1=rule, 2=vector, 3=llm, 4=user
    kind: categoryKindEnum("kind"),
    counterpartyName: text("counterparty_name"),
    counterpartyIban: text("counterparty_iban"),
    recurrenceGroupId: uuid("recurrence_group_id"),
    userOverride: boolean("user_override").notNull().default(false),
    userNotes: text("user_notes"),
    embedding: text("embedding"), // stocké en texte JSON, ou pgvector dédié
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byOrg: index("transactions_org_idx").on(t.orgId),
    byOrgDate: index("transactions_org_date_idx").on(t.orgId, t.bookedAt),
    byAccount: index("transactions_account_idx").on(t.accountId),
    byCategory: index("transactions_category_idx").on(t.categoryId),
    uniqProvider: uniqueIndex("transactions_provider_uq").on(t.accountId, t.providerTxId),
  })
);

// Groupes de récurrence détectés automatiquement
export const recurrenceGroups = pgTable("recurrence_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  periodicityDays: integer("periodicity_days"), // 30, 90, 365...
  avgAmount: numeric("avg_amount", { precision: 14, scale: 2 }),
  amountVariance: real("amount_variance"), // coefficient de variation
  occurrencesCount: integer("occurrences_count").notNull().default(0),
  kind: categoryKindEnum("kind"),
  firstSeenAt: date("first_seen_at"),
  lastSeenAt: date("last_seen_at"),
  nextPredictedAt: date("next_predicted_at"),
  confidence: real("confidence").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// ENGAGEMENTS (leasing, emprunts, baux, abonnements)
// ============================================================
export const engagements = pgTable(
  "engagements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    type: engagementTypeEnum("type").notNull(),
    label: text("label").notNull(),
    counterparty: text("counterparty"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    monthlyAmount: numeric("monthly_amount", { precision: 14, scale: 2 }).notNull(),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    tacitRenewal: boolean("tacit_renewal").notNull().default(false),
    earlyExitPenalty: numeric("early_exit_penalty", { precision: 14, scale: 2 }),
    balloonAmount: numeric("balloon_amount", { precision: 14, scale: 2 }), // option rachat leasing
    amortizationSchedule: jsonb("amortization_schedule"), // [{ date, principal, interest }]
    reminderDaysBefore: integer("reminder_days_before").notNull().default(90),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ byOrg: index("engagements_org_idx").on(t.orgId) })
);

// ============================================================
// FORECASTS (projections mensuelles prévu vs réalisé)
// ============================================================
export const forecasts = pgTable(
  "forecasts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "cascade" }),
    periodMonth: date("period_month").notNull(), // YYYY-MM-01
    plannedAmount: numeric("planned_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    realizedAmount: numeric("realized_amount", { precision: 14, scale: 2 }),
    confidence: real("confidence").notNull().default(0.5),
    generatedBy: text("generated_by").notNull().default("ai"), // ai | user | rule | recurrence
    generationReason: text("generation_reason"),
    userOverride: boolean("user_override").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byOrgPeriod: index("forecasts_org_period_idx").on(t.orgId, t.periodMonth),
    uniqRow: uniqueIndex("forecasts_uq").on(t.orgId, t.categoryId, t.periodMonth),
  })
);

// Snapshot quotidien du solde consolidé (pour les graphs ultra rapides)
export const cashSnapshots = pgTable(
  "cash_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    asOfDate: date("as_of_date").notNull(),
    totalBalance: numeric("total_balance", { precision: 14, scale: 2 }).notNull(),
    byAccount: jsonb("by_account").notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byOrg: index("cash_snapshots_org_idx").on(t.orgId, t.asOfDate),
    uniq: uniqueIndex("cash_snapshots_uq").on(t.orgId, t.asOfDate),
  })
);

// ============================================================
// SCENARIOS (what-if)
// ============================================================
export const scenarios = pgTable(
  "scenarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    adjustments: jsonb("adjustments").notNull().default(sql`'[]'::jsonb`),
    // [{ type: "delay_payment"|"revenue_change"|"hire"|"loan_injection", value: number, startMonth: string }]
    horizon: integer("horizon").notNull().default(6), // en mois
    isPinned: boolean("is_pinned").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ byOrg: index("scenarios_org_idx").on(t.orgId) })
);

// ============================================================
// ALERTS
// ============================================================
export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    severity: alertSeverityEnum("severity").notNull(),
    status: alertStatusEnum("status").notNull().default("active"),
    title: text("title").notNull(),
    body: text("body"),
    actionLabel: text("action_label"),
    actionPayload: jsonb("action_payload"),
    impactAmount: numeric("impact_amount", { precision: 14, scale: 2 }),
    impactDate: date("impact_date"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ byOrg: index("alerts_org_idx").on(t.orgId, t.status) })
);

// ============================================================
// AI CHAT CONVERSATIONS
// ============================================================
export const chatConversations = pgTable("chat_conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id").notNull().references(() => chatConversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // user | assistant | system
    content: text("content").notNull(),
    toolCalls: jsonb("tool_calls"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ byConv: index("chat_messages_conv_idx").on(t.conversationId) })
);

// ============================================================
// RELATIONS
// ============================================================
export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  bankConnections: many(bankConnections),
  bankAccounts: many(bankAccounts),
  categories: many(categories),
  transactions: many(transactions),
  engagements: many(engagements),
  forecasts: many(forecasts),
  scenarios: many(scenarios),
  alerts: many(alerts),
}));

export const usersRelations = relations(users, ({ many, one }) => ({
  memberships: many(organizationMembers),
  defaultOrg: one(organizations, { fields: [users.defaultOrgId], references: [organizations.id] }),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, { fields: [organizationMembers.orgId], references: [organizations.id] }),
  user: one(users, { fields: [organizationMembers.userId], references: [users.id] }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  organization: one(organizations, { fields: [transactions.orgId], references: [organizations.id] }),
  account: one(bankAccounts, { fields: [transactions.accountId], references: [bankAccounts.id] }),
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
  recurrenceGroup: one(recurrenceGroups, { fields: [transactions.recurrenceGroupId], references: [recurrenceGroups.id] }),
}));

export const categoriesRelations = relations(categories, ({ many, one }) => ({
  rules: many(categoryRules),
  transactions: many(transactions),
  parent: one(categories, { fields: [categories.parentId], references: [categories.id] }),
}));

// ============================================================
// TYPE EXPORTS
// ============================================================
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Engagement = typeof engagements.$inferSelect;
export type NewEngagement = typeof engagements.$inferInsert;
export type Forecast = typeof forecasts.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type Scenario = typeof scenarios.$inferSelect;
export type BankAccount = typeof bankAccounts.$inferSelect;
export type BankConnection = typeof bankConnections.$inferSelect;
