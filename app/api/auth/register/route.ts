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
    if (!await consumeRateLimit(`auth:register:${ipHash}`, 5, 3_600)) throw new HttpError(429, "Забагато спроб. Спробуйте пізніше.");
    const userId = await registerPasswordUser({
      provider: "email", subject: parsed.data.email, displayName: parsed.data.displayName,
      password: parsed.data.password, verified: false,
    });
    const token = await createSession(userId, request);
    await writeAuditEvent({ userId, action: "auth.registered", resourceType: "account", resourceId: userId, ipHash, metadata: { provider: "email" } });
    return Response.json({ data: { redirectTo: "/dashboard" } }, { status: 201, headers: { "set-cookie": sessionCookie(token, request), "cache-control": "no-store" } });
  } catch (error) { return apiError(error); }
}
