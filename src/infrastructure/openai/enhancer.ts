import zlib from "node:zlib";
import type { AnalysisTier } from "@/src/domain/billing/packages";
import { estimateOpenAICostMicrousd } from "@/src/domain/billing/cost";
import type { CompanyProfile, ContractRiskItem, PricePosition, TenderAnalysis, TenderDocument } from "@/src/domain/tender/types";
import { extractTextFromWordDoc, isWordBinary } from "./doc-extract";
import { buildContractScanPrompt, buildTenderPrompt } from "./prompt";
import { CONTRACT_SCAN_SCHEMA, TENDER_ANALYSIS_SCHEMA, type ContractScanPayload, type EnhancedTenderPayload } from "./tender-schema";

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
  const blacklist = new Set(["strict", "additionalProperties", "minimum", "maximum", "maxItems", "minItems"]);
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
type ThinkingLevel = "MINIMAL" | "MEDIUM" | "HIGH";

function getGeminiThinkingConfig(model: string, level: ThinkingLevel): Record<string, unknown> {
  const normalized = model.toLowerCase();
  if (/^gemini-3(\.|-|$)/.test(normalized)) {
    return { thinkingConfig: { thinkingLevel: level } };
  }
  return {
    thinkingConfig: {
      thinkingBudget: level === "MINIMAL" ? 0 : -1,
      includeThoughts: true,
    },
  };
}

const MAX_INLINE_FILE_BYTES = 8 * 1024 * 1024; // 8 MB safety margin for Gemini
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // PK.. (DOCX)
/** Expert читає всі підтримувані файли (з безпечним стелею), deep — до 5. */
const MAX_EXPERT_FILES = 20;

type ProcessedDocument =
  | { kind: "pdf"; mimeType: "application/pdf"; data: string; byteLength: number }
  | { kind: "text"; mimeType: "text/plain"; text: string; byteLength: number }
  | null;

function extractTextFromDocx(buffer: ArrayBuffer): string | null {
  try {
    const bytes = new Uint8Array(buffer);
    let offset = 0;
    while (offset < bytes.length - 30) {
      if (bytes[offset] === 0x50 && bytes[offset + 1] === 0x4b && bytes[offset + 2] === 0x03 && bytes[offset + 3] === 0x04) {
        const compression = bytes[offset + 8] | (bytes[offset + 9] << 8);
        const compressedSize = bytes[offset + 18] | (bytes[offset + 19] << 8) | (bytes[offset + 20] << 16) | (bytes[offset + 21] << 24);
        const fileNameLen = bytes[offset + 26] | (bytes[offset + 27] << 8);
        const extraLen = bytes[offset + 28] | (bytes[offset + 29] << 8);
        const fileNameBytes = bytes.subarray(offset + 30, offset + 30 + fileNameLen);
        const fileName = new TextDecoder().decode(fileNameBytes);
        const dataOffset = offset + 30 + fileNameLen + extraLen;

        if (fileName === "word/document.xml") {
          const compressedData = bytes.subarray(dataOffset, dataOffset + compressedSize);
          let xmlText = "";
          if (compression === 8) {
            const decompressed = zlib.inflateRawSync(compressedData);
            xmlText = new TextDecoder().decode(decompressed);
          } else if (compression === 0) {
            xmlText = new TextDecoder().decode(compressedData);
          }
          const text = xmlText
            .replace(/<w:p[^>]*>/g, "\n")
            .replace(/<[^>]+>/g, "")
            .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
          return text.trim();
        }
        offset = dataOffset + compressedSize;
      } else {
        offset++;
      }
    }
  } catch (err) {
    console.warn("[docx] Failed to extract text", { errorType: err instanceof Error ? err.name : "unknown" });
  }
  return null;
}

