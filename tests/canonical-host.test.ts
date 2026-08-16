import { describe, expect, it } from "vitest";
import { canonicalHostRedirectUrl } from "@/src/lib/canonical-host";

describe("canonicalHostRedirectUrl", () => {
  it("keeps the canonical apex host untouched", () => {
    expect(canonicalHostRedirectUrl(new URL("https://vymoha.com/analyze?source=UA-1"))).toBeNull();
  });

  it("redirects www to the apex host preserving path and query", () => {
    const result = canonicalHostRedirectUrl(new URL("https://www.vymoha.com/guides/dokumenty-dlia-uchasti?lang=uk#top"));
    expect(result).toBe("https://vymoha.com/guides/dokumenty-dlia-uchasti?lang=uk#top");
  });

  it("keeps the scheme unchanged (https upgrade happens before in the worker)", () => {
    expect(canonicalHostRedirectUrl(new URL("http://www.vymoha.com/"))).toBe("http://vymoha.com/");
  });

  it("redirects the workers.dev subdomain to the canonical domain", () => {
    expect(canonicalHostRedirectUrl(new URL("https://vymoha.vymoha-platform.workers.dev/api/auth/google/start"))).toBe("https://vymoha.com/api/auth/google/start");
  });

  it("redirects any workers.dev hostname, not just the project one", () => {
    expect(canonicalHostRedirectUrl(new URL("https://anything.workers.dev/x"))).toBe("https://vymoha.com/x");
  });

  it("keeps localhost and other custom hosts untouched", () => {
    expect(canonicalHostRedirectUrl(new URL("http://localhost:3000/"))).toBeNull();
    expect(canonicalHostRedirectUrl(new URL("https://staging.example.com/"))).toBeNull();
  });
});