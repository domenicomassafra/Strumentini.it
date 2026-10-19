import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  calculateEverydayCost,
  calculateGeometryEquationMotion,
  calculateMortgageAmortization,
  runBusinessOperation,
  validateInvoiceMath,
  type BusinessOperation,
  type EverydayCostInput,
  type GeometryEquationMotionInput,
  type MortgageAmortizationInput,
} from "../src/engines/business-math";
import mortgageModule from "../src/tools/mortgage-amortization-calculator/module";
import geometryModule from "../src/tools/geometry-equation-motion-helper/module";
import everydayModule from "../src/tools/everyday-cost-calculator/module";
import invoiceMathValidatorModule from "../src/tools/invoice-math-validator/module";
import type { ToolExecutionContext } from "../src/runtime/types";

const context: ToolExecutionContext = {
  defaults: {
    currency: { field: "currency", value: "EUR", provenance: "profile" },
  },
};

interface ExpectedVector {
  readonly case: string;
  readonly input: Record<string, string>;
  readonly expected: Record<string, unknown>;
}

interface ExpansionFixture {
  readonly tool_vectors: readonly {
    readonly tool_id: string;
    readonly operation: BusinessOperation;
    readonly input: Record<string, unknown>;
    readonly expected: Record<string, unknown>;
  }[];
  readonly mortgage: readonly ExpectedVector[];
  readonly geometry_motion: readonly ExpectedVector[];
  readonly everyday_cost: readonly ExpectedVector[];
}

const fixtures = JSON.parse(
  readFileSync(new URL("../quality/fixtures/business-math-expansion/vectors.json", import.meta.url), "utf8"),
) as ExpansionFixture;

function cents(value: string): bigint {
  const match = /^(-?)(\d+)\.(\d{2})$/u.exec(value);
  if (match === null) throw new Error(`invalid money literal: ${value}`);
  const magnitude = BigInt(match[2]!) * 100n + BigInt(match[3]!);
  return match[1] === "-" ? -magnitude : magnitude;
}

function expectFields(actual: Record<string, unknown>, expected: Record<string, unknown>, label: string) {
  for (const [key, value] of Object.entries(expected)) expect(actual[key], `${label}.${key}`).toEqual(value);
}

