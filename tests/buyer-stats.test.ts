import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBuyerContext } from "@/src/infrastructure/prozorro/buyer-stats";

afterEach(() => vi.unstubAllGlobals());

describe("buyer context", () => {
  it("calculates a transparent sample from official Prozorro decisions", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("/api/search/tenders")) {
        return json({ data: [{ tenderID: "UA-2026-01-01-000001-a" }, { tenderID: "UA-2026-01-02-000002-a" }] });
      }
      if (url.includes("UA-2026-01-01-000001-a/summary")) return json({ id: "a".repeat(32) });
      if (url.includes("UA-2026-01-02-000002-a/summary")) return json({ id: "b".repeat(32) });
      if (url.endsWith("a".repeat(32))) {
        return json({ data: { awards: [{ status: "active" }, { status: "unsuccessful" }], bids: [{}, {}, {}] } });
      }
      return json({ data: { awards: [{ status: "active" }], bids: [{}, {}] } });
    }));

    const result = await fetchBuyerContext("40081221", new Date("2026-08-01T12:00:00Z"));
    expect(result).toMatchObject({
      sampleSize: 2,
      decidedAwards: 3,
      disqualifiedAwards: 1,
      tendersWithDisqualifications: 1,
      disqualificationRate: 1 / 3,
      averageBids: 2.5,
    });
  });

  it("does not query invalid identifiers", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchBuyerContext("bad-id")).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
}
