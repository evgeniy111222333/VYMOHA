import type { AnalysisTier } from "@/src/domain/billing/packages";
import { estimateOpenAICostMicrousd } from "@/src/domain/billing/cost";
import type { CompanyProfile, TenderAnalysis } from "@/src/domain/tender/types";
import { buildTenderPrompt } from "./prompt";
import { TENDER_ANALYSIS_SCHEMA, type EnhancedTenderPayload } from "./tender-schema";

// ─── Debug log ring buffer ───────────────────────────────────────────────────
export type AnalysisDebugEntry = {
  id: string;
  timestamp: string;
  provider: "gemini" | "openai";
  model: string;
  tier: string;
  promptPreview: string;
  promptLengthChars: number;
  files: Array<{
    title: string;
    url?: string;
    format?: string;
    downloadedBytes: number | null;
    mimeType: string | null;
    downloadOk: boolean;
  }>;
  requestBodySizeBytes: number;
  responseStatus: number | null;
  responseError: string | null;
  durationMs: number | null;
};

const DEBUG_LOG_MAX = 50;
const GLOBAL_KEY = "__vymoha_analysis_debug_log__";

function getDebugLog(): AnalysisDebugEntry[] {
  const g = globalThis as Record<string, unknown>;
  if (!Array.isArray(g[GLOBAL_KEY])) g[GLOBAL_KEY] = [];
  return g[GLOBAL_KEY] as AnalysisDebugEntry[];
}

function pushDebugEntry(entry: AnalysisDebugEntry) {
  const log = getDebugLog();
  log.push(entry);
  if (log.length > DEBUG_LOG_MAX) log.shift();
}

export function getAnalysisDebugLog(): AnalysisDebugEntry[] {
  return [...getDebugLog()].reverse(); // newest first
}

type OpenAIResponse = {
  output?: Array<{ content?: Array<{ type?: string; text?: string; refusal?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number } };
  error?: { message?: string };
};

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    cachedContentTokenCount?: number;
  };
  error?: { message?: string; code?: number; status?: string };
};

export type AIUsage = {
  model: string; inputTokens: number; cachedInputTokens: number; outputTokens: number; costMicrousd: number;
};

export class OpenAIAnalysisError extends Error {
  constructor(message = "AI-провайдер не зміг завершити аналіз.") { super(message); this.name = "OpenAIAnalysisError"; }
}

function isGeminiModel(model: string): boolean {
  return model.toLowerCase().startsWith("gemini-");
}

function toGeminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  // Gemini підтримує підмножину JSON Schema. Видаляємо поля, які воно не приймає.
  const blacklist = new Set(["strict", "additionalProperties"]);
  const visit = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(visit);
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (blacklist.has(k)) continue;
        out[k] = visit(v);
      }
      return out;
    }
    return node;
  };
  return visit(schema) as Record<string, unknown>;
}

// Gemini 3.x → thinkingLevel (MINIMAL/LOW/MEDIUM/HIGH). Повністю вимкнути не можна.
// Gemini 2.5 і раніше → thinkingBudget (int: -1 dynamic, 0 off, 1024+ budget) + includeThoughts.
function getGeminiThinkingConfig(model: string, expert: boolean): Record<string, unknown> {
  const normalized = model.toLowerCase();
  if (/^gemini-3(\.|-|$)/.test(normalized)) {
    return { thinkingConfig: { thinkingLevel: expert ? "HIGH" : "MINIMAL" } };
  }
  // Gemini 2.5 і старіші
  return {
    thinkingConfig: {
      thinkingBudget: expert ? -1 : 0,
      includeThoughts: true,
    },
  };
}

const MAX_INLINE_FILE_BYTES = 8 * 1024 * 1024; // 8 MB safety margin for Gemini inline_data
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

type DownloadResult = { mimeType: string; data: string; byteLength: number } | null;

