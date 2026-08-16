export const CANONICAL_HOST = "vymoha.com";

export function canonicalHostRedirectUrl(url: URL): string | null {
  if (url.hostname === `www.${CANONICAL_HOST}` || url.hostname.endsWith(".workers.dev")) {
    url.hostname = CANONICAL_HOST;
    return url.href;
  }
  return null;
}