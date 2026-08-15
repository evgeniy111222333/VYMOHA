import { describe, expect, it } from "vitest";
import { competitionRiskLevel, computeCompetitionRisk } from "@/src/domain/market/competition";
import type { MarketSample } from "@/src/domain/market/stats";
import { tenderFixture } from "./fixtures";

function sample(overrides: Partial<MarketSample> = {}): MarketSample {
  return {
    cpv8: "55510000", cpv5: "55510", cpv3: "555",
    region: "Львівська область", method: "aboveThreshold",
    expectedAmount: 100_000, currency: "UAH", participants: 3,
    winningAmount: 90_000, winnerEdrpou: "11111111",
    completedAt: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

describe("competition risk detector", () => {
  it("keeps history signals silent below the minimum sample", () => {
    const risk = computeCompetitionRisk([sample(), sample(), sample(), sample()], tenderFixture({ method: "aboveThreshold" }));
    expect(risk.flags.some((f) => f.id === "single-bidder-history")).toBe(false);
    expect(risk.sampleSize).toBe(4);
    expect(risk.level).toBe("low");
  });

  it("flags single-bidder history at >= 50%", () => {
    const samples = [
      sample({ participants: 1 }), sample({ participants: 1 }), sample({ participants: 1 }),
      sample({ participants: 2 }), sample({ participants: 3 }),
    ];
    const risk = computeCompetitionRisk(samples, tenderFixture({ method: "aboveThreshold" }));
    expect(risk.flags.some((f) => f.id === "single-bidder-history")).toBe(true);
  });

  it("flags repeat winner at >= 60% concentration", () => {
    const samples = [
      sample({ winnerEdrpou: "A" }), sample({ winnerEdrpou: "A" }), sample({ winnerEdrpou: "A" }),
      sample({ winnerEdrpou: "A" }), sample({ winnerEdrpou: "B" }),
    ];
    const risk = computeCompetitionRisk(samples, tenderFixture({ method: "aboveThreshold" }));
    const flag = risk.flags.find((f) => f.id === "repeat-winner");
    expect(flag).toBeTruthy();
    expect(flag!.description).toContain("80%");
  });

  it("flags zero-discount history at >= 50%", () => {
    const samples = [
      sample({ winningAmount: 100_000 }), sample({ winningAmount: 100_000 }), sample({ winningAmount: 100_000 }),
      sample({ winningAmount: 95_000 }), sample({ winningAmount: 90_000 }),
    ];
    const risk = computeCompetitionRisk(samples, tenderFixture({ method: "aboveThreshold" }));
    expect(risk.flags.some((f) => f.id === "zero-discount-history")).toBe(true);
  });

  it("flags a short bid window (< 7 days between publish and deadline)", () => {
    const risk = computeCompetitionRisk([], tenderFixture({
      method: "aboveThreshold",
      datePublished: "2026-08-10T00:00:00+03:00",
      deadline: "2026-08-12T00:00:00+03:00",
    }));
    expect(risk.flags.some((f) => f.id === "short-bid-window")).toBe(true);
  });

  it("does not flag a comfortable bid window", () => {
    const risk = computeCompetitionRisk([], tenderFixture({
      method: "aboveThreshold",
      datePublished: "2026-07-27T00:00:00+03:00",
      deadline: "2026-08-04T00:00:00+03:00",
    }));
    expect(risk.flags.some((f) => f.id === "short-bid-window")).toBe(false);
  });

  it("flags no-auction for below-threshold and negotiation, not for auction methods", () => {
    expect(computeCompetitionRisk([], tenderFixture({ method: "belowThreshold" })).flags.some((f) => f.id === "no-auction")).toBe(true);
    expect(computeCompetitionRisk([], tenderFixture({ method: "negotiation" })).flags.some((f) => f.id === "no-auction")).toBe(true);
    expect(computeCompetitionRisk([], tenderFixture({ method: "reporting" })).flags.some((f) => f.id === "no-auction")).toBe(true);
    expect(computeCompetitionRisk([], tenderFixture({ method: "aboveThreshold" })).flags.some((f) => f.id === "no-auction")).toBe(false);
  });

  it("aggregates level: 2+ warnings -> high, 1 warning -> medium, 0 -> low", () => {
    expect(competitionRiskLevel([])).toBe("low");
    expect(competitionRiskLevel([
      { id: "a", title: "A", severity: "warning", description: "", evidence: { label: "x", source: "s" } },
    ])).toBe("medium");
    expect(competitionRiskLevel([
      { id: "a", title: "A", severity: "warning", description: "", evidence: { label: "x", source: "s" } },
      { id: "b", title: "B", severity: "warning", description: "", evidence: { label: "x", source: "s" } },
    ])).toBe("high");
  });

  it("flags a change-list document by title pattern", () => {
    const tender = tenderFixture({
      method: "aboveThreshold",
      datePublished: "2026-08-14T19:14:00+03:00",
      documents: [
        { id: "d1", title: "Перелік змін.pdf", dateModified: "2026-08-15T21:15:00+03:00" },
      ],
    });
    const risk = computeCompetitionRisk([], tender);
    const flag = risk.flags.find((f) => f.id === "document-changes");
    expect(flag).toBeTruthy();
    expect(flag!.severity).toBe("warning");
    expect(flag!.evidence.excerpt).toBe("Перелік змін.pdf");
  });

  it("flags documents re-uploaded after publication, beyond the tolerance", () => {
    const tender = tenderFixture({
      method: "aboveThreshold",
      datePublished: "2026-08-14T19:14:00+03:00",
      documents: [
        { id: "d1", title: "Додаток 1.docx", dateModified: "2026-08-14T19:14:30+03:00" },
        { id: "d2", title: "Додаток 4.docx", dateModified: "2026-08-15T21:15:00+03:00" },
      ],
    });
    const risk = computeCompetitionRisk([], tender);
    const flag = risk.flags.find((f) => f.id === "document-changes");
    expect(flag).toBeTruthy();
    // Лише один документ перевищив допуск (30с — ні, ~26 год — так).
    expect(flag!.description).toContain("1 файл");
  });

  it("does not flag documents uploaded in the same publish batch", () => {
    const tender = tenderFixture({
      method: "aboveThreshold",
      datePublished: "2026-08-14T19:14:00+03:00",
      documents: [
        { id: "d1", title: "Тендерна документація.doc", dateModified: "2026-08-14T19:14:30+03:00" },
        { id: "d2", title: "Проєкт договору.docx", dateModified: "2026-08-14T19:15:00+03:00" },
      ],
    });
    const risk = computeCompetitionRisk([], tender);
    expect(risk.flags.some((f) => f.id === "document-changes")).toBe(false);
  });

  it("flags a change-list title even without datePublished", () => {
    const tender = tenderFixture({
      method: "aboveThreshold",
      documents: [{ id: "d1", title: "Зміни до тендерної документації.docx" }],
    });
    const risk = computeCompetitionRisk([], tender);
    expect(risk.flags.some((f) => f.id === "document-changes")).toBe(true);
  });

  it("a change-list document alone raises the level to medium", () => {
    const tender = tenderFixture({
      method: "aboveThreshold",
      datePublished: "2026-08-14T19:14:00+03:00",
      documents: [{ id: "d1", title: "Перелік змін.pdf", dateModified: "2026-08-15T21:15:00+03:00" }],
    });
    const risk = computeCompetitionRisk([], tender);
    expect(risk.level).toBe("medium");
  });
});
