import { runtimeEnv, type RuntimeEnv } from "@/db/runtime";
import { getAnalysisTier, type AnalysisTier } from "@/src/domain/billing/packages";
import { analyzeTender } from "@/src/domain/tender/analyzer";
import { enhanceAnalysis, OpenAIAnalysisError } from "@/src/infrastructure/openai/enhancer";
import { fetchBuyerContext } from "@/src/infrastructure/prozorro/buyer-stats";
import { fetchTender } from "@/src/infrastructure/prozorro/client";
import { fetchMarketBenchmark } from "@/src/infrastructure/prozorro/market";
import { ensureUserAccount } from "@/src/infrastructure/storage/accounts";
import { completeAnalysisUsage, refundAnalysisCredits, reserveAnalysisCredits } from "@/src/infrastructure/storage/billing";
import { consumeRateLimit, getCompanyProfile, recordAnalysisTelemetry, saveAnalysis, upsertPublicTenderSummary, writeAuditEvent } from "@/src/infrastructure/storage/repository";
import { apiError, HttpError, requestUser } from "@/src/lib/http";
import { assertBodySize, assertSameOrigin, clientAddress, sha256 } from "@/src/lib/security";
import { analyzeRequestSchema } from "@/src/lib/validation";

export const dynamic = "force-dynamic";

const RATE_LIMITS = {
  quickAnon: { limit: 3, window: 3_600, message: "Ліміт безплатних перевірок вичерпано. Увійдіть, щоб продовжити." },
  quickUser: { limit: 10, window: 3_600, message: "Ліміт швидких перевірок вичерпано. Спробуйте пізніше." },
  paid: { limit: 30, window: 3_600, message: "Ліміт аналізів вичерпано. Спробуйте пізніше." },
} as const;

function pickAnalyzeRateLimit(tier: AnalysisTier, userId: string | null, ipHash: string): { bucket: string; limit: number; window: number; message: string } {
  if (tier === "quick") {
    return userId
      ? { bucket: `analyze:quick:user:${userId}`, ...RATE_LIMITS.quickUser }
      : { bucket: `analyze:quick:anon:${ipHash}`, ...RATE_LIMITS.quickAnon };
  }
  return { bucket: `analyze:paid:user:${userId ?? ipHash}`, ...RATE_LIMITS.paid };
}

function analysisProvider(model: string): "gemini" | "openai" {
  return model.toLowerCase().startsWith("gemini-") ? "gemini" : "openai";
}

function telemetryErrorCode(error: unknown): string {
  return error instanceof OpenAIAnalysisError ? "provider_error" : "unexpected_error";
}