async function downloadGeminiDocument(url: string, title: string, format?: string): Promise<ProcessedDocument> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) {
      console.warn("[download] Failed", { status: res.status });
      return null;
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > MAX_INLINE_FILE_BYTES) {
      console.warn("[download] Skipped", { byteLength: buf.byteLength });
      return null;
    }

    const head = new Uint8Array(buf, 0, Math.min(buf.byteLength, 5));
    const isPdf = head.length >= 5 && PDF_MAGIC.every((b, i) => b === head[i]);
    const isZip = head.length >= 4 && ZIP_MAGIC.every((b, i) => b === head[i]);
    const isLegacyWord = isWordBinary(buf) || /\.doc(?:\s|$)/i.test(title) || format === "application/msword";

    if (isPdf) {
      console.log("[download] PDF ready", { byteLength: buf.byteLength });
      let binary = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      return {
        kind: "pdf",
        mimeType: "application/pdf",
        data: typeof btoa === "function" ? btoa(binary) : Buffer.from(bytes).toString("base64"),
        byteLength: buf.byteLength,
      };
    }

    // Word 97-2003: Gemini cannot ingest the binary container, so the text
    // is extracted locally from the OLE2 piece table instead of dropping
    // the main bidding document.
    if (isLegacyWord) {
      const extractedText = extractTextFromWordDoc(buf);
      if (extractedText && extractedText.length > 100) {
        console.log("[download] DOC ready", { byteLength: buf.byteLength, extractedCharacters: extractedText.length });
        return {
          kind: "text",
          mimeType: "text/plain",
          text: extractedText,
          byteLength: buf.byteLength,
        };
      }
      console.warn("[download] DOC extraction yielded no text", { byteLength: buf.byteLength });
      return null;
    }

    if (isZip || title.toLowerCase().endsWith(".docx")) {
      const extractedText = extractTextFromDocx(buf);
      if (extractedText && extractedText.length > 0) {
        console.log("[download] DOCX ready", { byteLength: buf.byteLength, extractedCharacters: extractedText.length });
        return {
          kind: "text",
          mimeType: "text/plain",
          text: extractedText,
          byteLength: buf.byteLength,
        };
      }
      console.warn("[download] DOCX extraction yielded no text");
      return null;
    }

    // Try text decoding for text/csv files
    const text = new TextDecoder("utf-8", { fatal: false }).decode(buf).trim();
    if (text.length > 0 && !/[\x00-\x08\x0E-\x1F]/.test(text.slice(0, 200))) {
      console.log("[download] Text ready", { byteLength: buf.byteLength, extractedCharacters: text.length });
      return {
        kind: "text",
        mimeType: "text/plain",
        text,
        byteLength: buf.byteLength,
      };
    }

    console.warn("[download] Unsupported format", { byteLength: buf.byteLength });
    return null;
  } catch (err) {
    console.warn("[download] Failed", { errorType: err instanceof Error ? err.name : "unknown" });
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
    .slice(0, expert ? MAX_EXPERT_FILES : 5);
  const prompt = buildTenderPrompt(input.analysis, input.company, files);

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
  files: TenderDocument[];
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
    console.error(`[enhanceAnalysis:openai] ${response.status} ${response.statusText} model=${model} tier=${tier}`);
    throw new OpenAIAnalysisError(payload.error?.message ? "OpenAI відхилив запит аналізу." : undefined);
  }
  const output = payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
  if (!output) throw new OpenAIAnalysisError();
  const parsed = parseStructuredOutput(output);
  // OpenAI завантажує файли сам: надіслані файли вважаються прочитаними.
  const downloadedTitles = new Set(files.map((document) => document.title));
  return finalizeAnalysis({ analysis, company, parsed, model, usage: normalizeOpenAIUsage(payload, model), tier, sentDocuments: files, downloadedTitles });
}

