import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const organizations = sqliteTable(
  "organizations",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull(),
    name: text("name").notNull(),
    edrpou: text("edrpou"),
    region: text("region"),
    cpvCodesJson: text("cpv_codes_json").notNull().default("[]"),
    capabilitiesJson: text("capabilities_json").notNull().default("[]"),
    certificationsJson: text("certifications_json").notNull().default("[]"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_organizations_owner_user_id").on(table.ownerUserId),
    index("idx_organizations_edrpou").on(table.edrpou),
  ],
);

export const analyses = sqliteTable(
  "analyses",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    tenderExternalId: text("tender_external_id").notNull(),
    tenderInternalId: text("tender_internal_id"),
    sourceUrl: text("source_url").notNull(),
    title: text("title").notNull(),
    buyer: text("buyer").notNull(),
    amountMinor: integer("amount_minor"),
    currency: text("currency"),
    deadline: text("deadline"),
    verdict: text("verdict").notNull(),
    score: integer("score").notNull(),
    mode: text("mode").notNull(),
    resultJson: text("result_json").notNull(),
    contentHash: text("content_hash").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_analyses_user_created").on(table.userId, table.createdAt),
    index("idx_analyses_tender_external_id").on(table.tenderExternalId),
    uniqueIndex("idx_analyses_user_hash").on(table.userId, table.contentHash),
  ],
);

export const documents = sqliteTable(
  "documents",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    organizationId: text("organization_id"),
    name: text("name").notNull(),
    objectKey: text("object_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    status: text("status").notNull().default("ready"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_documents_user_created").on(table.userId, table.createdAt),
    uniqueIndex("idx_documents_user_sha256").on(table.userId, table.sha256),
  ],
);

export const watches = sqliteTable(
  "watches",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    tenderExternalId: text("tender_external_id").notNull(),
    lastModified: text("last_modified"),
    lastHash: text("last_hash"),
    notifyEmail: text("notify_email").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_watches_user_tender").on(table.userId, table.tenderExternalId),
    index("idx_watches_active").on(table.active),
  ],
);

export const rateLimits = sqliteTable(
  "rate_limits",
  {
    bucketKey: text("bucket_key").primaryKey(),
    count: integer("count").notNull(),
    resetAt: integer("reset_at").notNull(),
  },
  (table) => [index("idx_rate_limits_reset_at").on(table.resetAt)],
);

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    ipHash: text("ip_hash"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_audit_events_user_created").on(table.userId, table.createdAt),
    index("idx_audit_events_resource").on(table.resourceType, table.resourceId),
  ],
);

export const userAccounts = sqliteTable(
  "user_accounts",
  {
    userId: text("user_id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role").notNull().default("user"),
    status: text("status").notNull().default("active"),
    creditBalance: integer("credit_balance").notNull().default(0),
    totalCreditsPurchased: integer("total_credits_purchased").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_user_accounts_email").on(table.email),
    index("idx_user_accounts_role_status").on(table.role, table.status),
  ],
);

export const paymentOrders = sqliteTable(
  "payment_orders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    packageId: text("package_id").notNull(),
    credits: integer("credits").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    status: text("status").notNull().default("pending"),
    provider: text("provider").notNull().default("stripe"),
    providerSessionId: text("provider_session_id"),
    providerPaymentId: text("provider_payment_id"),
    createdAt: text("created_at").notNull(),
    paidAt: text("paid_at"),
  },
  (table) => [
    index("idx_payment_orders_user_created").on(table.userId, table.createdAt),
    uniqueIndex("idx_payment_orders_provider_session").on(table.providerSessionId),
  ],
);

export const creditLedger = sqliteTable(
  "credit_ledger",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    delta: integer("delta").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    reason: text("reason").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_credit_ledger_user_created").on(table.userId, table.createdAt),
    uniqueIndex("idx_credit_ledger_idempotency").on(table.idempotencyKey),
  ],
);

export const aiUsage = sqliteTable(
  "ai_usage",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    analysisId: text("analysis_id").notNull(),
    tier: text("tier").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    cachedInputTokens: integer("cached_input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costMicrousd: integer("cost_microusd").notNull().default(0),
    creditsCharged: integer("credits_charged").notNull(),
    status: text("status").notNull().default("reserved"),
    createdAt: text("created_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => [
    uniqueIndex("idx_ai_usage_analysis_id").on(table.analysisId),
    index("idx_ai_usage_user_created").on(table.userId, table.createdAt),
  ],
);
