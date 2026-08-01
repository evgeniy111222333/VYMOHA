import { sendPhoneCode } from "@/src/auth/providers/twilio";
import { phoneStartSchema } from "@/src/auth/validation";
import { consumeRateLimit } from "@/src/infrastructure/storage/repository";
import { apiError, HttpError } from "@/src/lib/http";
import { assertBodySize, assertSameOrigin, clientAddress, sha256 } from "@/src/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request); assertBodySize(request, 4_000);
    const parsed = phoneStartSchema.safeParse(await request.json());
    if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message ?? "Перевірте номер.");
    const ipHash = await sha256(clientAddress(request));
    const phoneHash = await sha256(parsed.data.phone);
    if (!await consumeRateLimit(`auth:phone:${ipHash}:${phoneHash}`, 4, 3_600)) throw new HttpError(429, "Забагато запитів коду. Спробуйте пізніше.");
    await sendPhoneCode(parsed.data.phone);
    return Response.json({ data: { sent: true } }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return apiError(error); }
}