async function callGemini(input: {
  analysis: TenderAnalysis;
  company?: CompanyProfile;
  apiKey: string;
  safetyIdentifier: string;
  tier: Exclude<AnalysisTier, "quick">;
  model: string;
  expert: boolean;
  files: TenderDocument[];
  prompt: string;
}): Promise<{ analysis: TenderAnalysis; usage: AIUsage }> {
  const { expert, files, prompt, model, apiKey, analysis, company, tier } = input;
  const analysisId = analysis.id ?? "unknown";

  console.log(`[gemini:${analysisId}] Starting analysis`, { model, tier, fileCount: files.length });

  const processedFiles = await Promise.all(files.map(async (document) => {
    if (!document.url) return null;
    return downloadGeminiDocument(document.url, document.title, document.format);
  }));

  const downloadedTitles = new Set(files.filter((_, index) => processedFiles[index]).map((document) => document.title));
  console.log(`[gemini:${analysisId}] Documents prepared`, { downloadedCount: downloadedTitles.size, fileCount: files.length });

  const fileParts = buildFileParts(processedFiles, files);

  // Прохід 1 — основний аналіз.
  const main = await callGeminiWithFallback({
    apiKey, analysisId, model, tier,
    parts: [{ text: prompt }, ...fileParts],
    schema: TENDER_ANALYSIS_SCHEMA as unknown as Record<string, unknown>,
    maxOutputTokens: expert ? 16_384 : 8_192,
    thinkingLevel: expert ? "MEDIUM" : "MINIMAL",
    timeoutMs: expert ? 150_000 : 90_000,
  });
  const result = finalizeAnalysis({
    analysis, company, parsed: main.parsed as EnhancedTenderPayload, model: main.model,
    usage: main.usage, tier, sentDocuments: files, downloadedTitles,
  });

  // Прохід 2 (лише expert) — глибокий скан договору та специфікації з HIGH-роздумом.
  if (expert) {
    try {
      const scanPrompt = buildContractScanPrompt(analysis);
      const scan = await callGeminiWithFallback({
        apiKey, analysisId, model, tier,
        parts: [{ text: scanPrompt }, ...fileParts],
        schema: CONTRACT_SCAN_SCHEMA as unknown as Record<string, unknown>,
        maxOutputTokens: 16_384,
        thinkingLevel: "HIGH",
        timeoutMs: 150_000,
      });
      const scanPayload = scan.parsed as ContractScanPayload;
      const source = analysis.tender.sourceUrl;
      result.analysis.contractRiskMatrix = (scanPayload.contractRiskMatrix ?? []).slice(0, 24)
        .map((item): ContractRiskItem => ({ ...item, evidence: { ...item.evidence, source } }));
      result.analysis.priceAnalysis = (scanPayload.priceAnalysis ?? []).slice(0, 40)
        .map((item): PricePosition => ({
          ...item,
          quantity: normalizePriceValue(item.quantity),
          unitPrice: normalizePriceValue(item.unitPrice),
          totalPrice: normalizePriceValue(item.totalPrice),
          evidence: { ...item.evidence, source },
        }));
      result.usage = sumAIUsage(result.usage, scan.usage);
      console.log(`[gemini:${analysisId}] Contract scan complete`, {
        risks: result.analysis.contractRiskMatrix.length, positions: result.analysis.priceAnalysis.length,
      });
    } catch (err) {
      console.warn(`[gemini:${analysisId}] Contract scan failed — proceeding without matrix`, { errorType: err instanceof Error ? err.name : "unknown" });
    }
  }

  return result;
}

/** Placeholder-значення, які модель ставить замість відсутньої ціни/кількості. */
const PLACEHOLDER_PRICE_PATTERN = /^(?:0(?:[.,]0+)?|н\/д|не вказано|не зазначено|—|-|null|n\/a|немає|відсутн)(?:\s*грн)?$/i;

/**
 * Нормалізує значення ціни/кількості: «0», «0.00», «н/д» тощо → null,
 * щоб не показувати користувачу фейковий нуль замість відсутніх даних.
 */
export function normalizePriceValue(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (PLACEHOLDER_PRICE_PATTERN.test(trimmed)) return null;
  return trimmed;
}

/** Будує частини запиту Gemini з уже завантажених документів (без повторного завантаження). */
function buildFileParts(processedFiles: Array<ProcessedDocument>, files: TenderDocument[]): Array<Record<string, unknown>> {
  const parts: Array<Record<string, unknown>> = [];
  processedFiles.forEach((file, index) => {
    if (!file) return;
    if (file.kind === "pdf") {
      parts.push({ inline_data: { mime_type: file.mimeType, data: file.data } });
      parts.push({ text: `Документ ${index + 1} (${files[index]?.title}) завантажено як PDF вище.` });
    } else if (file.kind === "text") {
      parts.push({ text: `\n\n--- Документ ${index + 1} (${files[index]?.title}) ---\n${file.text.slice(0, 40_000)}\n--- Кінець документа ${index + 1} ---` });
    }
  });
  return parts;
}

function sumAIUsage(a: AIUsage, b: AIUsage): AIUsage {
  return {
    model: a.model,
    inputTokens: a.inputTokens + b.inputTokens,
    cachedInputTokens: a.cachedInputTokens + b.cachedInputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    costMicrousd: a.costMicrousd + b.costMicrousd,
  };
}

const DEFAULT_GEMINI_FALLBACKS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3-flash-preview",
  "gemini-2.0-flash",
];

