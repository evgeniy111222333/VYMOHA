import { ensureDatabase, runtimeEnv } from "@/db/runtime";
import { sendHealthAlertEmail } from "@/src/infrastructure/notifications/email";

export type BackfillRunRecord = {
  job: string;
  processed: number;
  upserted: number;
  skipped: number;
  failed: number;
  createdAt: string;
};

export type HealthState = {
  now: Date;
  runs: BackfillRunRecord[];
  cursorUpdatedAt: string | null;
  backfillFinished: boolean;
};

export type HealthIssue = { check: string; severity: "warn" | "error"; detail: string };

const STALL_HOURS = 6;
const CRON_GAP_HOURS = 3;
const HIGH_FAILURE_RATIO = 0.5;
const ZERO_THROUGHPUT_HOURS = 24;
const RECENT_RUNS = 8;

/**
 * Чиста функція оцінки здоров'я: приймає стан і повертає знайдені проблеми.
 * Тестується без бази даних і мережі.
 */
export function evaluateHealth(state: HealthState): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const nowMs = state.now.getTime();

  if (state.runs.length > 0) {
    const latestAt = new Date(state.runs[0]!.createdAt).getTime();
    if (Number.isFinite(latestAt) && nowMs - latestAt > CRON_GAP_HOURS * 3_600_000) {
      const hours = Math.round((nowMs - latestAt) / 3_600_000);
      issues.push({ check: "cron-down", severity: "error", detail: `Останній крон-запуск backfill був ${hours} год тому — крон може не працювати.` });
    }
  }

  if (!state.backfillFinished && state.cursorUpdatedAt) {
    const cursorAt = new Date(state.cursorUpdatedAt).getTime();
    if (Number.isFinite(cursorAt) && nowMs - cursorAt > STALL_HOURS * 3_600_000) {
      issues.push({ check: "backfill-stall", severity: "error", detail: `Курсор backfill не рухався понад ${STALL_HOURS} годин, хоча роботу не завершено.` });
    }
  }

  const recent = state.runs.slice(0, RECENT_RUNS);
  const processedSum = recent.reduce((s, r) => s + r.processed, 0);
  const failedSum = recent.reduce((s, r) => s + r.failed, 0);
  if (processedSum > 0 && failedSum / processedSum > HIGH_FAILURE_RATIO) {
    const ratio = Math.round((failedSum / processedSum) * 100);
    issues.push({ check: "high-failure-rate", severity: "warn", detail: `${ratio}% запитів Prozorro за останні запуски завершились помилкою (ймовірний rate-limit або зміна API).` });
  }

  if (!state.backfillFinished) {
    const dayAgo = nowMs - ZERO_THROUGHPUT_HOURS * 3_600_000;
    const dayRuns = state.runs.filter((r) => new Date(r.createdAt).getTime() >= dayAgo);
    const dayProcessed = dayRuns.reduce((s, r) => s + r.processed, 0);
    const dayUpserted = dayRuns.reduce((s, r) => s + r.upserted, 0);
    if (dayProcessed > 0 && dayUpserted === 0) {
      issues.push({ check: "zero-throughput", severity: "warn", detail: `Backfill опрацював ${dayProcessed} тендерів за добу, але не додав жодного нового.` });
    }
  }

  return issues;
}

