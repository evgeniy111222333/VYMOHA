import { runtimeEnv } from "@/db/runtime";
import { HttpError } from "@/src/lib/http";
import { randomToken, sha256Base64Url } from "../password";

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export type GoogleFlow = { url: string; state: string; verifier: string };

export function googleConfigured(): boolean {
  const env = runtimeEnv();
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export async function beginGoogleFlow(request: Request): Promise<GoogleFlow> {
  const env = runtimeEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) throw new HttpError(503, "Вхід через Google тимчасово недоступний.");
  const state = randomToken(24);
  const verifier = randomToken(48);
  const redirectUri = googleRedirectUri(request);
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: await sha256Base64Url(verifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return { url: url.toString(), state, verifier };
}

export async function finishGoogleFlow(request: Request, code: string, verifier: string): Promise<{
  subject: string; email: string; emailVerified: boolean; name: string; picture?: string | null;
}> {
  const env = runtimeEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) throw new HttpError(503, "Вхід через Google тимчасово недоступний.");
  const tokenResponse = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: googleRedirectUri(request),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  const tokens = await tokenResponse.json() as { access_token?: string };
  if (!tokenResponse.ok || !tokens.access_token) throw new HttpError(401, "Google не підтвердив вхід. Спробуйте ще раз.");
  const profileResponse = await fetch(USERINFO_URL, { headers: { authorization: `Bearer ${tokens.access_token}` } });
  const profile = await profileResponse.json() as { sub?: string; email?: string; email_verified?: boolean; name?: string; picture?: string };
  if (!profileResponse.ok || !profile.sub || !profile.email) throw new HttpError(401, "Не вдалося отримати профіль Google.");
  return {
    subject: profile.sub,
    email: profile.email.toLowerCase(),
    emailVerified: profile.email_verified === true,
    name: profile.name?.trim() || profile.email,
    picture: profile.picture ?? null,
  };
}

function googleRedirectUri(request: Request): string {
  const base = runtimeEnv().APP_BASE_URL?.replace(/\/$/, "") || new URL(request.url).origin;
  return `${base}/api/auth/google/callback`;
}
