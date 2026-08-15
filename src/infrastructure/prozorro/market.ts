import {
  computeMarketStats, MIN_SAMPLE, topCompetitors, WINDOW_FULL_MONTHS,
  type MarketSample, type MarketStats,
} from "@/src/domain/market/stats";
import { computeCompetitionRisk } from "@/src/domain/market/competition";
import type { CompetitionRisk, CompetitionLevel, MarketContext, NormalizedTender } from "@/src/domain/tender/types";
import {
  extractMarketSample, getMarketBackfillState, queryMarketSamples,
  setMarketBackfillState, upsertMarketTenders,
} from "@/src/infrastructure/storage/market";

const PORTAL_SEARCH_URL = "https://prozorro.gov.ua/api/search/tenders";
const PORTAL_SUMMARY_URL = "https://prozorro.gov.ua/api/tenders";
const PUBLIC_API_URL = "https://public-api.prozorro.gov.ua/api/2.5/tenders";

const BUYER_SAMPLE_LIMIT = 40;
const CONCURRENCY = 6;
const SEARCH_TIMEOUT_MS = 8_000;

type RawTender = Record<string, unknown> & { id: string };

async function officialFetch(url: URL, init: RequestInit = {}): Promise<Response> {
  const allowed = url.hostname === "prozorro.gov.ua" || url.hostname === "public-api.prozorro.gov.ua";
  if (url.protocol !== "https:" || !allowed) throw new Error("Unsupported source");
  return fetch(url, {
    ...init,
    headers: { accept: "application/json", "content-type": "application/json", "user-agent": "Vymoha/1.0 (+market)", ...init.headers },
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    cache: "no-store",
  });
}

/** Розв'язує зовнішній ID у internal, повертає повний запис тендера. */
async function fetchRawByExternalId(externalId: string): Promise<RawTender | null> {
  try {
    const summaryResponse = await officialFetch(new URL(`${PORTAL_SUMMARY_URL}/${encodeURIComponent(externalId)}/summary`));
    if (!summaryResponse.ok) return null;
    const summary = (await summaryResponse.json()) as { id?: unknown };
    if (typeof summary.id !== "string") return null;
    const detailsResponse = await officialFetch(new URL(`${PUBLIC_API_URL}/${summary.id}`));
    if (!detailsResponse.ok) return null;
    const envelope = (await detailsResponse.json()) as { data?: RawTender };
    return envelope.data ?? null;
  } catch {
    return null;
  }
}

/** Шукає завершені закупівлі замовника через portal search (не фільтрує за CPV). */
async function fetchBuyerCompletedIds(buyerEdrpou: string, monthsBack: number): Promise<string[]> {
  const now = new Date();
  const start = new Date(now);
  start.setUTCMonth(start.getUTCMonth() - monthsBack);
  const url = new URL(PORTAL_SEARCH_URL);
  url.searchParams.append("buyer[]", buyerEdrpou);
  url.searchParams.append("status[]", "complete");
  url.searchParams.set("date[tender][start]", start.toISOString().slice(0, 10));
  url.searchParams.set("date[tender][end]", now.toISOString().slice(0, 10));
  url.searchParams.set("limit", String(BUYER_SAMPLE_LIMIT));

  const response = await officialFetch(url, { method: "POST", body: "{}" });
  if (!response.ok) return [];
  const payload = (await response.json()) as { data?: Array<{ tenderID?: unknown }> };
  return (payload.data ?? [])
    .map((item) => (typeof item.tenderID === "string" ? item.tenderID : ""))
    .filter(Boolean)
    .slice(0, BUYER_SAMPLE_LIMIT);
}

/** Паралельний map з обмеженням одночасності. */
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

function levelForParticipants(medianParticipants: number | null): CompetitionLevel {
  if (medianParticipants === null) return "unknown";
  if (medianParticipants <= 1) return "low";
  if (medianParticipants >= 5) return "high";
  return "normal";
}

function assembleContext(input: {
  scope: "market" | "buyer";
  cpvClass: string;
  region: string | null;
  stats: MarketStats;
  samples: MarketSample[];
  sourceUrl: string;
}): MarketContext | null {
  const { scope, cpvClass, region, stats, samples, sourceUrl } = input;
  if (stats.sampleSize < MIN_SAMPLE) return null;
  const competitors = topCompetitors(samples);
  return {
    scope,
    cpvClass,
    region,
    sampleSize: stats.sampleSize,
    discountSampleSize: stats.discountSampleSize,
    windowMonths: stats.windowMonths,
    medianParticipants: stats.medianParticipants,
    medianDiscount: stats.medianDiscount,
    discountP25: stats.discountP25,
    discountP75: stats.discountP75,
    singleBidderRate: stats.singleBidderRate,
    competitionLevel: levelForParticipants(stats.medianParticipants),
    confidence: stats.sampleSize >= 15 ? "high" : "low",
    topCompetitors: competitors,
    sourceUrl,
  };
}

