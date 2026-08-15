import { runtimeEnv } from "@/db/runtime";
import { fulfillMonobankPayment } from "@/src/infrastructure/storage/billing";
import { apiError, HttpError } from "@/src/lib/http";
import { assertBodySize, timingSafeSecretEqual } from "@/src/lib/security";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Minimal schema for Monobank statement item
const monobankWebhookSchema = z.object({
  type: z.literal("StatementItem"),
  data: z.object({
    statementItem: z.object({
      id: z.string(),
      amount: z.number(), // in kopecks
      ccy: z.number(), // ISO 4217 numeric code; UAH is 980
      comment: z.string().optional(),
    }).passthrough(),
  }).passthrough(),
});

// Monobank verifies a newly configured webhook with GET and requires HTTP 200.
export function GET(): Response {
  return new Response("OK", { status: 200 });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const env = runtimeEnv();
    const url = new URL(request.url);
    const secret = url.searchParams.get("secret");

    if (!env.MONOBANK_WEBHOOK_SECRET || !secret || !(await timingSafeSecretEqual(secret, env.MONOBANK_WEBHOOK_SECRET))) {
      throw new HttpError(401, "Invalid webhook secret");
    }

    assertBodySize(request, 32_000);
    const body = await request.json();
    const parsed = monobankWebhookSchema.safeParse(body);
    
    if (!parsed.success) {
      // Monobank might send ping/verification requests, return 200 so they don't disable the webhook
      return new Response("OK", { status: 200 });
    }

    const { statementItem } = parsed.data.data;

    // Only process incoming funds
    if (statementItem.amount <= 0 || statementItem.ccy !== 980 || !statementItem.comment) {
      return new Response("Ignored (negative amount or no comment)", { status: 200 });
    }

    const shortCode = statementItem.comment.trim().toUpperCase();
    
    if (shortCode.length < 8) {
      return new Response("Ignored (comment too short to be an order code)", { status: 200 });
    }

    try {
      const result = await fulfillMonobankPayment({
        sessionId: shortCode,
        paymentId: statementItem.id,
        amountMinor: statementItem.amount,
        currencyCode: statementItem.ccy,
      });
      if (result !== "fulfilled") return new Response(`Ignored (${result})`, { status: 200 });
    } catch (e) {
      console.error("Monobank fulfillment error:", e);
      // Return 200 to prevent monobank from retrying endlessly if the error is deterministic (e.g. invalid code format)
      return new Response("OK", { status: 200 });
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    return apiError(error);
  }
}
