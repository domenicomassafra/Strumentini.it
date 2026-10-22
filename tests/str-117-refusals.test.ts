import { describe, expect, it } from "vitest";
import { getInvoiceStampReference152 } from "../src/engines/italy/invoice-stamp-reference-152";
import { calculateNationalGrossIrpef127 } from "../src/engines/italy/irpef-national-127";
import {
  calculateVerifiedAnnualVatWindow117,
  getVerifiedAnnualVatCategory117,
} from "../src/reference-data/italy/fiscal-annual-vat-117";
import { getVerifiedForfettarioCoefficients117 } from "../src/reference-data/italy/fiscal-annual-117";
import { getAnnualFiscalSourceRows117 } from "../src/reference-data/italy/annual-source-registry-117";

describe("STR-117: explicit fiscal refusals preserve original inputs", () => {
  const validVat = Object.freeze({
    taxYear: 2025, transactionDate: "2025-12-13", categoryId: "art16-ordinary-taxable",
    confirmsExactLegalCategory: true, confirmsTaxableAndNotExempt: true,
    operation: "add" as const, amountCents: 10_000,
  });

  it("refuses unsupported VAT years, dates, categories, declarations and amounts without mutating input", () => {
    const cases = [
      [{ taxYear: 2026 }, /VAT117_UNSUPPORTED_YEAR/u],
      [{ transactionDate: "2025-12-12" }, /VAT117_UNSUPPORTED_DATE/u],
      [{ confirmsExactLegalCategory: false }, /VAT117_UNCONFIRMED_SCOPE/u],
      [{ confirmsTaxableAndNotExempt: false }, /VAT117_UNCONFIRMED_SCOPE/u],
      [{ categoryId: "unverified-product" }, /VAT117_UNLISTED_CATEGORY/u],
      [{ amountCents: -1 }, /INVALID/u],
    ] as const;
    for (const [change, failure] of cases) {
      const input = Object.freeze({ ...validVat, ...change });
      const original = JSON.stringify(input);
      expect(() => calculateVerifiedAnnualVatWindow117(input)).toThrow(failure);
      expect(JSON.stringify(input)).toBe(original);
    }
    const validBefore = JSON.stringify(validVat);
    expect(getVerifiedAnnualVatCategory117(validVat).ratePercent).toBe(22);
    expect(calculateVerifiedAnnualVatWindow117(validVat).ratePercent).toBe(22);
    expect(JSON.stringify(validVat)).toBe(validBefore);
  });

  it("does not turn archived 2024 bollo into a later-year reference", () => {
    const input = Object.freeze({ sourceYear: 2026, ordinarySingleLine: true,
      amountCents: 10_000, nature: "N2.2", declaresNoSpecialExemptions: true });
    const original = JSON.stringify(input);
    expect(getInvoiceStampReference152(input)).toMatchObject({ state: "OUT_OF_SCOPE", referenceStampCents: null });
    expect(JSON.stringify(input)).toBe(original);
    const invalid = Object.freeze({ ...input, sourceYear: 2024, amountCents: -1 });
    const invalidOriginal = JSON.stringify(invalid);
    expect(() => getInvoiceStampReference152(invalid)).toThrow(/STAMP152_INVALID_AMOUNT/u);
    expect(JSON.stringify(invalid)).toBe(invalidOriginal);
  });

  it("refuses unknown IRPEF and forfettario years without falling back to old bands", () => {
    expect(() => calculateNationalGrossIrpef127(2027, 3_000_000)).toThrow(/UNSUPPORTED_FISCAL_TAX_YEAR/u);
    expect(() => getVerifiedForfettarioCoefficients117(2026)).toThrow(/UNSUPPORTED_FISCAL_TAX_YEAR/u);
    expect(getAnnualFiscalSourceRows117(2027)).toEqual([]);
    expect(calculateNationalGrossIrpef127(2025, 3_000_000).lines[1]?.rateBasisPoints).toBe(3500);
    expect(calculateNationalGrossIrpef127(2026, 3_000_000).lines[1]?.rateBasisPoints).toBe(3300);
  });
});
