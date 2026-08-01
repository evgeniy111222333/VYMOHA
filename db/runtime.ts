import { env } from "cloudflare:workers";

export type RuntimeEnv = {
  DB: D1Database;
  DOCUMENTS: R2Bucket;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
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
    database.prepare(`CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY, user_id TEXT, action TEXT NOT NULL, resource_type TEXT NOT NULL,
      resource_id TEXT, ip_hash TEXT, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
    )`),
  ]);
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
    database.prepare("CREATE INDEX IF NOT EXISTS idx_audit_events_user_created ON audit_events(user_id, created_at)"),
    database.prepare("CREATE INDEX IF NOT EXISTS idx_audit_events_resource ON audit_events(resource_type, resource_id)"),
  ]);
  await database.prepare("PRAGMA optimize").run();
}
