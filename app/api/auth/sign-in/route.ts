import { authenticatePassword } from "@/src/auth/accounts";
import { createSession, sessionCookie } from "@/src/auth/session";
import { signInSchema } from "@/src/auth/validation";
import { consumeRateLimit, writeAuditEvent } from "@/src/infrastructure/storage/repository";
import { apiError, HttpError } from "@/src/lib/http";
import { assertBodySize, assertSameOrigin, clientAddress, sha256 } from "@/src/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request); assertBodySize(request, 12_000);
    const parsed = signInSchema.safeParse(await request.json());
    if (!parsed.success) throw new HttpError(422, "Вкажіть пошту або номер і пароль.");
    
    const ipHash = await sha256(clientAddress(request));
    if (!await consumeRateLimit(`auth:signin:${ipHash}`, 30, 900)) throw new HttpError(429, "Забагато спроб з цієї мережі. Спробуйте через 15 хвилин.");
    
    const accountHash = await sha256(parsed.data.identifier.toLowerCase());
    if (!await consumeRateLimit(`auth:signin:account:${accountHash}`, 5, 900)) throw new HttpError(429, "Забагато спроб входу. Спробуйте через 15 хвилин.");
    
    const userId = await authenticatePassword(parsed.data.identifier, parsed.data.password);
    const token = await createSession(userId, request);
    await writeAuditEvent({ userId, action: "auth.signed_in", resourceType: "session", ipHash, metadata: { provider: "password" } });
    return Response.json({ data: { redirectTo: "/dashboard" } }, { headers: { "set-cookie": sessionCookie(token, request), "cache-control": "no-store" } });
  } catch (error) { return apiError(error); }
}
