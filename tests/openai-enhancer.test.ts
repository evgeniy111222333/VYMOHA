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
        requiredDocumentsChecklist: [{ id: "doc-1", category: "statutory", title: "Довідка МВС", description: "Відсутність судимості", note: "Орган: МВС", requiredType: "document" }],
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
    expect(result.analysis.score).toBe(69);
    expect(result.analysis.verdict).toBe("maybe");
    expect(result.analysis.requirements[0]?.evidence.source).toBe(base.tender.sourceUrl);
    expect(result.usage).toMatchObject({ inputTokens: 1_000, cachedInputTokens: 100, outputTokens: 100, costMicrousd: 3_775 });
  });
});
