import { describe, it, expect } from "vitest";
import { calculateIrpefComponents128, IRPEF_128_COVERAGE } from "../src/engines/italy/irpef-components-128";

describe("#128 explicitly sourced 2025 selected components", () => {
  it("pins each modeled component to the corresponding primary 2025 legal source", () => {
    // MEF TUIR art. 13 in vigore dal 01/01/2025: https://def.finanze.it/DocTribFrontend/getAttoNormativoDetail.do?ACTION=getArticolo&id=%7B31D694E8-4398-4030-873B-FEAF5A6647F9%7D
    // MEF Regione Puglia 2025: https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/addregirpef.php?anno=2025&reg=14
    // MEF Comune Bari A662 2025: https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/nuova_addcomirpef/risultato.htm?anno=9999&cc=A662&pr=BA&r=1
    expect(IRPEF_128_COVERAGE.deduction.source.url).toContain("def.finanze.it/DocTribFrontend/");
    expect(IRPEF_128_COVERAGE.deduction.source.provision).toContain("art. 13");
    expect(IRPEF_128_COVERAGE.region.source.url).toContain("anno=2025&reg=14");
    expect(IRPEF_128_COVERAGE.municipality.source.url).toContain("cc=A662");
    expect(Object.values(IRPEF_128_COVERAGE).map((item) => item.source.version)).toEqual([
      "2025-01-01", "2025-04-08", "2025-12-20",
    ]);
  });
  it("shows national, employment deduction and independent Puglia/Bari surtaxes", () => {
    const result = calculateIrpefComponents128({ taxYear: 2025, taxableIncomeCents: 4_000_000,
      region: "puglia", municipality: "bari", employeeFullYearConfirmed: true });
    expect(result.status).toBe("SUPPORTED_COMPONENTS_ONLY");
    expect(result.national.grossNationalTaxCents).toBe(1_064_000);
    expect(result.components.map((x) => [x.id, x.cents])).toEqual([
      ["employee-deduction", 86810], ["puglia-regional", 58100], ["bari-municipal", 32000],
    ]);
    expect(result.selectedComponentsEstimateCents).toBe(1_067_290);
    expect(result.finalModeledTaxCents).toBe(1_067_290);
    expect(result.national.grossNationalTaxCents - result.components[0]!.cents
      + result.components[1]!.cents + result.components[2]!.cents).toBe(result.finalModeledTaxCents);
    for (const c of result.components) {
      expect(c.source.url).toMatch(/^https:\/\//u);
      expect(c.source.version).toMatch(/^2025-/u);
      expect(c.breakdown.reduce((sum, row) => sum + row.taxCents, 0)).toBe(c.cents);
    }
  });
  it("honors Bari 15k full exemption, Puglia brackets and employment additional 65 euro", () => {
    const lower = calculateIrpefComponents128({ taxYear: 2025, taxableIncomeCents: 1_500_000,
      region: "puglia", municipality: "bari", employeeFullYearConfirmed: true });
    expect(lower.components.map((c) => c.cents)).toEqual([195500, 19950, 0]);
    expect(lower.finalModeledTaxCents).toBe(169450);
    const plus = calculateIrpefComponents128({ taxYear: 2025, taxableIncomeCents: 1_500_001,
      region: "puglia", municipality: "bari", employeeFullYearConfirmed: true });
    expect(plus.components.find((c) => c.id === "bari-municipal")!.cents).toBe(12000);
    const bonus = calculateIrpefComponents128({ taxYear: 2025, taxableIncomeCents: 3_000_000,
      region: "puglia", municipality: "bari", employeeFullYearConfirmed: true });
    expect(bonus.components.find((c) => c.id === "employee-deduction")!.cents).toBe(180119);
  });
  it.each([500_000, 850_000, 850_002])("does not charge surtaxes when the confirmed deduction cancels national IRPEF (%i cents)", (taxableIncomeCents) => {
    const result = calculateIrpefComponents128({ taxYear: 2025, taxableIncomeCents,
      region: "puglia", municipality: "bari", employeeFullYearConfirmed: true });
    expect(result.nationalAfterSelectedDeductionCents).toBe(0);
    expect(result.components.filter((c) => c.id !== "employee-deduction").map((c) => [c.id, c.cents]))
      .toEqual([["puglia-regional", 0], ["bari-municipal", 0]]);
    expect(result.selectedComponentsEstimateCents).toBe(0);
    expect(result.finalModeledTaxCents).toBe(0);
    for (const c of result.components) {
      expect(c.breakdown.reduce((sum, row) => sum + row.taxCents, 0)).toBe(c.cents);
    }
  });
  it("starts the regional estimate only once the simulated national net becomes positive", () => {
    const result = calculateIrpefComponents128({ taxYear: 2025, taxableIncomeCents: 850_003,
      region: "puglia", municipality: "bari", employeeFullYearConfirmed: true });
    expect(result.nationalAfterSelectedDeductionCents).toBe(1);
    expect(result.components.find((c) => c.id === "puglia-regional")?.cents).toBe(11305);
    expect(result.components.find((c) => c.id === "bari-municipal")?.cents).toBe(0);
  });
  it.each([500_000, 4_000_000])("keeps net and surtaxes unknown without confirmed deduction conditions (%i cents)", (taxableIncomeCents) => {
    const result = calculateIrpefComponents128({ taxYear: 2025, taxableIncomeCents,
      region: "puglia", municipality: "bari", employeeFullYearConfirmed: false });
    expect(result.status).toBe("PARTIAL");
    expect(result.national.grossNationalTaxCents).toBeGreaterThan(0);
    expect(result.nationalAfterSelectedDeductionCents).toBeNull();
    expect(result.selectedComponentsEstimateCents).toBeNull();
    expect(result.finalModeledTaxCents).toBeNull();
    expect(result.components).toEqual([]);
    expect(result.unsupported.join(" ")).toMatch(/IRPEF netta/u);
  });
  it("missing locality and unsupported 2026 leave sourced national intact and components unknown", () => {
    const partial = calculateIrpefComponents128({ taxYear: 2025, taxableIncomeCents: 4_000_000,
      region: "unknown", municipality: "unknown", employeeFullYearConfirmed: false });
    expect(partial.status).toBe("PARTIAL");
    expect(partial.components).toEqual([]);
    expect(partial.finalModeledTaxCents).toBeNull();
    expect(partial.national.grossNationalTaxCents).toBe(1_064_000);
    const year = calculateIrpefComponents128({ taxYear: 2026, taxableIncomeCents: 4_000_000,
      region: "puglia", municipality: "bari", employeeFullYearConfirmed: true });
    expect(year.status).toBe("PARTIAL");
    expect(year.national.grossNationalTaxCents).toBe(1_040_000);
    expect(year.components).toEqual([]);
    expect(year.finalModeledTaxCents).toBeNull();
    expect(Object.values(IRPEF_128_COVERAGE).map((x) => x.year)).toEqual([2025, 2025, 2025]);
    expect(() => calculateIrpefComponents128({ taxYear: 2024, taxableIncomeCents: 4_000_000,
      region: "puglia", municipality: "bari", employeeFullYearConfirmed: true })).toThrow(/UNSUPPORTED_FISCAL_TAX_YEAR/u);
  });
  it("refuses a final modeled amount when only some of the sourced 2025 components are selected", () => {
    for (const [region, municipality] of [
      ["puglia", "unknown"], ["unknown", "bari"], ["unknown", "unknown"],
    ] as const) {
      const result = calculateIrpefComponents128({ taxYear: 2025, taxableIncomeCents: 4_000_000,
        region, municipality, employeeFullYearConfirmed: true });
      expect(result.status).toBe("PARTIAL");
      expect(result.finalModeledTaxCents).toBeNull();
      expect(result.unsupported.length).toBeGreaterThan(0);
    }
  });
});