/**
 * Конкурентний бенчмарк + ознаки низької конкуренції тендера.
 * Бенчмарк: ринок за CPV (з індексу D1), з фолбеком на історію замовника.
 * Ризик конкуренції рахується з тієї ж вибірки, тому жоден запит не дублюється.
 */
export type MarketIntelligence = {
  context: MarketContext | null;
  competition: CompetitionRisk;
};

export async function fetchMarketBenchmark(tender: NormalizedTender, now = new Date()): Promise<MarketIntelligence> {
  let pool: MarketSample[] = [];
  let context: MarketContext | null = null;

  const digits = (tender.cpvCode ?? "").replace(/\D/g, "");
  if (digits.length >= 5) {
    const cpv8 = digits.slice(0, 8);
    const cpv5 = digits.slice(0, 5);
    const cpv3 = digits.slice(0, 3);

    // 1) Ринковий вимір з індексу: ієрархія точний CPV → клас → група,
    //    з перевагою регіону, якщо вибірка по регіону достатня.
    let marketSamples: MarketSample[] = [];
    try {
      marketSamples = await queryMarketSamples(cpv5, cpv3);
    } catch {
      marketSamples = [];
    }
    const region = tender.region ?? null;
    const fullCpv = (tender.cpvCode ?? "").replace(/\D/g, "").length >= 8 ? tender.cpvCode! : cpv8;
    const levels: Array<{ code: string; matches: MarketSample[] }> = [
      { code: fullCpv, matches: marketSamples.filter((sample) => sample.cpv8 === cpv8) },
      { code: cpv5, matches: marketSamples.filter((sample) => sample.cpv5 === cpv5) },
      { code: cpv3, matches: marketSamples.filter((sample) => sample.cpv3 === cpv3) },
    ];
    for (const level of levels) {
      const { pool: candidate, usedRegion } = bestPool(level.matches, region);
      const stats = computeMarketStats(candidate, now);
      if (stats.sampleSize >= MIN_SAMPLE) {
        pool = candidate;
        context = assembleContext({
          scope: "market", cpvClass: level.code, region: usedRegion,
          stats, samples: candidate,
          sourceUrl: `https://prozorro.gov.ua/tender/search/?cpv=${cpv8}`,
        });
        break;
      }
    }

    // 2) Фолбек: історія цього замовника за тим самим CPV.
    if (!context && tender.buyerEdrpou && /^\d{8,10}$/.test(tender.buyerEdrpou)) {
      try {
        const ids = await fetchBuyerCompletedIds(tender.buyerEdrpou, 24);
        const rawTenders = (await mapWithConcurrency(ids, CONCURRENCY, fetchRawByExternalId)).filter((raw): raw is RawTender => raw !== null);
        const samples = rawTenders
          .map((raw) => extractMarketSample(raw))
          .filter((sample): sample is MarketSample => sample !== null && sample.cpv5 === cpv5);
        // Поповнюємо ринковий індекс знайденими даними (побічний ефект, дешево).
        await upsertMarketTenders(samples).catch(() => {});
        pool = samples;
        const stats = computeMarketStats(samples, now);
        const buyerContext = assembleContext({
          scope: "buyer", cpvClass: cpv5, region: null, stats, samples,
          sourceUrl: `https://prozorro.gov.ua/tender/search/?buyer=${encodeURIComponent(tender.buyerEdrpou)}`,
        });
        if (buyerContext) context = buyerContext;
      } catch {
        // Відсутність бенчмарку прийнятна — чесніше, ніж вигадані цифри.
      }
    }
  }

  const competition = computeCompetitionRisk(pool, tender);
  return { context, competition };
}

function bestPool(samples: MarketSample[], region: string | null): { pool: MarketSample[]; usedRegion: string | null } {
  if (!region) return { pool: samples, usedRegion: null };
  const regionSamples = samples.filter((sample) => sample.region === region);
  if (regionSamples.length >= MIN_SAMPLE) return { pool: regionSamples, usedRegion: region };
  return { pool: samples, usedRegion: null };
}

/**
 * Фоновий індексатор ринку (cron). Feed Prozorro не віддає items/bids/awards
 * навіть через opt_fields, тому йдемо по стрічці (descending), беремо щойно
 * завершені тендери і довантажуємо їх повні записи за внутрішнім id.
 */
