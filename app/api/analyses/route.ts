import { listAnalyses } from "@/src/infrastructure/storage/repository";
import { apiError, requireRequestUser } from "@/src/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const user = requireRequestUser(request);
    return Response.json({ data: await listAnalyses(user.id) }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