describe("tickets 16, 144 and 147 — adjacent business-math expansion", () => {
  it("matches one independent literal vector for each newly catalogued tool", () => {
    expect(fixtures.tool_vectors).toHaveLength(3);
    for (const vector of fixtures.tool_vectors) {
      const result = runBusinessOperation(vector.operation, vector.input) as Record<string, unknown>;
      expectFields(result, vector.expected, vector.tool_id);
    }
  });

  it("normalizes the three runtime modules and decorates money tools with currency provenance", () => {
    expect(mortgageModule.run({ principal: "100000", annualRatePercent: "3", termMonths: "12" }, context)).toMatchObject({ monthlyPayment: 8469.37, currency: "EUR", currencyProvenance: "profile" });
    expect(geometryModule.run({ mode: "rectangle", width: "4", height: "3", lengthUnit: "meter" }, context)).toMatchObject({ result: 12, area: "12.00000000 m²" });
    expect(everydayModule.run({ mode: "split-bill", bill: "100", tipPercent: "10", people: "3" }, context)).toMatchObject({ baseShare: "36.66", currency: "EUR", currencyProvenance: "profile" });
  });

  it("ticket 16 reconciles French-amortization rows, totals and CSV across normal, zero-rate, short and long terms", () => {
    for (const vector of fixtures.mortgage) {
      const result = calculateMortgageAmortization(vector.input as unknown as MortgageAmortizationInput);
      const expected = { ...vector.expected };
      const firstInterest = expected.firstInterest;
      const lastBalance = expected.lastBalance;
      delete expected.firstInterest;
      delete expected.lastBalance;
      expectFields(result as unknown as Record<string, unknown>, expected, vector.case);
      if (typeof firstInterest === "string") expect(result.scheduleRows[0]?.interest).toBe(firstInterest);
      if (typeof lastBalance === "string") expect(result.scheduleRows.at(-1)?.balance).toBe(lastBalance);
      expect(result.scheduleRows).toHaveLength(Number(vector.input.termMonths));
      expect(result.scheduleRows.at(-1)?.balance).toBe("0.00");

      const paid = result.scheduleRows.reduce((sum, row) => sum + cents(row.payment), 0n);
      const principal = result.scheduleRows.reduce((sum, row) => sum + cents(row.principal), 0n);
      const interest = result.scheduleRows.reduce((sum, row) => sum + cents(row.interest), 0n);
      expect(cents(result.totalRepaid)).toBe(paid);
      expect(cents(result.principal)).toBe(principal);
      expect(cents(result.totalInterest)).toBe(interest);
      expect(paid).toBe(principal + interest);
      expect(result.scheduleCsv.split("\n")).toHaveLength(result.termMonths + 2);
      expect(result.scheduleCsv.startsWith("period,payment,principal,interest,balance\n")).toBe(true);
      expect(result.schedulePreview.length).toBeLessThanOrEqual(8);
    }
  });

  it("ticket 16 exposes financial assumptions and fails closed outside the supported cent-precision domain", () => {
    const zero = calculateMortgageAmortization({ principal: "1200", annualRatePercent: "0", termMonths: "12" });
    expect(zero.periodicRatePercent).toBe("0.00000000");
    expect(zero.formulas.payment).toContain("capitale ÷ numero rate");
    expect(zero.assumptions.tan).toContain("TAN nominale annuo");
    expect(zero.assumptions.feesAndTaeg).toContain("TAEG");
    expect(zero.assumptions.rounding).toContain("half-up");
    expect(() => calculateMortgageAmortization({ principal: "0", annualRatePercent: "3", termMonths: "12" })).toThrow("INVALID_PRINCIPAL");
    expect(() => calculateMortgageAmortization({ principal: "1000", annualRatePercent: "-1", termMonths: "12" })).toThrow("INVALID_RATE");
    expect(() => calculateMortgageAmortization({ principal: "1000", annualRatePercent: "3", termMonths: "12.5" })).toThrow("INVALID_TERM_MONTHS");
    expect(() => calculateMortgageAmortization({ principal: "0.01", annualRatePercent: "0", termMonths: "3600" })).toThrow("TERM_NOT_REPRESENTABLE_AT_CENT_PRECISION");
  });

  it("ticket 146 generalizes the amortization primitive to generic loan scenarios without inventing fees", () => {
    const zero = calculateMortgageAmortization({ principal: "1200", annualRatePercent: "0", termMonths: "12" });
    expect(zero).toMatchObject({ monthlyPayment: 100, totalRepaid: "1200.00", explicitFees: "0.00", totalCost: "1200.00" });
    const withFee = calculateMortgageAmortization({ principal: "10000", annualRatePercent: "6", termMonths: "24", explicitFees: "250" });
    expect(withFee.explicitFees).toBe("250.00");
    expect(cents(withFee.totalCost)).toBe(cents(withFee.totalRepaid) + 25_000n);
    expect(withFee.scheduleRows.at(-1)?.balance).toBe("0.00");
    expect(withFee.assumptions.feesAndTaeg).toContain("Solo la spesa una tantum inserita esplicitamente");
    const sameWithoutFee = calculateMortgageAmortization({ principal: "10000", annualRatePercent: "6", termMonths: "24" });
    expect(withFee.monthlyPayment).toBe(sameWithoutFee.monthlyPayment);
    expect(withFee.totalRepaid).toBe(sameWithoutFee.totalRepaid);
    expect(() => calculateMortgageAmortization({ principal: "1000", annualRatePercent: "3", termMonths: "12", explicitFees: "-1" })).toThrow("INVALID_FEES");
  });

  it("ticket 144 matches known geometry/equation/motion literals and states the non-real-root boundary", () => {
    for (const vector of fixtures.geometry_motion) {
      const result = calculateGeometryEquationMotion(vector.input as unknown as GeometryEquationMotionInput);
      expectFields(result, vector.expected, vector.case);
    }
    expect(() => calculateGeometryEquationMotion({ mode: "rectangle", width: "-1", height: "2", lengthUnit: "meter" })).toThrow("INVALID_DIMENSION");
    expect(() => calculateGeometryEquationMotion({ mode: "quadratic", coefficientA: "0", coefficientB: "2", coefficientC: "1" })).toThrow("DEGENERATE_QUADRATIC");
    expect(calculateGeometryEquationMotion({ mode: "quadratic", coefficientA: "1", coefficientB: "0", coefficientC: "1" })).toMatchObject({ result: "Nessuna radice reale", rootType: "non-real" });
    expect(() => calculateGeometryEquationMotion({ mode: "speed", distance: "1", distanceUnit: "kilometer", time: "0", timeUnit: "hour", speedUnit: "kilometer-per-hour" })).toThrow("INVALID_TIME");
    expect(() => calculateGeometryEquationMotion({ mode: "time", distance: "1", distanceUnit: "kilometer", speed: "0", speedUnit: "kilometer-per-hour", timeUnit: "hour" })).toThrow("INVALID_SPEED");
    expect(() => calculateGeometryEquationMotion({ mode: "speed", distance: "1", distanceUnit: "kilogram", time: "1", timeUnit: "hour", speedUnit: "kilometer-per-hour" })).toThrow();
  });

  it("ticket 147 matches worked costs, deterministic split remainder and explicit zero-use/work-basis policies", () => {
    for (const vector of fixtures.everyday_cost) {
      const result = calculateEverydayCost(vector.input as unknown as EverydayCostInput);
      expectFields(result, vector.expected, vector.case);
    }
    expect(calculateEverydayCost({ mode: "energy-cost", power: "1500", powerUnit: "watt", usageHours: "0", pricePerKwh: "0.30" })).toMatchObject({ result: 0, amount: "0.00" });
    expect(calculateEverydayCost({ mode: "car-trip-cost", distance: "0", distanceUnit: "kilometer", consumptionLitersPer100Km: "6.5", fuelPricePerLiter: "1.85" })).toMatchObject({ result: 0, amount: "0.00" });
    const salary = calculateEverydayCost({ mode: "salary-hourly", salaryDirection: "hourly-to-salary", amount: "20", hoursPerWeek: "40", weeksPerYear: "52" });
    expect(salary).toMatchObject({ result: 41600, annualSalary: "41600.00", assumedAnnualHours: "2080" });
    expect((salary.assumptions as { workingBasis: string }).workingBasis).toContain("40 ore/settimana × 52 settimane/anno");
    expect(() => calculateEverydayCost({ mode: "unit-price", price: "2", quantity: "1", quantityUnit: "kilogram", normalizeUnit: "liter" })).toThrow("CROSS_DIMENSION_CONVERSION");
    expect(() => calculateEverydayCost({ mode: "split-bill", bill: "10", people: "0" })).toThrow("INVALID_PEOPLE");
  });
});

