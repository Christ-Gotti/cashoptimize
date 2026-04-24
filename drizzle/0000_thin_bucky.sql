CREATE TYPE "public"."alert_severity" AS ENUM('info', 'warning', 'critical', 'opportunity');--> statement-breakpoint
CREATE TYPE "public"."alert_status" AS ENUM('active', 'dismissed', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."bank_provider" AS ENUM('bridge', 'powens', 'gocardless', 'manual');--> statement-breakpoint
CREATE TYPE "public"."category_direction" AS ENUM('inflow', 'outflow');--> statement-breakpoint
CREATE TYPE "public"."category_kind" AS ENUM('fixed', 'variable', 'semi_variable');--> statement-breakpoint
CREATE TYPE "public"."engagement_type" AS ENUM('loan', 'leasing', 'consumer_credit', 'lease_commercial', 'insurance', 'subscription', 'contract_cdd', 'other');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('trial', 'starter', 'pro', 'business', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."scenario_kind" AS ENUM('delay_payment', 'revenue_change', 'hire', 'loan_injection', 'custom');--> statement-breakpoint
CREATE TYPE "public"."transaction_source" AS ENUM('bank_sync', 'manual', 'import_csv');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'admin', 'member', 'accountant_viewer');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"severity" "alert_severity" NOT NULL,
	"status" "alert_status" DEFAULT 'active' NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"action_label" text,
	"action_payload" jsonb,
	"impact_amount" numeric(14, 2),
	"impact_date" date,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"provider_account_id" text NOT NULL,
	"name" text NOT NULL,
	"iban" text,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"last_balance_at" timestamp with time zone,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"provider" "bank_provider" DEFAULT 'bridge' NOT NULL,
	"provider_user_id" text,
	"provider_item_id" text NOT NULL,
	"bank_name" text NOT NULL,
	"bank_logo_url" text,
	"status" text DEFAULT 'active' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"next_reauth_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"as_of_date" date NOT NULL,
	"total_balance" numeric(14, 2) NOT NULL,
	"by_account" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"direction" "category_direction" NOT NULL,
	"kind" "category_kind",
	"color" text DEFAULT '#6366f1' NOT NULL,
	"icon" text,
	"parent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"category_id" uuid NOT NULL,
	"pattern" text NOT NULL,
	"pattern_type" text DEFAULT 'contains' NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"learned_from_user" boolean DEFAULT false NOT NULL,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"tool_calls" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engagements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"type" "engagement_type" NOT NULL,
	"label" text NOT NULL,
	"counterparty" text,
	"start_date" date NOT NULL,
	"end_date" date,
	"monthly_amount" numeric(14, 2) NOT NULL,
	"category_id" uuid,
	"tacit_renewal" boolean DEFAULT false NOT NULL,
	"early_exit_penalty" numeric(14, 2),
	"balloon_amount" numeric(14, 2),
	"amortization_schedule" jsonb,
	"reminder_days_before" integer DEFAULT 90 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forecasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"category_id" uuid,
	"period_month" date NOT NULL,
	"planned_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"realized_amount" numeric(14, 2),
	"confidence" real DEFAULT 0.5 NOT NULL,
	"generated_by" text DEFAULT 'ai' NOT NULL,
	"generation_reason" text,
	"user_override" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_members_org_id_user_id_pk" PRIMARY KEY("org_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"siret" text,
	"industry" text,
	"country" text DEFAULT 'FR' NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"plan" "plan" DEFAULT 'trial' NOT NULL,
	"plan_renewal_at" timestamp with time zone,
	"dodo_customer_id" text,
	"dodo_subscription_id" text,
	"fiscal_year_start" integer DEFAULT 1 NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurrence_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"label" text NOT NULL,
	"category_id" uuid,
	"periodicity_days" integer,
	"avg_amount" numeric(14, 2),
	"amount_variance" real,
	"occurrences_count" integer DEFAULT 0 NOT NULL,
	"kind" "category_kind",
	"first_seen_at" date,
	"last_seen_at" date,
	"next_predicted_at" date,
	"confidence" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"adjustments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"horizon" integer DEFAULT 6 NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"provider_tx_id" text,
	"source" "transaction_source" DEFAULT 'bank_sync' NOT NULL,
	"booked_at" date NOT NULL,
	"value_date" date,
	"raw_label" text NOT NULL,
	"clean_label" text,
	"amount" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"category_id" uuid,
	"category_confidence" real,
	"categorization_tier" integer,
	"kind" "category_kind",
	"counterparty_name" text,
	"counterparty_iban" text,
	"recurrence_group_id" uuid,
	"user_override" boolean DEFAULT false NOT NULL,
	"user_notes" text,
	"embedding" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"avatar_url" text,
	"locale" text DEFAULT 'fr' NOT NULL,
	"default_org_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_connection_id_bank_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."bank_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_connections" ADD CONSTRAINT "bank_connections_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_snapshots" ADD CONSTRAINT "cash_snapshots_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagements" ADD CONSTRAINT "engagements_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagements" ADD CONSTRAINT "engagements_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurrence_groups" ADD CONSTRAINT "recurrence_groups_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurrence_groups" ADD CONSTRAINT "recurrence_groups_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_bank_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_default_org_id_organizations_id_fk" FOREIGN KEY ("default_org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_org_idx" ON "alerts" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "bank_accounts_org_idx" ON "bank_accounts" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_accounts_provider_uq" ON "bank_accounts" USING btree ("connection_id","provider_account_id");--> statement-breakpoint
CREATE INDEX "bank_connections_org_idx" ON "bank_connections" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_connections_item_uq" ON "bank_connections" USING btree ("provider","provider_item_id");--> statement-breakpoint
CREATE INDEX "cash_snapshots_org_idx" ON "cash_snapshots" USING btree ("org_id","as_of_date");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_snapshots_uq" ON "cash_snapshots" USING btree ("org_id","as_of_date");--> statement-breakpoint
CREATE INDEX "categories_org_idx" ON "categories" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_org_slug_uq" ON "categories" USING btree ("org_id","slug");--> statement-breakpoint
CREATE INDEX "category_rules_cat_idx" ON "category_rules" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "category_rules_org_idx" ON "category_rules" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "chat_messages_conv_idx" ON "chat_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "engagements_org_idx" ON "engagements" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "forecasts_org_period_idx" ON "forecasts" USING btree ("org_id","period_month");--> statement-breakpoint
CREATE UNIQUE INDEX "forecasts_uq" ON "forecasts" USING btree ("org_id","category_id","period_month");--> statement-breakpoint
CREATE INDEX "scenarios_org_idx" ON "scenarios" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "transactions_org_idx" ON "transactions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "transactions_org_date_idx" ON "transactions" USING btree ("org_id","booked_at");--> statement-breakpoint
CREATE INDEX "transactions_account_idx" ON "transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "transactions_category_idx" ON "transactions" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_provider_uq" ON "transactions" USING btree ("account_id","provider_tx_id");