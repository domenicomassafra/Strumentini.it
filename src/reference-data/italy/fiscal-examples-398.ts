/**
 * STR-398 worked examples: official year version plus the visible formula.
 *
 * Every amount below is computed by the existing year-scoped engines; this
 * module only composes them for display and captures their refusals verbatim.
 * A year without an official excerpt, a missing addizionale selection or an
 * IVA date outside the verified window returns a "non determinato" row: no
 * amount is inherited from another year and no surtax is estimated.
 */
import { calculateIrpefComponents128 } from "../../engines/italy/irpef-components-128";
import { calculateNationalGrossIrpef127 } from "../../engines/italy/irpef-national-127";
import {
  ANNUAL_VAT_2025_WINDOW_117,
  calculateVerifiedAnnualVatWindow117,
} from "./fiscal-annual-vat-117";

const euroFormat398 = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", useGrouping: true });
/** One shared formatter so the page and its tests cannot drift apart. */
export const formatEuro398 = (cents: number): string => euroFormat398.format(cents / 100);
export const formatPercent398 = (basisPoints: number): string =>
  `${(basisPoints / 100).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

/** Verified IVA examples live inside the only proven legal window. */
export const VAT_EXAMPLE_DATE_398 = "2025-12-20";

export interface IrpefBandLine398 {
  readonly label: string;
  readonly taxableBandCents: number;
  readonly rateBasisPoints: number;
  readonly taxCents: number;
  readonly formula: string;
}

export interface IrpefWorkedExample398 {
  readonly id: string;
  readonly taxYear: number;
  readonly revisionId: string;
  readonly checkedAt: string;
  readonly taxableIncomeCents: number;
  readonly bands: readonly IrpefBandLine398[];
  readonly totalCents: number;
  readonly formula: string;
  readonly sourceUrls: readonly string[];
  readonly limitation: string;
}

export type VatOperation398 = "add" | "scorporo";

export interface VatWorkedExample398 {
  readonly id: string;
  readonly taxYear: number;
  readonly transactionDate: string;
  readonly categoryId: string;
  readonly legalReference: string;
  readonly ratePercent: number;
  readonly operation: VatOperation398;
  readonly amountCents: number;
  readonly netCents: number;
  readonly vatCents: number;
  readonly grossCents: number;
  readonly formula: string;
  readonly window: string;
  readonly sourceUrls: readonly string[];
  readonly limitation: string;
}

export interface NotDeterminedExample398 {
  readonly id: string;
  readonly label: string;
  readonly taxYear: number | null;
  readonly reason: string;
}

/**
 * 35.000 € shows the second-bracket change 2025 → 2026, 28.000 € stops exactly
 * on the first boundary and 28.100 € proves the progressive slice above it.
 */
const IRPEF_CASES_398 = Object.freeze([
  Object.freeze({ id: "irpef-2025-35000", taxYear: 2025, taxableIncomeCents: 3_500_000 }),
  Object.freeze({ id: "irpef-2026-35000", taxYear: 2026, taxableIncomeCents: 3_500_000 }),
  Object.freeze({ id: "irpef-2026-28000", taxYear: 2026, taxableIncomeCents: 2_800_000 }),
  Object.freeze({ id: "irpef-2026-28100", taxYear: 2026, taxableIncomeCents: 2_810_000 }),
] as const satisfies readonly { id: string; taxYear: number; taxableIncomeCents: number }[]);

export function buildIrpefWorkedExamples398(): readonly IrpefWorkedExample398[] {
  return Object.freeze(IRPEF_CASES_398.map(({ id, taxYear, taxableIncomeCents }) => {
    const result = calculateNationalGrossIrpef127(taxYear, taxableIncomeCents);
    const bands = result.lines.map((line, index) => {
      const previousUpper = index === 0 ? 0 : result.lines[index - 1]!.upperBoundCents;
      const label = line.upperBoundCents === null
        ? `Oltre ${formatEuro398(previousUpper ?? 0)}`
        : `Fino a ${formatEuro398(line.upperBoundCents)}`;
      return Object.freeze({
        label,
        taxableBandCents: line.taxableBandCents,
        rateBasisPoints: line.rateBasisPoints,
        taxCents: line.taxCents,
        formula: `${formatEuro398(line.taxableBandCents)} × ${formatPercent398(line.rateBasisPoints)} = ${formatEuro398(line.taxCents)}`,
      });
    });
    const applied = bands.filter((band) => band.taxableBandCents > 0);
    const terms = applied.length === 0
      ? [`${formatEuro398(0)} × ${formatPercent398(bands[0]!.rateBasisPoints)}`]
      : applied.map((band) => `${formatEuro398(band.taxableBandCents)} × ${formatPercent398(band.rateBasisPoints)}`);
    return Object.freeze({
      id,
      taxYear: result.taxYear,
      revisionId: result.ruleRevisionId,
      checkedAt: result.sourceCheckedAt,
      taxableIncomeCents,
      bands: Object.freeze(bands),
      totalCents: result.grossNationalTaxCents,
      formula: `${terms.join(" + ")} = ${formatEuro398(result.grossNationalTaxCents)}`,
      sourceUrls: Object.freeze(result.sources.map((source) => source.url)),
      limitation: result.limitations,
    });
  }));
}

const VAT_CASES_398 = Object.freeze([
  Object.freeze({ id: "iva-2025-ordinaria-add", categoryId: "art16-ordinary-taxable", operation: "add", amountCents: 100_000 }),
  Object.freeze({ id: "iva-2025-ordinaria-scorporo", categoryId: "art16-ordinary-taxable", operation: "scorporo", amountCents: 122_000 }),
  Object.freeze({ id: "iva-2025-latte-fresco-4-add", categoryId: "tabA-ii-3-fresh-milk", operation: "add", amountCents: 50_000 }),
  Object.freeze({ id: "iva-2025-erbe-fresche-5-add", categoryId: "tabA-iibis-1bis-fresh-herbs", operation: "add", amountCents: 20_000 }),
  Object.freeze({ id: "iva-2025-somministrazione-10-add", categoryId: "tabA-iii-121-serving-food-drink", operation: "add", amountCents: 15_000 }),
] as const satisfies readonly { id: string; categoryId: string; operation: VatOperation398; amountCents: number }[]);

const vatWindow398 = `${ANNUAL_VAT_2025_WINDOW_117.validFrom} – ${ANNUAL_VAT_2025_WINDOW_117.validTo} (${ANNUAL_VAT_2025_WINDOW_117.status})`;

export function buildVatWorkedExamples398(): readonly VatWorkedExample398[] {
  return Object.freeze(VAT_CASES_398.map(({ id, categoryId, operation, amountCents }) => {
    const result = calculateVerifiedAnnualVatWindow117({
      taxYear: ANNUAL_VAT_2025_WINDOW_117.taxYear,
      transactionDate: VAT_EXAMPLE_DATE_398,
      categoryId,
      confirmsExactLegalCategory: true,
      confirmsTaxableAndNotExempt: true,
      operation,
      amountCents,
    });
    const formula = operation === "add"
      ? `${formatEuro398(result.netCents)} × ${formatPercent398(result.ratePercent * 100)} = ${formatEuro398(result.vatCents)} IVA · totale ${formatEuro398(result.grossCents)}`
      : `${formatEuro398(result.grossCents)} ÷ (1 + ${formatPercent398(result.ratePercent * 100)}) = ${formatEuro398(result.netCents)} imponibile · IVA ${formatEuro398(result.vatCents)}`;
    return Object.freeze({
      id,
      taxYear: result.taxYear,
      transactionDate: result.transactionDate,
      categoryId: result.categoryId,
      legalReference: result.legalReference,
      ratePercent: result.ratePercent,
      operation,
      amountCents,
      netCents: result.netCents,
      vatCents: result.vatCents,
      grossCents: result.grossCents,
      formula,
      window: vatWindow398,
      sourceUrls: Object.freeze(result.sources.map((source) => source.url)),
      limitation: result.limitations,
    });
  }));
}

const refusal398 = (run: () => unknown): string => {
  try {
    run();
    return "nessun rifiuto: caso coperto";
  } catch (error) {
    return error instanceof Error ? error.message : "caso rifiutato dal motore";
  }
};

const vatInput398 = (taxYear: number, transactionDate: string) => ({
  taxYear, transactionDate, categoryId: "art16-ordinary-taxable",
  confirmsExactLegalCategory: true, confirmsTaxableAndNotExempt: true,
  operation: "add" as const, amountCents: 100_000,
});

/** Failure cases kept next to the examples so a missing source is visible. */
export function buildNotDeterminedExamples398(): readonly NotDeterminedExample398[] {
  const surtaxes = calculateIrpefComponents128({
    taxYear: 2026, taxableIncomeCents: 3_500_000,
    region: "unknown", municipality: "unknown", employeeFullYearConfirmed: false,
  });
  const surtaxesReason = surtaxes.finalModeledTaxCents === null
    ? surtaxes.unsupported.join(" ")
    : "determinato: verificare il caso prima di pubblicarlo";
  return Object.freeze([
    Object.freeze({
      id: "irpef-2024", label: "IRPEF 2024 — nessun estratto ufficiale verificato", taxYear: 2024,
      reason: refusal398(() => calculateNationalGrossIrpef127(2024, 3_500_000)),
    }),
    Object.freeze({
      id: "irpef-addizionali-senza-regione", label: "Addizionali 2026 senza regione e comune dichiarati", taxYear: 2026,
      reason: surtaxesReason,
    }),
    Object.freeze({
      id: "iva-2026", label: "IVA 2026 — nessuno snapshot ufficiale dell'anno", taxYear: 2026,
      reason: refusal398(() => calculateVerifiedAnnualVatWindow117(vatInput398(2026, "2026-03-01"))),
    }),
    Object.freeze({
      id: "iva-2025-fuori-finestra", label: "IVA 15/06/2025 — fuori dalla finestra verificata 13–31/12/2025", taxYear: 2025,
      reason: refusal398(() => calculateVerifiedAnnualVatWindow117(vatInput398(2025, "2025-06-15"))),
    }),
  ]);
}
