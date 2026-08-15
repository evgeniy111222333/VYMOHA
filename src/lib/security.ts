declare global {
  interface SubtleCrypto {
    timingSafeEqual(left: ArrayBuffer, right: ArrayBuffer): boolean;
  }
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  try {
    const requestUrl = new URL(request.url);
    const originUrl = new URL(origin);
    if (originUrl.origin !== requestUrl.origin) throw new SecurityError("Запит із зовнішнього джерела заблоковано.");
  } catch (error) {
    if (error instanceof SecurityError) throw error;
    throw new SecurityError("Недопустиме джерело запиту.");
  }
}

export function assertBodySize(request: Request, maxBytes: number): void {
  const header = request.headers.get("content-length");
  if (!header) return;
  const size = Number(header);
  if (!Number.isFinite(size) || size > maxBytes) throw new SecurityError("Розмір запиту перевищує дозволений ліміт.");
}

export async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Compare secrets without exposing a timing signal. */
export async function timingSafeSecretEqual(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  if (typeof crypto.subtle.timingSafeEqual === "function") {
    return crypto.subtle.timingSafeEqual(leftDigest, rightDigest);
  }
  // Node's WebCrypto shim used in unit tests lacks timingSafeEqual. The
  // digests have a fixed equal length, so this fallback performs every byte
  // comparison before deciding.
  const a = new Uint8Array(leftDigest);
  const b = new Uint8Array(rightDigest);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index]! ^ b[index]!;
  return difference === 0;
}

export function clientAddress(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
}

export function safeFilename(value: string): string {
  const basename = value.split(/[\\/]/).pop() ?? "document";
  return basename.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120) || "document";
}

export function hasAllowedFileSignature(mimeType: string, bytes: ArrayBuffer): boolean {
  const data = new Uint8Array(bytes);
  if (mimeType === "application/pdf") return startsWith(data, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  if (mimeType.includes("officedocument")) return startsWith(data, [0x50, 0x4b, 0x03, 0x04]);
  if (mimeType === "text/plain" || mimeType === "text/csv") {
    return !data.subarray(0, Math.min(data.length, 8_192)).includes(0);
  }
  return false;
}

function startsWith(data: Uint8Array, signature: number[]): boolean {
  return signature.every((value, index) => data[index] === value);
}

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecurityError";
  }
}
