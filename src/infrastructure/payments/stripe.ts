import type { CreditPackage } from "@/src/domain/billing/packages";
import { HttpError } from "@/src/lib/http";

type StripeCheckoutResponse = { id?: string; url?: string; error?: { message?: string } };

export type StripeCheckoutSession = { id: string; url: string };

export async function createStripeCheckout(input: {
  secretKey: string;
  baseUrl: string;
  orderId: string;
  userId: string;
  email: string;
  pack: CreditPackage;
}): Promise<StripeCheckoutSession> {
  const body = new URLSearchParams({
    mode: "payment",
    client_reference_id: input.orderId,
    customer_email: input.email,
    success_url: `${input.baseUrl}/dashboard/billing?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.baseUrl}/dashboard/billing?payment=cancelled`,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": input.pack.currency,
    "line_items[0][price_data][unit_amount]": String(input.pack.amountMinor),
    "line_items[0][price_data][product_data][name]": `Вимога — ${input.pack.credits} сигналів`,
    "line_items[0][price_data][product_data][description]": input.pack.description,
    "metadata[order_id]": input.orderId,
    "metadata[user_id]": input.userId,
    "metadata[credits]": String(input.pack.credits),
    "payment_intent_data[metadata][order_id]": input.orderId,
    "payment_intent_data[metadata][user_id]": input.userId,
  });
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { authorization: `Bearer ${input.secretKey}`, "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json() as StripeCheckoutResponse;
  if (!response.ok || !payload.id || !payload.url) throw new HttpError(502, payload.error?.message ?? "Stripe не створив платіжну сесію.");
  return { id: payload.id, url: payload.url };
}

export async function verifyStripeSignature(rawBody: string, signatureHeader: string, webhookSecret: string, nowSeconds = Math.floor(Date.now() / 1000)): Promise<boolean> {
  const fields = signatureHeader.split(",").map((item) => item.trim());
  const timestamp = Number(fields.find((item) => item.startsWith("t="))?.slice(2));
  const signatures = fields.filter((item) => item.startsWith("v1=")).map((item) => item.slice(3));
  if (!Number.isFinite(timestamp) || signatures.length === 0 || Math.abs(nowSeconds - timestamp) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(webhookSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`));
  const expected = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return signatures.some((candidate) => constantTimeEqual(candidate, expected));
}

export type StripeEvent = {
  id: string;
  type: string;
  data?: { object?: {
    id?: string; payment_status?: string; payment_intent?: string | null;
    metadata?: Record<string, string | undefined>;
  } };
};

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}
