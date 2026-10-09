/**
 * #126 local cents-only VAT arithmetic. Until #117 has a complete year and
 * transaction-scope source pack, *every* official/year preset fails closed.
 * Custom rate is arithmetic supplied by the user, never tax classification.
 */
export type VatRate126 =
  | { readonly kind: "custom"; readonly percent: string }
  | { readonly kind: "preset"; readonly taxYear: number; readonly id: string };

export interface VatInput126 {
  readonly operation: "add" | "scorporo";
  /** Exact integer cents for net when adding, or gross when scorporing. */
  readonly amountCents: number;
  readonly rate: VatRate126;
}

const RATE_SCALE = 1_000_000n; // 100 * 10^4; up to four rate decimal places
const MAX_INPUT_CENTS = 1_000_000_000_000;

function roundedDivision(numerator: bigint, divisor: bigint): bigint {
  return (numerator + divisor / 2n) / divisor; // nonnegative half-up
}

function customRateUnits(percent: string): bigint {
  if (typeof percent !== "string") throw new Error("VAT126_INVALID_RATE: expected decimal percent as text");
  const match = /^(0|[1-9]\d{0,2})(?:[.,](\d{1,4}))?$/u.exec(percent.trim());
  if (!match) throw new Error("VAT126_INVALID_RATE: percent must have at most 4 decimal places");
  const scaled = BigInt(match[1]!) * 10000n + BigInt((match[2] ?? "").padEnd(4, "0") || "0");
  if (scaled > RATE_SCALE) throw new Error("VAT126_INVALID_RATE: custom rate outside 0–100 percent");
  return scaled;
}

/** Deliberate guard: reference mentions of 4/5/10/22 are NOT preset authorization. */
export function getVatPreset126(taxYear: number, presetId: string): never {
  throw new Error(`VAT126_UNSOURCED_PRESET: ${taxYear}/${presetId}; complete period-specific legal applicability is missing from #117`);
}

export function calculateVat126(input: VatInput126) {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents < 0 || input.amountCents > MAX_INPUT_CENTS) {
    throw new Error("VAT126_INVALID_AMOUNT: nonnegative exact cents within declared local bound required");
  }
  const percent = input.rate.kind === "custom" ? input.rate.percent
    : getVatPreset126(input.rate.taxYear, input.rate.id);
  const rateUnits = customRateUnits(percent);
  const amount = BigInt(input.amountCents);
  let net: bigint, vat: bigint, gross: bigint;
  if (input.operation === "add") {
    net = amount;
    vat = roundedDivision(net * rateUnits, RATE_SCALE);
    gross = net + vat;
  } else if (input.operation === "scorporo") {
    gross = amount;
    net = roundedDivision(gross * RATE_SCALE, RATE_SCALE + rateUnits);
    vat = gross - net;
  } else {
    throw new Error("VAT126_INVALID_OPERATION");
  }
  return {
    netCents: Number(net), vatCents: Number(vat), grossCents: Number(gross),
    ratePercent: percent.trim().replace(",", "."),
    rateOrigin: "USER_SUPPLIED" as const,
    rounding: "HALF_UP_AT_FINAL_CENT" as const,
    limitations: "User-supplied arithmetic only; does not determine whether a rate applies to a specific transaction. Scorporo rounds the net to cents and assigns the balance to IVA, so add/scorporo can differ by 1 cent.",
  };
}