type GeminiCallSpec = {
  apiKey: string;
  analysisId: string;
  model: string;
  tier: string;
  parts: Array<Record<string, unknown>>;
  schema: Record<string, unknown>;
  maxOutputTokens: number;
  thinkingLevel: ThinkingLevel;
  timeoutMs: number;
};

/** Один Gemini-виклик із фолбеком по моделях при квоті/порожньому виводі. */
async function callGeminiWithFallback(spec: GeminiCallSpec): Promise<{ parsed: Record<string, unknown>; usage: AIUsage; model: string }> {
  const { apiKey, analysisId, model, tier, parts, schema, maxOutputTokens, thinkingLevel, timeoutMs } = spec;
  const modelsToTry: string[] = [model];
  for (const m of DEFAULT_GEMINI_FALLBACKS) {
    if (!modelsToTry.includes(m)) modelsToTry.push(m);
  }

  let lastError: Error | null = null;

  for (let modelIndex = 0; modelIndex < modelsToTry.length; modelIndex++) {
    const currentModel = modelsToTry[modelIndex]!;
    const body = {
      contents: [{ role: "user", parts }],
      generationConfig: {
        response_mime_type: "application/json",
        response_schema: toGeminiSchema(schema),
        max_output_tokens: maxOutputTokens,
        temperature: 0.0,
        ...getGeminiThinkingConfig(currentModel, thinkingLevel),
      },
    };

    const bodyJson = JSON.stringify(body);
    console.log(`[gemini:${analysisId}] Provider attempt`, { attempt: modelIndex + 1, attempts: modelsToTry.length, model: currentModel, partCount: parts.length });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(currentModel)}:generateContent`;
    const attemptStartTime = Date.now();
    let response: Response;
    let payload: GeminiResponse;

    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
        body: bodyJson,
        signal: AbortSignal.timeout(timeoutMs),
      });
      payload = (await response.json()) as GeminiResponse;
    } catch (err) {
      console.error(`[gemini:${analysisId}] Provider network error`, { model: currentModel, errorType: err instanceof Error ? err.name : "unknown" });
      lastError = new OpenAIAnalysisError("AI-провайдер тимчасово недоступний.");
      continue;
    }

    const durationMs = Date.now() - attemptStartTime;
    if (!response.ok) {
      const isQuotaError = response.status === 429 || payload.error?.status === "RESOURCE_EXHAUSTED" || payload.error?.code === 429;
      if (isQuotaError && modelIndex < modelsToTry.length - 1) {
        const nextModel = modelsToTry[modelIndex + 1];
        console.warn(`[gemini:${analysisId}] Provider quota fallback`, { model: currentModel, nextModel, status: response.status });
        lastError = new OpenAIAnalysisError(`Квоту для ${currentModel} вичерпано. Технічна проблема з AI-сервісом.`);
        continue;
      }

      console.error(`[gemini:${analysisId}] Provider response error`, { model: currentModel, tier, status: response.status, durationMs });
      throw new OpenAIAnalysisError("Технічна проблема з AI-сервісом. Спробуйте пізніше.");
    }

    const candidate = payload.candidates?.[0];
    const finishReason = candidate?.finishReason;
    console.log(`[gemini:${analysisId}] Provider response`, { model: currentModel, status: response.status, finishReason: finishReason ?? "unknown", durationMs });
    if (finishReason && finishReason !== "STOP" && finishReason !== "MAX_TOKENS") {
      console.error(`[gemini:${analysisId}]   unexpected finishReason=${finishReason} model=${currentModel}`);
    }

    const responseParts = candidate?.content?.parts ?? [];
    const output = responseParts
      .filter((p) => p && typeof p.text === "string" && (p as { thought?: boolean }).thought !== true)
      .map((p) => p.text ?? "")
      .join("")
      .trim();

    if (!output) {
      lastError = new OpenAIAnalysisError("AI-провайдер не повернув придатний результат аналізу.");
      if (modelIndex < modelsToTry.length - 1) {
        console.warn(`[gemini:${analysisId}] ⚠️ Output empty or thinking truncated on model=${currentModel}. Retrying with next model=${modelsToTry[modelIndex + 1]}...`);
        continue;
      }
      throw lastError;
    }

    try {
      const parsed = parseStructuredOutput(output);
      return { parsed, usage: normalizeGeminiUsage(payload, currentModel), model: currentModel };
    } catch (parseErr) {
      console.warn(`[gemini:${analysisId}] Structured response parsing failed`, { model: currentModel, finishReason: finishReason ?? "unknown", errorType: parseErr instanceof Error ? parseErr.name : "unknown" });
      lastError = new OpenAIAnalysisError("AI-провайдер повернув неповний структурований звіт.");
      if (modelIndex < modelsToTry.length - 1) {
        console.warn(`[gemini:${analysisId}] ⚠️ Retrying with fallback model=${modelsToTry[modelIndex + 1]} due to truncated JSON...`);
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new OpenAIAnalysisError("Технічна проблема з AI-сервісом. Спробуйте пізніше.");
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

import { calculateWeightedMatrixScore, scoreTender } from "@/src/domain/tender/scoring";
import { buildCompetitionSentence, buildMarketSentence } from "@/src/domain/tender/analyzer";

/** LLM-ризики про відсутній профіль постачальника дублюють детермінований profile-cap. */
const PROFILE_RISK_PATTERN = /профіл|постачальник[ау]? не (надано|відом|зістав)/i;
const VERDICT_SENTENCE_PATTERN = /(^|\s)[^.!?]*(?:вердикт|verdict|\bno-go\b|\bmaybe\b|\bgo\b|заходит)[^.!?]*[.!?]/gi;

function stripVerdictSentences(text: string): string {
  return text.replace(VERDICT_SENTENCE_PATTERN, " ").replace(/\s{2,}/g, " ").trim();
}

/**
 * Детермінована звірка documentCoverage: модель фізично не може позначити
 * файл як "read"/"partial", якщо він не був обраний для аналізу (slice) або
 * не завантажився. Незалежно від галюцинацій моделі, статус таких файлів
 * примусово стає "unavailable" з чесною причиною.
 */
function buildDeterministicCoverage(
  allDocuments: TenderDocument[],
  sentDocuments: TenderDocument[],
  downloadedTitles: ReadonlySet<string>,
  modelCoverage: Array<{ title: string; status: "read" | "partial" | "unavailable"; notes: string }>,
): Array<{ title: string; status: "read" | "partial" | "unavailable"; notes: string }> {
  const sentTitles = new Set(sentDocuments.map((doc) => doc.title));
  const modelByTitle = new Map(modelCoverage.map((item) => [item.title, item]));
  return allDocuments.map((doc) => {
    if (!sentTitles.has(doc.title)) {
      return { title: doc.title, status: "unavailable", notes: "Файл не увійшов до ліміту документів цього режиму аналізу." };
    }
    if (!downloadedTitles.has(doc.title)) {
      return { title: doc.title, status: "unavailable", notes: "Файл не вдалося завантажити або розібрати для аналізу." };
    }
    const model = modelByTitle.get(doc.title);
    if (model?.status === "unavailable") {
      return { title: doc.title, status: "unavailable", notes: model.notes || "Модель не змогла проаналізувати файл." };
    }
    return {
      title: doc.title,
      status: model?.status === "read" ? "read" : "partial",
      notes: model?.notes || "Документ передано моделі для аналізу.",
    };
  });
}

function finalizeAnalysis(input: {
  analysis: TenderAnalysis;
  company?: CompanyProfile;
  parsed: EnhancedTenderPayload;
  model: string;
  usage: AIUsage;
  tier: Exclude<AnalysisTier, "quick">;
  sentDocuments: TenderDocument[];
  downloadedTitles: ReadonlySet<string>;
}): { analysis: TenderAnalysis; usage: AIUsage } {
  const { analysis, company, parsed, usage, tier } = input;
  const hasCompany = Boolean(company?.cpvCodes.length || company?.capabilities.length);
  const evaluatedAt = new Date(analysis.generatedAt);
  const analysisTime = Number.isFinite(evaluatedAt.getTime()) ? evaluatedAt : new Date();
  const deadline = analysis.tender.deadline ? new Date(analysis.tender.deadline) : null;
  const submissionOpen = !deadline || deadline.getTime() > analysisTime.getTime();

  // Use the same instant as the initial deterministic analysis. Re-evaluating
  // against wall-clock time can turn an already generated report into a false
  // no-go while the provider request is still being processed or replayed.
  const baseBreakdown = scoreTender(analysis.tender, company, analysisTime, analysis.buyerContext, analysis.marketContext);

  // "No supplier profile" is deterministic system knowledge, not a tender
  // risk: strip LLM copies. Shown in the report as an honest medium risk,
  // but excluded from the matrix — the anonymous score cap already prices
  // the missing profile in once.
  const llmRisks = parsed.risks.filter((risk) => !PROFILE_RISK_PATTERN.test(risk.title) && !PROFILE_RISK_PATTERN.test(risk.id));
  const matrixRisks = llmRisks;
  const displayRisks = hasCompany ? llmRisks : llmRisks.concat([{
    id: "profile-unknown",
    title: "Профіль постачальника не зіставлено",
    description: "Без CPV-кодів і можливостей компанії сервіс не може підтвердити відповідність предмету закупівлі.",
    level: "medium" as const,
    mitigation: "Додайте профіль компанії та повторіть аналіз перед рішенням про участь.",
    evidence: { label: "Профіль компанії", source: analysis.tender.sourceUrl, evidenceType: "business_inference" as const },
  }]);

  const matrixResult = calculateWeightedMatrixScore({
    baseBreakdown,
    requirements: parsed.requirements,
    risks: matrixRisks,
    requiredDocumentsChecklist: parsed.requiredDocumentsChecklist,
    hasCompanyProfile: hasCompany,
    submissionOpen,
  });

  const score = matrixResult.score;
  const verdict = matrixResult.verdict;
  const sourceUrl = analysis.tender.sourceUrl;

  // Deterministic coverage: the model cannot claim "read" for a file that
  // was never sent or failed to download.
  const documentCoverage = buildDeterministicCoverage(
    analysis.tender.documents, input.sentDocuments, input.downloadedTitles, parsed.documentCoverage,
  );

  // Missing key documents cap the report's own honesty claim.
  const unavailableDocs = documentCoverage.filter((doc) => doc.status === "unavailable").length;
  const confidencePenalty = unavailableDocs > 0 ? 15 : 0;
  const verdictLabel = verdict === "go" ? "можна заходити" : verdict === "no-go" ? "не заходити" : "потрібна ручна перевірка";
  const cleanedSummary = stripVerdictSentences(parsed.summary).slice(0, 800);
  const marketSentence = buildMarketSentence(analysis.tender, analysis.marketContext);
  const competitionSentence = buildCompetitionSentence(analysis.competitionRisk);
  return {
    analysis: {
      ...analysis,
      score,
      confidence: Math.max(25, Math.min(99, Math.round(parsed.confidence) - confidencePenalty)),
      scoreFactors: matrixResult.factors,
      verdict,
      summary: `Вердикт: ${verdictLabel} (бал ${score}/100). ${cleanedSummary}${marketSentence}${competitionSentence}`,
      requirements: parsed.requirements.slice(0, 32).map((item) => ({ ...item, evidence: { ...item.evidence, source: sourceUrl } })),
      risks: (() => {
        const list = displayRisks.slice(0, 20).map((item) => ({ ...item, evidence: { ...item.evidence, source: sourceUrl } }));
        if (!submissionOpen || (analysis.tender.status && analysis.tender.status !== "active.tendering")) {
          const hasDeadlineRisk = list.some((r) => r.id === "deadline-closed" || r.title.toLowerCase().includes("дедлайн"));
          if (!hasDeadlineRisk) {
            list.unshift({
              id: "deadline-closed",
              level: "critical",
              isStopFactor: true,
              title: "Дедлайн подання пропозицій минув",
              description: `Прийом пропозицій за цією закупівлею закритий Prozorro (статус: ${analysis.tender.status}). Нову заявку подати вже неможливо.`,
              mitigation: "Додати замовника в моніторинг на нові закупівлі.",
              evidence: { label: "Дані Prozorro", source: sourceUrl, excerpt: `Статус Prozorro: ${analysis.tender.status}` },
            });
          } else {
            const deadlineRisk = list.find((r) => r.id === "deadline-closed" || r.title.toLowerCase().includes("дедлайн"));
            if (deadlineRisk) deadlineRisk.isStopFactor = true;
          }
        }
        return list;
      })(),
      nextActions: parsed.nextActions.slice(0, 8),
      questionsToBuyer: parsed.questionsToBuyer.slice(0, 8),
      documentCoverage,
      requiredDocumentsChecklist: Array.isArray(parsed.requiredDocumentsChecklist)
        ? parsed.requiredDocumentsChecklist.slice(0, 24)
        : undefined,
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
