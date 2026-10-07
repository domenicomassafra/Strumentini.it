const ITALIAN_LOCALE = "it-IT";

export const RESULT_LABELS_IT = {
  result: "Risultato",
  details: "Dettaglio",
  assumptions: "Ipotesi usate",
  provenance: "Provenienza",
  before: "Prima",
  after: "Dopo",
  bytes: "Dimensione",
  completed: "Completati",
  failed: "Falliti",
} as const;

export interface ResultNumberOptions {
  readonly minimumFractionDigits?: number;
  readonly maximumFractionDigits?: number;
}

export function formatResultNumber(value: number, options: ResultNumberOptions = {}): string {
  if (!Number.isFinite(value)) throw new RangeError("Result number must be finite.");
  return new Intl.NumberFormat(ITALIAN_LOCALE, {
    minimumFractionDigits: options.minimumFractionDigits,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
    useGrouping: true,
  }).format(value);
}

export function formatResultCurrency(value: number, currency = "EUR"): string {
  if (!Number.isFinite(value)) throw new RangeError("Currency value must be finite.");
  return new Intl.NumberFormat(ITALIAN_LOCALE, {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
    useGrouping: "always",
  }).format(value);
}

export function formatResultDate(
  value: Date | string,
  options: { readonly timeZone?: string; readonly includeTime?: boolean } = {},
): string {
  const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value)
    ? new Date(`${value}T00:00:00.000Z`)
    : value instanceof Date
      ? new Date(value.getTime())
      : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new RangeError("Result date must be valid.");
  const dateOnlyInput = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value);
  return new Intl.DateTimeFormat(ITALIAN_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(options.includeTime === true ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: options.timeZone ?? (dateOnlyInput ? "UTC" : "Europe/Rome"),
  }).format(date);
}

const BYTE_UNITS = ["B", "kB", "MB", "GB", "TB"] as const;

export function formatResultBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) throw new RangeError("Byte count must be a finite non-negative number.");
  if (bytes < 1000) return `${formatResultNumber(bytes, { maximumFractionDigits: 0 })} B`;
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1000 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1000;
    unitIndex += 1;
  }
  return `${formatResultNumber(value, { maximumFractionDigits: value < 10 ? 2 : 1 })} ${BYTE_UNITS[unitIndex]}`;
}

export function formatResultCount(count: number, singular: string, plural: string): string {
  if (!Number.isInteger(count) || count < 0) throw new RangeError("Count must be a non-negative integer.");
  return `${formatResultNumber(count, { maximumFractionDigits: 0 })} ${count === 1 ? singular : plural}`;
}

export function formatResultUnit(value: number, unit: string, options: ResultNumberOptions = {}): string {
  const normalizedUnit = unit.trim();
  if (normalizedUnit === "") throw new TypeError("Unit label is required.");
  return `${formatResultNumber(value, options)} ${normalizedUnit}`;
}
