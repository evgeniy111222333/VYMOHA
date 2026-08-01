import type { NormalizedTender } from "@/src/domain/tender/types";

export function tenderFixture(overrides: Partial<NormalizedTender> = {}): NormalizedTender {
  return {
    internalId: "a".repeat(32),
    externalId: "UA-2026-08-01-000463-A",
    sourceUrl: "https://prozorro.gov.ua/tender/UA-2026-08-01-000463-a",
    title: "Тестова закупівля",
    buyer: "Тестовий замовник",
    status: "active.tendering",
    amount: 1_000_000,
    currency: "UAH",
    deadline: "2026-08-12T12:00:00+03:00",
    cpvCode: "44160000-9",
    cpvLabel: "Магістралі, трубопроводи, труби",
    documents: [{ id: "doc-1", title: "Тендерна документація.pdf", url: "https://public-docs.prozorro.gov.ua/doc.pdf" }],
    structuredCriteria: [{ title: "Наявність аналогічного договору" }],
    itemCount: 1,
    ...overrides,
  };
}
