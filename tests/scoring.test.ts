import { describe, expect, it } from "vitest";
import { analyzeTender } from "@/src/domain/tender/analyzer";
import { scoreTender } from "@/src/domain/tender/scoring";
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
    expect(result.score).toBeLessThan(45);
  });

  it("builds traceable requirements and actionable risks", () => {
    const result = analyzeTender(tenderFixture({
      deadline: "2026-08-03T00:00:00+03:00",
      guaranteeAmount: 25_000,
    }), undefined, now);
    expect(result.requirements.some((item) => item.id === "guarantee")).toBe(true);
    expect(result.risks.map((item) => item.id)).toEqual(expect.arrayContaining(["short-deadline", "guarantee-risk"]));
    expect(result.nextActions.length).toBeGreaterThan(1);
    expect(result.requirements.every((item) => item.evidence.source.startsWith("https://"))).toBe(true);
  });
});
