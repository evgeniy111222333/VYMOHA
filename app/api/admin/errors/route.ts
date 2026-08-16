import { ensureUserAccount } from "@/src/infrastructure/storage/accounts";
import { requireAdmin } from "@/src/infrastructure/storage/admin";
import { listErrorEvents } from "@/src/services/observability/errors";
import { apiError, requireRequestUser } from "@/src/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireRequestUser(request);
    await ensureUserAccount(user);
    await requireAdmin(user.id);

    const requestedLimit = Number(new URL(request.url).searchParams.get("limit") ?? "100");
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 250) : 100;
    const events = await listErrorEvents(limit);

    return Response.json({ data: events }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
