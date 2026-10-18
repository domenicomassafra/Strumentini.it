import { describe, expect, it } from "vitest";
import { estimateSalaryNet13 } from "../src/engines/italy/salary-net-13";

describe("STR-013: RAL, explicit contributions and verified national gross IRPEF only", () => {
  const input = { taxYear: 2026, ralCents: 4_000_000, employeeRate: "9,19", installments: 13 as const };

  it("uses caller-declared contributions and reconciles the transparent annual bridge", () => {
    const result = estimateSalaryNet13(input);
    expect(result.contributionsCents).toBe(367_600);
    expect(result.taxableCents).toBe(3_632_400);
    expect(result.grossNationalTaxCents).toBe(918_692);
    expect(result.partialAnnualNetCents).toBe(2_713_708);
    expect(result.contributionsCents + result.grossNationalTaxCents + result.partialAnnualNetCents).toBe(input.ralCents);
    expect(result.assumptions).toContain("non determina il netto in busta paga");
    expect(result.sources.length).toBeGreaterThan(0);
  });

  it("changes presentation only when changing 12, 13 or 14 payments", () => {
    const results = ([12, 13, 14] as const).map((installments) => estimateSalaryNet13({ ...input, installments }));
    expect(new Set(results.map((result) => result.partialAnnualNetCents)).size).toBe(1);
    expect(new Set(results.map((result) => result.grossNationalTaxCents)).size).toBe(1);
    expect(results[0]!.indicativeInstallmentCents).toBeGreaterThan(results[2]!.indicativeInstallmentCents);
  });

  it("refuses unsupported years and invented/inexact amounts or rates", () => {
    expect(() => estimateSalaryNet13({ ...input, taxYear: 2027 })).toThrow(/UNSUPPORTED_FISCAL_TAX_YEAR/u);
    for (const employeeRate of ["", "9.999", "101", "-9", "NaN", "9,2,3", "1e2"]) {
      expect(() => estimateSalaryNet13({ ...input, employeeRate })).toThrow(/SALARY13_RATE/u);
    }
    for (const ralCents of [NaN, -1, 2.5, Number.MAX_SAFE_INTEGER]) {
      expect(() => estimateSalaryNet13({ ...input, ralCents })).toThrow(/SALARY13_RAL/u);
    }
    expect(() => estimateSalaryNet13({ ...input, installments: 11 as 12 })).toThrow(/SALARY13_INSTALLMENTS/u);
  });

  it("does not fabricate tax or benefits from a zero-contribution scenario", () => {
    const result = estimateSalaryNet13({ taxYear: 2025, ralCents: 0, employeeRate: "0", installments: 12 });
    expect(result.partialAnnualNetCents).toBe(0);
    expect(result.grossNationalTaxCents).toBe(0);
  });
});
