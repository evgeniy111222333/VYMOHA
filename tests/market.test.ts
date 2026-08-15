import { describe, expect, it } from "vitest";
import {
  countParticipants, extractMarketSample, readCpv, readWinnerEdrpou, readWinningAmount,
} from "@/src/infrastructure/storage/market";

const rawTender: Record<string, unknown> = {
  id: "2f738339fc9b4f97895110e43ff032f2",
  tenderID: "UA-2026-06-01-000001-a",
  status: "complete",
  procurementMethodType: "aboveThreshold",
  dateModified: "2026-06-15T10:00:00+03:00",
  value: { amount: 200_000, currency: "UAH", valueAddedTaxIncluded: false },
  items: [{ classification: { id: "55510000-8", description: "Послуги їдалень" } }],
  procuringEntity: { name: "Ліцей", address: { region: "Львівська область" } },
  bids: [
    { value: { amount: 190_000 }, tenderers: [{ identifier: { id: "11111111" } }] },
    { value: { amount: 180_000 }, tenderers: [{ identifier: { id: "22222222" } }] },
    { value: { amount: 175_000 }, tenderers: [{ identifier: { id: "11111111" } }] },
  ],
  awards: [
    { status: "active", value: { amount: 180_000 }, suppliers: [{ identifier: { id: "22222222" } }] },
    { status: "unsuccessful", value: { amount: 0 }, suppliers: [{ identifier: { id: "11111111" } }] },
  ],
};

describe("market sample extraction", () => {
  it("reads CPV hierarchy from items classification", () => {
    expect(readCpv(rawTender)).toEqual({ cpv8: "55510000", cpv5: "55510", cpv3: "555" });
    expect(readCpv({})).toBeNull();
    expect(readCpv({ items: [{ classification: { id: "555" } }] })).toBeNull();
  });

  it("counts unique participants by EDRPOU", () => {
    expect(countParticipants(rawTender.bids)).toBe(2);
    expect(countParticipants(undefined)).toBe(0);
    expect(countParticipants([])).toBe(0);
  });

  it("sums only active awards for the winning amount", () => {
    expect(readWinningAmount(rawTender.awards)).toBe(180_000);
    expect(readWinningAmount([{ status: "unsuccessful", value: { amount: 10 } }])).toBeNull();
    expect(readWinningAmount(undefined)).toBeNull();
  });

  it("reads the winning supplier EDRPOU", () => {
    expect(readWinnerEdrpou(rawTender.awards)).toBe("22222222");
  });

  it("builds a full market sample from a raw tender", () => {
    const sample = extractMarketSample(rawTender);
    expect(sample).toMatchObject({
      cpv8: "55510000", cpv5: "55510", cpv3: "555",
      region: "Львівська область", method: "aboveThreshold",
      expectedAmount: 200_000, currency: "UAH", participants: 2,
      winningAmount: 180_000, winnerEdrpou: "22222222",
      completedAt: "2026-06-15T10:00:00+03:00",
    });
  });

  it("returns null when CPV or expected amount is missing", () => {
    expect(extractMarketSample({ ...rawTender, items: [] })).toBeNull();
    expect(extractMarketSample({ ...rawTender, value: { amount: 0 } })).toBeNull();
  });
});
