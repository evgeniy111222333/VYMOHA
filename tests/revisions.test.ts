import { describe, expect, it } from "vitest";
import { parseTenderRevisions } from "@/src/infrastructure/prozorro/client";
import { buildRevisionsSummary } from "@/src/infrastructure/openai/revisions-analyzer";

describe("Prozorro Revisions & Diff Engine", () => {
  it("correctly parses RFC 6902 JSON patch revisions from Prozorro raw API payload", () => {
    const rawTender = {
      id: "fake-id",
      revisions: [
        {
          id: "rev-1",
          date: "2026-07-24T11:20:00+03:00",
          author: "procuringEntity",
          changes: [
            { op: "replace", path: "/tenderPeriod/endDate", oldValue: "2026-07-28T12:00:00", value: "2026-07-31T12:59:00" },
            { op: "replace", path: "/value/amount", oldValue: 600000, value: 650000 },
          ],
        },
        {
          id: "rev-2",
          date: "2026-07-26T14:15:00+03:00",
          author: "procuringEntity",
          changes: [
            { op: "add", path: "/documents/3", value: "Додаток 5 Змінений.docx" },
          ],
        },
      ],
    };

    const revisions = parseTenderRevisions(rawTender);
    expect(revisions).toHaveLength(2);
    expect(revisions[0]!.changes[0]!.fieldLabel).toBe("Дедлайн подання пропозицій");
    expect(revisions[0]!.changes[1]!.fieldLabel).toBe("Очікувана вартість закупівлі");
    expect(revisions[1]!.changes[0]!.fieldLabel).toBe("Тендерний документ / Додаток ТД");
  });

  it("builds critical impact level and actionable advice when deadline is changed", () => {
    const rawTender = {
      id: "fake-id",
      revisions: [
        {
          id: "rev-1",
          date: "2026-07-24T11:20:00+03:00",
          author: "procuringEntity",
          changes: [
            { op: "replace", path: "/tenderPeriod/endDate", oldValue: "2026-07-28T12:00:00", value: "2026-07-31T12:59:00" },
          ],
        },
      ],
    };

    const revisions = parseTenderRevisions(rawTender);
    const summary = buildRevisionsSummary(revisions);

    expect(summary.hasRevisions).toBe(true);
    expect(summary.impactLevel).toBe("critical");
    expect(summary.actionRequired).toContain("Звірте графік підготовки та термін дії банківської гарантії");
  });
});
