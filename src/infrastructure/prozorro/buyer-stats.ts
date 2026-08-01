import type { BuyerContext } from "@/src/domain/tender/types";

const PORTAL_SEARCH_URL = "https://prozorro.gov.ua/api/search/tenders";
const PORTAL_SUMMARY_URL = "https://prozorro.gov.ua/api/tenders";
const PUBLIC_API_URL = "https://public-api.prozorro.gov.ua/api/2.5/tenders";
const SAMPLE_LIMIT = 12;
const CACHE_TTL_MS = 6 * 60 * 60 * 1_000;
const CACHE_LIMIT = 100;

type CachedContext = { expiresAt: number; value: BuyerContext };
const contextCache = new Map<string, CachedContext>();

type SearchTender = { tenderID?: unknown };
type SearchResponse = { data?: SearchTender[] };
type Award = { status?: unknown };
type TenderDetails = { awards?: Award[]; bids?: unknown[] };

export async function fetchBuyerContext(buyerEdrpou: string, now = new Date()): Promise<BuyerContext | undefined> {
  if (!/^\d{8,10}$/.test(buyerEdrpou)) return undefined;

  const periodEnd = isoDate(now);
  const start = new Date(now);
  start.setUTCFullYear(start.getUTCFullYear() - 1);
  const periodStart = isoDate(start);
  const cacheKey = `${buyerEdrpou}:${periodStart}:${periodEnd}`;
  const cached = contextCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) contextCache.delete(cacheKey);
  const searchUrl = new URL(PORTAL_SEARCH_URL);
  searchUrl.searchParams.append("buyer[]", buyerEdrpou);
  searchUrl.searchParams.append("status[]", "complete");
  searchUrl.searchParams.set("date[tender][start]", periodStart);
  searchUrl.searchParams.set("date[tender][end]", periodEnd);

  try {
    const response = await officialFetch(searchUrl, { method: "POST", body: "{}" });
    if (!response.ok) return undefined;
    const payload = await response.json() as SearchResponse;
    const tenderIds = (payload.data ?? [])
      .map((item) => typeof item.tenderID === "string" ? item.tenderID : "")
      .filter(Boolean)
      .slice(0, SAMPLE_LIMIT);
    if (!tenderIds.length) return undefined;

    const settled = await Promise.allSettled(tenderIds.map(fetchDecisionStats));
    const decisions = settled
      .filter((item): item is PromiseFulfilledResult<DecisionStats> => item.status === "fulfilled")
      .map((item) => item.value);
    if (!decisions.length) return undefined;

    const decidedAwards = sum(decisions.map((item) => item.decidedAwards));
    const disqualifiedAwards = sum(decisions.map((item) => item.disqualifiedAwards));
    const value: BuyerContext = {
      buyerEdrpou,
      sampleSize: decisions.length,
      decidedAwards,
      disqualifiedAwards,
      tendersWithDisqualifications: decisions.filter((item) => item.disqualifiedAwards > 0).length,
      disqualificationRate: decidedAwards ? disqualifiedAwards / decidedAwards : 0,
      averageBids: Math.round((sum(decisions.map((item) => item.bids)) / decisions.length) * 10) / 10,
      periodStart,
      periodEnd,
      sourceUrl: `https://prozorro.gov.ua/tender/search/?buyer=${encodeURIComponent(buyerEdrpou)}`,
    };
    remember(cacheKey, value);
    return value;
  } catch {
    return undefined;
  }
}

function remember(key: string, value: BuyerContext): void {
  if (contextCache.size >= CACHE_LIMIT) {
    const oldest = contextCache.keys().next().value;
    if (oldest) contextCache.delete(oldest);
  }
  contextCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

type DecisionStats = { decidedAwards: number; disqualifiedAwards: number; bids: number };

async function fetchDecisionStats(tenderId: string): Promise<DecisionStats> {
  const summaryResponse = await officialFetch(new URL(`${PORTAL_SUMMARY_URL}/${encodeURIComponent(tenderId)}/summary`));
  if (!summaryResponse.ok) throw new Error("Tender summary unavailable");
  const summary = await summaryResponse.json() as { id?: unknown };
  if (typeof summary.id !== "string" || !/^[a-f0-9]{32}$/i.test(summary.id)) throw new Error("Invalid tender id");

  const detailsResponse = await officialFetch(new URL(`${PUBLIC_API_URL}/${summary.id}`));
  if (!detailsResponse.ok) throw new Error("Tender details unavailable");
  const envelope = await detailsResponse.json() as { data?: TenderDetails };
  const awards = Array.isArray(envelope.data?.awards) ? envelope.data.awards : [];
  const decided = awards.filter((award) => award.status === "active" || award.status === "unsuccessful");
  return {
    decidedAwards: decided.length,
    disqualifiedAwards: decided.filter((award) => award.status === "unsuccessful").length,
    bids: Array.isArray(envelope.data?.bids) ? envelope.data.bids.length : 0,
  };
}

function officialFetch(url: URL, init: RequestInit = {}): Promise<Response> {
  const allowed = url.hostname === "prozorro.gov.ua" || url.hostname === "public-api.prozorro.gov.ua";
  if (url.protocol !== "https:" || !allowed) throw new Error("Unsupported source");
  return fetch(url, {
    ...init,
    headers: { accept: "application/json", "content-type": "application/json", "user-agent": "Vymoha/1.0 (+buyer-context)", ...init.headers },
    signal: AbortSignal.timeout(6_000),
    cache: "no-store",
  });
}

function isoDate(value: Date): string { return value.toISOString().slice(0, 10); }
function sum(values: number[]): number { return values.reduce((total, value) => total + value, 0); }
