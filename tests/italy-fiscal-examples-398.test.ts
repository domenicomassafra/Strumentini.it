/**
 * STR-398 regression: the published IVA/IRPEF examples keep the official year
 * version, the visible formula and the explicit refusal of uncovered cases.
 * These assertions fail on the reported defect (no IVA example, no breakdown)
 * and on any attempt to inherit a rate from another year.
 */
import { describe, expect, it } from "vitest";
import { VERIFIED_IRPEF_EXCERPTS_117 } from "../src/reference-data/italy/fiscal-annual-117";
import { ANNUAL_VAT_2025_WINDOW_117 } from "../src/reference-data/italy/fiscal-annual-vat-117";
import {
  buildIrpefWorkedExamples398,
  buildNotDeterminedExamples398,
  buildVatWorkedExamples398,
  formatEuro398,
  formatPercent398,
  VAT_EXAMPLE_DATE_398,
} from "../src/reference-data/italy/fiscal-examples-398";

const irpef = buildIrpefWorkedExamples398();
const vat = buildVatWorkedExamples398();
const refused = buildNotDeterminedExamples398();
const irpefCase = (id: string) => irpef.find((entry) => entry.id === id)!;
const vatCase = (id: string) => vat.find((entry) => entry.id === id)!;

describe("STR-398 IRPEF examples carry the official year version", () => {
  it("publishes every example with a verified revision, its check date and a source", () => {
    expect(irpef.length).toBeGreaterThanOrEqual(4);
    for (const example of irpef) {
      const excerpt = VERIFIED_IRPEF_EXCERPTS_117.find((entry) => entry.taxYear === example.taxYear)!;
      expect(excerpt.revisionId).toBe(example.revisionId);
      expect(excerpt.checkedAt).toBe(example.checkedAt);
      expect([2025, 2026]).toContain(example.taxYear);
      expect(example.sourceUrls.length).toBeGreaterThan(0);
      for (const url of example.sourceUrls) expect(url).toMatch(/^https:\/\//u);
    }
  });

  it("keeps band lines summing to the total and prints the formula that produced it", () => {
    for (const example of irpef) {
      const sum = example.bands.reduce((total, band) => total + band.taxCents, 0);
      expect(sum, example.id).toBe(example.totalCents);
      expect(example.formula).toContain("×");
      expect(example.formula).toContain("=");
      expect(example.formula.endsWith(formatEuro398(example.totalCents))).toBe(true);
      for (const band of example.bands) {
        expect(band.formula).toBe(`${formatEuro398(band.taxableBandCents)} × ${formatPercent398(band.rateBasisPoints)} = ${formatEuro398(band.taxCents)}`);
      }
    }
    // Literal proof that the printed formula is the arithmetic of the year.
    const plain = (value: string) => value.replace(/\u00a0/gu, " ");
    expect(plain(irpefCase("irpef-2026-35000").formula)).toBe(
      "28.000,00 € × 23,00% + 7.000,00 € × 33,00% = 8.750,00 €");
    expect(plain(irpefCase("irpef-2025-35000").formula)).toBe(
      "28.000,00 € × 23,00% + 7.000,00 € × 35,00% = 8.890,00 €");
  });

  it("computes the official boundaries and the second-bracket change", () => {
    // 28.000 € sits exactly on the first boundary: no tax in the 33%/35% bracket.
    expect(irpefCase("irpef-2026-28000").totalCents).toBe(644_000);
    expect(irpefCase("irpef-2026-28000").bands[1]!.taxableBandCents).toBe(0);
    // One hundred euro above it: 100 € × 33% = 33 € for 2026.
    expect(irpefCase("irpef-2026-28100").bands[1]!.taxableBandCents).toBe(10_000);
    expect(irpefCase("irpef-2026-28100").totalCents).toBe(647_300);
    // Same taxable income, different official year: 2025 uses 35%.
    expect(irpefCase("irpef-2025-35000").totalCents).toBe(889_000);
    expect(irpefCase("irpef-2026-35000").totalCents).toBe(875_000);
    expect(irpefCase("irpef-2025-35000").totalCents).not.toBe(irpefCase("irpef-2026-35000").totalCents);
  });
});

describe("STR-398 IVA examples stay inside the verified official window", () => {
  it("shows 4/5/10/22 from the pinned table with add and scorporo arithmetic", () => {
    expect(vat.map((entry) => entry.ratePercent).sort((a, b) => a - b)).toEqual([4, 5, 10, 22, 22]);
    for (const example of vat) {
      const category = ANNUAL_VAT_2025_WINDOW_117.categories.find((row) => row.id === example.categoryId)!;
      expect(example.ratePercent).toBe(category.ratePercent);
      expect(example.legalReference).toBe(category.legalReference);
      expect(example.taxYear).toBe(2025);
      expect(example.transactionDate).toBe(VAT_EXAMPLE_DATE_398);
      expect(example.netCents + example.vatCents).toBe(example.grossCents);
      expect(example.sourceUrls.length).toBe(ANNUAL_VAT_2025_WINDOW_117.sources.length);
      expect(example.window).toContain("2025-12-13");
      expect(example.window).toContain("2025-12-31");
    }
  });

  it("reproduces the official boundary amounts for 22% and 4%", () => {
    expect(vatCase("iva-2025-ordinaria-add")).toMatchObject({ netCents: 100_000, vatCents: 22_000, grossCents: 122_000 });
    expect(vatCase("iva-2025-ordinaria-scorporo")).toMatchObject({ netCents: 100_000, vatCents: 22_000, grossCents: 122_000 });
    expect(vatCase("iva-2025-latte-fresco-4-add")).toMatchObject({ netCents: 50_000, vatCents: 2_000, grossCents: 52_000 });
    expect(vatCase("iva-2025-ordinaria-add").formula).toContain("22,00%");
    expect(vatCase("iva-2025-ordinaria-scorporo").formula).toContain("÷");
  });
});

describe("STR-398 missing year or addizionali never invent a calculation", () => {
  it("keeps one explicit refusal for every uncovered case", () => {
    expect(refused.map((entry) => entry.id)).toEqual([
      "irpef-2024", "irpef-addizionali-senza-regione", "iva-2026", "iva-2025-fuori-finestra",
    ]);
    for (const entry of refused) expect(entry.reason.length).toBeGreaterThan(20);
    expect(refused.find((entry) => entry.id === "irpef-2024")!.reason).toMatch(/UNSUPPORTED_FISCAL_TAX_YEAR/u);
    expect(refused.find((entry) => entry.id === "iva-2026")!.reason).toMatch(/VAT117_UNSUPPORTED_YEAR/u);
    expect(refused.find((entry) => entry.id === "iva-2025-fuori-finestra")!.reason).toMatch(/VAT117_UNSUPPORTED_DATE/u);
    const surtaxes = refused.find((entry) => entry.id === "irpef-addizionali-senza-regione")!;
    expect(surtaxes.reason).toMatch(/Addizionale regionale/u);
    expect(surtaxes.reason).toMatch(/Addizionale comunale/u);
    expect(surtaxes.reason).not.toMatch(/determinato: verificare/u);
  });

  it("never exposes a rate for a year outside the pinned sources", () => {
    expect(vat.every((entry) => entry.taxYear === 2025)).toBe(true);
    expect(irpef.every((entry) => entry.taxYear === 2025 || entry.taxYear === 2026)).toBe(true);
    expect(refused.filter((entry) => entry.taxYear === 2026 && entry.id.startsWith("iva-")).map((entry) => entry.id)).toEqual(["iva-2026"]);
  });
});
