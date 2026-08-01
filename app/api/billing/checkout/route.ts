import { runtimeEnv } from "@/db/runtime";
import { getCreditPackage } from "@/src/domain/billing/packages";
import { createStripeCheckout } from "@/src/infrastructure/payments/stripe";
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
    const user = requireRequestUser(request);
    await ensureUserAccount(user);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) throw new HttpError(422, "Оберіть пакет кредитів.");
    const pack = getCreditPackage(parsed.data.packageId);
    if (!pack) throw new HttpError(404, "Пакет не знайдено.");
    const env = runtimeEnv();
    if (!env.STRIPE_SECRET_KEY) throw new HttpError(503, "Оплата ще не підключена. Адміністратор має додати Stripe-ключі.");
    const order = await createPaymentOrder(user.id, pack);
    const baseUrl = env.APP_BASE_URL?.replace(/\/$/, "") || new URL(request.url).origin;
    const checkout = await createStripeCheckout({
      secretKey: env.STRIPE_SECRET_KEY, baseUrl, orderId: order.id, userId: user.id, email: user.email, pack,
    });
    await attachCheckoutSession(order.id, checkout.id);
    return Response.json({ data: checkout }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
