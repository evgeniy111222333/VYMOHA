import { runtimeEnv } from "@/db/runtime";
import { getAnalysisTier, type AnalysisTier } from "@/src/domain/billing/packages";
import { analyzeTender } from "@/src/domain/tender/analyzer";
import { enhanceAnalysis, OpenAIAnalysisError } from "@/src/infrastructure/openai/enhancer";
import { fetchBuyerContext } from "@/src/infrastructure/prozorro/buyer-stats";
import { fetchTender } from "@/src/infrastructure/prozorro/client";
import { ensureUserAccount } from "@/src/infrastructure/storage/accounts";
import { completeAnalysisUsage, refundAnalysisCredits, reserveAnalysisCredits } from "@/src/infrastructure/storage/billing";
import { consumeRateLimit, getCompanyProfile, saveAnalysis, upsertPublicTenderSummary, writeAuditEvent } from "@/src/infrastructure/storage/repository";
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

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    assertBodySize(request, 32_000);
    let rawBody: unknown;
    const rawText = await request.text();
    try {
      rawBody = JSON.parse(rawText);
    } catch (parseError) {
      console.error(`[analyze] JSON parse error: ${parseError}`);
      console.error(`[analyze] raw body (first 500 chars): ${rawText.slice(0, 500)}`);
      console.error(`[analyze] raw body hex (first 40 bytes): ${[...rawText.slice(0, 40)].map(c => c.charCodeAt(0).toString(16).padStart(4, "0")).join(" ")}`);
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
    const allowed = await consumeRateLimit(rate.bucket, rate.limit, rate.window);
    if (!allowed) return Response.json({ error: { message: rate.message } }, { status: 429 });

    const account = user ? await ensureUserAccount(user) : null;
    if (account?.status === "suspended") throw new HttpError(403, "Обліковий запис призупинено. Зверніться до адміністратора.");
    if (requestedTier !== "quick" && !user) throw new HttpError(401, "Увійдіть, щоб запустити повний AI-аналіз.");
    const company = parsed.data.company ?? (user ? await getCompanyProfile(user.id) : undefined) ?? undefined;
    const tender = await fetchTender(parsed.data.source);
    const buyerContext = tender.buyerEdrpou ? await fetchBuyerContext(tender.buyerEdrpou) : undefined;
    let analysis = analyzeTender(tender, company, new Date(), buyerContext, requestedTier);
    let creditBalance = account?.creditBalance;

    if (requestedTier !== "quick" && user) {
      const env = runtimeEnv();
      if (!env.OPENAI_API_KEY) throw new HttpError(503, "Поглиблений аналіз тимчасово недоступний. Спробуйте швидку перевірку.");
      const model = requestedTier === "expert"
        ? env.OPENAI_MODEL_EXPERT ?? "gpt-5.6-sol"
        : env.OPENAI_MODEL_STANDARD ?? "gpt-5.6-terra";
      creditBalance = await reserveAnalysisCredits({
        userId: user.id, analysisId: analysis.id, tier: requestedTier, model, credits: tier.credits,
      });
      try {
        const enhanced = await enhanceAnalysis({
          analysis, company, apiKey: env.OPENAI_API_KEY, safetyIdentifier: await sha256(user.id), tier: requestedTier, model,
        });
        analysis = { ...enhanced.analysis, creditsCharged: tier.credits };
        await completeAnalysisUsage({ analysisId: analysis.id, ...enhanced.usage });
      } catch (error) {
        await refundAnalysisCredits(user.id, analysis.id, error instanceof Error ? error.name : "unknown");
        if (error instanceof OpenAIAnalysisError) {
          const msg = error.message.includes("Баланс") ? error.message : `${error.message} Баланс не змінився — спробуйте пізніше.`;
          throw new HttpError(502, msg);
        }
        throw error;
      }
    }

    if (user) await saveAnalysis(user.id, analysis);
    if (requestedTier === "quick") {
      try { await upsertPublicTenderSummary({ analysis }); } catch (error) { console.error("public summary upsert failed", error); }
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
