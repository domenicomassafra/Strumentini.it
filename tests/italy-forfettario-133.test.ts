import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { inspectForfettario133, calculateForfettario133 } from "../src/engines/italy/forfettario-133";

const root = resolve(import.meta.dirname, "..");

describe("#133 source-bound forfettario preflight and unverified coefficient rejection", () => {
  it("pins 2025 regime legal limits and 2025 ATECO2007 transition to exact official source bytes", async () => {
    const result = inspectForfettario133({ taxYear: 2025, priorYearReceiptsCents: 8_500_000,
      atecoVersion: "ATECO2007", atecoCode: "69.10.10", declaredRate: "standard-15", declaresEligible: true });
    expect(result).toMatchObject({ status: "SOURCE_BACKED_COEFFICIENT_READY", taxYear: 2025,
      declaredRatePercent: 15, annualPriorReceiptsLimitCents: 8500000, revenueThresholdSatisfied: true });
    expect(result.sources).toHaveLength(3);
    const text = await Promise.all(result.sources.slice(0, 2).map(async ({ path, sha256 }) => {
      const bytes = await readFile(resolve(root, path));
      expect(`sha256:${createHash("sha256").update(bytes).digest("hex")}`).toBe(sha256);
      return bytes.toString("utf8");
    }));
    expect(text[0]).toMatch(/euro 85\.000/iu);
    expect(text[0]).toMatch(/aliquota[^<]{0,160}5 per cento/iu);
    expect(text[1]).toMatch(/ATECO 2025/iu);
    expect(text[1]).toMatch(/ATECO 2007/iu);
  });

  it("refuses unsupported years, non-ATECO2007 codes and unconfirmed 5% eligibility", () => {
    const base = { taxYear: 2025, priorYearReceiptsCents: 6_000_000, atecoVersion: "ATECO2007",
      atecoCode: "69.10.10", declaredRate: "standard-15", declaresEligible: true } as const;
    expect(() => inspectForfettario133({ ...base, taxYear: 2026 })).toThrow(/FORF133_UNSUPPORTED_YEAR/u);
    expect(() => inspectForfettario133({ ...base, atecoVersion: "ATECO2025" })).toThrow(/FORF133_UNSUPPORTED_ATECO/u);
    expect(() => inspectForfettario133({ ...base, declaredRate: "startup-5" })).toThrow(/FORF133_5_PERCENT_DECLARATION_REQUIRED/u);
    expect(() => inspectForfettario133({ ...base, declaresEligible: false })).toThrow(/FORF133_ELIGIBILITY_UNCONFIRMED/u);
    expect(() => inspectForfettario133({ ...base, priorYearReceiptsCents: -1 })).toThrow(/FORF133_INVALID_REVENUE/u);
  });

  it("keeps 85k previous-year eligibility boundary separate from verified coefficient acquisition", () => {
    const base = { taxYear: 2025, priorYearReceiptsCents: 8_500_000, atecoVersion: "ATECO2007",
      atecoCode: "62.01.00", declaredRate: "startup-5", declaresEligible: true,
      declaresStartupFivePercentRequirements: true } as const;
    expect(inspectForfettario133(base)).toMatchObject({ revenueThresholdSatisfied: true,
      status: "BLOCKED_OFFICIAL_COEFFICIENT", declaredRatePercent: 5 });
    expect(inspectForfettario133({ ...base, priorYearReceiptsCents: 8_500_001 })).toMatchObject({
      revenueThresholdSatisfied: false, status: "OUT_OF_SCOPE_LIMIT" });
    expect(() => calculateForfettario133({ ...base, yearReceiptsCents: 5_000_000,
      paidMandatoryContributionsCents: 0 })).toThrow(/FORF133_OFFICIAL_COEFFICIENT_MISSING/u);
  });

  it("uses only official Gazzetta 2018 Annex 2 (Law190 Annex4 replacement) for 2025 ATECO2007 group 69–70", async () => {
    const input = { taxYear: 2025, priorYearReceiptsCents: 8_500_000, atecoVersion: "ATECO2007",
      atecoCode: "69.10.10", declaredRate: "standard-15", declaresEligible: true,
      yearReceiptsCents: 4_000_000, paidMandatoryContributionsCents: 500_000 } as const;
    const result = calculateForfettario133(input);
    expect(result).toMatchObject({
      taxYear: 2025, coefficientPercent: 78, yearReceiptsCents: 4_000_000,
      grossForfettarioIncomeCents: 3_120_000, paidMandatoryContributionsCents: 500_000,
      taxableIncomeCents: 2_620_000, substituteTaxCents: 393_000, estimatedNetAfterTaxAndContributionsCents: 3_107_000,
      contributionOrigin: "USER_DECLARED_ALREADY_PAID", status: "SOURCE_BACKED_2025_SUBSET_ESTIMATE",
    });
    expect(result.sources.find((source) => source.authority === "Gazzetta Ufficiale")).toBeDefined();
    for (const source of result.sources) {
      const bytes = await readFile(resolve(root, source.path));
      expect(`sha256:${createHash("sha256").update(bytes).digest("hex")}`).toBe(source.sha256);
    }
    const gazette = result.sources.find((source) => source.authority === "Gazzetta Ufficiale");
    if (!gazette) throw new Error("Missing Gazette primary artifact");
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loading = getDocument({ data: new Uint8Array(await readFile(resolve(root, gazette.path))), useSystemFonts: true, disableFontFace: true });
    try {
      const pdf = await loading.promise;
      expect(pdf.numPages).toBeGreaterThanOrEqual(218);
      const page = await pdf.getPage(218);
      const text = (await page.getTextContent()).items.map((item) => "str" in item ? item.str : "").join(" ");
      expect(text).toContain("78%");
      expect(text).toMatch(/69\s*[-–]\s*70/u);
      page.cleanup();
    } finally { await loading.destroy(); }
    expect(calculateForfettario133({ ...input, declaredRate: "startup-5", declaresStartupFivePercentRequirements: true }))
      .toMatchObject({ substituteTaxCents: 131_000, estimatedNetAfterTaxAndContributionsCents: 3_369_000 });
    expect(calculateForfettario133({ ...input, atecoCode: "70.22.09" })).toMatchObject({ coefficientPercent: 78 });
  });

  it("never fabricates INPS contributions or validates ATECO2025 mapping or unknown groups", () => {
    const input = { taxYear: 2025, priorYearReceiptsCents: 6_000_000, atecoVersion: "ATECO2007",
      atecoCode: "69.10.10", declaredRate: "standard-15", declaresEligible: true,
      yearReceiptsCents: 1_000_000, paidMandatoryContributionsCents: 0 } as const;
    expect(() => calculateForfettario133({ ...input, atecoCode: "62.01.00" })).toThrow(/FORF133_OFFICIAL_COEFFICIENT_MISSING/u);
    expect(() => calculateForfettario133({ ...input, userProvidedCoefficientPercent: 78 })).toThrow(/FORF133_USER_COEFFICIENT_REFUSED/u);
    expect(() => calculateForfettario133({ ...input, paidMandatoryContributionsCents: -1 })).toThrow(/FORF133_INVALID_CONTRIBUTIONS/u);
    expect(() => calculateForfettario133({ ...input, paidMandatoryContributionsCents: 800_000 })).toThrow(/FORF133_OUT_OF_SCOPE_CONTRIBUTIONS/u);
    expect(() => calculateForfettario133({ ...input, yearReceiptsCents: 8_500_001 })).toThrow(/FORF133_OUT_OF_SCOPE_RECEIPTS/u);
    expect(() => calculateForfettario133({ ...input, yearReceiptsCents: 1.5 })).toThrow(/FORF133_INVALID_REVENUE/u);
  });
});
