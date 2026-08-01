import { describe, expect, it } from "vitest";
import { extractTenderReference } from "@/src/infrastructure/prozorro/client";

describe("Prozorro reference parsing", () => {
  it("extracts a procurement id from a full URL", () => {
    expect(extractTenderReference("https://prozorro.gov.ua/uk/tender/UA-2026-08-01-000463-a"))
      .toBe("UA-2026-08-01-000463-A");
  });

  it("accepts normalized internal ids", () => {
    expect(extractTenderReference("ABCDEF0123456789ABCDEF0123456789"))
      .toBe("abcdef0123456789abcdef0123456789");
  });

  it("rejects arbitrary URLs and text", () => {
    expect(() => extractTenderReference("https://evil.example/tender/123")).toThrow(/UA-2026/);
  });
});
