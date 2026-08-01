import { safeReturnPath } from "@/app/auth";
import { beginGoogleFlow } from "@/src/auth/providers/google";
import { HttpError } from "@/src/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const flow = await beginGoogleFlow(request);
    const response = new Response(null, { status: 302, headers: { location: flow.url } });
    appendCookie(response.headers, "vymoha_oauth_state", flow.state, request, 600);
    appendCookie(response.headers, "vymoha_oauth_verifier", flow.verifier, request, 600);
    appendCookie(response.headers, "vymoha_oauth_return", safeReturnPath(url.searchParams.get("return_to")), request, 600);
    return response;
  } catch (error) {
    const message = error instanceof HttpError ? "google_unavailable" : "google_failed";
    return new Response(null, { status: 302, headers: { location: new URL(`/auth/sign-in?error=${message}`, request.url).toString() } });
  }
}

function appendCookie(headers: Headers, name: string, value: string, request: Request, maxAge: number): void {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  headers.append("set-cookie", `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`);
}
