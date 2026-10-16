import { describe, expect, it } from "vitest";
import { calculateStipendioNetto13 } from "../src/engines/italy/stipendio-netto-13";

describe("#13 stima RAL basata sugli estratti IRPEF verificati", () => {
  it("riconcilia RAL, contributi dichiarati, imponibile, IRPEF e netto 2025/2026", () => {
    const base = { ralCents: 4_000_000, contributionRatePercent: "9,19", paymentsPerYear: 13 as const };
    const year2025 = calculateStipendioNetto13({ ...base, taxYear: 2025 });
    expect(year2025.employeeContributionsCents).toBe(367_600);
    expect(year2025.taxableIncomeCents).toBe(3_632_400);
    expect(year2025.nationalGrossIrpefCents).toBe(935_340);
    expect(year2025.annualNetBeforeUnmodeledTaxesCents).toBe(2_697_060);
    expect(year2025.employeeContributionsCents + year2025.nationalGrossIrpefCents + year2025.annualNetBeforeUnmodeledTaxesCents).toBe(base.ralCents);
    const year2026 = calculateStipendioNetto13({ ...base, taxYear: 2026 });
    expect(year2026.nationalGrossIrpefCents).toBe(918_692);
    expect(year2026.annualNetBeforeUnmodeledTaxesCents).toBe(2_713_708);
  });

  it("12/13/14 mensilità cambiano solo l'indicazione mensile", () => {
    const results = ([12, 13, 14] as const).map((paymentsPerYear) => calculateStipendioNetto13({ taxYear: 2026, ralCents: 3_500_000, contributionRatePercent: "9.19", paymentsPerYear }));
    expect(new Set(results.map((result) => result.annualNetBeforeUnmodeledTaxesCents)).size).toBe(1);
    expect(results[0]!.indicativePaymentCents).toBeGreaterThan(results[2]!.indicativePaymentCents);
  });

  it("blocca annualità, percentuali e importi non supportati", () => {
    const base = { taxYear: 2026, ralCents: 4_000_000, contributionRatePercent: "9.19", paymentsPerYear: 13 as const };
    expect(() => calculateStipendioNetto13({ ...base, taxYear: 2024 })).toThrow(/UNSUPPORTED_FISCAL_TAX_YEAR/u);
    expect(() => calculateStipendioNetto13({ ...base, contributionRatePercent: "100,01" })).toThrow(/NET13_INVALID_RATE/u);
    expect(() => calculateStipendioNetto13({ ...base, contributionRatePercent: "9.999" })).toThrow(/NET13_INVALID_RATE/u);
    expect(() => calculateStipendioNetto13({ ...base, ralCents: -1 })).toThrow(/NET13_INVALID_RAL/u);
  });
});
