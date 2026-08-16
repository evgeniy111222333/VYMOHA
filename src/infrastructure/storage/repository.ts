import { ensureDatabase, runtimeEnv } from "@/db/runtime";
import type { CompanyProfile, TenderAnalysis } from "@/src/domain/tender/types";
import { sha256 } from "@/src/lib/security";

export type StoredAnalysis = {
  id: string;
  tenderExternalId: string;
  title: string;
  buyer: string;
  score: number;
  verdict: string;
  mode: string;
  deadline: string | null;
  createdAt: string;
};

export type StoredDocument = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  createdAt: string;
};

export type PrivateDocument = StoredDocument & { objectKey: string };

export type StoredWatch = {
  id: string;
  tenderExternalId: string;
  lastModified: string | null;
  notifyEmail: string;
  active: boolean;
  createdAt: string;
};

export type ActiveWatch = StoredWatch & { userId: string };

export type PublicTenderSummary = {
  tenderExternalId: string;
  tenderDateModified: string | null;
  title: string;
  buyer: string;
  buyerEdrpou: string | null;
  amountMinor: number | null;
  currency: string | null;
  deadline: string | null;
  status: string;
  method: string | null;
  cpvCode: string | null;
  cpvLabel: string | null;
  documentCount: number;
  verdict: string;
  score: number;
  confidence: number;
  summary: string;
  resultJson: string;
  expiresAt: number;
  createdAt: string;
  updatedAt: string;
};

export type AnalysisTelemetry = {
  id: string;
  analysisId: string;
  userHash: string;
  provider: "gemini" | "openai";
  model: string;
  tier: string;
  status: "completed" | "failed";
  errorCode: string | null;
  durationMs: number;
  documentCount: number;
  documentsRead: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  costMicrousd: number;
  createdAt: string;
  expiresAt: number;
};

const ANALYSIS_TELEMETRY_TTL_SECONDS = 30 * 24 * 60 * 60;

