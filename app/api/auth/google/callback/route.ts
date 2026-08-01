import { upsertGoogleUser } from "@/src/auth/accounts";
import { finishGoogleFlow } from "@/src/auth/providers/google";
import { createSession, readCookie, sessionCookie } from "@/src/auth/session";
import { writeAuditEvent } from "@/src/infrastructure/storage/repository";
import { clientAddress, sha256 } from "@/src/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const cookieHeader = request.headers.get("cookie");
  const state = url.searchParams.get("state");
  const expectedState = readCookie(cookieHeader, "vymoha_oauth_state");
  const verifier = readCookie(cookieHeader, "vymoha_oauth_verifier");
  const returnTo = readCookie(cookieHeader, "vymoha_oauth_return") ?? "/dashboard";
  try {
    const code = url.searchParams.get("code");
    if (!code || !state || !expectedState || state !== expectedState || !verifier) throw new Error("invalid oauth state");
    const profile = await finishGoogleFlow(request, code, verifier);
    const userId = await upsertGoogleUser(profile);
    const token = await createSession(userId, request);
    await writeAuditEvent({
      userId, action: "auth.signed_in", resourceType: "session", ipHash: await sha256(clientAddress(request)),
      metadata: { provider: "google" },
    });
    const response = new Response(null, { status: 303, headers: { location: new URL(returnTo, request.url).toString() } });
    response.headers.append("set-cookie", sessionCookie(token, request));
    clearOAuthCookies(response.headers, request);
    return response;
  } catch {
    const response = new Response(null, { status: 303, headers: { location: new URL("/auth/sign-in?error=google_failed", request.url).toString() } });
    clearOAuthCookies(response.headers, request);
    return response;
  }
}

function clearOAuthCookies(headers: Headers, request: Request): void {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  for (const name of ["vymoha_oauth_state", "vymoha_oauth_verifier", "vymoha_oauth_return"]) {
    headers.append("set-cookie", `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
  }
}
