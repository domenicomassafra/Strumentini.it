import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getForfettarioAteco2007Coefficient133, inspectForfettario133, calculateForfettario133 } from "../src/engines/italy/forfettario-133";
import { getVerifiedForfettarioCoefficients117 } from "../src/reference-data/italy/fiscal-annual-117";

const root = resolve(import.meta.dirname, "..");
const base = {
  taxYear: 2025, priorYearReceiptsCents: 5_000_000, atecoVersion: "ATECO2007", declaredRate: "standard-15",
  declaresEligible: true, yearReceiptsCents: 4_000_000, paidMandatoryContributionsCents: 500_000,
} as const;

// Nine distinct official annex rows, with non-overlapping exact ATECO2007 prefixes.
const fixtures = [
  { row: 1, percent: 40, code: "10.11.00" },
  { row: 2, percent: 40, code: "45.20.10" },
  { row: 3, percent: 40, code: "47.81.09" },
  { row: 4, percent: 54, code: "47.82.02" },
  { row: 5, percent: 86, code: "68.20.01" },
  { row: 6, percent: 62, code: "46.19.00" },
  { row: 7, percent: 40, code: "56.10.11" },
  { row: 8, percent: 78, code: "69.10.10" },
  { row: 9, percent: 67, code: "62.01.00" },
] as const;

describe("#133 official 2025 Annex2 all-nine-row source-backed ATECO2007 table", () => {
  it("loads the independent annual #117 table with exact coverage, 9 rows and strict unsupported-year refusals", async () => {
    const pack = getVerifiedForfettarioCoefficients117(2025);
    expect(pack).toMatchObject({ taxYear: 2025, effectiveFrom: "2025-01-01", effectiveTo: "2025-12-31",
      atecoVersion: "ATECO2007", status: "VERIFIED_COEFFICIENT_TABLE_ONLY" });
    expect(pack.rows.map((row) => [row.sourceTableRow, row.coefficientPercent]))
      .toEqual([[1, 40], [2, 40], [3, 40], [4, 54], [5, 86], [6, 62], [7, 40], [8, 78], [9, 67]]);
    expect(pack.sources).toHaveLength(2);
    for (const source of pack.sources) {
      const bytes = await readFile(resolve(root, source.artifactPath));
      expect(`sha256:${createHash("sha256").update(bytes).digest("hex")}`).toBe(source.sha256);
    }
    for (const year of [2024, 2026, 2027]) {
      expect(() => getVerifiedForfettarioCoefficients117(year)).toThrow(/UNSUPPORTED_FISCAL_TAX_YEAR/u);
    }
  });
  it("independently checks source bytes, exact PDF Annex2 header, all 9 printed row percents and special codes", async () => {
    const file = resolve(root, "quality/reference-data/italy/artifacts/117-fiscal-annual/gu-law145-2018-supplement-annex2.pdf");
    const bytes = await readFile(file);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe("19e507421ba6fb7f856d5c3bee3dcbf53bf3efc9a22114562951d11932bbd142");
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loader = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, disableFontFace: true });
    try {
      const doc = await loader.promise;
      const page = await doc.getPage(218);
      const text = (await page.getTextContent()).items.map((item) => "str" in item ? item.str : "").join(" ");
      expect(text).toMatch(/Allegato 2[\s\S]*ALLEGATO 4[\s\S]*ATECO 2007/u);
      // The exact sequence printed by Gazzetta, not a generated fixture.
      expect([...text.matchAll(/(40|54|86|62|78|67)%/gu)].map((match) => Number(match[1])))
        .toEqual([40, 40, 40, 54, 86, 62, 40, 78, 67]);
      for (const expression of [/47\.81[\s\S]*40%/u, /47\.82[^%]*47\.89[\s\S]*54%/u, /46\.1[\s\S]*62%/u,
        /69-70-71-[\s\S]*78%/u, /97-98[\s\S]*67%/u]) expect(text).toMatch(expression);
      for (const percent of ["40%", "54%", "86%", "62%", "78%", "67%"]) expect(text).toContain(percent);
      page.cleanup();
    } finally { await loader.destroy(); }
  });

  it.each(fixtures)("maps official Annex2 row $row code $code at $percent%", ({ code, percent, row }) => {
    const record = getForfettarioAteco2007Coefficient133(code);
    expect(record).toMatchObject({ sourceTableRow: row, coefficientPercent: percent, atecoVersion: "ATECO2007" });
    const estimate = calculateForfettario133({ ...base, atecoCode: code });
    const grossIncome = Math.floor((base.yearReceiptsCents * percent + 50) / 100);
    const taxBase = grossIncome - base.paidMandatoryContributionsCents;
    const substituteTax = Math.floor((taxBase * 15 + 50) / 100);
    expect(estimate).toMatchObject({ coefficientPercent: percent, coefficientTableRow: row,
      grossForfettarioIncomeCents: grossIncome, taxableIncomeCents: taxBase,
      substituteTaxCents: substituteTax, status: "SOURCE_BACKED_2025_SUBSET_ESTIMATE" });
    expect(estimate.estimatedNetAfterTaxAndContributionsCents).toBe(base.yearReceiptsCents - base.paidMandatoryContributionsCents - substituteTax);
  });

  it("distinguishes 46.1 intermediaries from 46.2–46.9 wholesale and 47.81/47.82/47.89/47.9", () => {
    const cases = [
      ["46.10.00", 62, 6], ["46.29.00", 40, 2], ["46.90.00", 40, 2],
      ["47.10.00", 40, 2], ["47.79.99", 40, 2], ["47.90.00", 40, 2],
      ["47.81.01", 40, 3], ["47.82.00", 54, 4], ["47.89.99", 54, 4],
      ["41.20.00", 86, 5], ["55.10.00", 40, 7], ["85.30.00", 78, 8], ["99.00.00", 67, 9],
    ] as const;
    for (const [code, percent, row] of cases) {
      expect(getForfettarioAteco2007Coefficient133(code)).toMatchObject({ coefficientPercent: percent, sourceTableRow: row });
    }
  });

  it("fails closed for absent/ambiguous/unlisted ATECO groups and unknown year/ATECO2025", () => {
    for (const code of ["47.80.00", "47.83.00", "04.01.00", "34.01.00", "40.01.00", "46", "47", "06A.0", "62XYZ"] ) {
      expect(getForfettarioAteco2007Coefficient133(code), code).toBeNull();
      if (/^\d{2}(?:\.\d{1,2}){0,2}$/u.test(code)) {
        expect(inspectForfettario133({ ...base, atecoCode: code }).status).toBe("BLOCKED_OFFICIAL_COEFFICIENT");
      }
    }
    expect(() => calculateForfettario133({ ...base, taxYear: 2026, atecoCode: "62.01.00" })).toThrow(/FORF133_UNSUPPORTED_YEAR/u);
    expect(() => calculateForfettario133({ ...base, atecoVersion: "ATECO2025", atecoCode: "62.01.00" })).toThrow(/FORF133_UNSUPPORTED_ATECO/u);
  });
});
