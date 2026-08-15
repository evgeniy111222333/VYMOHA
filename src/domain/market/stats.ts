/**
 * Чиста ринкова статистика — без I/O, повністю тестована.
 *
 * Принцип «не брехати»:
 * - рахуємо відносні метрики (дисконт як частку, кількість учасників),
 *   а не абсолютні ціни — інфляція і ПДВ не спотворюють висновок;
 * - вибірку очищаємо від неторгів (reporting/negotiation, без конкурентних
 *   ставок) і аномалій (виграш > очікуваної вартості);
 * - при малій вибірці (n < MIN_SAMPLE) не показуємо жодних середніх.
 */

export const MIN_SAMPLE = 5;
export const WINDOW_RECENT_MONTHS = 6;
export const WINDOW_FULL_MONTHS = 24;

const NON_COMPETITIVE_METHODS = new Set(["reporting", "negotiation", "negotiation.quick"]);

export type MarketSample = {
  cpv8: string;
  cpv5: string;
  cpv3: string;
  region: string | null;
  method: string | null;
  expectedAmount: number;
  currency: string | null;
  participants: number;
  /** Сума активних award; null якщо переможця не визначено. */
  winningAmount: number | null;
  winnerEdrpou: string | null;
  completedAt: string | null;
};

export type MarketStats = {
  sampleSize: number;
  discountSampleSize: number;
  windowMonths: number;
  medianParticipants: number | null;
  medianDiscount: number | null;
  discountP25: number | null;
  discountP75: number | null;
  singleBidderRate: number | null;
};

export function isCompetitiveMethod(method: string | null): boolean {
  return method !== null && method.length > 0 && !NON_COMPETITIVE_METHODS.has(method);
}

/** Nearest-rank перцентиль: робастний, без інтерполяції, нечутливий до викидів. */
export function percentile(sortedAscending: number[], p: number): number {
  if (sortedAscending.length === 0) return Number.NaN;
  const index = Math.ceil(p * sortedAscending.length) - 1;
  return sortedAscending[Math.max(0, Math.min(index, sortedAscending.length - 1))]!;
}

export function median(values: number[]): number {
  return percentile([...values].sort((a, b) => a - b), 0.5);
}

/** Дисконт переможця: (очікувана − виграшна) / очікувана. null при невалідних даних. */
export function winnerDiscount(expectedAmount: number, winningAmount: number | null): number | null {
  if (expectedAmount <= 0 || winningAmount === null || !Number.isFinite(winningAmount)) return null;
  if (winningAmount < 0 || winningAmount > expectedAmount) return null;
  return (expectedAmount - winningAmount) / expectedAmount;
}

/**
 * Агрегує вибірку завершених тендерів у ринкові метрики.
 * Надає перевагу свіжим даним (6 міс), якщо їх достатньо, інакше — 24 міс.
 */
export function computeMarketStats(samples: MarketSample[], now = new Date()): MarketStats {
  const competitive = samples.filter((sample) =>
    isCompetitiveMethod(sample.method)
    && sample.expectedAmount > 0
    && (sample.currency === null || sample.currency === "UAH"),
  );

  const inWindow = (sample: MarketSample, months: number): boolean => {
    if (!sample.completedAt) return false;
    const date = new Date(sample.completedAt);
    if (!Number.isFinite(date.getTime())) return false;
    const monthsAgo = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    return monthsAgo >= 0 && monthsAgo <= months;
  };

  const recent = competitive.filter((sample) => inWindow(sample, WINDOW_RECENT_MONTHS));
  const full = competitive.filter((sample) => inWindow(sample, WINDOW_FULL_MONTHS));
  const usable = recent.length >= MIN_SAMPLE ? recent : full;
  const windowMonths = recent.length >= MIN_SAMPLE ? WINDOW_RECENT_MONTHS : WINDOW_FULL_MONTHS;

  if (usable.length < MIN_SAMPLE) {
    return {
      sampleSize: usable.length,
      discountSampleSize: 0,
      windowMonths,
      medianParticipants: null,
      medianDiscount: null,
      discountP25: null,
      discountP75: null,
      singleBidderRate: null,
    };
  }

  const participants = usable.map((sample) => sample.participants).sort((a, b) => a - b);
  const discounts = usable
    .map((sample) => winnerDiscount(sample.expectedAmount, sample.winningAmount))
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);

  const singleBidderCount = participants.filter((value) => value <= 1).length;

  return {
    sampleSize: usable.length,
    discountSampleSize: discounts.length,
    windowMonths,
    medianParticipants: median(participants),
    medianDiscount: discounts.length > 0 ? median(discounts) : null,
    discountP25: discounts.length > 0 ? percentile(discounts, 0.25) : null,
    discountP75: discounts.length > 0 ? percentile(discounts, 0.75) : null,
    singleBidderRate: participants.length > 0 ? singleBidderCount / participants.length : null,
  };
}

/** Рахує топ-переможців (за ЄДРПОУ) серед вибірки. */
export function topCompetitors(samples: MarketSample[], limit = 5): Array<{ edrpou: string; wins: number }> {
  const counts = new Map<string, number>();
  for (const sample of samples) {
    if (!sample.winnerEdrpou) continue;
    counts.set(sample.winnerEdrpou, (counts.get(sample.winnerEdrpou) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([edrpou, wins]) => ({ edrpou, wins }))
    .sort((a, b) => b.wins - a.wins)
    .slice(0, limit);
}

/** Цільова ціна поточної закупівлі з медіанного дисконту. */
export function targetPrice(expectedAmount: number, medianDiscount: number | null): number | null {
  if (!expectedAmount || !Number.isFinite(expectedAmount)) return null;
  if (medianDiscount === null || !Number.isFinite(medianDiscount)) return null;
  return expectedAmount * (1 - medianDiscount);
}
