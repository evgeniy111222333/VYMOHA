import { describe, expect, it } from "vitest";
import { analyzeTender } from "@/src/domain/tender/analyzer";
import { calculateWeightedMatrixScore, scoreTender } from "@/src/domain/tender/scoring";
import { tenderFixture } from "./fixtures";

const now = new Date("2026-08-01T12:00:00+03:00");

describe("tender scoring", () => {
  it("rewards active, well-documented tenders matching the company profile", () => {
    const result = scoreTender(tenderFixture(), {
      name: "Труба-Сервіс",
      edrpou: "12345678",
      cpvCodes: ["44160000-9"],
      certifications: ["ISO 9001", "ISO 14001"],
      capabilities: [],
    }, now);
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.verdict).toBe("go");
    expect(result.confidence).toBeGreaterThanOrEqual(90);
  });

  it("rejects a tender whose deadline has passed", () => {
    const result = scoreTender(tenderFixture({ deadline: "2026-07-30T12:00:00+03:00" }), undefined, now);
    expect(result.verdict).toBe("no-go");
    expect(result.score).toBe(23);
    expect(result.factors).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "deadline-closed", points: -45 }),
    ]));
  });

  it("rewards an open tender without structured bid security", () => {
    const result = scoreTender(tenderFixture(), undefined, now);
    expect(result.factors).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "no-guarantee", points: 10 }),
    ]));
  });

  it("penalizes a high buyer disqualification rate only while submission is open", () => {
    const buyerContext = {
      buyerEdrpou: "12345678", sampleSize: 12, decidedAwards: 20, disqualifiedAwards: 11,
      tendersWithDisqualifications: 8, disqualificationRate: 0.55, averageBids: 2.1,
      periodStart: "2025-08-01", periodEnd: "2026-08-01", sourceUrl: "https://prozorro.gov.ua/tender/search/?buyer=12345678",
    };
    const result = scoreTender(tenderFixture(), undefined, now, buyerContext);
    expect(result.factors).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "buyer-high-dq", points: -20 }),
    ]));
  });

  it("never recommends an anonymous structured check as ready to bid", () => {
    const result = scoreTender(tenderFixture(), undefined, now);
    expect(result.score).toBeLessThanOrEqual(69);
    expect(result.verdict).toBe("maybe");
    expect(result.confidence).toBeLessThanOrEqual(78);
  });

  it("builds traceable requirements and actionable risks", () => {
    const quick = analyzeTender(tenderFixture({
      deadline: "2026-08-03T00:00:00+03:00",
      guaranteeAmount: 25_000,
    }), undefined, now, undefined, "quick");
    expect(quick.requirements.some((item) => item.id === "guarantee")).toBe(true);
    expect(quick.risks.map((item) => item.id)).toEqual(expect.arrayContaining(["short-deadline", "guarantee-risk"]));
    expect(quick.risks.map((item) => item.id)).toEqual(expect.arrayContaining(["profile-unknown", "document-review"]));
    expect(quick.nextActions).toEqual([]);
    expect(quick.requirements.every((item) => item.evidence.source.startsWith("https://"))).toBe(true);

    const deep = analyzeTender(tenderFixture({
      deadline: "2026-08-03T00:00:00+03:00",
      guaranteeAmount: 25_000,
    }), undefined, now, undefined, "deep");
    expect(deep.nextActions.length).toBeGreaterThan(1);
  });

  it("calculates deterministic weighted matrix score with hard stop factor caps", () => {
    const { score, verdict } = calculateWeightedMatrixScore({
      requirements: [
        { category: "statutory", status: "met" },
        { category: "qualification", status: "met" },
        { category: "technical", status: "met" },
        { category: "financial", status: "met" },
      ],
      risks: [],
      hasCompanyProfile: true,
      submissionOpen: true,
    });
    expect(score).toBe(100);
    expect(verdict).toBe("go");

    const baseBreakdown = { score: 60, confidence: 50, verdict: "maybe" as const, factors: [] };
    const res = calculateWeightedMatrixScore({
      baseBreakdown,
      requirements: [{ category: "technical", status: "met" }],
      risks: [],
      hasCompanyProfile: true,
      submissionOpen: true,
    });
    expect(res.score).toBe(60);

    // Critical risk without a stop factor: heavy penalty, but the tender
    // stays reviewable instead of being force-blocked.
    const criticalNonStop = calculateWeightedMatrixScore({
      requirements: [{ category: "statutory", status: "met" }],
      risks: [{ level: "critical", title: "Штраф 20%" }],
      hasCompanyProfile: true,
      submissionOpen: true,
    });
    expect(criticalNonStop.score).toBe(80);
    expect(criticalNonStop.verdict).toBe("maybe");

    // Critical stop factor caps the score to 10 and forces no-go.
    const stopped = calculateWeightedMatrixScore({
      requirements: [{ category: "statutory", status: "met" }],
      risks: [{ level: "critical", title: "Дискваліфікація без альтернатив", isStopFactor: true }],
      hasCompanyProfile: true,
      submissionOpen: true,
    });
    expect(stopped.verdict).toBe("no-go");
    expect(stopped.score).toBeLessThanOrEqual(10);
    expect(stopped.factors).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "critical-cap" }),
    ]));
  });

  it("caps the total risk deduction at 40 so an open tender cannot hit zero from medium risks", () => {
    const risks = [
      { id: "r0", title: "Штраф", level: "high" as const },
      { id: "r1", title: "Пеня", level: "high" as const },
      { id: "r2", title: "Відстрочка", level: "high" as const },
      { id: "r3", title: "Розірвання", level: "high" as const },
    ];
    const result = calculateWeightedMatrixScore({
      baseBreakdown: { score: 90, confidence: 70, verdict: "maybe" as const, factors: [] },
      requirements: [],
      risks,
      hasCompanyProfile: true,
      submissionOpen: true,
    });
    // 4 × 10 = 40 raw risk points, capped at 30 with a -10 adjustment factor.
    expect(result.factors).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "risk-cap", points: -10 }),
    ]));
    expect(result.score).toBe(60);
    expect(result.verdict).toBe("maybe");
  });

  it("adds deterministic enquiry and award criteria requirements for normalized tenders", () => {
    const tender = tenderFixture({
      enquiryDeadline: "2026-07-30T00:00:00+03:00",
      awardCriteria: "lowestCost",
      clarifications: [{ title: "Про меню", question: "Яке меню?", answer: "Дивіться додаток", date: "2026-08-02" }],
    });
    const quick = analyzeTender(tender, undefined, now, undefined, "quick");
    expect(quick.requirements.some((item) => item.id === "enquiry-deadline" && item.status === "missing")).toBe(true);
    expect(quick.requirements.some((item) => item.id === "award-criteria" && item.status === "met")).toBe(true);
    expect(quick.requirements.some((item) => item.id === "clarifications")).toBe(true);
    expect(quick.risks.some((item) => item.id === "enquiry-closed")).toBe(true);
  });
});
