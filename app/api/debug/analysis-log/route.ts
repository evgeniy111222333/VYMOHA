import { getAnalysisDebugLog } from "@/src/infrastructure/openai/enhancer";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const log = getAnalysisDebugLog();
  return Response.json(
    { count: log.length, entries: log },
    {
      headers: {
        "cache-control": "no-store",
        "content-type": "application/json; charset=utf-8",
      },
    },
  );
}
