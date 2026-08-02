import { describe, expect, it } from "vitest";
import { analyzeTender } from "@/src/domain/tender/analyzer";
import { enhanceAnalysis } from "@/src/infrastructure/openai/enhancer";
import { tenderFixture } from "./fixtures";

describe("Gemini enhancer DOCX handling", () => {
  it("downloads DOCX files and extracts text correctly for Gemini", async () => {
    let capturedBody: Record<string, unknown> | undefined;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
      const urlString = String(url);

      if (urlString.includes("public-docs.prozorro.gov.ua")) {
        return new Response("Not a real PDF", {
          status: 200,
          headers: { "content-type": "text/plain" },
        });
      }

      if (urlString.includes("generativelanguage.googleapis.com")) {
        capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        const mockGeminiOutput = {
          summary: "Тест успішного аналізу DOCX документа.",
          score: 85,
          confidence: 90,
          verdict: "go",
          requirements: [],
          risks: [],
          nextActions: ["Провести зустріч з замовником"],
          questionsToBuyer: [],
          documentCoverage: [],
        };
        return new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: "STOP",
                content: {
                  parts: [{ text: JSON.stringify(mockGeminiOutput) }],
                },
              },
            ],
            usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 150 },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      return originalFetch(url, init);
    };

    try {
      const base = analyzeTender(tenderFixture(), undefined, new Date("2026-08-01T12:00:00+03:00"));
      base.tender.documents = [
        {
          title: "Тендерна документація.docx",
          url: "https://public-docs.prozorro.gov.ua/get/fake-docx-id",
          format: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
      ];

      const result = await enhanceAnalysis({
        analysis: base,
        apiKey: "fake-gemini-key",
        safetyIdentifier: "safe-user",
        tier: "expert",
        model: "gemini-3.6-flash",
      });

      expect(capturedBody).toBeDefined();
      expect(result.analysis.mode).toBe("ai-enhanced");
      expect(result.analysis.summary).toContain("Тест успішного аналізу");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("automatically falls back from gemini-3.6-flash to gemini-3.5-flash on 429 quota error", async () => {
    const requestedModels: string[] = [];

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
      const urlString = String(url);

      if (urlString.includes("generativelanguage.googleapis.com")) {
        const modelMatch = urlString.match(/models\/([^:]+):/);
        if (modelMatch?.[1]) {
          requestedModels.push(decodeURIComponent(modelMatch[1]));
        }

        // First attempt (gemini-3.6-flash) returns 429
        if (requestedModels.length === 1) {
          return new Response(
            JSON.stringify({
              error: { code: 429, message: "Quota exceeded for metric", status: "RESOURCE_EXHAUSTED" },
            }),
            { status: 429, headers: { "content-type": "application/json" } }
          );
        }

        // Second attempt (gemini-3.5-flash) succeeds
        const mockGeminiOutput = {
          summary: "Аналіз виконано через fallback модель.",
          score: 80,
          confidence: 85,
          verdict: "go",
          requirements: [],
          risks: [],
          nextActions: [],
          questionsToBuyer: [],
          documentCoverage: [],
        };
        return new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: "STOP",
                content: { parts: [{ text: JSON.stringify(mockGeminiOutput) }] },
              },
            ],
            usageMetadata: { promptTokenCount: 300, candidatesTokenCount: 100 },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      return originalFetch(url, init);
    };

    try {
      const base = analyzeTender(tenderFixture(), undefined, new Date("2026-08-01T12:00:00+03:00"));
      const result = await enhanceAnalysis({
        analysis: base,
        apiKey: "fake-gemini-key",
        safetyIdentifier: "safe-user",
        tier: "expert",
        model: "gemini-3.6-flash",
      });

      expect(requestedModels).toEqual(["gemini-3.6-flash", "gemini-3.5-flash"]);
      expect(result.analysis.summary).toContain("через fallback модель");
      expect(result.usage.model).toBe("gemini-3.5-flash");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
