import { registerPasswordUser } from "@/src/auth/accounts";
import { createSession, sessionCookie } from "@/src/auth/session";
import { emailRegistrationSchema } from "@/src/auth/validation";
import { consumeRateLimit, writeAuditEvent } from "@/src/infrastructure/storage/repository";
import { apiError, HttpError } from "@/src/lib/http";
import { assertBodySize, assertSameOrigin, clientAddress, sha256 } from "@/src/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request); assertBodySize(request, 16_000);
    const parsed = emailRegistrationSchema.safeParse(await request.json());
    if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message ?? "Перевірте введені дані.");
    
    const ipHash = await sha256(clientAddress(request));
    const ipLimit = await consumeRateLimit(`auth:register:${ipHash}`, 20, 3_600);
    if (!ipLimit.allowed) throw new HttpError(429, "Забагато спроб реєстрації. Спробуйте пізніше.", undefined, { "Retry-After": String(Math.max(1, ipLimit.resetAt - Math.floor(Date.now() / 1000))) });
    
    const accountHash = await sha256(parsed.data.email.toLowerCase());
    const accountLimit = await consumeRateLimit(`auth:register:account:${accountHash}`, 5, 3_600);
    if (!accountLimit.allowed) throw new HttpError(429, "Забагато спроб. Спробуйте пізніше.", undefined, { "Retry-After": String(Math.max(1, accountLimit.resetAt - Math.floor(Date.now() / 1000))) });

    const legacyUserId = request.headers.get("oai-authenticated-user-email")?.toLowerCase() === parsed.data.email
      ? request.headers.get("oai-authenticated-user-id") ?? undefined
      : undefined;
    const userId = await registerPasswordUser({
      provider: "email", subject: parsed.data.email, displayName: parsed.data.displayName,
      password: parsed.data.password, verified: Boolean(legacyUserId), claimUserId: legacyUserId,
    });
    const token = await createSession(userId, request);
    await writeAuditEvent({ userId, action: "auth.registered", resourceType: "account", resourceId: userId, ipHash, metadata: { provider: "email" } });
    return Response.json({ data: { redirectTo: "/dashboard" } }, { status: 201, headers: { "set-cookie": sessionCookie(token, request), "cache-control": "no-store" } });
  } catch (error) { return apiError(error); }
}