export async function recordAnalysisTelemetry(input: Omit<AnalysisTelemetry, "id" | "createdAt" | "expiresAt">): Promise<void> {
  const database = await ensureDatabase();
  const now = new Date();
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const expiresAt = nowSeconds + ANALYSIS_TELEMETRY_TTL_SECONDS;
  await database.batch([
    database.prepare("DELETE FROM analysis_telemetry WHERE expires_at <= ?").bind(nowSeconds),
    database.prepare(`INSERT INTO analysis_telemetry (
      id, analysis_id, user_hash, provider, model, tier, status, error_code,
      duration_ms, document_count, documents_read, input_tokens, cached_input_tokens,
      output_tokens, cost_microusd, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
      crypto.randomUUID(), input.analysisId, input.userHash, input.provider, input.model,
      input.tier, input.status, input.errorCode, input.durationMs, input.documentCount,
      input.documentsRead, input.inputTokens, input.cachedInputTokens, input.outputTokens,
      input.costMicrousd, now.toISOString(), expiresAt,
    ),
  ]);
}

export async function listAnalysisTelemetry(limit = 100): Promise<AnalysisTelemetry[]> {
  const database = await ensureDatabase();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const result = await database.prepare(`SELECT id, analysis_id, user_hash, provider, model, tier, status,
    error_code, duration_ms, document_count, documents_read, input_tokens, cached_input_tokens,
    output_tokens, cost_microusd, created_at, expires_at
    FROM analysis_telemetry WHERE expires_at > ? ORDER BY created_at DESC LIMIT ?`)
    .bind(nowSeconds, Math.min(Math.max(limit, 1), 250)).all<Record<string, unknown>>();
  return result.results.map((row) => ({
    id: String(row.id), analysisId: String(row.analysis_id), userHash: String(row.user_hash),
    provider: row.provider === "gemini" ? "gemini" : "openai", model: String(row.model), tier: String(row.tier),
    status: row.status === "completed" ? "completed" : "failed", errorCode: row.error_code ? String(row.error_code) : null,
    durationMs: Number(row.duration_ms), documentCount: Number(row.document_count), documentsRead: Number(row.documents_read),
    inputTokens: Number(row.input_tokens), cachedInputTokens: Number(row.cached_input_tokens), outputTokens: Number(row.output_tokens),
    costMicrousd: Number(row.cost_microusd), createdAt: String(row.created_at), expiresAt: Number(row.expires_at),
  }));
}

export async function getCompanyProfile(userId: string): Promise<(CompanyProfile & { region?: string }) | null> {
  const database = await ensureDatabase();
  const row = await database.prepare(`SELECT name, edrpou, region, cpv_codes_json, capabilities_json, certifications_json
    FROM organizations WHERE owner_user_id = ? LIMIT 1`).bind(userId).first<Record<string, unknown>>();
  if (!row) return null;
  return {
    name: String(row.name), edrpou: row.edrpou ? String(row.edrpou) : undefined,
    region: row.region ? String(row.region) : undefined,
    cpvCodes: parseStringArray(row.cpv_codes_json),
    capabilities: parseStringArray(row.capabilities_json),
    certifications: parseStringArray(row.certifications_json),
  };
}

export async function upsertCompanyProfile(userId: string, profile: CompanyProfile & { region?: string }): Promise<void> {
  const database = await ensureDatabase();
  const now = new Date().toISOString();
  await database.prepare(`INSERT INTO organizations (
      id, owner_user_id, name, edrpou, region, cpv_codes_json, capabilities_json, certifications_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(owner_user_id) DO UPDATE SET
      name = excluded.name, edrpou = excluded.edrpou, region = excluded.region,
      cpv_codes_json = excluded.cpv_codes_json, capabilities_json = excluded.capabilities_json,
      certifications_json = excluded.certifications_json, updated_at = excluded.updated_at`).bind(
    crypto.randomUUID(), userId, profile.name ?? "Моя компанія", profile.edrpou ?? null, profile.region ?? null,
    JSON.stringify(profile.cpvCodes), JSON.stringify(profile.capabilities), JSON.stringify(profile.certifications), now, now,
  ).run();
}

export async function saveAnalysis(userId: string, analysis: TenderAnalysis): Promise<void> {
  const database = await ensureDatabase();
  const serialized = JSON.stringify(analysis);
  const contentHash = await sha256(`${analysis.tender.externalId}:${analysis.tender.dateModified ?? "unknown"}:${analysis.mode}`);
  await database.prepare(`INSERT INTO analyses (
    id, user_id, tender_external_id, tender_internal_id, source_url, title, buyer,
    amount_minor, currency, deadline, verdict, score, mode, result_json, content_hash, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(user_id, content_hash) DO UPDATE SET
    result_json = excluded.result_json, verdict = excluded.verdict, score = excluded.score,
    mode = excluded.mode, created_at = excluded.created_at`).bind(
    analysis.id, userId, analysis.tender.externalId, analysis.tender.internalId,
    analysis.tender.sourceUrl, analysis.tender.title, analysis.tender.buyer,
    analysis.tender.amount ? Math.round(analysis.tender.amount * 100) : null,
    analysis.tender.currency ?? null, analysis.tender.deadline ?? null, analysis.verdict,
    analysis.score, analysis.mode, serialized, contentHash, analysis.generatedAt,
  ).run();
}

export async function listAnalyses(userId: string, limit = 20): Promise<StoredAnalysis[]> {
  const database = await ensureDatabase();
  const result = await database.prepare(`SELECT id, tender_external_id, title, buyer, score, verdict, mode, deadline, created_at
    FROM analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`).bind(userId, Math.min(limit, 50)).all<Record<string, unknown>>();
  return result.results.map((row) => ({
    id: String(row.id), tenderExternalId: String(row.tender_external_id), title: String(row.title),
    buyer: String(row.buyer), score: Number(row.score), verdict: String(row.verdict), mode: String(row.mode),
    deadline: row.deadline ? String(row.deadline) : null, createdAt: String(row.created_at),
  }));
}

export async function getAnalysisById(userId: string, id: string): Promise<TenderAnalysis | null> {
  const database = await ensureDatabase();
  const row = await database.prepare(`SELECT result_json FROM analyses WHERE user_id = ? AND id = ? LIMIT 1`)
    .bind(userId, id).first<Record<string, unknown>>();
  if (!row?.result_json) return null;
  try {
    return JSON.parse(String(row.result_json)) as TenderAnalysis;
  } catch {
    return null;
  }
}

export async function getLatestAnalysisByTender(userId: string, tenderExternalId: string): Promise<TenderAnalysis | null> {
  const database = await ensureDatabase();
  const row = await database.prepare(`SELECT result_json FROM analyses WHERE user_id = ? AND tender_external_id = ? ORDER BY created_at DESC LIMIT 1`)
    .bind(userId, tenderExternalId).first<Record<string, unknown>>();
  if (!row?.result_json) return null;
  try {
    return JSON.parse(String(row.result_json)) as TenderAnalysis;
  } catch {
    return null;
  }
}

export async function saveDocument(
  userId: string,
  input: { name: string; mimeType: string; bytes: ArrayBuffer },
): Promise<StoredDocument> {
  const database = await ensureDatabase();
  const hash = await hashBuffer(input.bytes);
  const existing = await database.prepare(`SELECT id, name, mime_type, size_bytes, status, created_at
    FROM documents WHERE user_id = ? AND sha256 = ? LIMIT 1`).bind(userId, hash).first<Record<string, unknown>>();
  if (existing) return mapDocument(existing);

  const id = crypto.randomUUID();
  const objectKey = `${await sha256(userId)}/${id}`;
  await runtimeEnv().DOCUMENTS.put(objectKey, input.bytes, {
    httpMetadata: { contentType: input.mimeType },
    customMetadata: { originalName: input.name },
  });
  const createdAt = new Date().toISOString();
  await database.prepare(`INSERT INTO documents (
    id, user_id, name, object_key, mime_type, size_bytes, sha256, status, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ready', ?)`).bind(
    id, userId, input.name, objectKey, input.mimeType, input.bytes.byteLength, hash, createdAt,
  ).run();
  return { id, name: input.name, mimeType: input.mimeType, sizeBytes: input.bytes.byteLength, status: "ready", createdAt };
}

export async function listDocuments(userId: string): Promise<StoredDocument[]> {
  const database = await ensureDatabase();
  const result = await database.prepare(`SELECT id, name, mime_type, size_bytes, status, created_at
    FROM documents WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`).bind(userId).all<Record<string, unknown>>();
  return result.results.map(mapDocument);
}

export async function getDocument(userId: string, documentId: string): Promise<PrivateDocument | null> {
  const database = await ensureDatabase();
  const row = await database.prepare(`SELECT id, name, object_key, mime_type, size_bytes, status, created_at
    FROM documents WHERE id = ? AND user_id = ? LIMIT 1`).bind(documentId, userId).first<Record<string, unknown>>();
  if (!row) return null;
  return { ...mapDocument(row), objectKey: String(row.object_key) };
}

export async function deleteDocument(userId: string, documentId: string): Promise<boolean> {
  const document = await getDocument(userId, documentId);
  if (!document) return false;
  await runtimeEnv().DOCUMENTS.delete(document.objectKey);
  const database = await ensureDatabase();
  await database.prepare("DELETE FROM documents WHERE id = ? AND user_id = ?").bind(documentId, userId).run();
  return true;
}

export async function setWatch(userId: string, email: string, tenderExternalId: string, modified?: string): Promise<void> {
  const database = await ensureDatabase();
  await database.prepare(`INSERT INTO watches (
    id, user_id, tender_external_id, last_modified, notify_email, active, created_at
  ) VALUES (?, ?, ?, ?, ?, 1, ?)
  ON CONFLICT(user_id, tender_external_id) DO UPDATE SET
    notify_email = excluded.notify_email, last_modified = excluded.last_modified, active = 1`).bind(
    crypto.randomUUID(), userId, tenderExternalId, modified ?? null, email, new Date().toISOString(),
  ).run();
}

export async function listWatches(userId: string): Promise<StoredWatch[]> {
  const database = await ensureDatabase();
  const result = await database.prepare(`SELECT id, tender_external_id, last_modified, notify_email, active, created_at
    FROM watches WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`).bind(userId).all<Record<string, unknown>>();
  return result.results.map((row) => ({
    id: String(row.id), tenderExternalId: String(row.tender_external_id),
    lastModified: row.last_modified ? String(row.last_modified) : null,
    notifyEmail: String(row.notify_email), active: Boolean(row.active), createdAt: String(row.created_at),
  }));
}

export async function listActiveWatches(limit = 200): Promise<ActiveWatch[]> {
  const database = await ensureDatabase();
  const result = await database.prepare(`SELECT id, user_id, tender_external_id, last_modified, notify_email, active, created_at
    FROM watches WHERE active = 1 ORDER BY created_at ASC LIMIT ?`).bind(Math.min(limit, 500)).all<Record<string, unknown>>();
  return result.results.map((row) => ({
    id: String(row.id), userId: String(row.user_id), tenderExternalId: String(row.tender_external_id),
    lastModified: row.last_modified ? String(row.last_modified) : null,
    notifyEmail: String(row.notify_email), active: Boolean(row.active), createdAt: String(row.created_at),
  }));
}

export async function updateWatchVersion(watchId: string, modified: string | null): Promise<void> {
  const database = await ensureDatabase();
  await database.prepare("UPDATE watches SET last_modified = ? WHERE id = ?").bind(modified, watchId).run();
}

export async function consumeRateLimit(bucketKey: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; resetAt: number }> {
  const database = await ensureDatabase();
  const now = Math.floor(Date.now() / 1000);
  const resetAt = now + windowSeconds;
  await database.prepare(`INSERT INTO rate_limits (bucket_key, count, reset_at) VALUES (?, 1, ?)
    ON CONFLICT(bucket_key) DO UPDATE SET
      count = CASE WHEN rate_limits.reset_at <= ? THEN 1 ELSE rate_limits.count + 1 END,
      reset_at = CASE WHEN rate_limits.reset_at <= ? THEN ? ELSE rate_limits.reset_at END`).bind(
    bucketKey, resetAt, now, now, resetAt,
  ).run();
  const row = await database.prepare("SELECT count, reset_at FROM rate_limits WHERE bucket_key = ?").bind(bucketKey).first<{ count: number; reset_at: number }>();
  return { 
    allowed: Boolean(row && row.count <= limit), 
    resetAt: row?.reset_at ?? resetAt 
  };
}

export async function writeAuditEvent(input: {
  userId?: string; action: string; resourceType: string; resourceId?: string; ipHash?: string; metadata?: unknown;
}): Promise<void> {
  const database = await ensureDatabase();
  await database.prepare(`INSERT INTO audit_events (
    id, user_id, action, resource_type, resource_id, ip_hash, metadata_json, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    crypto.randomUUID(), input.userId ?? null, input.action, input.resourceType,
    input.resourceId ?? null, input.ipHash ?? null, JSON.stringify(input.metadata ?? {}), new Date().toISOString(),
  ).run();
}

const PUBLIC_SUMMARY_TTL_SECONDS = 30 * 60;
const TERMINAL_SUMMARY_TTL_SECONDS = 30 * 24 * 60 * 60;

function isTerminalTenderStatus(status: string): boolean {
  return status === "complete" || status === "cancelled" || status === "unsuccessful";
}

export async function getPublicTenderSummary(externalId: string): Promise<PublicTenderSummary | null> {
  const database = await ensureDatabase();
  const row = await database.prepare(
    `SELECT tender_external_id, tender_date_modified, title, buyer, buyer_edrpou,
      amount_minor, currency, deadline, status, method, cpv_code, cpv_label,
      document_count, verdict, score, confidence, summary, result_json,
      expires_at, created_at, updated_at
     FROM public_tender_summaries WHERE tender_external_id = ? LIMIT 1`,
  ).bind(externalId).first<Record<string, unknown>>();
  if (!row) return null;
  return mapPublicSummary(row);
}

export async function upsertPublicTenderSummary(input: {
  analysis: import("@/src/domain/tender/types").TenderAnalysis;
  ttlSeconds?: number;
}): Promise<void> {
  const database = await ensureDatabase();
  const now = new Date();
  const ttl = input.ttlSeconds ?? (isTerminalTenderStatus(input.analysis.tender.status) ? TERMINAL_SUMMARY_TTL_SECONDS : PUBLIC_SUMMARY_TTL_SECONDS);
  const expiresAt = Math.floor(now.getTime() / 1000) + ttl;
  const tender = input.analysis.tender;
  const visibleDocs = tender.documents.filter((doc) => doc.title.toLowerCase() !== "sign.p7s");
  const sanitizedAnalysis = {
    ...input.analysis,
    questionsToBuyer: undefined,
    documentCoverage: undefined,
    risks: input.analysis.risks.map((risk) => ({ ...risk, mitigation: risk.mitigation.slice(0, 240) })),
  };
  await database.prepare(
    `INSERT INTO public_tender_summaries (
      tender_external_id, tender_date_modified, title, buyer, buyer_edrpou,
      amount_minor, currency, deadline, status, method, cpv_code, cpv_label,
      document_count, verdict, score, confidence, summary, result_json,
      expires_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tender_external_id) DO UPDATE SET
      tender_date_modified = excluded.tender_date_modified,
      title = excluded.title, buyer = excluded.buyer, buyer_edrpou = excluded.buyer_edrpou,
      amount_minor = excluded.amount_minor, currency = excluded.currency,
      deadline = excluded.deadline, status = excluded.status, method = excluded.method,
      cpv_code = excluded.cpv_code, cpv_label = excluded.cpv_label,
      document_count = excluded.document_count, verdict = excluded.verdict,
      score = excluded.score, confidence = excluded.confidence,
      summary = excluded.summary, result_json = excluded.result_json,
      expires_at = excluded.expires_at, updated_at = excluded.updated_at`,
  ).bind(
    tender.externalId, tender.dateModified ?? null, tender.title, tender.buyer,
    tender.buyerEdrpou ?? null,
    tender.amount ? Math.round(tender.amount * 100) : null,
    tender.currency ?? null, tender.deadline ?? null, tender.status,
    tender.method ?? null, tender.cpvCode ?? null, tender.cpvLabel ?? null,
    visibleDocs.length, input.analysis.verdict, input.analysis.score,
    input.analysis.confidence, input.analysis.summary.slice(0, 500),
    JSON.stringify(sanitizedAnalysis), expiresAt,
    now.toISOString(), now.toISOString(),
  ).run();
}

export async function isPublicSummaryFresh(summary: PublicTenderSummary, tenderDateModified: string | null | undefined): Promise<boolean> {
  if (summary.expiresAt * 1000 <= Date.now()) return false;
  if (tenderDateModified && summary.tenderDateModified && summary.tenderDateModified !== tenderDateModified) return false;
  return true;
}

export type PublicTenderSitemapEntry = {
  tenderExternalId: string;
  status: string;
  dateModified: string | null;
  updatedAt: string;
};

export async function countPublicTenderSummaries(): Promise<number> {
  const database = await ensureDatabase();
  const row = await database.prepare("SELECT COUNT(*) AS c FROM public_tender_summaries").first<{ c: number }>();
  return row?.c ?? 0;
}

export async function listPublicTenderSitemapEntries(limit: number, offset: number): Promise<PublicTenderSitemapEntry[]> {
  const database = await ensureDatabase();
  const result = await database.prepare(
    `SELECT tender_external_id, status, tender_date_modified, updated_at
     FROM public_tender_summaries
     ORDER BY tender_external_id ASC
     LIMIT ? OFFSET ?`,
  ).bind(Math.min(Math.max(Math.floor(limit), 1), 5000), Math.max(Math.floor(offset), 0)).all<Record<string, unknown>>();
  return result.results.map((row) => ({
    tenderExternalId: String(row.tender_external_id),
    status: String(row.status),
    dateModified: row.tender_date_modified ? String(row.tender_date_modified) : null,
    updatedAt: String(row.updated_at),
  }));
}

export type PublicTenderCard = {
  tenderExternalId: string;
  title: string;
  buyer: string;
  buyerEdrpou: string | null;
  amountMinor: number | null;
  currency: string | null;
  deadline: string | null;
  status: string;
  cpvCode: string | null;
  cpvLabel: string | null;
  verdict: string;
  score: number;
  updatedAt: string;
};

export type TenderDivision = { division: string; count: number };

function mapPublicTenderCard(row: Record<string, unknown>): PublicTenderCard {
  return {
    tenderExternalId: String(row.tender_external_id),
    title: String(row.title),
    buyer: String(row.buyer),
    buyerEdrpou: row.buyer_edrpou ? String(row.buyer_edrpou) : null,
    amountMinor: row.amount_minor === null || row.amount_minor === undefined ? null : Number(row.amount_minor),
    currency: row.currency ? String(row.currency) : null,
    deadline: row.deadline ? String(row.deadline) : null,
    status: String(row.status),
    cpvCode: row.cpv_code ? String(row.cpv_code) : null,
    cpvLabel: row.cpv_label ? String(row.cpv_label) : null,
    verdict: String(row.verdict),
    score: Number(row.score),
    updatedAt: String(row.updated_at),
  };
}

export async function listTenderDivisions(limit = 60): Promise<TenderDivision[]> {
  const database = await ensureDatabase();
  const result = await database.prepare(
    `SELECT substr(cpv_code, 1, 2) AS div, COUNT(*) AS c
     FROM public_tender_summaries
     WHERE cpv_code IS NOT NULL
     GROUP BY substr(cpv_code, 1, 2)
     ORDER BY c DESC
     LIMIT ?`,
  ).bind(Math.min(Math.max(Math.floor(limit), 1), 500)).all<Record<string, unknown>>();
  return result.results.map((row) => ({
    division: String(row.div),
    count: Number(row.c),
  }));
}

export type TenderClass = { cls: string; count: number };

export type TenderClassEntry = { division: string; cls: string; count: number };

export async function listAllTenderClasses(minCount = 3, limit = 500): Promise<TenderClassEntry[]> {
  const database = await ensureDatabase();
  const result = await database.prepare(
    `SELECT substr(cpv_code, 1, 2) AS div, substr(cpv_code, 1, 5) AS cls, COUNT(*) AS c
     FROM public_tender_summaries
     WHERE cpv_code IS NOT NULL
     GROUP BY substr(cpv_code, 1, 5)
     HAVING COUNT(*) >= ?
     ORDER BY c DESC
     LIMIT ?`,
  ).bind(Math.max(1, Math.floor(minCount)), Math.min(Math.max(Math.floor(limit), 1), 5000)).all<Record<string, unknown>>();
  return result.results.map((row) => ({
    division: String(row.div),
    cls: String(row.cls),
    count: Number(row.c),
  }));
}

export async function listTenderClasses(division: string, minCount = 3, limit = 100): Promise<TenderClass[]> {
  const digits = division.replace(/\D/g, "").slice(0, 2);
  if (!digits) return [];
  const database = await ensureDatabase();
  const result = await database.prepare(
    `SELECT substr(cpv_code, 1, 5) AS cls, COUNT(*) AS c
     FROM public_tender_summaries
     WHERE substr(cpv_code, 1, 2) = ?
     GROUP BY substr(cpv_code, 1, 5)
     HAVING COUNT(*) >= ?
     ORDER BY c DESC
     LIMIT ?`,
  ).bind(digits, Math.max(1, Math.floor(minCount)), Math.min(Math.max(Math.floor(limit), 1), 200)).all<Record<string, unknown>>();
  return result.results.map((row) => ({
    cls: String(row.cls),
    count: Number(row.c),
  }));
}

export async function listPublicTenderCardsByCpv(cpvPrefix: string, limit = 200): Promise<PublicTenderCard[]> {
  const digits = cpvPrefix.replace(/\D/g, "").slice(0, 8);
  if (!digits) return [];
  const database = await ensureDatabase();
  const result = await database.prepare(
    `SELECT tender_external_id, title, buyer, buyer_edrpou, amount_minor, currency, deadline,
       status, cpv_code, cpv_label, verdict, score, updated_at
     FROM public_tender_summaries
     WHERE cpv_code LIKE ? || '%'
     ORDER BY updated_at DESC
     LIMIT ?`,
  ).bind(digits, Math.min(Math.max(Math.floor(limit), 1), 500)).all<Record<string, unknown>>();
  return result.results.map(mapPublicTenderCard);
}

export async function listPublicTenderCardsByBuyer(buyerEdrpou: string, limit = 200): Promise<PublicTenderCard[]> {
  const database = await ensureDatabase();
  const result = await database.prepare(
    `SELECT tender_external_id, title, buyer, buyer_edrpou, amount_minor, currency, deadline,
       status, cpv_code, cpv_label, verdict, score, updated_at
     FROM public_tender_summaries
     WHERE buyer_edrpou = ?
     ORDER BY updated_at DESC
     LIMIT ?`,
  ).bind(buyerEdrpou, Math.min(Math.max(Math.floor(limit), 1), 500)).all<Record<string, unknown>>();
  return result.results.map(mapPublicTenderCard);
}

export type BuyerRef = { edrpou: string; name: string; count: number };

export async function listDistinctBuyers(limit = 500): Promise<BuyerRef[]> {
  const database = await ensureDatabase();
  const result = await database.prepare(
    `SELECT buyer_edrpou, buyer, COUNT(*) AS c
     FROM public_tender_summaries
     WHERE buyer_edrpou IS NOT NULL
     GROUP BY buyer_edrpou
     ORDER BY c DESC
     LIMIT ?`,
  ).bind(Math.min(Math.max(Math.floor(limit), 1), 5000)).all<Record<string, unknown>>();
  return result.results.map((row) => ({
    edrpou: String(row.buyer_edrpou),
    name: String(row.buyer),
    count: Number(row.c),
  }));
}

export async function getBuyerName(edrpou: string): Promise<string | null> {
  const database = await ensureDatabase();
  const row = await database.prepare(
    "SELECT buyer FROM public_tender_summaries WHERE buyer_edrpou = ? LIMIT 1",
  ).bind(edrpou).first<Record<string, unknown>>();
  return row?.buyer ? String(row.buyer) : null;
}

function mapPublicSummary(row: Record<string, unknown>): PublicTenderSummary {
  return {
    tenderExternalId: String(row.tender_external_id),
    tenderDateModified: row.tender_date_modified ? String(row.tender_date_modified) : null,
    title: String(row.title),
    buyer: String(row.buyer),
    buyerEdrpou: row.buyer_edrpou ? String(row.buyer_edrpou) : null,
    amountMinor: row.amount_minor === null || row.amount_minor === undefined ? null : Number(row.amount_minor),
    currency: row.currency ? String(row.currency) : null,
    deadline: row.deadline ? String(row.deadline) : null,
    status: String(row.status),
    method: row.method ? String(row.method) : null,
    cpvCode: row.cpv_code ? String(row.cpv_code) : null,
    cpvLabel: row.cpv_label ? String(row.cpv_label) : null,
    documentCount: Number(row.document_count),
    verdict: String(row.verdict),
    score: Number(row.score),
    confidence: Number(row.confidence),
    summary: String(row.summary),
    resultJson: String(row.result_json),
    expiresAt: Number(row.expires_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function parseStringArray(value: unknown): string[] {
  try { const parsed = JSON.parse(String(value)); return Array.isArray(parsed) ? parsed.map(String) : []; }
  catch { return []; }
}

async function hashBuffer(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function mapDocument(row: Record<string, unknown>): StoredDocument {
  return {
    id: String(row.id), name: String(row.name), mimeType: String(row.mime_type),
    sizeBytes: Number(row.size_bytes), status: String(row.status), createdAt: String(row.created_at),
  };
}
