import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { extractTextFromWordDoc, isWordBinary } from "@/src/infrastructure/openai/doc-extract";

const FIXTURE_PATH = fileURLToPath(new URL("./fixtures/prozorro-bidding-sample.doc", import.meta.url));

describe("Word 97 .doc text extraction", () => {
  it("extracts readable Ukrainian text from a real Prozorro bidding document", () => {
    const buffer = readFileSync(FIXTURE_PATH);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    expect(isWordBinary(arrayBuffer)).toBe(true);

    const text = extractTextFromWordDoc(arrayBuffer);
    expect(text).not.toBeNull();
    expect(text!.length).toBeGreaterThan(5_000);
    expect(text!).toMatch(/[\u0400-\u04FF]/);
    // Real bidding document content: procedure header, legal references.
    expect(text!).toMatch(/ТЕНДЕРНА ДОКУМЕНТАЦІЯ/i);
    expect(text!).toMatch(/договір/i);
    expect(text!).not.toMatch(/\u0000/);
  });

  it("returns null for non-OLE payloads", () => {
    expect(extractTextFromWordDoc(new TextEncoder().encode("just plain text, definitely not a doc").buffer as ArrayBuffer)).toBeNull();
  });
});
