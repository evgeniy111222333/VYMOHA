import { ensureUserAccount } from "@/src/infrastructure/storage/accounts";
import { requireAdmin } from "@/src/infrastructure/storage/admin";
import { listAnalysisTelemetry, writeAuditEvent } from "@/src/infrastructure/storage/repository";
import { apiError, requireRequestUser } from "@/src/lib/http";
import { clientAddress, sha256 } from "@/src/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireRequestUser(request);
    await ensureUserAccount(user);
    await requireAdmin(user.id);
    const requestedLimit = Number(new URL(request.url).searchParams.get("limit") ?? "100");
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 250) : 100;
    const entries = await listAnalysisTelemetry(limit);
    await writeAuditEvent({
      userId: user.id,
      action: "diagnostics.view",
      resourceType: "analysis_telemetry",
      ipHash: await sha256(clientAddress(request)),
      metadata: { limit, returned: entries.length },
    });
    return Response.json({
      data: entries.map(({ userHash, analysisId, ...entry }) => ({
        ...entry,
        userRef: userHash.slice(0, 12),
        analysisRef: analysisId.slice(0, 12),
      })),
    }, {
      headers: {
        "cache-control": "private, no-store",
        "content-type": "application/json; charset=utf-8",
        "x-robots-tag": "noindex, nofollow, noarchive",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
