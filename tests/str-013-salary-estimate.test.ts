import { describe, expect, it } from "vitest";
import { estimateSalaryNet13, SALARY_13_INPS_2025 } from "../src/engines/italy/salary-net-13";

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

  it("uses the exact 2025 employment/Puglia/Bari fiscal engine with explicitly confirmed base", () => {
    // TUIR art. 13 (MEF): https://def.finanze.it/DocTribFrontend/getAttoNormativoDetail.do?ACTION=getArticolo&id=%7B31D694E8-4398-4030-873B-FEAF5A6647F9%7D
    // 2025 Puglia and Bari MEF: https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/addregirpef.php?anno=2025&reg=14
    // https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/nuova_addcomirpef/risultato.htm?anno=9999&cc=A662&pr=BA&r=1
    const supported = { ...input, taxYear: 2025, confirmsContributionBase: true,
      employeeFullYearConfirmed: true, region: "puglia" as const, municipality: "bari" as const };
    const rows = ([12, 13, 14] as const).map((installments) => estimateSalaryNet13({ ...supported, installments }));
    const [annual] = rows;
    expect(annual!.finalModeledTaxCents).not.toBeNull();
    expect(annual!.modeledTaxComponents.map((part) => part.id)).toEqual([
      "employee-deduction", "puglia-regional", "bari-municipal",
    ]);
    const deduction = annual!.modeledTaxComponents[0]!.cents;
    const region = annual!.modeledTaxComponents[1]!.cents;
    const city = annual!.modeledTaxComponents[2]!.cents;
    expect(annual!.finalModeledTaxCents).toBe(annual!.grossNationalTaxCents - deduction + region + city);
    expect(annual!.ralCents - annual!.contributionsCents - annual!.finalModeledTaxCents!)
      .toBe(annual!.modeledAnnualNetCents);
    expect(new Set(rows.map((row) => row.modeledAnnualNetCents)).size).toBe(1);
    expect(new Set(rows.map((row) => row.finalModeledTaxCents)).size).toBe(1);
    expect(rows[0]!.indicativeModeledInstallmentCents).toBeGreaterThan(rows[2]!.indicativeModeledInstallmentCents!);
    expect(annual!.unsupportedTaxComponents).toEqual([]);
    expect(estimateSalaryNet13({ ...supported, confirmsContributionBase: false }).modeledAnnualNetCents).toBeNull();
    expect(estimateSalaryNet13({ ...supported, region: "unknown" }).modeledAnnualNetCents).toBeNull();
    expect(estimateSalaryNet13({ ...supported, municipality: "unknown" }).modeledAnnualNetCents).toBeNull();
    expect(estimateSalaryNet13({ ...supported, taxYear: 2026 }).modeledAnnualNetCents).toBeNull();
  });

  it("pins the bounded ordinary agricultural 2025 FPLD worker profile to primary INPS circular", () => {
    // INPS circolare 46/2025 §2: https://www.inps.it/content/dam/inps-site/it/scorporati/circolari-e-messaggi/2025/02/Circolare_14840/Allegati/15918_Circolare-numero-46-del-20-02-2025.pdf
    expect(SALARY_13_INPS_2025.url).toContain("inps.it/");
    expect(SALARY_13_INPS_2025.version).toBe("2025-02-20");
    const supported = { taxYear: 2025, ralCents: 4_000_000, employeeRate: "",
      installments: 13 as const, contributionProfile: "agricultural-2025-fpld" as const,
      confirmsContributionBase: true, employeeFullYearConfirmed: true,
      region: "puglia" as const, municipality: "bari" as const };
    const result = estimateSalaryNet13(supported);
    expect(result.contributionRate).toBe("8.84");
    expect(result.contributionsCents).toBe(353_600);
    expect(result.contributionSource?.url).toBe(SALARY_13_INPS_2025.url);
    expect(result.modeledAnnualNetCents).not.toBeNull();
    expect(result.contributionsCents + result.finalModeledTaxCents! + result.modeledAnnualNetCents!).toBe(4_000_000);
    expect(() => estimateSalaryNet13({ ...supported, taxYear: 2026 })).toThrow(/SALARY13_INPS_SCOPE/u);
    expect(() => estimateSalaryNet13({ ...supported, confirmsContributionBase: false })).toThrow(/SALARY13_INPS_SCOPE/u);
    expect(() => estimateSalaryNet13({ ...supported, ralCents: 5_000_001 })).toThrow(/SALARY13_INPS_SCOPE/u);
    expect(() => estimateSalaryNet13({ ...supported, contributionProfile: "unknown" as "agricultural-2025-fpld" })).toThrow(/SALARY13_INPS_SCOPE/u);
  });
});
