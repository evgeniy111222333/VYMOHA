import { env } from "cloudflare:workers";

export type RuntimeEnv = {
  DB: D1Database;
  DOCUMENTS: R2Bucket;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL_STANDARD?: string;
  GEMINI_MODEL_EXPERT?: string;
  /** @deprecated Transitional aliases for an existing deployment. */
  OPENAI_API_KEY?: string;
  OPENAI_MODEL_STANDARD?: string;
  OPENAI_MODEL_EXPERT?: string;
  MONOBANK_JAR_ID?: string;
  MONOBANK_WEBHOOK_SECRET?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  APP_BASE_URL?: string;
  ADMIN_EMAILS?: string;
  ADMIN_STARTING_CREDITS?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_VERIFY_SERVICE_SID?: string;
};

let initialization: Promise<void> | null = null;

export function runtimeEnv(): RuntimeEnv {
  return env as unknown as RuntimeEnv;
}

export async function ensureDatabase(): Promise<D1Database> {
  const database = runtimeEnv().DB;
  if (!database) throw new Error("D1 binding DB is unavailable.");
  initialization ??= initialize(database).catch((error) => {
    initialization = null;
    throw error;
  });
  await initialization;
  return database;
}

async function initialize(database: D1Database): Promise<void> {
  await database.batch([
    database.prepare(`CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, name TEXT NOT NULL,
      edrpou TEXT, region TEXT, cpv_codes_json TEXT NOT NULL DEFAULT '[]',
      capabilities_json TEXT NOT NULL DEFAULT '[]', certifications_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, tender_external_id TEXT NOT NULL,
      tender_internal_id TEXT, source_url TEXT NOT NULL, title TEXT NOT NULL, buyer TEXT NOT NULL,
      amount_minor INTEGER, currency TEXT, deadline TEXT, verdict TEXT NOT NULL, score INTEGER NOT NULL,
      mode TEXT NOT NULL, result_json TEXT NOT NULL, content_hash TEXT NOT NULL, created_at TEXT NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, organization_id TEXT, name TEXT NOT NULL,
      object_key TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL,
      sha256 TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ready', created_at TEXT NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS watches (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, tender_external_id TEXT NOT NULL,
      last_modified TEXT, last_hash TEXT, notify_email TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS rate_limits (
      bucket_key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS public_tender_summaries (
      tender_external_id TEXT PRIMARY KEY, tender_date_modified TEXT,
      title TEXT NOT NULL, buyer TEXT NOT NULL, buyer_edrpou TEXT,
      amount_minor INTEGER, currency TEXT, deadline TEXT, status TEXT NOT NULL,
      method TEXT, cpv_code TEXT, cpv_label TEXT, document_count INTEGER NOT NULL DEFAULT 0,
      verdict TEXT NOT NULL, score INTEGER NOT NULL, confidence INTEGER NOT NULL,
      summary TEXT NOT NULL, result_json TEXT NOT NULL,
      expires_at INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY, user_id TEXT, action TEXT NOT NULL, resource_type TEXT NOT NULL,
      resource_id TEXT, ip_hash TEXT, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS user_accounts (
      user_id TEXT PRIMARY KEY, email TEXT NOT NULL, phone TEXT, display_name TEXT NOT NULL,
      avatar_url TEXT, email_verified INTEGER NOT NULL DEFAULT 0, phone_verified INTEGER NOT NULL DEFAULT 0,
      role TEXT NOT NULL DEFAULT 'user', status TEXT NOT NULL DEFAULT 'active',
      credit_balance INTEGER NOT NULL DEFAULT 0, total_credits_purchased INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS payment_orders (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, package_id TEXT NOT NULL, credits INTEGER NOT NULL,
      amount_minor INTEGER NOT NULL, currency TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
      provider TEXT NOT NULL DEFAULT 'stripe', provider_session_id TEXT, provider_payment_id TEXT,
      created_at TEXT NOT NULL, paid_at TEXT
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS credit_ledger (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, delta INTEGER NOT NULL, balance_after INTEGER NOT NULL,
      reason TEXT NOT NULL, idempotency_key TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS ai_usage (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, analysis_id TEXT NOT NULL, tier TEXT NOT NULL,
      model TEXT NOT NULL, input_tokens INTEGER NOT NULL DEFAULT 0, cached_input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0, cost_microusd INTEGER NOT NULL DEFAULT 0,
      credits_charged INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'reserved',
      created_at TEXT NOT NULL, completed_at TEXT
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS analysis_telemetry (
      id TEXT PRIMARY KEY, analysis_id TEXT NOT NULL, user_hash TEXT NOT NULL,
      provider TEXT NOT NULL, model TEXT NOT NULL, tier TEXT NOT NULL, status TEXT NOT NULL,
      error_code TEXT, duration_ms INTEGER NOT NULL, document_count INTEGER NOT NULL DEFAULT 0,
      documents_read INTEGER NOT NULL DEFAULT 0, input_tokens INTEGER NOT NULL DEFAULT 0,
      cached_input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
      cost_microusd INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, expires_at INTEGER NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS auth_identities (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, provider TEXT NOT NULL,
      provider_subject TEXT NOT NULL, secret_hash TEXT, secret_salt TEXT,
      verified_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, user_agent_hash TEXT, revoked_at TEXT
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS market_tenders (
      id TEXT PRIMARY KEY, tender_external_id TEXT NOT NULL,
      cpv8 TEXT NOT NULL, cpv5 TEXT NOT NULL, cpv3 TEXT NOT NULL,
      region TEXT, method TEXT, expected_amount REAL NOT NULL, currency TEXT,
      participants INTEGER NOT NULL DEFAULT 0, winning_amount REAL, winner_edrpou TEXT,
      completed_at TEXT, indexed_at TEXT NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS market_index_progress (
      key TEXT PRIMARY KEY, cursor TEXT, finished INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL
    )`),
  ]);
  await ensureUserAccountColumns(database);
  await database.batch([
    database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_owner_user_id ON organizations(owner_user_id)"),
    database.prepare("CREATE INDEX IF NOT EXISTS idx_organizations_edrpou ON organizations(edrpou)"),
    database.prepare("CREATE INDEX IF NOT EXISTS idx_analyses_user_created ON analyses(user_id, created_at)"),
    database.prepare("CREATE INDEX IF NOT EXISTS idx_analyses_tender_external_id ON analyses(tender_external_id)"),
    database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_analyses_user_hash ON analyses(user_id, content_hash)"),
    database.prepare("CREATE INDEX IF NOT EXISTS idx_documents_user_created ON documents(user_id, created_at)"),
    database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_user_sha256 ON documents(user_id, sha256)"),
    database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_watches_user_tender ON watches(user_id, tender_external_id)"),
    database.prepare("CREATE INDEX IF NOT EXISTS idx_watches_active ON watches(active)"),
    database.prepare("CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON rate_limits(reset_at)"),
    database.prepare("CREATE INDEX IF NOT EXISTS idx_public_summaries_expires_at ON public_tender_summaries(expires_at)"),
    database.prepare("CREATE INDEX IF NOT EXISTS idx_audit_events_user_created ON audit_events(user_id, created_at)"),
    database.prepare("CREATE INDEX IF NOT EXISTS idx_audit_events_resource ON audit_events(resource_type, resource_id)"),
    database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_user_accounts_email ON user_accounts(email)"),
    database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_user_accounts_phone ON user_accounts(phone)"),
    database.prepare("CREATE INDEX IF NOT EXISTS idx_user_accounts_role_status ON user_accounts(role, status)"),
    database.prepare("CREATE INDEX IF NOT EXISTS idx_payment_orders_user_created ON payment_orders(user_id, created_at)"),
    database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_orders_provider_session ON payment_orders(provider_session_id)"),
    database.prepare("CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_created ON credit_ledger(user_id, created_at)"),
    database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_ledger_idempotency ON credit_ledger(idempotency_key)"),
    database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_usage_analysis_id ON ai_usage(analysis_id)"),
    database.prepare("CREATE INDEX IF NOT EXISTS idx_ai_usage_user_created ON ai_usage(user_id, created_at)"),
    database.prepare("CREATE INDEX IF NOT EXISTS idx_analysis_telemetry_created ON analysis_telemetry(created_at)"),
    database.prepare("CREATE INDEX IF NOT EXISTS idx_analysis_telemetry_expires ON analysis_telemetry(expires_at)"),
    database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_identities_provider_subject ON auth_identities(provider, provider_subject)"),
    database.prepare("CREATE INDEX IF NOT EXISTS idx_auth_identities_user_id ON auth_identities(user_id)"),
    database.prepare("CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_expires ON auth_sessions(user_id, expires_at)"),
    database.prepare("CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at)"),
    database.prepare("CREATE INDEX IF NOT EXISTS idx_market_tenders_cpv5_completed ON market_tenders(cpv5, completed_at)"),
    database.prepare("CREATE INDEX IF NOT EXISTS idx_market_tenders_cpv3_completed ON market_tenders(cpv3, completed_at)"),
    database.prepare("CREATE INDEX IF NOT EXISTS idx_market_tenders_region_completed ON market_tenders(region, completed_at)"),
  ]);
  await database.prepare("PRAGMA optimize").run();
}

async function ensureUserAccountColumns(database: D1Database): Promise<void> {
  const tableInfo = await database.prepare("PRAGMA table_info(user_accounts)").all<{ name: string }>();
  const columns = new Set(tableInfo.results.map((column) => column.name));
  const additions: D1PreparedStatement[] = [];
  if (!columns.has("phone")) additions.push(database.prepare("ALTER TABLE user_accounts ADD COLUMN phone TEXT"));
  if (!columns.has("avatar_url")) additions.push(database.prepare("ALTER TABLE user_accounts ADD COLUMN avatar_url TEXT"));
  if (!columns.has("email_verified")) additions.push(database.prepare("ALTER TABLE user_accounts ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0"));
  if (!columns.has("phone_verified")) additions.push(database.prepare("ALTER TABLE user_accounts ADD COLUMN phone_verified INTEGER NOT NULL DEFAULT 0"));
  if (additions.length) await database.batch(additions);
  if (!columns.has("email_verified")) {
    await database.prepare("UPDATE user_accounts SET email_verified = 1 WHERE email NOT LIKE '%@phone.vymoha.invalid'").run();
  }
}
