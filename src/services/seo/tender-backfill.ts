import { ensureDatabase } from "@/db/runtime";
import { analyzeTender } from "@/src/domain/tender/analyzer";
import { fetchBuyerContext } from "@/src/infrastructure/prozorro/buyer-stats";
import { fetchTender } from "@/src/infrastructure/prozorro/client";
import {
  getPublicTenderSummary,
  isPublicSummaryFresh,
  upsertPublicTenderSummary,
} from "@/src/infrastructure/storage/repository";

const FEED_URL = "https://public-api.prozorro.gov.ua/api/2.5/tenders";
const CONCURRENCY = 4;
const TIMEOUT_MS = 8_000;
const STATE_KEY = "tender-pages";
const HISTORY_WINDOW_MS = 730 * 24 * 60 * 60 * 1_000;

type FeedItem = { id: string; tenderID: string; status: string; dateModified: string };

export type TenderPageBackfillResult = {
  processed: number;
  upserted: number;
  skipped: number;
  failed: number;
  cursor: string | null;
  finished: boolean;
};

async function fetchFeedPage(offset?: string, limit = 100): Promise<FeedItem[]> {
  const url = new URL(FEED_URL);
  url.searchParams.set("descending", "1");
  url.searchParams.set("limit", String(Math.min(limit, 100)));
  url.searchParams.set("opt_fields", "tenderID,status,dateModified,id");
  if (offset) url.searchParams.set("offset", offset);

  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "Vymoha/1.0 (+seo-backfill)" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) return [];
  const envelope = (await response.json()) as {
    data?: Array<{ id?: unknown; tenderID?: unknown; status?: unknown; dateModified?: unknown }>;
  };
  return (envelope.data ?? [])
    .filter((item): item is { id: unknown; tenderID: unknown; status: unknown; dateModified: unknown } =>
      typeof item.id === "string" && typeof item.tenderID === "string" && typeof item.dateModified === "string")
    .map((item) => ({
      id: item.id as string,
      tenderID: String(item.tenderID ?? "").toUpperCase(),
      status: String(item.status ?? ""),
      dateModified: item.dateModified as string,
    }))
    .filter((item) => item.tenderID.startsWith("UA-"));
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

type ProcessOutcome = "upserted" | "skipped" | "failed";

async function processFeedItems(items: FeedItem[]): Promise<{ upserted: number; skipped: number; failed: number }> {
  const outcomes = await mapWithConcurrency(items, CONCURRENCY, async (item): Promise<ProcessOutcome> => {
    const existing = await getPublicTenderSummary(item.tenderID);
    if (existing && await isPublicSummaryFresh(existing, item.dateModified)) return "skipped";
    try {
      const tender = await fetchTender(item.id);
      let buyerContext;
      try {
        buyerContext = tender.buyerEdrpou ? await fetchBuyerContext(tender.buyerEdrpou) : undefined;
      } catch {
        buyerContext = undefined;
      }
      const analysis = analyzeTender(tender, undefined, new Date(), buyerContext, "quick");
      await upsertPublicTenderSummary({ analysis });
      return "upserted";
    } catch {
      return "failed";
    }
  });
  return outcomes.reduce(
    (acc, outcome) => {
      if (outcome === "upserted") acc.upserted += 1;
      else if (outcome === "skipped") acc.skipped += 1;
      else acc.failed += 1;
      return acc;
    },
    { upserted: 0, skipped: 0, failed: 0 },
  );
}

async function getState(): Promise<{ cursor: string | null; finished: boolean }> {
  const database = await ensureDatabase();
  const row = await database.prepare("SELECT cursor, finished FROM market_index_progress WHERE key = ?")
    .bind(STATE_KEY).first<{ cursor: string | null; finished: number }>();
  return { cursor: row?.cursor ?? null, finished: Boolean(row?.finished) };
}

async function setState(cursor: string | null, finished: boolean): Promise<void> {
  const database = await ensureDatabase();
  await database.prepare(
    `INSERT INTO market_index_progress (key, cursor, finished, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET cursor = excluded.cursor, finished = excluded.finished, updated_at = excluded.updated_at`,
  ).bind(STATE_KEY, cursor, finished ? 1 : 0, new Date().toISOString()).run();
}

/**
 * Підтримує свіжість найсвіжіших тендерів стрічки (активні + щойно завершені).
 * Без курсора — завжди читає верх стрічки (descending) і пропускає вже свіжі.
 */
export async function refreshRecentTenderPages(budgetTenders = 200): Promise<TenderPageBackfillResult> {
  let remaining = Math.max(budgetTenders, 1);
  let cursor: string | undefined;
  let processed = 0;
  const totals = { upserted: 0, skipped: 0, failed: 0 };

  while (remaining > 0) {
    const page = await fetchFeedPage(cursor, Math.min(remaining, 100));
    if (page.length === 0) break;
    processed += page.length;
    const result = await processFeedItems(page);
    totals.upserted += result.upserted;
    totals.skipped += result.skipped;
    totals.failed += result.failed;

    const last = page[page.length - 1]?.dateModified ?? null;
    if (!last || last === cursor) break;
    cursor = last;
    remaining -= page.length;
  }

  return { processed, ...totals, cursor: cursor ?? null, finished: false };
}

/**
 * Курсорний прохід по стрічці назад у часі — будує довгий хвіст завершених
 * тендерів. Ідемпотентний: після finished одразу повертається без мережі.
 */
export async function backfillTenderPages(budgetTenders = 300): Promise<TenderPageBackfillResult> {
  const state = await getState();
  if (state.finished) {
    return { processed: 0, upserted: 0, skipped: 0, failed: 0, cursor: state.cursor, finished: true };
  }

  const stopBeforeMs = Date.now() - HISTORY_WINDOW_MS;
  let cursor = state.cursor;
  let processed = 0;
  const totals = { upserted: 0, skipped: 0, failed: 0 };
  let finished = false;

  while (processed < budgetTenders) {
    const page = await fetchFeedPage(cursor ?? undefined);
    if (page.length === 0) { finished = true; break; }

    processed += page.length;
    const result = await processFeedItems(page);
    totals.upserted += result.upserted;
    totals.skipped += result.skipped;
    totals.failed += result.failed;

    const last = page[page.length - 1]?.dateModified ?? null;
    if (last === cursor) { finished = true; break; }
    cursor = last;
    if (!last || new Date(last).getTime() <= stopBeforeMs) { finished = true; break; }
  }

  await setState(cursor, finished);
  return { processed, ...totals, cursor, finished };
}
