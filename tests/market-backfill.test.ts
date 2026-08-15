import { describe, expect, it, vi } from "vitest";
import { backfillBatch, type BackfillDependencies, type FeedItem } from "@/src/infrastructure/prozorro/market";
import type { MarketSample } from "@/src/domain/market/stats";

function rawTender(id: string, cpv: string, amount: number, method = "aboveThreshold"): { id: string } & Record<string, unknown> {
  return {
    id,
    status: "complete",
    procurementMethodType: method,
    dateModified: "2026-06-15T10:00:00+03:00",
    value: { amount, currency: "UAH", valueAddedTaxIncluded: false },
    items: [{ classification: { id: cpv } }],
    procuringEntity: { name: "Замовник", address: { region: "Львівська область" } },
    bids: [
      { value: { amount: amount * 0.95 }, tenderers: [{ identifier: { id: "11111111" } }] },
      { value: { amount: amount * 0.9 }, tenderers: [{ identifier: { id: "22222222" } }] },
    ],
    awards: [{ status: "active", value: { amount: amount * 0.9 }, suppliers: [{ identifier: { id: "22222222" } }] }],
  };
}

function feedItem(id: string, status: string, dateModified: string): FeedItem {
  return { id, status, dateModified };
}

function makeDeps(initialState: { cursor: string | null; finished: boolean } = { cursor: null, finished: false }, overrides: Partial<BackfillDependencies> = {}): BackfillDependencies & {
  upserted: MarketSample[][];
  state: { cursor: string | null; finished: boolean };
} {
  const state = { ...initialState };
  const upserted: MarketSample[][] = [];
  return {
    fetchFeedPage: vi.fn(async () => []),
    fetchRawById: vi.fn(async (id: string) => rawTender(id, "55510000-8", 100_000)),
    upsert: vi.fn(async (samples: MarketSample[]) => { upserted.push(samples); }),
    getState: vi.fn(async () => ({ ...state })),
    setState: vi.fn(async (cursor: string | null, finished: boolean) => { state.cursor = cursor; state.finished = finished; }),
    upserted,
    state,
    ...overrides,
  };
}

describe("market backfill", () => {
  it("indexes completed tenders, advances the cursor and is resumable", async () => {
    // Дві сторінки по 3 позиції: t6..t4 (новіші), t3..t1 (старіші).
    const pages: FeedItem[][] = [
      [feedItem("t6", "complete", "2026-08-15T10:00:00+03:00"), feedItem("t5", "active.tendering", "2026-08-15T09:00:00+03:00"), feedItem("t4", "complete", "2026-08-15T08:00:00+03:00")],
      [feedItem("t3", "complete", "2026-08-15T07:00:00+03:00"), feedItem("t2", "complete", "2026-08-15T06:00:00+03:00"), feedItem("t1", "complete", "2026-08-15T05:00:00+03:00")],
    ];
    const deps = makeDeps({ cursor: null, finished: false }, {
      fetchFeedPage: vi.fn(async (offset?: string) => (offset ? pages[1]! : pages[0]!)),
    });
    const stopBeforeMs = new Date("2020-01-01T00:00:00Z").getTime();

    const result = await backfillBatch(5, stopBeforeMs, deps);
    expect(result.processed).toBe(6);
    expect(result.completed).toBe(5);
    expect(result.indexed).toBe(5);
    expect(result.cursor).toBe("2026-08-15T05:00:00+03:00");
    expect(result.finished).toBe(false);
    expect(deps.upserted.flat()).toHaveLength(5);
  });

  it("skips the network entirely once finished", async () => {
    const deps = makeDeps({ cursor: null, finished: true });
    const result = await backfillBatch(10, 0, deps);
    expect(result.finished).toBe(true);
    expect(result.processed).toBe(0);
    expect(deps.fetchFeedPage).not.toHaveBeenCalled();
  });

  it("marks finished when the cursor reaches the window boundary", async () => {
    const page: FeedItem[] = [feedItem("t2", "complete", "2023-01-01T00:00:00+03:00")];
    const deps = makeDeps({ cursor: null, finished: false }, { fetchFeedPage: vi.fn(async () => page) });
    const stopBeforeMs = new Date("2024-01-01T00:00:00Z").getTime();
    const result = await backfillBatch(10, stopBeforeMs, deps);
    expect(result.finished).toBe(true);
    expect(result.cursor).toBe("2023-01-01T00:00:00+03:00");
  });

  it("guards against a non-advancing cursor", async () => {
    const page: FeedItem[] = [feedItem("t1", "complete", "2026-01-01T00:00:00+03:00")];
    const deps = makeDeps({ cursor: "2026-01-01T00:00:00+03:00", finished: false }, {
      fetchFeedPage: vi.fn(async () => page),
    });
    const result = await backfillBatch(10, 0, deps);
    expect(result.finished).toBe(true);
    expect(deps.fetchFeedPage).toHaveBeenCalledTimes(1);
  });
});