async function downloadAsInlineData(url: string): Promise<DownloadResult> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) {
      console.warn(`[download] FAILED ${res.status} ${res.statusText} url=${url}`);
      return null;
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > MAX_INLINE_FILE_BYTES) {
      console.warn(`[download] SKIPPED size=${buf.byteLength} url=${url}`);
      return null;
    }
    // Перевіряємо magic bytes — Prozorro часто віддає .docx/.xlsx з Content-Type application/pdf,
    // і тоді Gemini reject-ить з "The document has no pages". Беремо тільки справжні PDF.
    const head = new Uint8Array(buf, 0, Math.min(buf.byteLength, PDF_MAGIC.length));
    const isPdf = head.length === PDF_MAGIC.length && PDF_MAGIC.every((b, i) => b === head[i]);
    if (!isPdf) {
      console.log(`[download] NOT_PDF size=${buf.byteLength} url=${url} — пропущено`);
      return null;
    }
    let binary = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    console.log(`[download] OK size=${buf.byteLength} mime=application/pdf url=${url}`);
    return { mimeType: "application/pdf", data: typeof btoa === "function" ? btoa(binary) : Buffer.from(bytes).toString("base64"), byteLength: buf.byteLength };
  } catch (err) {
    console.warn(`[download] ERROR url=${url}`, err);
    return null;
  }
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
  const prompt = buildTenderPrompt(input.analysis, input.company);

  if (isGeminiModel(input.model)) {
    return callGemini({ ...input, expert, files, prompt });
  }
  return callOpenAI({ ...input, expert, files, prompt });
}

async function callOpenAI(input: {
  analysis: TenderAnalysis;
  company?: CompanyProfile;
  apiKey: string;
  safetyIdentifier: string;
  tier: Exclude<AnalysisTier, "quick">;
  model: string;
  expert: boolean;
  files: Array<{ url?: string; format?: string; title: string }>;
  prompt: string;
}): Promise<{ analysis: TenderAnalysis; usage: AIUsage }> {
  const { expert, files, prompt, model, apiKey, safetyIdentifier, analysis, company, tier } = input;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      safety_identifier: safetyIdentifier,
      reasoning: { effort: expert ? "high" : "medium", context: "current_turn" },
      text: {
        verbosity: expert ? "medium" : "low",
        format: { type: "json_schema", name: "tender_analysis", strict: true, schema: TENDER_ANALYSIS_SCHEMA },
      },
      max_output_tokens: expert ? 9_000 : 6_000,
      input: [{ role: "user", content: [
        { type: "input_text", text: prompt },
        ...files.map((document) => ({
          type: "input_file", file_url: document.url, detail: expert ? "high" : "low",
        })),
      ] }],
    }),
    signal: AbortSignal.timeout(expert ? 150_000 : 90_000),
  });
  const payload = await response.json() as OpenAIResponse;
  if (!response.ok) {
    const errorBody = JSON.stringify(payload).slice(0, 800);
    console.error(`[enhanceAnalysis:openai] ${response.status} ${response.statusText} model=${model} tier=${tier}`);
    console.error(`[enhanceAnalysis:openai] body: ${errorBody}`);
    throw new OpenAIAnalysisError(payload.error?.message ? "OpenAI відхилив запит аналізу." : undefined);
  }
  const output = payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
  if (!output) throw new OpenAIAnalysisError();
  const parsed = parseStructuredOutput(output);
  return finalizeAnalysis({ analysis, company, parsed, model, usage: normalizeOpenAIUsage(payload, model), tier });
}

