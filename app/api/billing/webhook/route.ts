import { runtimeEnv } from "@/db/runtime";
import { verifyStripeSignature, type StripeEvent } from "@/src/infrastructure/payments/stripe";
import { fulfillPayment } from "@/src/infrastructure/storage/billing";
import { writeAuditEvent } from "@/src/infrastructure/storage/repository";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const secret = runtimeEnv().STRIPE_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: { message: "Webhook не налаштовано." } }, { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: { message: "Відсутній підпис." } }, { status: 400 });
  const rawBody = await request.text();
  if (!(await verifyStripeSignature(rawBody, signature, secret))) {
    return Response.json({ error: { message: "Некоректний підпис." } }, { status: 400 });
  }
  const event = JSON.parse(rawBody) as StripeEvent;
  if (event.type === "checkout.session.completed") {
    const session = event.data?.object;
    const orderId = session?.metadata?.order_id;
    if (session?.id && orderId && (session.payment_status === "paid" || session.payment_status === "no_payment_required")) {
      const fulfilled = await fulfillPayment(orderId, session.id, session.payment_intent ?? undefined);
      await writeAuditEvent({
        userId: session.metadata?.user_id, action: fulfilled ? "payment.fulfilled" : "payment.duplicate",
        resourceType: "payment_order", resourceId: orderId, metadata: { stripeEventId: event.id, sessionId: session.id },
      });
    }
  }
  return Response.json({ received: true });
}
