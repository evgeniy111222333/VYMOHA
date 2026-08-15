import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeTender } from "@/src/domain/tender/analyzer";
import { enhanceAnalysis } from "@/src/infrastructure/openai/enhancer";
import { tenderFixture } from "./fixtures";

afterEach(() => vi.unstubAllGlobals());

describe("OpenAI tender enhancer", () => {
  it("sends files through Responses with a strict schema and normalizes the result", async () => {
    let requestBody: Record<string, unknown> | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      const output = {
        summary: "Документи прочитані, але профіль постачальника ще не заданий.",
        score: 92,
        confidence: 88,
        verdict: "go",
        requirements: [{
          id: "experience", title: "Аналогічний договір", description: "Потрібен один договір.",
          category: "experience", status: "review",
          evidence: { label: "ТД, сторінка 6", source: "https://untrusted.example/evidence", excerpt: "не менше одного договору" },
        }],
        risks: [],
        nextActions: ["Додати профіль компанії"],
        questionsToBuyer: ["Чи приймається суміжний CPV?"],
        documentCoverage: [{ title: "Тендерна документація.pdf", status: "read", notes: "Прочитано повністю" }],
        requiredDocumentsChecklist: [{ id: "doc-1", category: "statutory", title: "Довідка МВС", description: "Відсутність судимості", note: "Орган: МВС", requiredType: "document", evidence: { label: "Додаток 1.docx", source: "https://prozorro.gov.ua", excerpt: "довідка про відсутність судимості" } }],
      };
      return new Response(JSON.stringify({
        output: [{ content: [{ type: "output_text", text: JSON.stringify(output) }] }],
        usage: { input_tokens: 1_000, output_tokens: 100, input_tokens_details: { cached_tokens: 100 } },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }));

    const base = analyzeTender(tenderFixture(), undefined, new Date("2026-08-01T12:00:00+03:00"));
    const result = await enhanceAnalysis({
      analysis: base, apiKey: "test-key", safetyIdentifier: "safe-user", tier: "deep", model: "gpt-5.6-terra",
    });

    expect(requestBody?.model).toBe("gpt-5.6-terra");
    expect(requestBody?.store).toBe(false);
    expect(requestBody?.text).toMatchObject({ format: { type: "json_schema", strict: true } });
    expect(JSON.stringify(requestBody?.input)).toContain("input_file");
    expect(result.analysis.mode).toBe("ai-enhanced");
    // Anonymous run: the quick-pass profile cap is restored before the
    // matrix re-applies it once (69), and half-weight vectors for the
    // review-only experience requirement cost 4 points — but the cap
    // dominates, so the score stays at the anonymous maximum.
    expect(result.analysis.score).toBe(69);
    expect(result.analysis.verdict).toBe("maybe");
    expect(result.analysis.summary).toMatch(/^Вердикт: потрібна ручна перевірка \(бал 69\/100\)\./);
    expect(result.analysis.risks.some((risk) => risk.id === "profile-unknown" && risk.level === "medium")).toBe(true);
    expect(result.analysis.requirements[0]?.evidence.source).toBe(base.tender.sourceUrl);
    expect(result.usage).toMatchObject({ inputTokens: 1_000, cachedInputTokens: 100, outputTokens: 100, costMicrousd: 3_775 });
  });

  it("strips LLM verdict words from summary and drops profile-absence critical risks", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      JSON.parse(String(init?.body));
      const output = {
        summary: "Тендер виглядає привабливо. Фінальний вердикт — 'maybe'. Штрафи сягають 20%.",
        score: 60,
        confidence: 90,
        verdict: "maybe",
        requirements: [],
        risks: [
          { id: "profile", title: "Відсутність даних про профіль постачальника", description: "Немає даних", level: "critical", isStopFactor: true, mitigation: "Додати профіль", evidence: { label: "x", source: "https://prozorro.gov.ua", excerpt: "y" } },
          { id: "contract-fine", title: "Штраф 20% за якість", description: "Жорстка санкція", level: "high", isStopFactor: false, mitigation: "Перевірити", evidence: { label: "x", source: "https://prozorro.gov.ua", excerpt: "y" } },
        ],
        nextActions: [],
        questionsToBuyer: [],
        documentCoverage: [{ title: "Тендерна документація.pdf", status: "unavailable", notes: "Формат не підтримано" }],
        requiredDocumentsChecklist: [],
      };
      return new Response(JSON.stringify({
        output: [{ content: [{ type: "output_text", text: JSON.stringify(output) }] }],
        usage: { input_tokens: 100, output_tokens: 10 },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }));

    const base = analyzeTender(tenderFixture(), undefined, new Date("2026-08-01T12:00:00+03:00"));
    const result = await enhanceAnalysis({
      analysis: base, apiKey: "test-key", safetyIdentifier: "safe-user", tier: "deep", model: "gpt-5.6-terra",
    });

    const riskIds = result.analysis.risks.map((risk) => risk.id);
    expect(riskIds).not.toContain("profile");
    expect(result.analysis.risks.some((risk) => risk.id === "profile-unknown" && risk.level === "medium")).toBe(true);
    expect(result.analysis.risks.some((risk) => risk.id === "contract-fine")).toBe(true);
    expect(result.analysis.summary).not.toMatch(/вердикт\s*—|maybe/i);
    expect(result.analysis.summary).toMatch(/^Вердикт: /);
    expect(result.analysis.summary).toContain("Штрафи сягають 20%");
    // Unread key document reduces the honesty claim by 15 points.
    expect(result.analysis.confidence).toBe(75);
    expect(result.analysis.verdict).not.toBe("no-go");
    expect(result.analysis.score).toBeGreaterThan(0);
  });

  it("forces 'unavailable' on documents the model never received, even if it claims 'read'", async () => {
    const docs = Array.from({ length: 6 }, (_, i) => ({
      id: `d${i}`,
      title: `Документ ${i + 1}.docx`,
      url: `https://prozorro.gov.ua/doc-${i + 1}`,
      format: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }));
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      JSON.parse(String(init?.body));
      // Модель нахабно каже "read" на ВСІ шість, хоча deep надсилає лише 5.
      const output = {
        summary: "Аналіз документів.",
        score: 60, confidence: 80, verdict: "maybe",
        requirements: [], risks: [],
        nextActions: [], questionsToBuyer: [],
        documentCoverage: docs.map((doc) => ({ title: doc.title, status: "read", notes: "ok" })),
        requiredDocumentsChecklist: [],
      };
      return new Response(JSON.stringify({
        output: [{ content: [{ type: "output_text", text: JSON.stringify(output) }] }],
        usage: { input_tokens: 100, output_tokens: 10 },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }));

    const base = analyzeTender(tenderFixture({ documents: docs }), undefined, new Date("2026-08-01T12:00:00+03:00"));
    const result = await enhanceAnalysis({
      analysis: base, apiKey: "test-key", safetyIdentifier: "safe-user", tier: "deep", model: "gpt-5.6-terra",
    });

    const coverage = result.analysis.documentCoverage!;
    expect(coverage).toHaveLength(6);
    // Перші п'ять справді надіслано — статус моделі зберігається.
    expect(coverage[0]?.status).toBe("read");
    expect(coverage[4]?.status).toBe("read");
    // Шостий файл модель не отримувала — статус примусово "unavailable".
    expect(coverage[5]).toMatchObject({ title: "Документ 6.docx", status: "unavailable" });
    expect(coverage[5]?.notes).toMatch(/ліміту документів/);
  });
});
