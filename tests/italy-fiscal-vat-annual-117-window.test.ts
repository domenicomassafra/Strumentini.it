import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ANNUAL_VAT_2025_WINDOW_117,
  getVerifiedAnnualVatCategory117,
  calculateVerifiedAnnualVatWindow117,
} from "../src/reference-data/italy/fiscal-annual-vat-117";

const root = resolve(import.meta.dirname, "..");
const confirmed = { confirmsExactLegalCategory: true, confirmsTaxableAndNotExempt: true } as const;
const categoryInput = (id: string, date = "2025-12-20") => ({ taxYear: 2025, transactionDate: date,
  categoryId: id, ...confirmed });

describe("#117 real official complete VAT Annex A and Art16 2025-12-13+ limited window", () => {
  it("pins actual complete 13-page official PDF and independent article16 with content, legal dates and 4/5/10/22 mapping", async () => {
    expect(ANNUAL_VAT_2025_WINDOW_117).toMatchObject({ taxYear: 2025,
      validFrom: "2025-12-13", validTo: "2025-12-31", status: "VERIFIED_LAST_19_DAYS_ONLY" });
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    for (const artifact of ANNUAL_VAT_2025_WINDOW_117.sources) {
      const bytes = await readFile(resolve(root, artifact.artifactPath));
      expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
      expect(`sha256:${createHash("sha256").update(bytes).digest("hex")}`).toBe(artifact.sha256);
      const job = pdfjs.getDocument({ data: new Uint8Array(bytes), disableFontFace: true, useSystemFonts: true });
      try {
        const pdf = await job.promise;
        expect(pdf.numPages).toBe(artifact.expectedPages);
        let content = "";
        for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
          const page = await pdf.getPage(pageNo);
          content += " " + (await page.getTextContent()).items.map((item) => "str" in item ? item.str : "").join(" ");
          page.cleanup();
        }
        expect(content.length).toBeGreaterThan(artifact.expectedPages === 13 ? 30_000 : 1800);
        expect(content).toMatch(artifact.expectedPages === 13 ? /In vigore dal 13\/12\/2025 al 01\/01\/2027/u : /In vigore dal 01\/01\/2016 al 01\/01\/2027/u);
        if (artifact.expectedPages === 13) {
          for (const fragment of ["PARTE II", "PARTE II-bis", "PARTE III", "ALIQUOTA DEL 4", "ALIQUOTA DEL 5", "ALIQUOTA DEL 10", "3) latte fresco", "1-bis) basilico", "121) somministrazioni di alimenti"]) {
            expect(content, fragment).toContain(fragment);
          }
        } else {
          for (const fragment of ["ventidue per cento", "quattro, al cinque e al dieci per cento", "salvo il disposto dell'articolo 34"]) {
            expect(content, fragment).toContain(fragment);
          }
        }
      } finally { await job.destroy(); }
    }
    expect(ANNUAL_VAT_2025_WINDOW_117.categories.map(({ id, ratePercent, legalReference }) => [id, ratePercent, legalReference]))
      .toEqual([
        ["art16-ordinary-taxable", 22, "DPR633/1972 art.16 c.1"],
        ["tabA-ii-3-fresh-milk", 4, "Tabella A parte II n.3"],
        ["tabA-iibis-1bis-fresh-herbs", 5, "Tabella A parte II-bis n.1-bis"],
        ["tabA-iii-121-serving-food-drink", 10, "Tabella A parte III n.121"],
      ]);
  });

  it.each([
    ["art16-ordinary-taxable", "22"],
    ["tabA-ii-3-fresh-milk", "4"],
    ["tabA-iibis-1bis-fresh-herbs", "5"],
    ["tabA-iii-121-serving-food-drink", "10"],
  ])("does actual local VAT add/scorporo using source-conditional category %s (%s%%)", (id, rate) => {
    const chosen = getVerifiedAnnualVatCategory117(categoryInput(id));
    expect(chosen).toMatchObject({ ratePercent: Number(rate), taxYear: 2025,
      categoryOrigin: "USER_CONFIRMED_EXACT_LEGAL_SCOPE" });
    const add = calculateVerifiedAnnualVatWindow117({ ...categoryInput(id), operation: "add", amountCents: 10000 });
    expect(add).toMatchObject({ ratePercent: Number(rate), netCents: 10000,
      vatCents: Number(rate) * 100, grossCents: 10000 + Number(rate) * 100,
      status: "CONDITIONAL_2025_WINDOW_ESTIMATE", categoryOrigin: "USER_CONFIRMED_EXACT_LEGAL_SCOPE" });
    const reverse = calculateVerifiedAnnualVatWindow117({ ...categoryInput(id), operation: "scorporo", amountCents: add.grossCents });
    expect(reverse.netCents).toBe(10000);
    expect(reverse.vatCents).toBe(add.vatCents);
    expect(reverse.grossCents).toBe(add.grossCents);
  });

  it("strictly refuses pre-13 December, other tax years, future date, and all unconfirmed or unspecified legal classifications", () => {
    for (const date of ["2025-01-01", "2025-12-12", "2026-01-01", "2025-12-32", "2025-2-21", "wrong"]) {
      expect(() => getVerifiedAnnualVatCategory117(categoryInput("tabA-ii-3-fresh-milk", date)), date).toThrow(/VAT117_UNSUPPORTED_DATE/);
    }
    for (const taxYear of [2024, 2026, 2027]) {
      expect(() => getVerifiedAnnualVatCategory117({ ...categoryInput("tabA-ii-3-fresh-milk"), taxYear })).toThrow(/VAT117_UNSUPPORTED_YEAR/);
    }
    for (const overrides of [{ confirmsExactLegalCategory: false }, { confirmsTaxableAndNotExempt: false }]) {
      expect(() => getVerifiedAnnualVatCategory117({ ...categoryInput("tabA-ii-3-fresh-milk"), ...overrides })).toThrow(/VAT117_UNCONFIRMED_SCOPE/);
    }
    expect(() => getVerifiedAnnualVatCategory117(categoryInput("milk"))).toThrow(/VAT117_UNLISTED_CATEGORY/);
    expect(() => getVerifiedAnnualVatCategory117(categoryInput("tabA-ii-3-fresh-milk-dried"))).toThrow(/VAT117_UNLISTED_CATEGORY/);
  });

  it("refuses invalid amounts, preserves original #126 rate as user-submitted rather than claiming certified classification", () => {
    for (const amountCents of [-1, 1.5, 1e16, Number.NaN]) {
      expect(() => calculateVerifiedAnnualVatWindow117({ ...categoryInput("art16-ordinary-taxable"), operation: "add", amountCents })).toThrow(/VAT126_INVALID_AMOUNT/);
    }
    const result = calculateVerifiedAnnualVatWindow117({ ...categoryInput("tabA-iii-121-serving-food-drink"), operation: "scorporo", amountCents: 11000 });
    expect(result).toMatchObject({ rateOrigin: "USER_SUPPLIED", netCents: 10000, vatCents: 1000, grossCents: 11000 });
    expect(result.limitations).toMatch(/not an automatic legal classifier/iu);
  });
});