async function callGemini(input: {
  analysis: TenderAnalysis;
  company?: CompanyProfile;
  apiKey: string;
  safetyIdentifier: string;
  tier: Exclude<AnalysisTier, "quick">;
  model: string;
  expert: boolean;
  files: Array<{ url?: string; format?: string; title: string }>;
  prompt: string;
}): Promise<{ analysis: TenderAnalysis; usage: AIUsage }> {
  const { expert, files, prompt, model, apiKey, analysis, company, tier } = input;
  const analysisId = analysis.id ?? "unknown";
  const startTime = Date.now();

  // ─── Logging: files being downloaded ───────────────────────────────────────
  console.log(`[gemini:${analysisId}] ▶ Starting analysis model=${model} tier=${tier} expert=${expert} files=${files.length}`);
  files.forEach((f, i) => console.log(`[gemini:${analysisId}]   file[${i}] title="${f.title}" format=${f.format ?? "?"} url=${f.url ?? "none"}`));

  const inlineFiles = await Promise.all(files.map(async (document) => {
    if (!document.url) return null;
    return downloadAsInlineData(document.url);
  }));

  // ─── Logging: download results ─────────────────────────────────────────────
  const fileDebugInfo = files.map((f, i) => {
    const dl = inlineFiles[i];
    return {
      title: f.title,
      url: f.url,
      format: f.format,
      downloadedBytes: dl?.byteLength ?? null,
      mimeType: dl?.mimeType ?? null,
      downloadOk: dl !== null,
    };
  });
  const downloadedCount = inlineFiles.filter(Boolean).length;
  console.log(`[gemini:${analysisId}]   downloaded ${downloadedCount}/${files.length} files`);
  fileDebugInfo.forEach((f, i) => {
    if (!f.downloadOk) console.warn(`[gemini:${analysisId}]   ✗ file[${i}] "${f.title}" FAILED to download`);
    else console.log(`[gemini:${analysisId}]   ✓ file[${i}] "${f.title}" ${f.downloadedBytes} bytes mime=${f.mimeType}`);
  });

  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  inlineFiles.forEach((file, index) => {
    if (!file) return;
    parts.push({ inline_data: { mime_type: file.mimeType, data: file.data } });
    parts.push({ text: `Документ ${index + 1} (${files[index]?.title}) завантажено вище. Використай його під час аналізу.` });
  });

  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      response_mime_type: "application/json",
      response_schema: toGeminiSchema(TENDER_ANALYSIS_SCHEMA as Record<string, unknown>),
      max_output_tokens: expert ? 9_000 : 6_000,
      temperature: expert ? 0.4 : 0.2,
      ...getGeminiThinkingConfig(model, expert),
    },
  };

  const bodyJson = JSON.stringify(body);
  console.log(`[gemini:${analysisId}]   prompt length=${prompt.length} chars, request body=${bodyJson.length} bytes, parts=${parts.length}`);

  // ─── Create debug entry (before request) ───────────────────────────────────
  const debugEntry: AnalysisDebugEntry = {
    id: analysisId,
    timestamp: new Date().toISOString(),
    provider: "gemini",
    model,
    tier,
    promptPreview: prompt.slice(0, 1000),
    promptLengthChars: prompt.length,
    files: fileDebugInfo,
    requestBodySizeBytes: bodyJson.length,
    responseStatus: null,
    responseError: null,
    durationMs: null,
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
    body: bodyJson,
    signal: AbortSignal.timeout(expert ? 150_000 : 90_000),
  });
  const payload = (await response.json()) as GeminiResponse;
  const durationMs = Date.now() - startTime;
  debugEntry.responseStatus = response.status;
  debugEntry.durationMs = durationMs;

  if (!response.ok) {
    const errorBody = JSON.stringify(payload).slice(0, 800);
    debugEntry.responseError = errorBody;
    pushDebugEntry(debugEntry);
    console.error(`[gemini:${analysisId}] ✗ ${response.status} ${response.statusText} model=${model} tier=${tier} duration=${durationMs}ms`);
    console.error(`[gemini:${analysisId}]   error body: ${errorBody}`);
    throw new OpenAIAnalysisError(payload.error?.message ?? "Gemini відхилив запит аналізу.");
  }

  const candidate = payload.candidates?.[0];
  const finishReason = candidate?.finishReason;
  console.log(`[gemini:${analysisId}] ✓ ${response.status} finishReason=${finishReason ?? "?"} duration=${durationMs}ms`);
  if (finishReason && finishReason !== "STOP" && finishReason !== "MAX_TOKENS") {
    console.error(`[gemini:${analysisId}]   unexpected finishReason=${finishReason} model=${model}`);
  }

  pushDebugEntry(debugEntry);

  const responseParts = candidate?.content?.parts ?? [];
  const output = responseParts
    .filter((p) => p && typeof p.text === "string" && (p as { thought?: boolean }).thought !== true)
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!output) {
    const thought = responseParts.filter((p) => (p as { thought?: boolean }).thought === true).map((p) => p.text ?? "").join(" ").trim();
    throw new OpenAIAnalysisError(
      `Gemini не повернув фінальну відповідь (finishReason=${finishReason ?? "unknown"}${thought ? `, thought="${thought.slice(0, 200)}"` : ""}).`,
    );
  }
  const parsed = parseStructuredOutput(output);
  return finalizeAnalysis({ analysis, company, parsed, model, usage: normalizeGeminiUsage(payload, model), tier });
}