describe("ticket 313 — invoice discounts at the inclusive upper bound", () => {
  const line = { lineItems: [{ quantity: "1", unitPrice: "100", discountPercent: "100" }], taxRatePercent: "22", total: "0" };
  const order = { subtotal: "100", discountPercent: "100", taxRatePercent: "22", total: "0" };

  it("accepts 100% at line and order level, keeping the cent-rounding contract", () => {
    expect(validateInvoiceMath(line)).toMatchObject({ subtotal: "0.00", taxableAmount: "0.00", taxAmount: "0.00", expectedTotal: "0.00", difference: "0.00", valid: true, issues: [] });
    expect(validateInvoiceMath(order)).toMatchObject({ subtotal: "100.00", discountAmount: "100.00", taxableAmount: "0.00", taxAmount: "0.00", expectedTotal: "0.00", valid: true, issues: [] });
    expect(validateInvoiceMath({ ...order, discountPercent: "99.99", total: "0.01" })).toMatchObject({ taxableAmount: "0.01", expectedTotal: "0.01", valid: true, issues: [] });
    for (const discountPercent of ["-1", "101"]) {
      expect(() => validateInvoiceMath({ ...order, discountPercent })).toThrow("INVALID_DISCOUNT_RATE");
      expect(() => validateInvoiceMath({ ...line, lineItems: [{ ...line.lineItems[0]!, discountPercent }] })).toThrow("INVALID_DISCOUNT_RATE");
    }
  });

  it("exposes those values and typed range failures through the invoice tool module", () => {
    expect(invoiceMathValidatorModule.run(order, context)).toMatchObject({ expectedTotal: "0.00", valid: true, currency: "EUR" });
    expect(invoiceMathValidatorModule.run(line, context)).toMatchObject({ expectedTotal: "0.00", valid: true, currency: "EUR" });
    expect(invoiceMathValidatorModule.run({ ...order, discountPercent: "99.99", total: "0.01" }, context)).toMatchObject({ expectedTotal: "0.01", valid: true });
    for (const discountPercent of ["-1", "101"]) {
      expect(() => invoiceMathValidatorModule.run({ ...order, discountPercent }, context)).toThrow("INVALID_DISCOUNT_RATE");
      expect(() => invoiceMathValidatorModule.run({ ...line, lineItems: [{ ...line.lineItems[0]!, discountPercent }] }, context)).toThrow("INVALID_DISCOUNT_RATE");
    }
  });
});