export async function indexCompletedTenders(limit = 100): Promise<{ indexed: number; fetched: number; completed: number }> {
  const page = await fetchFeedPage(undefined, Math.min(limit, 100));
  const completed = page.filter((item) => item.status === "complete");
  const raws = await mapWithConcurrency(completed, CONCURRENCY, (item) => fetchRawById(item.id));
  const samples = raws
    .filter((raw): raw is RawTender => raw !== null)
    .map((raw) => extractMarketSample(raw))
    .filter((sample): sample is MarketSample => sample !== null);
  await upsertMarketTenders(samples).catch(() => {});
  return { indexed: samples.length, fetched: page.length, completed: completed.length };
}

export type FeedItem = { id: string; status: string; dateModified: string };

export type BackfillResult = {
  processed: number;
  completed: number;
  indexed: number;
  cursor: string | null;
  finished: boolean;
};

export type BackfillDependencies = {
  fetchFeedPage: (offset?: string) => Promise<FeedItem[]>;
  fetchRawById: (id: string) => Promise<RawTender | null>;
  upsert: (samples: MarketSample[]) => Promise<void>;
  getState: () => Promise<{ cursor: string | null; finished: boolean }>;
  setState: (cursor: string | null, finished: boolean) => Promise<void>;
};

/**
 * Резюмований курсорний прохід по стрічці назад у часі (descending + offset).
 * Кожен виклик обробляє не більше `budgetTenders` позицій стрічки, зберігає
 * курсор і прапор finished. Ідемпотентний: повторний виклик після finished
 * одразу повертає результат без мережі.
 */
export async function backfillBatch(
  budgetTenders: number,
  stopBeforeMs: number,
  dependencies: BackfillDependencies,
): Promise<BackfillResult> {
  const state = await dependencies.getState();
  if (state.finished) {
    return { processed: 0, completed: 0, indexed: 0, cursor: state.cursor, finished: true };
  }

  let cursor = state.cursor;
  let processed = 0;
  let completed = 0;
  let indexed = 0;
  let finished = false;

  while (processed < budgetTenders) {
    const page = await dependencies.fetchFeedPage(cursor ?? undefined);
    if (page.length === 0) { finished = true; break; }

    processed += page.length;
    const completedItems = page.filter((item) => item.status === "complete");
    completed += completedItems.length;

    const raws = await mapWithConcurrency(completedItems, CONCURRENCY, (item) => dependencies.fetchRawById(item.id));
    const samples = raws
      .filter((raw): raw is RawTender => raw !== null)
      .map((raw) => extractMarketSample(raw))
      .filter((sample): sample is MarketSample => sample !== null);
    indexed += samples.length;
    await dependencies.upsert(samples);

    const last = page[page.length - 1]?.dateModified ?? null;
    if (last === cursor) { finished = true; break; }
    cursor = last;
    if (!last || new Date(last).getTime() <= stopBeforeMs) { finished = true; break; }
  }

  await dependencies.setState(cursor, finished);
  return { processed, completed, indexed, cursor, finished };
}

const MONTH_MS = 30.44 * 24 * 60 * 60 * 1_000;

/** Публічний вхід для cron: прогріває 24-місячне вікно історії. */
export async function backfillMarketIndex(budgetTenders = 500): Promise<BackfillResult> {
  const stopBeforeMs = Date.now() - WINDOW_FULL_MONTHS * MONTH_MS;
  return backfillBatch(budgetTenders, stopBeforeMs, {
    fetchFeedPage: (offset) => fetchFeedPage(offset),
    fetchRawById: (id) => fetchRawById(id),
    upsert: (samples) => upsertMarketTenders(samples),
    getState: () => getMarketBackfillState(),
    setState: (cursor, finished) => setMarketBackfillState(cursor, finished),
  });
}

async function fetchFeedPage(offset?: string, limit = 100): Promise<FeedItem[]> {
  const url = new URL(PUBLIC_API_URL);
  url.searchParams.set("descending", "1");
  url.searchParams.set("limit", String(Math.min(limit, 100)));
  url.searchParams.set("mode", "all");
  url.searchParams.set("opt_fields", "tenderID,status,procurementMethodType,dateModified,id");
  if (offset) url.searchParams.set("offset", offset);

  const response = await officialFetch(url);
  if (!response.ok) return [];
  const envelope = (await response.json()) as { data?: Array<{ id?: unknown; status?: unknown; dateModified?: unknown }> };
  return (envelope.data ?? [])
    .filter((item): item is { id: unknown; status: unknown; dateModified: unknown } => typeof item.id === "string" && typeof item.dateModified === "string")
    .map((item) => ({ id: item.id as string, status: String(item.status ?? ""), dateModified: item.dateModified as string }));
}

async function fetchRawById(id: string): Promise<RawTender | null> {
  try {
    const detailsResponse = await officialFetch(new URL(`${PUBLIC_API_URL}/${id}`));
    if (!detailsResponse.ok) return null;
    const detailEnvelope = (await detailsResponse.json()) as { data?: RawTender };
    return detailEnvelope.data ?? null;
  } catch {
    return null;
  }
}
