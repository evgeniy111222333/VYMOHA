import { registerPasswordUser } from "@/src/auth/accounts";
import { verifyPhoneCode } from "@/src/auth/providers/twilio";
import { createSession, sessionCookie } from "@/src/auth/session";
import { phoneVerifySchema } from "@/src/auth/validation";
import { writeAuditEvent } from "@/src/infrastructure/storage/repository";
import { apiError, HttpError } from "@/src/lib/http";
import { assertBodySize, assertSameOrigin, clientAddress, sha256 } from "@/src/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request); assertBodySize(request, 12_000);
    const parsed = phoneVerifySchema.safeParse(await request.json());
    if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message ?? "Перевірте введені дані.");
    if (!await verifyPhoneCode(parsed.data.phone, parsed.data.code)) throw new HttpError(422, "Невірний або прострочений код.");
    const userId = await registerPasswordUser({
      provider: "phone", subject: parsed.data.phone, displayName: parsed.data.displayName,
      password: parsed.data.password, verified: true,
    });
    const token = await createSession(userId, request);
    await writeAuditEvent({
      userId, action: "auth.registered", resourceType: "account", resourceId: userId,
      ipHash: await sha256(clientAddress(request)), metadata: { provider: "phone" },
    });
    return Response.json({ data: { redirectTo: "/dashboard" } }, { status: 201, headers: { "set-cookie": sessionCookie(token, request), "cache-control": "no-store" } });
  } catch (error) { return apiError(error); }
}
