import { describe, expect, it } from "vitest";
import { analyzeTender } from "@/src/domain/tender/analyzer";
import { enhanceAnalysis, normalizePriceValue } from "@/src/infrastructure/openai/enhancer";
import { tenderFixture } from "./fixtures";

function geminiResponse(payload: unknown, promptTokens = 500, outputTokens = 150) {
  return new Response(
    JSON.stringify({
      candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(payload) }] } }],
      usageMetadata: { promptTokenCount: promptTokens, candidatesTokenCount: outputTokens },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

const MAIN_OUTPUT = {
  summary: "Основний аналіз документів.",
  score: 70,
  confidence: 85,
  verdict: "maybe",
  requirements: [],
  risks: [],
  nextActions: [],
  questionsToBuyer: [],
  documentCoverage: [],
  requiredDocumentsChecklist: [],
};

const SCAN_OUTPUT = {
  contractRiskMatrix: [
    {
      id: "r1", category: "fine", title: "Штраф за неякісне виконання",
      description: "20% від вартості договору", severity: "high",
      evidence: { label: "Договір", source: "https://untrusted.example", excerpt: "штраф 20%", evidenceType: "direct_quote" },
    },
    {
      id: "r2", category: "force_majeure", title: "Форс-мажор",
      description: "Повідомлення протягом 5 днів", severity: "low",
      evidence: { label: "Договір", source: "https://untrusted.example", excerpt: "форс-мажор", evidenceType: "direct_quote" },
    },
  ],
  priceAnalysis: [
    {
      id: "p1", position: "Харчування учнів 1-4 класів", quantity: "21 147 послуг",
      unitPrice: "80 грн", totalPrice: "0.00", note: "Гранична вартість за позицією",
      evidence: { label: "Специфікація", source: "https://untrusted.example", excerpt: "80 гривень", evidenceType: "direct_quote" },
    },
  ],
};

describe("normalizePriceValue", () => {
  it("normalizes placeholder prices to null and keeps real values", () => {
    expect(normalizePriceValue("0.00")).toBeNull();
    expect(normalizePriceValue("0")).toBeNull();
    expect(normalizePriceValue("0,00")).toBeNull();
    expect(normalizePriceValue("н/д")).toBeNull();
    expect(normalizePriceValue("не вказано")).toBeNull();
    expect(normalizePriceValue("-")).toBeNull();
    expect(normalizePriceValue("  ")).toBeNull();
    expect(normalizePriceValue(null)).toBeNull();
    expect(normalizePriceValue("80 грн")).toBe("80 грн");
    expect(normalizePriceValue("21 147 послуг")).toBe("21 147 послуг");
  });
});

describe("Gemini expert contract scan", () => {
  it("reads all files and runs a second contract scan pass, merging matrix + price analysis", async () => {
    let geminiCalls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
      const urlString = String(url);
      if (urlString.includes("public-docs.prozorro.gov.ua")) {
        return new Response("Not a real PDF", { status: 200, headers: { "content-type": "text/plain" } });
      }
      if (urlString.includes("generativelanguage.googleapis.com")) {
        geminiCalls += 1;
        return geminiCalls === 1 ? geminiResponse(MAIN_OUTPUT) : geminiResponse(SCAN_OUTPUT);
      }
      return originalFetch(url, init);
    };

    try {
      const base = analyzeTender(tenderFixture(), undefined, new Date("2026-08-01T12:00:00+03:00"));
      base.tender.documents = Array.from({ length: 6 }, (_, i) => ({
        id: `d${i}`, title: `Документ ${i + 1}.docx`,
        url: `https://public-docs.prozorro.gov.ua/get/d${i}`,
        format: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }));

      const result = await enhanceAnalysis({
        analysis: base, apiKey: "fake-gemini-key", safetyIdentifier: "safe-user",
        tier: "expert", model: "gemini-3.6-flash",
      });

      // Два виклики: основний + скан договору.
      expect(geminiCalls).toBe(2);
      expect(result.analysis.contractRiskMatrix).toHaveLength(2);
      expect(result.analysis.contractRiskMatrix![0]).toMatchObject({ category: "fine", severity: "high" });
      // Джерело доказу перезаписано на джерело тендера.
      expect(result.analysis.contractRiskMatrix![0]!.evidence.source).toBe(base.tender.sourceUrl);
      expect(result.analysis.priceAnalysis).toHaveLength(1);
      expect(result.analysis.priceAnalysis![0]!.unitPrice).toBe("80 грн");
      // Placeholder «0.00» нормалізовано в null.
      expect(result.analysis.priceAnalysis![0]!.totalPrice).toBeNull();
      // Usage підсумовано з обох викликів.
      expect(result.usage.inputTokens).toBe(1_000);
      expect(result.usage.outputTokens).toBe(300);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("survives a contract scan failure and still returns the main analysis", async () => {
    let geminiCalls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
      const urlString = String(url);
      if (urlString.includes("generativelanguage.googleapis.com")) {
        geminiCalls += 1;
        if (geminiCalls === 1) return geminiResponse(MAIN_OUTPUT);
        return new Response(JSON.stringify({ error: { message: "boom" } }), { status: 500, headers: { "content-type": "application/json" } });
      }
      return originalFetch(url, init);
    };

    try {
      const base = analyzeTender(tenderFixture(), undefined, new Date("2026-08-01T12:00:00+03:00"));
      const result = await enhanceAnalysis({
        analysis: base, apiKey: "fake-gemini-key", safetyIdentifier: "safe-user",
        tier: "expert", model: "gemini-3.6-flash",
      });
      expect(result.analysis.mode).toBe("ai-enhanced");
      expect(result.analysis.contractRiskMatrix).toBeUndefined();
      expect(result.analysis.priceAnalysis).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
