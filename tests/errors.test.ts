import { describe, expect, it } from "vitest";
import { normalizeError, normalizeForFingerprint } from "@/src/services/observability/errors";

describe("error normalization", () => {
  it("extracts name/message/stack from an Error", () => {
    const err = new Error("boom");
    const result = normalizeError(err);
    expect(result.name).toBe("Error");
    expect(result.message).toBe("boom");
    expect(result.stack).toContain("boom");
  });

  it("normalizes a plain string", () => {
    expect(normalizeError("just a string")).toEqual({ name: "Error", message: "just a string" });
  });

  it("normalizes a plain object with name/message/stack", () => {
    const result = normalizeError({ name: "ClientError", message: "x", stack: "stack-trace" });
    expect(result).toEqual({ name: "ClientError", message: "x", stack: "stack-trace" });
  });

  it("normalizes unknown values without throwing", () => {
    expect(normalizeError(null).message).toBe("null");
    expect(normalizeError(undefined).message).toBe("undefined");
    expect(normalizeError(42).message).toBe("42");
  });
});

describe("error fingerprinting", () => {
  it("groups errors that differ only by tender id", () => {
    const a = normalizeForFingerprint("Закупівлю UA-2026-08-16-000286-a не знайдено");
    const b = normalizeForFingerprint("Закупівлю UA-2025-01-01-000001-b не знайдено");
    expect(a).toBe(b);
  });

  it("groups errors that differ only by long numbers", () => {
    const a = normalizeForFingerprint("Помилка 1234567890");
    const b = normalizeForFingerprint("Помилка 9876543210");
    expect(a).toBe(b);
  });

  it("keeps short numbers and text intact", () => {
    expect(normalizeForFingerprint("Помилка 404")).toBe("Помилка 404");
    expect(normalizeForFingerprint("Просто текст")).toBe("Просто текст");
  });
});