export async function recordBackfillRun(job: string, result: { processed: number; upserted: number; skipped: number; failed: number }): Promise<void> {
  const database = await ensureDatabase();
  await database.prepare(
    `INSERT INTO seo_backfill_runs (id, job, processed, upserted, skipped, failed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(), job, Math.max(0, Math.floor(result.processed)),
    Math.max(0, Math.floor(result.upserted)), Math.max(0, Math.floor(result.skipped)),
    Math.max(0, Math.floor(result.failed)), new Date().toISOString(),
  ).run();
  await pruneOldRuns(database);
}

async function pruneOldRuns(database: D1Database): Promise<void> {
  await database.prepare(
    `DELETE FROM seo_backfill_runs WHERE id NOT IN (SELECT id FROM seo_backfill_runs ORDER BY created_at DESC LIMIT 500)`,
  ).run();
}

export async function recordHealthEvent(check: string, status: "ok" | "warn" | "error", detail: string): Promise<void> {
  const database = await ensureDatabase();
  await database.prepare(
    `INSERT INTO seo_health_events (id, check_name, status, detail, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).bind(crypto.randomUUID(), check, status, detail.slice(0, 400), new Date().toISOString()).run();
}

async function gatherHealthState(): Promise<HealthState> {
  const database = await ensureDatabase();
  const runsResult = await database.prepare(
    `SELECT job, processed, upserted, skipped, failed, created_at
     FROM seo_backfill_runs ORDER BY created_at DESC LIMIT 40`,
  ).all<Record<string, unknown>>();
  const cursorRow = await database.prepare(
    "SELECT cursor, finished, updated_at FROM market_index_progress WHERE key = ?",
  ).bind("tender-pages").first<{ cursor: string | null; finished: number; updated_at: string | null }>();

  return {
    now: new Date(),
    runs: runsResult.results.map((row) => ({
      job: String(row.job),
      processed: Number(row.processed),
      upserted: Number(row.upserted),
      skipped: Number(row.skipped),
      failed: Number(row.failed),
      createdAt: String(row.created_at),
    })),
    cursorUpdatedAt: cursorRow?.updated_at ?? null,
    backfillFinished: Boolean(cursorRow?.finished),
  };
}

const ALERT_COOLDOWN_HOURS = 6;

async function shouldAlert(check: string, severity: "warn" | "error"): Promise<boolean> {
  const database = await ensureDatabase();
  const row = await database.prepare("SELECT last_status, last_alert_at FROM seo_alert_state WHERE check_name = ?")
    .bind(check).first<{ last_status: string; last_alert_at: string }>();
  if (!row) return true;
  const lastAt = new Date(row.last_alert_at).getTime();
  const cooldownMs = ALERT_COOLDOWN_HOURS * 3_600_000;
  if (Date.now() - lastAt < cooldownMs && row.last_status === severity) return false;
  return true;
}

async function upsertAlertState(check: string, severity: "warn" | "error"): Promise<void> {
  const database = await ensureDatabase();
  await database.prepare(
    `INSERT INTO seo_alert_state (check_name, last_status, last_alert_at) VALUES (?, ?, ?)
     ON CONFLICT(check_name) DO UPDATE SET last_status = excluded.last_status, last_alert_at = excluded.last_alert_at`,
  ).bind(check, severity, new Date().toISOString()).run();
}

function adminEmails(): string[] {
  const raw = runtimeEnv().ADMIN_EMAILS ?? "";
  return raw.split(",").map((email) => email.trim()).filter(Boolean);
}

/**
 * Оркестратор: збирає стан, оцінює здоров'я, дедуплікує та розсилає алерти
 * адміністраторам. Викликається з крон-обробника Worker.
 */
export async function runSeoMonitoring(): Promise<{ issues: number; alertsSent: number }> {
  const state = await gatherHealthState();
  const issues = evaluateHealth(state);
  let alertsSent = 0;

  const apiKey = runtimeEnv().RESEND_API_KEY;
  const from = runtimeEnv().NOTIFICATION_FROM ?? "VYMOHA <updates@vymoha.com>";
  const recipients = adminEmails();

  for (const issue of issues) {
    await recordHealthEvent(issue.check, issue.severity, issue.detail);
    if (!(await shouldAlert(issue.check, issue.severity))) continue;
    if (recipients.length === 0) continue;
    for (const to of recipients) {
      const status = await sendHealthAlertEmail({ to, issues: [issue] }, apiKey, from);
      if (status === "sent") alertsSent += 1;
    }
    await upsertAlertState(issue.check, issue.severity);
  }

  return { issues: issues.length, alertsSent };
}
