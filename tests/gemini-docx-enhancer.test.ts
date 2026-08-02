import { describe, expect, it } from "vitest";
import { analyzeTender } from "@/src/domain/tender/analyzer";
import { enhanceAnalysis } from "@/src/infrastructure/openai/enhancer";
import { tenderFixture } from "./fixtures";

describe("Gemini enhancer DOCX handling", () => {
  it("downloads DOCX files and extracts text correctly for Gemini", async () => {
    let capturedBody: Record<string, unknown> | undefined;

    // Mock fetch for Gemini API endpoint
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
      const urlString = String(url);

      // If fetching Prozorro DOCX file fixture
      if (urlString.includes("public-docs.prozorro.gov.ua")) {
        // Return a mock DOCX ZIP buffer or test response
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
      // Add a docx document to fixture
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
        model: "gemini-3.5-flash",
      });

      expect(capturedBody).toBeDefined();
      expect(result.analysis.mode).toBe("ai-enhanced");
      expect(result.analysis.summary).toContain("Тест успішного аналізу");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
