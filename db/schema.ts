import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

export const publicTenderSummaries = sqliteTable(
  "public_tender_summaries",
  {
    tenderExternalId: text("tender_external_id").primaryKey(),
    tenderDateModified: text("tender_date_modified"),
    title: text("title").notNull(),
    buyer: text("buyer").notNull(),
    buyerEdrpou: text("buyer_edrpou"),
    amountMinor: integer("amount_minor"),
    currency: text("currency"),
    deadline: text("deadline"),
    status: text("status").notNull(),
    method: text("method"),
    cpvCode: text("cpv_code"),
    cpvLabel: text("cpv_label"),
    documentCount: integer("document_count").notNull().default(0),
    verdict: text("verdict").notNull(),
    score: integer("score").notNull(),
    confidence: integer("confidence").notNull(),
    summary: text("summary").notNull(),
    resultJson: text("result_json").notNull(),
    expiresAt: integer("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("idx_public_summaries_expires_at").on(table.expiresAt)],
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
    phone: text("phone"),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
    phoneVerified: integer("phone_verified", { mode: "boolean" }).notNull().default(false),
    role: text("role").notNull().default("user"),
    status: text("status").notNull().default("active"),
    creditBalance: integer("credit_balance").notNull().default(0),
    totalCreditsPurchased: integer("total_credits_purchased").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_user_accounts_email").on(table.email),
    uniqueIndex("idx_user_accounts_phone").on(table.phone),
    index("idx_user_accounts_role_status").on(table.role, table.status),
  ],
);

export const authIdentities = sqliteTable(
  "auth_identities",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    provider: text("provider").notNull(),
    providerSubject: text("provider_subject").notNull(),
    secretHash: text("secret_hash"),
    secretSalt: text("secret_salt"),
    verifiedAt: text("verified_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_auth_identities_provider_subject").on(table.provider, table.providerSubject),
    index("idx_auth_identities_user_id").on(table.userId),
  ],
);

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
    userAgentHash: text("user_agent_hash"),
    revokedAt: text("revoked_at"),
  },
  (table) => [
    index("idx_auth_sessions_user_expires").on(table.userId, table.expiresAt),
    index("idx_auth_sessions_expires_at").on(table.expiresAt),
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

export const analysisTelemetry = sqliteTable(
  "analysis_telemetry",
  {
    id: text("id").primaryKey(),
    analysisId: text("analysis_id").notNull(),
    userHash: text("user_hash").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    tier: text("tier").notNull(),
    status: text("status").notNull(),
    errorCode: text("error_code"),
    durationMs: integer("duration_ms").notNull(),
    documentCount: integer("document_count").notNull().default(0),
    documentsRead: integer("documents_read").notNull().default(0),
    inputTokens: integer("input_tokens").notNull().default(0),
    cachedInputTokens: integer("cached_input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costMicrousd: integer("cost_microusd").notNull().default(0),
    createdAt: text("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [
    index("idx_analysis_telemetry_created").on(table.createdAt),
    index("idx_analysis_telemetry_expires").on(table.expiresAt),
  ],
);

export const marketTenders = sqliteTable(
  "market_tenders",
  {
    id: text("id").primaryKey(),
    tenderExternalId: text("tender_external_id").notNull(),
    cpv8: text("cpv8").notNull(),
    cpv5: text("cpv5").notNull(),
    cpv3: text("cpv3").notNull(),
    region: text("region"),
    method: text("method"),
    expectedAmount: real("expected_amount").notNull(),
    currency: text("currency"),
    participants: integer("participants").notNull().default(0),
    winningAmount: real("winning_amount"),
    winnerEdrpou: text("winner_edrpou"),
    completedAt: text("completed_at"),
    indexedAt: text("indexed_at").notNull(),
  },
  (table) => [
    index("idx_market_tenders_cpv5_completed").on(table.cpv5, table.completedAt),
    index("idx_market_tenders_cpv3_completed").on(table.cpv3, table.completedAt),
    index("idx_market_tenders_region_completed").on(table.region, table.completedAt),
  ],
);

export const marketIndexProgress = sqliteTable(
  "market_index_progress",
  {
    key: text("key").primaryKey(),
    cursor: text("cursor"),
    finished: integer("finished", { mode: "boolean" }).notNull().default(false),
    updatedAt: text("updated_at").notNull(),
  },
);
