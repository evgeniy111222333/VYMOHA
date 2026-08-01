import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { estimateOpenAICostMicrousd } from "@/src/domain/billing/cost";
import { CREDIT_PACKAGES, getCreditPackage } from "@/src/domain/billing/packages";
import { verifyStripeSignature } from "@/src/infrastructure/payments/stripe";

describe("AI billing", () => {
  it("estimates uncached model usage in microdollars", () => {
    expect(estimateOpenAICostMicrousd({ model: "gpt-5.6-sol", inputTokens: 1_000, outputTokens: 100 })).toBe(8_000);
  });

  it("prices cached input at the lower rate", () => {
    expect(estimateOpenAICostMicrousd({ model: "gpt-5.6-terra", inputTokens: 1_000, cachedInputTokens: 400, outputTokens: 100 })).toBe(3_100);
  });

  it("keeps package ids unique and amounts positive", () => {
    expect(new Set(CREDIT_PACKAGES.map((item) => item.id)).size).toBe(CREDIT_PACKAGES.length);
    expect(CREDIT_PACKAGES.every((item) => item.credits > 0 && item.amountMinor > 0)).toBe(true);
    expect(getCreditPackage("team")?.credits).toBe(400);
  });
});

describe("Stripe webhook verification", () => {
  const secret = "whsec_test_secret";
  const timestamp = 1_800_000_000;
  const payload = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
  const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");

  it("accepts a valid recent signature", async () => {
    await expect(verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret, timestamp + 30)).resolves.toBe(true);
  });

  it("rejects tampering and stale events", async () => {
    await expect(verifyStripeSignature(`${payload}x`, `t=${timestamp},v1=${signature}`, secret, timestamp + 30)).resolves.toBe(false);
    await expect(verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret, timestamp + 301)).resolves.toBe(false);
  });
});