function parseStructuredOutput(raw: string): EnhancedTenderPayload {
  // Gemini 3+ може додавати "thought" prefix (e.g. "Here\n{...}") перед фінальним JSON
  // і обгортати у ```json fences. Шукаємо перший { та останній }.
  const trimmed = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new OpenAIAnalysisError("AI повернув неповний структурований звіт.");
  }
  const json = trimmed.slice(firstBrace, lastBrace + 1);
  try { return JSON.parse(json) as EnhancedTenderPayload; }
  catch { throw new OpenAIAnalysisError("AI повернув неповний структурований звіт."); }
}

function normalizeOpenAIUsage(payload: OpenAIResponse, model: string): AIUsage {
  const inputTokens = Math.max(0, Number(payload.usage?.input_tokens ?? 0));
  const cachedInputTokens = Math.max(0, Number(payload.usage?.input_tokens_details?.cached_tokens ?? 0));
  const outputTokens = Math.max(0, Number(payload.usage?.output_tokens ?? 0));
  return { model, inputTokens, cachedInputTokens, outputTokens, costMicrousd: estimateOpenAICostMicrousd({ model, inputTokens, cachedInputTokens, outputTokens }) };
}

function normalizeGeminiUsage(payload: GeminiResponse, model: string): AIUsage {
  const usage = payload.usageMetadata;
  const inputTokens = Math.max(0, Number(usage?.promptTokenCount ?? 0));
  const cachedInputTokens = Math.max(0, Number(usage?.cachedContentTokenCount ?? 0));
  const outputTokens = Math.max(0, Number(usage?.candidatesTokenCount ?? 0));
  return { model, inputTokens, cachedInputTokens, outputTokens, costMicrousd: estimateOpenAICostMicrousd({ model, inputTokens, cachedInputTokens, outputTokens }) };
}

function finalizeAnalysis(input: {
  analysis: TenderAnalysis;
  company?: CompanyProfile;
  parsed: EnhancedTenderPayload;
  model: string;
  usage: AIUsage;
  tier: Exclude<AnalysisTier, "quick">;
}): { analysis: TenderAnalysis; usage: AIUsage } {
  const { analysis, company, parsed, usage, tier } = input;
  const hasCompany = Boolean(company?.cpvCodes.length || company?.capabilities.length);
  const score = Math.max(0, Math.min(hasCompany ? 100 : 69, Math.round(parsed.score)));
  const verdict = (!hasCompany && parsed.verdict === "go" ? "maybe" : parsed.verdict) as TenderAnalysis["verdict"];
  const sourceUrl = analysis.tender.sourceUrl;
  return {
    analysis: {
      ...analysis,
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
      analysisTier: tier,
    },
    usage,
  };
}

function isSupportedDocument(format: string | undefined, title: string): boolean {
  const value = `${format ?? ""} ${title}`.toLowerCase();
  return /\.(pdf|docx?|xlsx?|csv|txt)(?:\s|$)|application\/pdf|officedocument|text\//.test(value) && !value.includes("sign.p7s");
}
