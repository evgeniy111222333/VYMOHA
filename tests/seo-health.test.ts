import { describe, expect, it } from "vitest";
import { evaluateHealth, type BackfillRunRecord, type HealthState } from "@/src/services/seo/health";

const now = new Date("2026-08-16T12:00:00Z");

function run(minutesAgo: number, overrides: Partial<BackfillRunRecord> = {}): BackfillRunRecord {
  return {
    job: "history",
    processed: 100,
    upserted: 10,
    skipped: 80,
    failed: 10,
    createdAt: new Date(now.getTime() - minutesAgo * 60_000).toISOString(),
    ...overrides,
  };
}

describe("SEO health evaluation", () => {
  it("reports no issues for a healthy backfill", () => {
    const state: HealthState = {
      now,
      runs: [run(10, { processed: 100, upserted: 12, failed: 2 })],
      cursorUpdatedAt: run(10).createdAt,
      backfillFinished: false,
    };
    expect(evaluateHealth(state)).toEqual([]);
  });

  it("flags cron-down when there were no recent runs", () => {
    const state: HealthState = {
      now,
      runs: [run(4 * 60)],
      cursorUpdatedAt: run(4 * 60).createdAt,
      backfillFinished: false,
    };
    expect(evaluateHealth(state).some((i) => i.check === "cron-down")).toBe(true);
  });

  it("flags backfill-stall when the cursor is stale while unfinished", () => {
    const state: HealthState = {
      now,
      runs: [run(10)],
      cursorUpdatedAt: run(8 * 60).createdAt,
      backfillFinished: false,
    };
    expect(evaluateHealth(state).some((i) => i.check === "backfill-stall")).toBe(true);
  });

  it("does not flag stall once the backfill is finished", () => {
    const state: HealthState = {
      now,
      runs: [run(10)],
      cursorUpdatedAt: run(8 * 60).createdAt,
      backfillFinished: true,
    };
    expect(evaluateHealth(state)).toEqual([]);
  });

  it("flags high-failure-rate when most requests fail", () => {
    const runs = Array.from({ length: 8 }, () => run(10, { processed: 100, upserted: 0, failed: 80 }));
    const state: HealthState = { now, runs, cursorUpdatedAt: run(10).createdAt, backfillFinished: false };
    expect(evaluateHealth(state).some((i) => i.check === "high-failure-rate")).toBe(true);
  });

  it("flags zero-throughput when processing but adding nothing", () => {
    const runs = Array.from({ length: 8 }, () => run(10, { processed: 100, upserted: 0, failed: 0 }));
    const state: HealthState = { now, runs, cursorUpdatedAt: run(10).createdAt, backfillFinished: false };
    expect(evaluateHealth(state).some((i) => i.check === "zero-throughput")).toBe(true);
  });

  it("does not flag zero-throughput when nothing was processed at all", () => {
    const runs = Array.from({ length: 8 }, () => run(10, { processed: 0, upserted: 0, failed: 0 }));
    const state: HealthState = { now, runs, cursorUpdatedAt: run(10).createdAt, backfillFinished: false };
    expect(evaluateHealth(state).some((i) => i.check === "zero-throughput")).toBe(false);
  });
});
