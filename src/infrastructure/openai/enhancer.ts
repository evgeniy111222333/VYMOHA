import type { AnalysisTier } from "@/src/domain/billing/packages";
import { estimateOpenAICostMicrousd } from "@/src/domain/billing/cost";
import type { CompanyProfile, TenderAnalysis } from "@/src/domain/tender/types";
import { buildTenderPrompt } from "./prompt";
import { TENDER_ANALYSIS_SCHEMA, type EnhancedTenderPayload } from "./tender-schema";

type OpenAIResponse = {
  output?: Array<{ content?: Array<{ type?: string; text?: string; refusal?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number } };
  error?: { message?: string };
};

export type AIUsage = {
  model: string; inputTokens: number; cachedInputTokens: number; outputTokens: number; costMicrousd: number;
};

export class OpenAIAnalysisError extends Error {
  constructor(message = "OpenAI не зміг завершити аналіз.") { super(message); this.name = "OpenAIAnalysisError"; }
}

export async function enhanceAnalysis(input: {
  analysis: TenderAnalysis;
  company?: CompanyProfile;
  apiKey: string;
  safetyIdentifier: string;
  tier: Exclude<AnalysisTier, "quick">;
  model: string;
}): Promise<{ analysis: TenderAnalysis; usage: AIUsage }> {
  const expert = input.tier === "expert";
  const files = input.analysis.tender.documents
    .filter((document) => document.url && isSupportedDocument(document.format, document.title))
    .slice(0, expert ? 8 : 5);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${input.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: input.model,
      store: false,
      safety_identifier: input.safetyIdentifier,
      reasoning: { effort: expert ? "high" : "medium", context: "current_turn" },
      text: {
        verbosity: expert ? "medium" : "low",
        format: { type: "json_schema", name: "tender_analysis", strict: true, schema: TENDER_ANALYSIS_SCHEMA },
      },
      max_output_tokens: expert ? 9_000 : 6_000,
      input: [{ role: "user", content: [
        { type: "input_text", text: buildTenderPrompt(input.analysis, input.company) },
        ...files.map((document) => ({
          type: "input_file", file_url: document.url, detail: expert ? "high" : "low",
        })),
      ] }],
    }),
    signal: AbortSignal.timeout(expert ? 150_000 : 90_000),
  });
  const payload = await response.json() as OpenAIResponse;
  if (!response.ok) throw new OpenAIAnalysisError(payload.error?.message ? "OpenAI відхилив запит аналізу." : undefined);
  const output = payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
  if (!output) throw new OpenAIAnalysisError();

  let parsed: EnhancedTenderPayload;
  try { parsed = JSON.parse(output) as EnhancedTenderPayload; }
  catch { throw new OpenAIAnalysisError("OpenAI повернув неповний структурований звіт."); }

  const usage = normalizeUsage(payload, input.model);
  const hasCompany = Boolean(input.company?.cpvCodes.length || input.company?.capabilities.length);
  const score = Math.max(0, Math.min(hasCompany ? 100 : 69, Math.round(parsed.score)));
  const verdict = !hasCompany && parsed.verdict === "go" ? "maybe" : parsed.verdict;
  const sourceUrl = input.analysis.tender.sourceUrl;

  return {
    analysis: {
      ...input.analysis,
      score,
      confidence: Math.max(25, Math.min(99, Math.round(parsed.confidence))),
      scoreFactors: [{
        id: "ai-document-analysis",
        label: "Оцінка за доказами",
        points: score,
        description: "Підсумковий бал сформовано після читання доступних файлів і зіставлення з профілем компанії.",
        kind: "base",
      }],
      verdict,
      summary: parsed.summary.slice(0, 900),
      requirements: parsed.requirements.slice(0, 32).map((item) => ({ ...item, evidence: { ...item.evidence, source: sourceUrl } })),
      risks: parsed.risks.slice(0, 20).map((item) => ({ ...item, evidence: { ...item.evidence, source: sourceUrl } })),
      nextActions: parsed.nextActions.slice(0, 8),
      questionsToBuyer: parsed.questionsToBuyer.slice(0, 8),
      documentCoverage: parsed.documentCoverage.slice(0, 16),
      mode: "ai-enhanced",
      analysisTier: input.tier,
    },
    usage,
  };
}

function normalizeUsage(payload: OpenAIResponse, model: string): AIUsage {
  const inputTokens = Math.max(0, Number(payload.usage?.input_tokens ?? 0));
  const cachedInputTokens = Math.max(0, Number(payload.usage?.input_tokens_details?.cached_tokens ?? 0));
  const outputTokens = Math.max(0, Number(payload.usage?.output_tokens ?? 0));
  return {
    model, inputTokens, cachedInputTokens, outputTokens,
    costMicrousd: estimateOpenAICostMicrousd({ model, inputTokens, cachedInputTokens, outputTokens }),
  };
}

function isSupportedDocument(format: string | undefined, title: string): boolean {
  const value = `${format ?? ""} ${title}`.toLowerCase();
  return /\.(pdf|docx?|xlsx?|csv|txt)(?:\s|$)|application\/pdf|officedocument|text\//.test(value) && !value.includes("sign.p7s");
}
