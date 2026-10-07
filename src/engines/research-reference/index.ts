export const RESEARCH_REFERENCE_ENGINE_VERSION = "research-reference-v1";

export type DoiResult =
  | { kind: "DOI"; valid: true; normalized: string; url: string }
  | { kind: "DOI"; valid: false; reason: string };

export type IsbnResult =
  | { kind: "ISBN-10"; valid: true; digits: string; isbn13: string }
  | { kind: "ISBN-13"; valid: true; digits: string }
  | { kind: "ISBN-10" | "ISBN-13" | "ISBN"; valid: false; reason: string; digits?: string };

export type PartitaIvaFailureRule = "character" | "length" | "checksum";

interface PartitaIvaBaseResult {
  readonly kind: "PARTITA_IVA";
  readonly normalized: string;
  readonly claim: "formal-only";
  readonly registerVerified: false;
}

export type PartitaIvaResult =
  | (PartitaIvaBaseResult & {
      readonly valid: true;
      readonly checkDigit: string;
      readonly expectedCheckDigit: string;
    })
  | (PartitaIvaBaseResult & {
      readonly valid: false;
      readonly failureRule: PartitaIvaFailureRule;
      readonly reason: string;
      readonly checkDigit?: string;
      readonly expectedCheckDigit?: string;
    });

export type IbanFailureRule = "character" | "prefix" | "country" | "length" | "structure" | "checksum";

export interface ItalianIbanCoordinates {
  readonly cin: string;
  readonly abi: string;
  readonly cab: string;
  readonly account: string;
  readonly structuralOnly: true;
}

interface IbanBaseResult {
  readonly kind: "IBAN";
  readonly normalized: string;
  readonly countryCode: string;
  readonly expectedLength: number | null;
  readonly formatAuthority: "SWIFT IBAN Registry Release 103";
  readonly formatCheckedAt: "2026-09-17";
  readonly claim: "formal-only";
  readonly accountVerified: false;
  readonly italianCoordinates?: ItalianIbanCoordinates;
}

export type IbanResult =
  | (IbanBaseResult & {
      readonly valid: true;
      readonly mod97Remainder: 1;
    })
  | (IbanBaseResult & {
      readonly valid: false;
      readonly failureRule: IbanFailureRule;
      readonly reason: string;
      readonly mod97Remainder?: number;
    });

const IBAN_FORMATS_R103 = {
  DE: { length: 22, bban: /^\d{18}$/u },
  ES: { length: 24, bban: /^\d{20}$/u },
  FR: { length: 27, bban: /^\d{10}[A-Z0-9]{11}\d{2}$/u },
  GB: { length: 22, bban: /^[A-Z]{4}\d{14}$/u },
  IT: { length: 27, bban: /^[A-Z]\d{10}[A-Z0-9]{12}$/u },
  NL: { length: 18, bban: /^[A-Z]{4}\d{10}$/u },
} as const;

type SupportedIbanCountry = keyof typeof IBAN_FORMATS_R103;

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

function stripPartitaIvaPresentation(value: string): string {
  return value
    .trim()
    .replace(/^IT(?=\s|\d)/iu, "")
    .replace(/\s/gu, "");
}

function partitaIvaCheckDigit(firstTen: string): string {
  let sum = 0;
  for (let index = 0; index < 10; index += 1) {
    const digit = Number(firstTen[index] ?? "0");
    if (index % 2 === 0) {
      sum += digit;
      continue;
    }
    const doubled = digit * 2;
    sum += doubled > 9 ? doubled - 9 : doubled;
  }
  return String((10 - (sum % 10)) % 10);
}

export function normalizePartitaIva(value: string): PartitaIvaResult {
  const normalized = stripPartitaIvaPresentation(value);
  const base = {
    kind: "PARTITA_IVA" as const,
    normalized,
    claim: "formal-only" as const,
    registerVerified: false as const,
  };

  if (!/^\d*$/u.test(normalized)) {
    return {
      ...base,
      valid: false,
      failureRule: "character",
      reason: "contains characters other than decimal digits",
    };
  }
  if (normalized.length !== 11) {
    return {
      ...base,
      valid: false,
      failureRule: "length",
      reason: "Italian Partita IVA must contain exactly 11 digits",
    };
  }

  const checkDigit = normalized[10]!;
  const expectedCheckDigit = partitaIvaCheckDigit(normalized.slice(0, 10));
  if (checkDigit !== expectedCheckDigit) {
    return {
      ...base,
      valid: false,
      failureRule: "checksum",
      reason: "check digit mismatch",
      checkDigit,
      expectedCheckDigit,
    };
  }

  return {
    ...base,
    valid: true,
    checkDigit,
    expectedCheckDigit,
  };
}

function normalizeIbanPresentation(value: string): string {
  return value.replace(/\s/gu, "").toUpperCase();
}

function ibanRemainder(normalized: string): number {
  const rearranged = `${normalized.slice(4)}${normalized.slice(0, 4)}`;
  let remainder = 0;
  for (const character of rearranged) {
    const digits = /[A-Z]/u.test(character) ? String(character.charCodeAt(0) - 55) : character;
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder;
}

function italianIbanCoordinates(normalized: string): ItalianIbanCoordinates | undefined {
  if (!normalized.startsWith("IT") || normalized.length !== 27) return undefined;
  return {
    cin: normalized.slice(4, 5),
    abi: normalized.slice(5, 10),
    cab: normalized.slice(10, 15),
    account: normalized.slice(15, 27),
    structuralOnly: true,
  };
}

export function normalizeIban(value: string): IbanResult {
  const normalized = normalizeIbanPresentation(value);
  const countryCode = normalized.slice(0, 2);
  const supported = Object.prototype.hasOwnProperty.call(IBAN_FORMATS_R103, countryCode);
  const format = supported ? IBAN_FORMATS_R103[countryCode as SupportedIbanCountry] : undefined;
  const coordinates = italianIbanCoordinates(normalized);
  const base = {
    kind: "IBAN" as const,
    normalized,
    countryCode,
    expectedLength: format?.length ?? null,
    formatAuthority: "SWIFT IBAN Registry Release 103" as const,
    formatCheckedAt: "2026-09-17" as const,
    claim: "formal-only" as const,
    accountVerified: false as const,
    ...(coordinates === undefined ? {} : { italianCoordinates: coordinates }),
  };

  if (!/^[A-Z0-9]*$/u.test(normalized)) {
    return { ...base, valid: false, failureRule: "character", reason: "IBAN contains characters outside A-Z and 0-9" };
  }
  if (!/^[A-Z]{2}\d{2}/u.test(normalized)) {
    return { ...base, valid: false, failureRule: "prefix", reason: "IBAN must start with a two-letter country code followed by two check digits" };
  }
  if (format === undefined) {
    return { ...base, valid: false, failureRule: "country", reason: `country ${countryCode} is outside the currently supported Release 103 subset` };
  }
  if (normalized.length !== format.length) {
    return { ...base, valid: false, failureRule: "length", reason: `${countryCode} IBAN must contain exactly ${format.length} characters` };
  }
  if (!format.bban.test(normalized.slice(4))) {
    return { ...base, valid: false, failureRule: "structure", reason: `${countryCode} BBAN does not match the supported SWIFT Release 103 structure` };
  }

  const mod97Remainder = ibanRemainder(normalized);
  if (mod97Remainder !== 1) {
    return { ...base, valid: false, failureRule: "checksum", reason: "IBAN MOD-97 check digits do not validate", mod97Remainder };
  }

  return { ...base, valid: true, mod97Remainder: 1 };
}
