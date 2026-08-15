import { runtimeEnv } from "@/db/runtime";
import { getCreditPackage } from "@/src/domain/billing/packages";
import { ensureUserAccount } from "@/src/infrastructure/storage/accounts";
import { attachCheckoutSession, createPaymentOrder } from "@/src/infrastructure/storage/billing";
import { apiError, HttpError, requireRequestUser } from "@/src/lib/http";
import { assertBodySize, assertSameOrigin } from "@/src/lib/security";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({ packageId: z.enum(["signal", "team", "scale"]) });

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    assertBodySize(request, 8_000);
    const user = await requireRequestUser(request);
    await ensureUserAccount(user);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) throw new HttpError(422, "Оберіть пакет сигналів.");
    const pack = getCreditPackage(parsed.data.packageId);
    if (!pack) throw new HttpError(404, "Пакет не знайдено.");
    const env = runtimeEnv();
    
    if (!env.MONOBANK_JAR_ID) {
      throw new HttpError(503, "Оплата тимчасово недоступна. Адміністратор має додати MONOBANK_JAR_ID.");
    }
    
    const order = await createPaymentOrder(user.id, pack, "monobank");
    const shortCode = order.id.split("-")[0]!.toUpperCase(); 
    await attachCheckoutSession(order.id, shortCode);
    
    const amountUah = pack.amountMinor / 100;
    const url = `https://send.monobank.ua/jar/${env.MONOBANK_JAR_ID}?a=${amountUah}&text=${shortCode}`;
    
    return Response.json({ data: { url } }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
