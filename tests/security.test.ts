import { describe, expect, it } from "vitest";
import { assertBodySize, assertSameOrigin, clientAddress, hasAllowedFileSignature, safeFilename, SecurityError, sha256 } from "@/src/lib/security";

describe("request security", () => {
  it("blocks cross-origin mutations", () => {
    const request = new Request("https://vymoha.app/api/company", { headers: { origin: "https://attacker.example" } });
    expect(() => assertSameOrigin(request)).toThrow(SecurityError);
  });

  it("allows matching origins and enforces declared body size", () => {
    const okay = new Request("https://vymoha.app/api/company", { headers: { origin: "https://vymoha.app", "content-length": "512" } });
    expect(() => assertSameOrigin(okay)).not.toThrow();
    expect(() => assertBodySize(okay, 1024)).not.toThrow();
    expect(() => assertBodySize(okay, 128)).toThrow(SecurityError);
  });

  it("sanitizes filenames, hashes identifiers, and prefers the Cloudflare address", async () => {
    expect(safeFilename("../секрет<script>.pdf")).toBe("секрет_script_.pdf");
    expect(await sha256("stable")).toMatch(/^[a-f0-9]{64}$/);
    expect(clientAddress(new Request("https://vymoha.app", { headers: { "cf-connecting-ip": "203.0.113.4" } }))).toBe("203.0.113.4");
  });

  it("validates uploaded file signatures instead of trusting MIME alone", () => {
    expect(hasAllowedFileSignature("application/pdf", new TextEncoder().encode("%PDF-1.7\n").buffer)).toBe(true);
    expect(hasAllowedFileSignature("application/pdf", new TextEncoder().encode("<script>alert(1)</script>").buffer)).toBe(false);
    expect(hasAllowedFileSignature("text/csv", new TextEncoder().encode("name,value\nA,1").buffer)).toBe(true);
  });
});
