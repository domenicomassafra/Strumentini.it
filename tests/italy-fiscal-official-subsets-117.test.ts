import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  VERIFIED_IRPEF_EXCERPTS_117, getVerifiedNationalIrpef117, INVOICE_STAMP_REFERENCE_2024_117,
} from "../src/reference-data/italy/fiscal-annual-117";
import { calculateNationalGrossIrpef127 } from "../src/engines/italy/irpef-national-127";
import { getInvoiceStampReference152 } from "../src/engines/italy/invoice-stamp-reference-152";

const root = resolve(import.meta.dirname, "..");
const sourceText = async (source: { readonly artifactPath: string; readonly sha256: string }) => {
  const bytes = await readFile(resolve(root, source.artifactPath));
  expect(`sha256:${createHash("sha256").update(bytes).digest("hex")}`).toBe(source.sha256);
  return bytes.toString("utf8");
};

describe("#117 official independent excerpts remain narrower than a complete annual fiscal pack", () => {
  it("hash-binds 2025 national IRPEF bands to the 2024 budget law and 2026 rate change to the 2025 law", async () => {
    expect(VERIFIED_IRPEF_EXCERPTS_117.map((pack) => pack.taxYear)).toEqual([2025, 2026]);
    const [original, change] = await Promise.all([
      sourceText(VERIFIED_IRPEF_EXCERPTS_117[0]!.sources[0]!),
      sourceText(VERIFIED_IRPEF_EXCERPTS_117[1]!.sources[1]!),
    ]);
    expect(original).toMatch(/fino a 28\.000 euro, 23 per cento/iu);
    // Normattiva republishes this article in a two-column HTML table: the
    // numeric 35 and its unit 'per cento' are split by the column separator.
    expect(original).toMatch(/oltre 28\.000 euro e fino a 50\.000 euro, 35\|euro;/iu);
    expect(original).toMatch(/oltre 50\.000 euro, 43 per cento/iu);
    expect(change).toMatch(/le parole: &laquo;35 per cento&raquo; sono sostituite dalle seguenti: &laquo;33 per cento&raquo;/iu);
    expect(VERIFIED_IRPEF_EXCERPTS_117[0]!.bands.map((band) => band.rateBasisPoints)).toEqual([2300, 3500, 4300]);
    expect(VERIFIED_IRPEF_EXCERPTS_117[1]!.bands.map((band) => band.rateBasisPoints)).toEqual([2300, 3300, 4300]);
    expect(() => getVerifiedNationalIrpef117(2027)).toThrow(/UNSUPPORTED_FISCAL_TAX_YEAR/u);
    expect(() => getVerifiedNationalIrpef117(2024)).toThrow(/UNSUPPORTED_FISCAL_TAX_YEAR/u);
  });

  it.each([2025, 2026] as const)("#127 national gross tax %s has cent-exact band boundaries and reconciled breakdown", (year) => {
    const middleRate = year === 2025 ? 3500 : 3300;
    const secondBandEuros = year === 2025 ? 7700 : 7260;
    const cap = 2_800_000;
    const secondCap = 5_000_000;
    const exact28000 = calculateNationalGrossIrpef127(year, cap);
    expect(exact28000.grossNationalTaxCents).toBe(644_000);
    expect(exact28000.lines.map((line) => line.taxableBandCents)).toEqual([cap, 0, 0]);
    const after28000 = calculateNationalGrossIrpef127(year, cap + 1);
    expect(after28000.lines.map((line) => line.taxableBandCents)).toEqual([cap, 1, 0]);
    expect(after28000.lines[1]!.rateBasisPoints).toBe(middleRate);
    const before50000 = calculateNationalGrossIrpef127(year, secondCap - 1);
    const exact50000 = calculateNationalGrossIrpef127(year, secondCap);
    const after50000 = calculateNationalGrossIrpef127(year, secondCap + 1);
    expect(exact50000.grossNationalTaxCents).toBe((6440 + secondBandEuros) * 100);
    expect(before50000.lines[1]!.taxableBandCents).toBe(2_199_999);
    expect(after50000.lines[2]!.taxableBandCents).toBe(1);
    for (const income of [0, 1, cap - 1, cap, cap + 1, secondCap - 1, secondCap, secondCap + 1, 65_555_555]) {
      const result = calculateNationalGrossIrpef127(year, income);
      expect(result.lines.reduce((sum, line) => sum + line.taxableBandCents, 0)).toBe(income);
      expect(result.lines.reduce((sum, line) => sum + line.taxCents, 0)).toBe(result.grossNationalTaxCents);
      expect(result.scope).toBe("GROSS_NATIONAL_IRPEF_ONLY");
      expect(result.sources.length).toBeGreaterThan(0);
    }
  });

  it("#127 refuses invalid amounts or unsupported tax year without carrying forward previous brackets", () => {
    for (const year of [2024, 2027]) expect(() => calculateNationalGrossIrpef127(year, 30_000_00)).toThrow(/UNSUPPORTED_FISCAL_TAX_YEAR/u);
    for (const cents of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER]) {
      expect(() => calculateNationalGrossIrpef127(2026, cents)).toThrow(/IRPEF127_INVALID_TAXABLE_CENTS/u);
    }
  });

  it("hash-binds #152 reference conditions to the archived Agenzia 2024 e-invoice guide", async () => {
    const guide = await sourceText(INVOICE_STAMP_REFERENCE_2024_117.source);
    expect(guide).toMatch(/maggiore di 77,47 euro/iu);
    expect(guide).toMatch(/dovuto di 2 euro/iu);
    for (const nature of INVOICE_STAMP_REFERENCE_2024_117.supportedNatures) expect(guide).toContain(nature);
    expect(guide).toMatch(/NB1[\s\S]+NB2[\s\S]+NB3/iu);
  });

  it("#152 strict single-line 2024 reference respects €77.47 exclusive boundary and explicit exemptions", () => {
    const input = { sourceYear: 2024, ordinarySingleLine: true, amountCents: 7747,
      nature: "N2.2", declaresNoSpecialExemptions: true };
    expect(getInvoiceStampReference152(input)).toMatchObject({ state: "REFERENCE", referenceStampCents: 0, isLegalCertification: false });
    expect(getInvoiceStampReference152({ ...input, amountCents: 7748 })).toMatchObject({ state: "REFERENCE", referenceStampCents: 200 });
    for (const nature of ["N2.2", "N3.6", "N4"]) {
      expect(getInvoiceStampReference152({ ...input, amountCents: 10_000, nature }).referenceStampCents).toBe(200);
    }
    for (const variant of [
      { sourceYear: 2025 }, { sourceYear: 2026 }, { ordinarySingleLine: false },
      { nature: "N1" }, { nature: "VAT22" }, { declaresNoSpecialExemptions: false },
    ]) {
      expect(getInvoiceStampReference152({ ...input, ...variant })).toMatchObject({ state: "OUT_OF_SCOPE", referenceStampCents: null });
    }
    for (const amountCents of [-1, 1.2, NaN, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => getInvoiceStampReference152({ ...input, amountCents })).toThrow(/STAMP152_INVALID_AMOUNT/u);
    }
  });
});
