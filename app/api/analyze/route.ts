import { runtimeEnv } from "@/db/runtime";
import { analyzeTender } from "@/src/domain/tender/analyzer";
import { enhanceAnalysis } from "@/src/infrastructure/openai/enhancer";
import { fetchTender } from "@/src/infrastructure/prozorro/client";
import { consumeRateLimit, getCompanyProfile, saveAnalysis, writeAuditEvent } from "@/src/infrastructure/storage/repository";
import { apiError, requestUser } from "@/src/lib/http";
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
    const ipHash = await sha256(clientAddress(request));
    const allowed = await consumeRateLimit(`analyze:${user?.id ?? ipHash}`, user ? 30 : 8, 3_600);
    if (!allowed) return Response.json({ error: { message: "Ліміт аналізів вичерпано. Спробуйте пізніше." } }, { status: 429 });

    const company = parsed.data.company ?? (user ? await getCompanyProfile(user.id) : undefined) ?? undefined;
    const tender = await fetchTender(parsed.data.source);
    let analysis = analyzeTender(tender, company);

    if (parsed.data.deepAnalysis && user) {
      const env = runtimeEnv();
      analysis = await enhanceAnalysis(
        analysis,
        env.OPENAI_API_KEY,
        await sha256(user.id),
        env.OPENAI_MODEL ?? "gpt-5.6-terra",
      );
    }

    if (user) await saveAnalysis(user.id, analysis);
    await writeAuditEvent({
      userId: user?.id, action: "analysis.created", resourceType: "tender",
      resourceId: tender.externalId, ipHash, metadata: { mode: analysis.mode, score: analysis.score },
    });
    return Response.json({ data: analysis }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
