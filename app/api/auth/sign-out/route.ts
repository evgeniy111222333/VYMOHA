import { clearSessionCookie, revokeRequestSession } from "@/src/auth/session";
import { assertSameOrigin } from "@/src/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  assertSameOrigin(request);
  await revokeRequestSession(request);
  return new Response(null, {
    status: 303,
    headers: { location: "/", "set-cookie": clearSessionCookie(request), "cache-control": "no-store" },
  });
}
