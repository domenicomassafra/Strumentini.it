export interface ParsedUrl {
  href: string;
  origin: string;
  pathname: string;
  query: Array<[string, string]>;
  hash: string;
}

const TRACKING_KEYS = new Set([
  "dclid",
  "fbclid",
  "gclid",
  "gbraid",
  "mc_cid",
  "mc_eid",
  "msclkid",
  "wbraid",
  "_hsenc",
  "_hsmi",
]);

function asUrl(input: string): URL {
  return new URL(input);
}

export function parseUrl(input: string): ParsedUrl {
  const url = asUrl(input);
  return {
    href: url.href,
    origin: url.origin,
    pathname: url.pathname,
    query: Array.from(url.searchParams.entries()),
    hash: url.hash,
  };
}

export function normalizeUrl(input: string): string {
  const url = asUrl(input);
  url.searchParams.sort();
  return url.href;
}

export function cleanTrackingUrl(input: string): string {
  const url = asUrl(input);
  const keys = new Set(Array.from(url.searchParams.keys()));
  for (const key of keys) {
    const normalized = key.toLowerCase();
    if (normalized.startsWith("utm_") || TRACKING_KEYS.has(normalized)) {
      url.searchParams.delete(key);
    }
  }
  return url.href;
}
