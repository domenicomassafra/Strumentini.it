export const RESEARCH_REFERENCE_ENGINE_VERSION = "research-reference-v1";

export type DoiResult =
  | { kind: "DOI"; valid: true; normalized: string; url: string }
  | { kind: "DOI"; valid: false; reason: string };

export type IsbnResult =
  | { kind: "ISBN-10"; valid: true; digits: string; isbn13: string }
  | { kind: "ISBN-13"; valid: true; digits: string }
  | { kind: "ISBN-10" | "ISBN-13" | "ISBN"; valid: false; reason: string; digits?: string };

function stripDoiPresentation(value: string): string | undefined {
  let candidate = value.trim();
  if (/^doi\s*:/iu.test(candidate)) {
    candidate = candidate.replace(/^doi\s*:\s*/iu, "");
  } else if (/^https?:\/\/(?:dx\.)?doi\.org\//iu.test(candidate)) {
    candidate = candidate.replace(/^https?:\/\/(?:dx\.)?doi\.org\//iu, "");
    try {
      candidate = decodeURIComponent(candidate);
    } catch {
      return undefined;
    }
  }
  return candidate.trim();
}

function doiUrl(doi: string): string {
  const encoded = encodeURIComponent(doi)
    .replace(/%2F/giu, "/")
    .replace(/%3A/giu, ":");
  return `https://doi.org/${encoded}`;
}

export function normalizeDoi(value: string): DoiResult {
  const candidate = stripDoiPresentation(value);
  if (candidate === undefined || candidate === "") {
    return { kind: "DOI", valid: false, reason: "invalid DOI syntax" };
  }
  if (!/^10\.\d{4,9}\/.+$/u.test(candidate) || /[\u0000-\u001F\u007F]/u.test(candidate)) {
    return { kind: "DOI", valid: false, reason: "invalid DOI syntax" };
  }
  return {
    kind: "DOI",
    valid: true,
    normalized: candidate,
    url: doiUrl(candidate),
  };
}

function isbn10Valid(digits: string): boolean {
  if (!/^\d{9}[\dX]$/u.test(digits)) return false;
  let sum = 0;
  for (let index = 0; index < 10; index += 1) {
    const character = digits[index];
    if (character === undefined) return false;
    const value = character === "X" ? 10 : Number(character);
    sum += value * (10 - index);
  }
  return sum % 11 === 0;
}

function isbn13CheckDigit(firstTwelve: string): string {
  let sum = 0;
  for (let index = 0; index < 12; index += 1) {
    const value = Number(firstTwelve[index] ?? "0");
    sum += value * (index % 2 === 0 ? 1 : 3);
  }
  return String((10 - (sum % 10)) % 10);
}

function isbn13Valid(digits: string): boolean {
  return /^\d{13}$/u.test(digits) && isbn13CheckDigit(digits.slice(0, 12)) === digits[12];
}

function stripIsbnPresentation(value: string): string {
  return value
    .trim()
    .replace(/^ISBN(?:-(?:10|13))?\s*:?\s*/iu, "")
    .replace(/[ -]/gu, "")
    .toUpperCase();
}

export function normalizeIsbn(value: string): IsbnResult {
  const digits = stripIsbnPresentation(value);
  if (digits.length === 10) {
    if (!/^\d{9}[\dX]$/u.test(digits)) {
      return { kind: "ISBN-10", valid: false, digits, reason: "invalid ISBN syntax" };
    }
    if (!isbn10Valid(digits)) {
      return { kind: "ISBN-10", valid: false, digits, reason: "check digit mismatch" };
    }
    const firstTwelve = `978${digits.slice(0, 9)}`;
    return {
      kind: "ISBN-10",
      valid: true,
      digits,
      isbn13: `${firstTwelve}${isbn13CheckDigit(firstTwelve)}`,
    };
  }

  if (digits.length === 13) {
    if (!/^\d{13}$/u.test(digits)) {
      return { kind: "ISBN-13", valid: false, digits, reason: "invalid ISBN syntax" };
    }
    if (!digits.startsWith("978") && !digits.startsWith("979")) {
      return { kind: "ISBN-13", valid: false, digits, reason: "ISBN-13 prefix must be 978 or 979" };
    }
    if (!isbn13Valid(digits)) {
      return { kind: "ISBN-13", valid: false, digits, reason: "check digit mismatch" };
    }
    return { kind: "ISBN-13", valid: true, digits };
  }

  return { kind: "ISBN", valid: false, reason: "invalid ISBN syntax" };
}