async function recordAnalysisTelemetrySafely(input: Parameters<typeof recordAnalysisTelemetry>[0]): Promise<void> {
  try {
    await recordAnalysisTelemetry(input);
  } catch (error) {
    console.error("[analysis-telemetry] Write failed", { errorType: error instanceof Error ? error.name : "unknown" });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    assertBodySize(request, 32_000);
    let rawBody: unknown;
    const rawText = await request.text();
    try {
      rawBody = JSON.parse(rawText);
    } catch (parseError) {
      console.error("[analyze] Invalid JSON", { errorType: parseError instanceof Error ? parseError.name : "unknown" });
      return Response.json({ error: { message: "Невалідний JSON у тілі запиту." } }, { status: 400 });
    }
    const parsed = analyzeRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return Response.json({ error: { message: "Перевірте введені дані.", details: parsed.error.issues } }, { status: 422 });
    }

    const user = await requestUser(request);
    const requestedTier: AnalysisTier = parsed.data.analysisTier ?? (parsed.data.deepAnalysis ? "deep" : "quick");
    const tier = getAnalysisTier(requestedTier);
    const ipHash = await sha256(clientAddress(request));
    const rate = pickAnalyzeRateLimit(requestedTier, user?.id ?? null, ipHash);
    const limit = await consumeRateLimit(rate.bucket, rate.limit, rate.window);
    if (!limit.allowed) return Response.json({ error: { message: rate.message } }, { status: 429, headers: { "Retry-After": String(Math.max(1, limit.resetAt - Math.floor(Date.now() / 1000))) } });

    const account = user ? await ensureUserAccount(user) : null;
    if (account?.status === "suspended") throw new HttpError(403, "Обліковий запис призупинено. Зверніться до адміністратора.");
    if (requestedTier !== "quick" && !user) throw new HttpError(401, "Увійдіть, щоб запустити повний AI-аналіз.");
    const company = parsed.data.company ?? (user ? await getCompanyProfile(user.id) : undefined) ?? undefined;
    const tender = await fetchTender(parsed.data.source);
    const [buyerContext, intelligence] = await Promise.all([
      tender.buyerEdrpou ? fetchBuyerContext(tender.buyerEdrpou) : Promise.resolve(undefined),
      fetchMarketBenchmark(tender).catch(() => null),
    ]);
    const marketContext = intelligence?.context ?? undefined;
    const competitionRisk = intelligence?.competition ?? undefined;
    let analysis = analyzeTender(tender, company, new Date(), buyerContext, requestedTier, marketContext, competitionRisk);
    let creditBalance = account?.creditBalance;

    if (requestedTier !== "quick" && user) {
      const runtime = runtimeEnv();
      // GEMINI_* is the canonical configuration. OPENAI_* remains a short
      // migration bridge for the currently deployed secret names.
      const env: RuntimeEnv = {
        ...runtime,
        OPENAI_API_KEY: runtime.GEMINI_API_KEY ?? runtime.OPENAI_API_KEY,
        OPENAI_MODEL_STANDARD: runtime.GEMINI_MODEL_STANDARD ?? runtime.OPENAI_MODEL_STANDARD,
        OPENAI_MODEL_EXPERT: runtime.GEMINI_MODEL_EXPERT ?? runtime.OPENAI_MODEL_EXPERT,
      };
      if (!env.OPENAI_API_KEY) throw new HttpError(503, "Поглиблений аналіз тимчасово недоступний. Спробуйте швидку перевірку.");
      const model = requestedTier === "expert"
        ? env.OPENAI_MODEL_EXPERT ?? "gemini-3.6-flash"
        : env.OPENAI_MODEL_STANDARD ?? "gemini-3.6-flash";
      const userHash = await sha256(user.id);
      creditBalance = await reserveAnalysisCredits({
        userId: user.id, analysisId: analysis.id, tier: requestedTier, model, credits: tier.credits,
      });
      const analysisStartedAt = Date.now();
      try {
        const enhanced = await enhanceAnalysis({
          analysis, company, apiKey: env.OPENAI_API_KEY, safetyIdentifier: userHash, tier: requestedTier, model,
        });
        analysis = { ...enhanced.analysis, creditsCharged: tier.credits };
        await completeAnalysisUsage({ analysisId: analysis.id, ...enhanced.usage });
        await recordAnalysisTelemetrySafely({
          analysisId: analysis.id, userHash, provider: analysisProvider(model), model, tier: requestedTier, status: "completed", errorCode: null,
          durationMs: Date.now() - analysisStartedAt, documentCount: analysis.tender.documents.length,
          documentsRead: analysis.documentCoverage?.filter((document) => document.status === "read").length ?? 0,
          inputTokens: enhanced.usage.inputTokens, cachedInputTokens: enhanced.usage.cachedInputTokens,
          outputTokens: enhanced.usage.outputTokens, costMicrousd: enhanced.usage.costMicrousd,
        });
      } catch (error) {
        await refundAnalysisCredits(user.id, analysis.id, error instanceof Error ? error.name : "unknown");
        await recordAnalysisTelemetrySafely({
          analysisId: analysis.id, userHash, provider: analysisProvider(model), model, tier: requestedTier, status: "failed",
          errorCode: telemetryErrorCode(error), durationMs: Date.now() - analysisStartedAt,
          documentCount: analysis.tender.documents.length, documentsRead: 0,
          inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costMicrousd: 0,
        });
        if (error instanceof OpenAIAnalysisError) {
          const msg = error.message.includes("Баланс") ? error.message : `${error.message} Баланс не змінився — спробуйте пізніше.`;
          throw new HttpError(502, msg);
        }
        throw error;
      }
    }

    if (user) await saveAnalysis(user.id, analysis);
    if (requestedTier === "quick") {
      try { await upsertPublicTenderSummary({ analysis }); } catch (error) { console.error("[public-summary] Write failed", { errorType: error instanceof Error ? error.name : "unknown" }); }
    }
    await writeAuditEvent({
      userId: user?.id, action: "analysis.created", resourceType: "tender",
      resourceId: tender.externalId, ipHash, metadata: { mode: analysis.mode, tier: requestedTier, score: analysis.score },
    });
    return Response.json({ data: analysis, meta: { creditBalance } }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
