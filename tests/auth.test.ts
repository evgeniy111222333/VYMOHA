import { describe, expect, it } from "vitest";
import { hashPassword, randomToken, sha256Base64Url, verifyPassword } from "@/src/auth/password";
import { emailRegistrationSchema, normalizeIdentifier, phoneStartSchema } from "@/src/auth/validation";

describe("password authentication", () => {
  it("hashes and verifies without storing the password", async () => {
    const password = "TenderSecure2026";
    const secret = await hashPassword(password);
    expect(secret.hash).not.toContain(password);
    expect(await verifyPassword(password, secret.hash, secret.salt)).toBe(true);
    expect(await verifyPassword("WrongPassword2026", secret.hash, secret.salt)).toBe(false);
  });

  it("uses unique salts and URL-safe random tokens", async () => {
    const first = await hashPassword("TenderSecure2026");
    const second = await hashPassword("TenderSecure2026");
    expect(first.salt).not.toBe(second.salt);
    expect(first.hash).not.toBe(second.hash);
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await sha256Base64Url("verifier")).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("authentication validation", () => {
  it("normalizes email and Ukrainian phone identifiers", () => {
    expect(normalizeIdentifier(" USER@Example.COM ")).toEqual({ provider: "email", subject: "user@example.com" });
    expect(normalizeIdentifier("+380 (67) 123-45-67")).toEqual({ provider: "phone", subject: "+380671234567" });
  });

  it("rejects weak credentials and non-E.164 phone numbers", () => {
    expect(emailRegistrationSchema.safeParse({ displayName: "Олена", email: "user@example.com", password: "short" }).success).toBe(false);
    expect(phoneStartSchema.safeParse({ phone: "0671234567" }).success).toBe(false);
    expect(phoneStartSchema.safeParse({ phone: "+380671234567" }).success).toBe(true);
  });
});
