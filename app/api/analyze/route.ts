import { runtimeEnv } from "@/db/runtime";
import { getAnalysisTier, type AnalysisTier } from "@/src/domain/billing/packages";
import { analyzeTender } from "@/src/domain/tender/analyzer";
import { enhanceAnalysis, OpenAIAnalysisError } from "@/src/infrastructure/openai/enhancer";
import { fetchTender } from "@/src/infrastructure/prozorro/client";
import { ensureUserAccount } from "@/src/infrastructure/storage/accounts";
import { completeAnalysisUsage, refundAnalysisCredits, reserveAnalysisCredits } from "@/src/infrastructure/storage/billing";
import { consumeRateLimit, getCompanyProfile, saveAnalysis, writeAuditEvent } from "@/src/infrastructure/storage/repository";
import { apiError, HttpError, requestUser } from "@/src/lib/http";
import { assertBodySize, assertSameOrigin, clientAddress, sha256 } from "@/src/lib/security";
import { analyzeRequestSchema } from "@/src/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    assertBodySize(request, 32_000);
    const parsed = analyzeRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: { message: "Перевірте введені дані.", details: parsed.error.issues } }, { status: 422 });
    }

    const user = requestUser(request);
    const requestedTier: AnalysisTier = parsed.data.analysisTier ?? (parsed.data.deepAnalysis ? "deep" : "quick");
    const tier = getAnalysisTier(requestedTier);
    const ipHash = await sha256(clientAddress(request));
    const allowed = await consumeRateLimit(`analyze:${user?.id ?? ipHash}`, user ? 30 : 8, 3_600);
    if (!allowed) return Response.json({ error: { message: "Ліміт аналізів вичерпано. Спробуйте пізніше." } }, { status: 429 });

    const account = user ? await ensureUserAccount(user) : null;
    if (account?.status === "suspended") throw new HttpError(403, "Обліковий запис призупинено. Зверніться до адміністратора.");
    if (requestedTier !== "quick" && !user) throw new HttpError(401, "Увійдіть, щоб запустити повний AI-аналіз.");
    const company = parsed.data.company ?? (user ? await getCompanyProfile(user.id) : undefined) ?? undefined;
    const tender = await fetchTender(parsed.data.source);
    let analysis = analyzeTender(tender, company);
    analysis.analysisTier = "quick";
    let creditBalance = account?.creditBalance;

    if (requestedTier !== "quick" && user) {
      const env = runtimeEnv();
      if (!env.OPENAI_API_KEY) throw new HttpError(503, "AI-аналіз ще не підключено: адміністратор має додати OpenAI API key.");
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
        if (error instanceof OpenAIAnalysisError) throw new HttpError(502, "AI не завершив звіт. Кредити повернено на баланс.");
        throw error;
      }
    }

    if (user) await saveAnalysis(user.id, analysis);
    await writeAuditEvent({
      userId: user?.id, action: "analysis.created", resourceType: "tender",
      resourceId: tender.externalId, ipHash, metadata: { mode: analysis.mode, score: analysis.score },
    });
    return Response.json({ data: analysis, meta: { creditBalance } }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
