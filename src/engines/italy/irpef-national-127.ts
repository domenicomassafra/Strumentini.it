import { getVerifiedNationalIrpef117 } from "../../reference-data/italy/fiscal-annual-117";
import { assertItalyPinnedAnnualUse158 } from "../../reference-data/italy/freshness-158";

/** National gross IRPEF only: taxable base already net of deductible expenses. */
export function calculateNationalGrossIrpef127(taxYear: number, taxableIncomeCents: number) {
  const pack = getVerifiedNationalIrpef117(taxYear);
  assertItalyPinnedAnnualUse158("national-irpef-gross-subset", pack.taxYear);
  if (!Number.isSafeInteger(taxableIncomeCents) || taxableIncomeCents < 0 || taxableIncomeCents > 100_000_000_000) {
    throw new Error("IRPEF127_INVALID_TAXABLE_CENTS: nonnegative safe integer cents up to 1 billion euros required");
  }
  let priorUpper = 0, accumulatedTaxUnits = 0, previousRoundedCents = 0;
  const lines = pack.bands.map(({ upToCents, rateBasisPoints }) => {
    const taxableBandCents = Math.max(0, Math.min(taxableIncomeCents, upToCents ?? taxableIncomeCents) - priorUpper);
    accumulatedTaxUnits += taxableBandCents * rateBasisPoints;
    const roundedCumulativeCents = Math.round(accumulatedTaxUnits / 10_000);
    const taxCents = roundedCumulativeCents - previousRoundedCents;
    previousRoundedCents = roundedCumulativeCents;
    priorUpper = upToCents ?? taxableIncomeCents;
    return { upperBoundCents: upToCents, taxableBandCents, rateBasisPoints, taxCents };
  });
  return {
    taxYear: pack.taxYear, taxableIncomeCents, grossNationalTaxCents: previousRoundedCents,
    lines, sources: pack.sources, scope: "GROSS_NATIONAL_IRPEF_ONLY" as const,
    limitations: "Excludes all deductions, tax credits, regional/municipal surtaxes, substitute taxes and legal eligibility decisions.",
  };
}
