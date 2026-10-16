import { describe, it, expect } from "vitest";
import { calculateIrpefComponents128, IRPEF_128_COVERAGE } from "../src/engines/italy/irpef-components-128";

describe("#128 explicitly sourced 2025 selected components", () => {
  it("shows national, employment deduction and independent Puglia/Bari surtaxes", () => {
    const result = calculateIrpefComponents128({ taxYear: 2025, taxableIncomeCents: 4_000_000,
      region: "puglia", municipality: "bari", employeeFullYearConfirmed: true });
    expect(result.status).toBe("SUPPORTED_COMPONENTS_ONLY");
    expect(result.national.grossNationalTaxCents).toBe(1_064_000);
    expect(result.components.map((x) => [x.id, x.cents])).toEqual([
      ["employee-deduction", 86810], ["puglia-regional", 58100], ["bari-municipal", 32000],
    ]);
    expect(result.selectedComponentsEstimateCents).toBe(1_067_290);
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
    const plus = calculateIrpefComponents128({ taxYear: 2025, taxableIncomeCents: 1_500_001,
      region: "puglia", municipality: "bari", employeeFullYearConfirmed: true });
    expect(plus.components.find((c) => c.id === "bari-municipal")!.cents).toBe(12000);
    const bonus = calculateIrpefComponents128({ taxYear: 2025, taxableIncomeCents: 3_000_000,
      region: "puglia", municipality: "bari", employeeFullYearConfirmed: true });
    expect(bonus.components.find((c) => c.id === "employee-deduction")!.cents).toBe(180119);
  });
  it("missing locality and unsupported 2026 leave sourced national intact and components unknown", () => {
    const partial = calculateIrpefComponents128({ taxYear: 2025, taxableIncomeCents: 4_000_000,
      region: "unknown", municipality: "unknown", employeeFullYearConfirmed: false });
    expect(partial.status).toBe("PARTIAL");
    expect(partial.components).toEqual([]);
    expect(partial.national.grossNationalTaxCents).toBe(1_064_000);
    const year = calculateIrpefComponents128({ taxYear: 2026, taxableIncomeCents: 4_000_000,
      region: "puglia", municipality: "bari", employeeFullYearConfirmed: true });
    expect(year.status).toBe("PARTIAL");
    expect(year.national.grossNationalTaxCents).toBe(1_040_000);
    expect(year.components).toEqual([]);
    expect(Object.values(IRPEF_128_COVERAGE).map((x) => x.year)).toEqual([2025, 2025, 2025]);
    expect(() => calculateIrpefComponents128({ taxYear: 2024, taxableIncomeCents: 4_000_000,
      region: "puglia", municipality: "bari", employeeFullYearConfirmed: true })).toThrow(/UNSUPPORTED_FISCAL_TAX_YEAR/u);
  });
});
