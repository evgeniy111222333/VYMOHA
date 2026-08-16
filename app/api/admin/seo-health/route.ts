import { ensureDatabase } from "@/db/runtime";
import { ensureUserAccount } from "@/src/infrastructure/storage/accounts";
import { requireAdmin } from "@/src/infrastructure/storage/admin";
import { evaluateHealth, type BackfillRunRecord } from "@/src/services/seo/health";
import { apiError, requireRequestUser } from "@/src/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireRequestUser(request);
    await ensureUserAccount(user);
    await requireAdmin(user.id);

    const database = await ensureDatabase();
    const runsResult = await database.prepare(
      `SELECT job, processed, upserted, skipped, failed, created_at
       FROM seo_backfill_runs ORDER BY created_at DESC LIMIT 20`,
    ).all<Record<string, unknown>>();
    const eventsResult = await database.prepare(
      `SELECT check_name, status, detail, created_at
       FROM seo_health_events ORDER BY created_at DESC LIMIT 20`,
    ).all<Record<string, unknown>>();
    const tenderCount = await database.prepare("SELECT COUNT(*) AS c FROM public_tender_summaries").first<{ c: number }>();
    const marketCount = await database.prepare("SELECT COUNT(*) AS c FROM market_tenders").first<{ c: number }>();
    const cursor = await database.prepare(
      "SELECT cursor, finished, updated_at FROM market_index_progress WHERE key = 'tender-pages'",
    ).first<{ cursor: string | null; finished: number; updated_at: string | null }>();

    const runs: BackfillRunRecord[] = runsResult.results.map((row) => ({
      job: String(row.job),
      processed: Number(row.processed),
      upserted: Number(row.upserted),
      skipped: Number(row.skipped),
      failed: Number(row.failed),
      createdAt: String(row.created_at),
    }));

    const issues = evaluateHealth({
      now: new Date(),
      runs,
      cursorUpdatedAt: cursor?.updated_at ?? null,
      backfillFinished: Boolean(cursor?.finished),
    });

    return Response.json({
      data: {
        tenderCount: tenderCount?.c ?? 0,
        marketCount: marketCount?.c ?? 0,
        backfillCursor: cursor?.cursor ?? null,
        backfillFinished: Boolean(cursor?.finished),
        cursorUpdatedAt: cursor?.updated_at ?? null,
        issues,
        runs,
        events: eventsResult.results.map((row) => ({
          check: String(row.check_name),
          status: String(row.status),
          detail: String(row.detail),
          createdAt: String(row.created_at),
        })),
      },
    }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
