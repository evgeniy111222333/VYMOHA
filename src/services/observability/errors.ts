import { ensureDatabase, runtimeEnv } from "@/db/runtime";
import { sendHealthAlertEmail } from "@/src/infrastructure/notifications/email";
import { sha256 } from "@/src/lib/security";

export type ErrorSource = "server" | "client" | "cron" | "external";

export type CaptureErrorInput = {
  source: ErrorSource;
  route?: string;
  error: unknown;
  context?: Record<string, unknown>;
  severity?: "error" | "warning";
};

export type ErrorEventRow = {
  fingerprint: string;
  source: string;
  route: string | null;
  errorName: string;
  errorMessage: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
};

export type ErrorIssue = { check: string; severity: "warn" | "error"; detail: string };

export function normalizeError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) return { name: error.name || "Error", message: error.message || String(error), stack: error.stack };
  if (typeof error === "string") return { name: "Error", message: error };
  if (error && typeof error === "object") {
    const obj = error as Record<string, unknown>;
    return {
      name: typeof obj.name === "string" ? obj.name : "Error",
      message: typeof obj.message === "string" ? obj.message : JSON.stringify(error).slice(0, 500),
      stack: typeof obj.stack === "string" ? obj.stack : undefined,
    };
  }
  return { name: "Error", message: String(error) };
}

/** Видаляє динамічні значення, щоб однакові за суттю помилки групувалися. */
export function normalizeForFingerprint(message: string): string {
  return message
    .replace(/UA-\d{4}-\d{2}-\d{2}-\d{6}(?:-[a-z])?/gi, "<tender>")
    .replace(/\b\d{8,}\b/g, "<num>");
}

/**
 * Єдиний вхід для фіксації помилок. Нормалізує, групує за fingerprint і
 * асинхронно пише в D1. Ніколи не кидає — capture не має ламати продукт.
 */
export async function captureError(input: CaptureErrorInput): Promise<void> {
  try {
    const normalized = normalizeError(input.error);
    const fingerprint = await sha256(`${input.source}:${normalized.name}:${normalizeForFingerprint(normalized.message)}`);
    const database = await ensureDatabase();
    const now = new Date().toISOString();
    await database.prepare(
      `INSERT INTO error_events (id, fingerprint, source, route, error_name, error_message, stack, context_json, severity, count, first_seen, last_seen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT(fingerprint) DO UPDATE SET
         count = error_events.count + 1, last_seen = excluded.last_seen,
         route = COALESCE(excluded.route, error_events.route),
         error_message = excluded.error_message`,
    ).bind(
      crypto.randomUUID(), fingerprint, input.source, input.route ?? null,
      normalized.name, normalized.message.slice(0, 1000),
      normalized.stack?.slice(0, 2000) ?? null,
      JSON.stringify(input.context ?? {}), input.severity ?? "error", now, now,
    ).run();
  } catch {
    // silently ignore capture failures
  }
}

export async function listErrorEvents(limit = 50): Promise<ErrorEventRow[]> {
  const database = await ensureDatabase();
  const result = await database.prepare(
    `SELECT fingerprint, source, route, error_name, error_message, count, first_seen, last_seen
     FROM error_events ORDER BY last_seen DESC LIMIT ?`,
  ).bind(Math.min(Math.max(Math.floor(limit), 1), 250)).all<Record<string, unknown>>();
  return result.results.map((row) => ({
    fingerprint: String(row.fingerprint),
    source: String(row.source),
    route: row.route ? String(row.route) : null,
    errorName: String(row.error_name),
    errorMessage: String(row.error_message),
    count: Number(row.count),
    firstSeen: String(row.first_seen),
    lastSeen: String(row.last_seen),
  }));
}

export async function evaluateErrorAlerts(now = new Date()): Promise<ErrorIssue[]> {
  const database = await ensureDatabase();
  const since = new Date(now.getTime() - 6 * 3_600_000).toISOString();
  const result = await database.prepare(
    `SELECT source, route, error_name, count, first_seen FROM error_events WHERE last_seen >= ? ORDER BY count DESC LIMIT 30`,
  ).bind(since).all<Record<string, unknown>>();
  const issues: ErrorIssue[] = [];
  for (const row of result.results) {
    const count = Number(row.count);
    const label = `${String(row.error_name)} (${String(row.source)}${row.route ? " · " + String(row.route) : ""})`;
    const isNew = String(row.first_seen) >= since;
    if (count >= 5) {
      issues.push({ check: `error-spike:${label}`, severity: "warn", detail: `${label} — ${count} разів за 6 год.` });
    } else if (isNew && count >= 2) {
      issues.push({ check: `error-new:${label}`, severity: "warn", detail: `Нова помилка за останні 6 год: ${label}.` });
    }
  }
  return issues;
}

const ALERT_COOLDOWN_HOURS = 6;

async function shouldAlert(check: string, severity: "warn" | "error"): Promise<boolean> {
  const database = await ensureDatabase();
  const row = await database.prepare("SELECT last_status, last_alert_at FROM seo_alert_state WHERE check_name = ?")
    .bind(check).first<{ last_status: string; last_alert_at: string }>();
  if (!row) return true;
  const lastAt = new Date(row.last_alert_at).getTime();
  if (Date.now() - lastAt < ALERT_COOLDOWN_HOURS * 3_600_000 && row.last_status === severity) return false;
  return true;
}

async function markAlertSent(check: string, severity: "warn" | "error"): Promise<void> {
  const database = await ensureDatabase();
  await database.prepare(
    `INSERT INTO seo_alert_state (check_name, last_status, last_alert_at) VALUES (?, ?, ?)
     ON CONFLICT(check_name) DO UPDATE SET last_status = excluded.last_status, last_alert_at = excluded.last_alert_at`,
  ).bind(check, severity, new Date().toISOString()).run();
}

export async function runErrorMonitoring(): Promise<{ issues: number; alertsSent: number }> {
  const database = await ensureDatabase();
  await database.prepare("DELETE FROM error_events WHERE last_seen < ?")
    .bind(new Date(Date.now() - 30 * 24 * 3_600_000).toISOString()).run();

  const issues = await evaluateErrorAlerts();
  let alertsSent = 0;
  const apiKey = runtimeEnv().RESEND_API_KEY;
  const from = runtimeEnv().NOTIFICATION_FROM ?? "VYMOHA <updates@vymoha.com>";
  const recipients = (runtimeEnv().ADMIN_EMAILS ?? "").split(",").map((email) => email.trim()).filter(Boolean);

  for (const issue of issues) {
    if (!(await shouldAlert(issue.check, issue.severity))) continue;
    for (const to of recipients) {
      const status = await sendHealthAlertEmail({ to, issues: [{ check: issue.check, severity: issue.severity, detail: issue.detail }] }, apiKey, from);
      if (status === "sent") alertsSent += 1;
    }
    await markAlertSent(issue.check, issue.severity);
  }

  return { issues: issues.length, alertsSent };
}
