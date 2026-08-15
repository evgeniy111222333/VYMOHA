import { describe, expect, it } from "vitest";
import {
  computeMarketStats, median, percentile, targetPrice, topCompetitors, winnerDiscount,
  type MarketSample,
} from "@/src/domain/market/stats";

const now = new Date("2026-08-15T12:00:00Z");

function sample(overrides: Partial<MarketSample> = {}): MarketSample {
  return {
    cpv8: "55510000-8", cpv5: "55510", cpv3: "555",
    region: "Львівська область", method: "aboveThreshold",
    expectedAmount: 100_000, currency: "UAH", participants: 3,
    winningAmount: 90_000, winnerEdrpou: "12345678",
    completedAt: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

describe("market stats pure functions", () => {
  it("computes nearest-rank percentiles", () => {
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.25)).toBe(3);
    expect(percentile([], 0.5)).toBeNaN();
  });

  it("computes median", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([5, 1, 9, 7])).toBe(5);
  });

  it("derives winner discount as a ratio, rejecting invalid data", () => {
    expect(winnerDiscount(100, 80)).toBeCloseTo(0.2);
    expect(winnerDiscount(100, 0)).toBeCloseTo(1);
    expect(winnerDiscount(100, null)).toBeNull();
    expect(winnerDiscount(0, 50)).toBeNull();
    expect(winnerDiscount(100, 120)).toBeNull();
    expect(winnerDiscount(100, -5)).toBeNull();
  });

  it("refuses to report stats below the minimum sample", () => {
    const stats = computeMarketStats([sample(), sample(), sample(), sample()], now);
    expect(stats.sampleSize).toBe(4);
    expect(stats.medianDiscount).toBeNull();
    expect(stats.medianParticipants).toBeNull();
  });

  it("excludes non-competitive methods, non-UAH and invalid expected amounts", () => {
    const valid = sample();
    const reporting = sample({ method: "reporting" });
    const negotiation = sample({ method: "negotiation.quick" });
    const nonUah = sample({ currency: "USD" });
    const zeroAmount = sample({ expectedAmount: 0 });
    const stats = computeMarketStats([valid, reporting, negotiation, nonUah, zeroAmount, valid, valid, valid, valid], now);
    expect(stats.sampleSize).toBe(5);
  });

  it("aggregates participants, discount and single-bidder rate", () => {
    const samples = [
      sample({ participants: 1, winningAmount: 100_000 }),
      sample({ participants: 2, winningAmount: 95_000 }),
      sample({ participants: 3, winningAmount: 90_000 }),
      sample({ participants: 3, winningAmount: 88_000 }),
      sample({ participants: 4, winningAmount: 85_000 }),
      sample({ participants: 5, winningAmount: 80_000 }),
    ];
    const stats = computeMarketStats(samples, now);
    expect(stats.medianParticipants).toBe(3);
    // Дисконти: [0, .05, .10, .12, .15, .20]; nearest-rank медіана = нижнє середнє.
    expect(stats.medianDiscount).toBeCloseTo(0.10);
    expect(stats.discountP25).toBeCloseTo(0.05);
    expect(stats.discountP75).toBeCloseTo(0.15);
    expect(stats.singleBidderRate).toBeCloseTo(1 / 6);
  });

  it("prefers the recent 6-month window when it has enough samples", () => {
    const recent = Array.from({ length: 6 }, () => sample({ completedAt: "2026-07-01T00:00:00Z", participants: 5 }));
    const old = sample({ completedAt: "2025-01-01T00:00:00Z", participants: 1 });
    const stats = computeMarketStats([...recent, old], now);
    expect(stats.windowMonths).toBe(6);
    expect(stats.sampleSize).toBe(6);
    expect(stats.medianParticipants).toBe(5);
  });

  it("falls back to the 24-month window when recent data is thin", () => {
    const old = Array.from({ length: 6 }, () => sample({ completedAt: "2025-06-01T00:00:00Z", participants: 2 }));
    const stats = computeMarketStats(old, now);
    expect(stats.windowMonths).toBe(24);
    expect(stats.medianParticipants).toBe(2);
  });

  it("sorts top competitors by wins", () => {
    const samples = [
      sample({ winnerEdrpou: "A" }), sample({ winnerEdrpou: "A" }), sample({ winnerEdrpou: "A" }),
      sample({ winnerEdrpou: "B" }), sample({ winnerEdrpou: "C" }),
    ];
    const top = topCompetitors(samples, 3);
    expect(top[0]).toEqual({ edrpou: "A", wins: 3 });
    expect(top).toHaveLength(3);
  });

  it("computes target price from expected amount and median discount", () => {
    expect(targetPrice(100_000, 0.12)).toBe(88_000);
    expect(targetPrice(100_000, null)).toBeNull();
    expect(targetPrice(0, 0.1)).toBeNull();
  });
});
