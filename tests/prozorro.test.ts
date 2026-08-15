import { afterEach, describe, expect, it, vi } from "vitest";
import { extractTenderReference, fetchTender, normalizeTenderForTest } from "@/src/infrastructure/prozorro/client";

afterEach(() => vi.unstubAllGlobals());

describe("Prozorro reference parsing", () => {
  it("extracts a procurement id from a full URL", () => {
    expect(extractTenderReference("https://prozorro.gov.ua/uk/tender/UA-2026-08-01-000463-a"))
      .toBe("UA-2026-08-01-000463-A");
  });

  it("accepts normalized internal ids", () => {
    expect(extractTenderReference("ABCDEF0123456789ABCDEF0123456789"))
      .toBe("abcdef0123456789abcdef0123456789");
  });

  it("rejects arbitrary URLs and text", () => {
    expect(() => extractTenderReference("https://evil.example/tender/123")).toThrow(/UA-2026/);
  });

  it("resolves a public tender id through the official portal summary", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(Response.json({ id: "2f738339fc9b4f97895110e43ff032f2" }))
      .mockResolvedValueOnce(Response.json({ data: {
        id: "2f738339fc9b4f97895110e43ff032f2",
        tenderID: "UA-2026-07-15-007537-a",
        title: "Послуги з ремонту автомобілів",
        status: "active.qualification",
        value: { amount: 470000, currency: "UAH", valueAddedTaxIncluded: false },
        tenderPeriod: { endDate: "2026-07-28T00:00:00+03:00" },
      } }));
    vi.stubGlobal("fetch", request);

    const tender = await fetchTender("UA-2026-07-15-007537-a");

    expect(request).toHaveBeenNthCalledWith(1,
      "https://prozorro.gov.ua/api/tenders/UA-2026-07-15-007537-A/summary",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(String(request.mock.calls[1]?.[0])).toBe(
      "https://public-api.prozorro.gov.ua/api/2.5/tenders/2f738339fc9b4f97895110e43ff032f2",
    );
    expect(request.mock.calls[1]?.[1]).toEqual(expect.objectContaining({ cache: "no-store" }));
    expect(tender.externalId).toBe("UA-2026-07-15-007537-a");
    expect(tender.amount).toBe(470000);
  });
});

describe("Prozorro tender normalization", () => {
  const rawTender = {
    id: "2f738339fc9b4f97895110e43ff032f2",
    tenderID: "UA-2026-08-13-012445-a",
    title: "Послуги харчування",
    status: "active.tendering",
    procurementMethodType: "aboveThreshold",
    awardCriteria: "lowestCost",
    procuringEntity: { name: "Ліцей", identifier: { id: "12345678" } },
    value: { amount: 5534130, currency: "UAH", valueAddedTaxIncluded: false },
    guarantee: { amount: 0, currency: "UAH" },
    tenderPeriod: { startDate: "2026-08-13T17:51:20+03:00", endDate: "2026-08-21T10:00:00+03:00" },
    enquiryPeriod: { endDate: "2026-08-18T00:00:00+03:00" },
    complaintPeriod: { endDate: "2026-08-19T00:00:00+03:00" },
    questions: [{ title: "Про меню", description: "Чи є вегетаріанське меню?", answer: "Так, у додатку 2", date: "2026-08-14T10:00:00+03:00" }],
    milestones: [{ type: "approval", title: "Укладення договору", dueDate: "2026-08-28T00:00:00+03:00" }],
    items: [{ classification: { id: "55510000-8", description: "Послуги їдалень" } }],
    criteria: [
      { title: "Досвід виконання аналогічного договору", requirementGroups: [{ requirements: [{ title: "Досвід", expectedValue: true, minValue: 90 }] }] },
      { title: "Загальна вимога" },
    ],
    documents: [
      { id: "doc-1", title: "Тендерна документація.doc", format: "application/msword", dateModified: "2026-08-13T18:00:00+03:00", url: "https://prozorro.gov.ua/doc-1" },
      { id: "doc-1", title: "Тендерна документація.doc (стара версія)", format: "application/msword", dateModified: "2026-08-13T17:00:00+03:00", url: "https://prozorro.gov.ua/doc-1-old" },
      { id: "doc-2", title: "Проєкт договору.docx", format: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", dateModified: "2026-08-13T18:00:00+03:00", url: "https://prozorro.gov.ua/doc-2" },
      { id: "doc-3", title: "sign.p7s", format: "application/pkcs7-signature", url: "https://prozorro.gov.ua/doc-3" },
      { id: "doc-4", title: "Додаток 2.docx", format: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", dateModified: "2026-08-14T09:00:00+03:00", url: "https://prozorro.gov.ua/doc-4" },
    ],
  };

  it("deduplicates document revisions, keeps the newest version and drops signatures", () => {
    const tender = normalizeTenderForTest(rawTender);
    expect(tender.documents).toHaveLength(3);
    const biddingDoc = tender.documents.find((doc) => doc.id === "doc-1");
    expect(biddingDoc?.title).toBe("Тендерна документація.doc");
    expect(tender.documents.some((doc) => doc.title === "sign.p7s")).toBe(false);
    expect(tender.documents.some((doc) => doc.title.includes("стара версія"))).toBe(false);
  });

  it("extracts procedure metadata previously discarded by the normalizer", () => {
    const tender = normalizeTenderForTest(rawTender);
    expect(tender.awardCriteria).toBe("lowestCost");
    expect(tender.enquiryDeadline).toBe("2026-08-18T00:00:00+03:00");
    expect(tender.complaintDeadline).toBe("2026-08-19T00:00:00+03:00");
    expect(tender.clarifications).toEqual([
      expect.objectContaining({ title: "Про меню", answer: "Так, у додатку 2" }),
    ]);
    expect(tender.milestones).toEqual([
      expect.objectContaining({ type: "approval", dueDate: "2026-08-28T00:00:00+03:00" }),
    ]);
  });

  it("flattens numeric qualification thresholds from structured criteria", () => {
    const tender = normalizeTenderForTest(rawTender);
    expect(tender.structuredCriteria[0]?.numericRequirements).toEqual([
      expect.objectContaining({ title: "Досвід", expectedValue: "true", minValue: "90" }),
    ]);
    expect(tender.structuredCriteria[1]?.numericRequirements).toBeUndefined();
  });

  it("leaves optional collections undefined when the API omits them", () => {
    const tender = normalizeTenderForTest({ ...rawTender, questions: [], milestones: [], criteria: [] });
    expect(tender.clarifications).toBeUndefined();
    expect(tender.milestones).toBeUndefined();
  });
});
