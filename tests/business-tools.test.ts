import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  calculateBreakEven,
  calculateCurrencyScenario,
  calculateDiscountImpact,
  calculateEffectiveHourlyRate,
  calculateLatePaymentInterest,
  calculatePercentage,
  calculateProjectProfitability,
  calculateRetainerCapacity,
  calculateScopeCreepCost,
  calculateTargetIncomeRate,
  calculateUtilization,
  checkProposalBudget,
  generateInvoiceNumber,
  grossUpForFee,
  planCapacity,
  runBusinessOperation,
  validateInvoiceMath,
  type BusinessOperation,
} from "../src/engines/business-math";
import marginMarkupModule from "../src/tools/margin-markup/module";
import rateConverterModule from "../src/tools/rate-converter/module";
import timezoneOverlapModule from "../src/tools/timezone-overlap/module";
import effectiveHourlyRateModule from "../src/tools/effective-hourly-rate/module";
import targetIncomeRateModule from "../src/tools/target-income-rate/module";
import utilizationCalculatorModule from "../src/tools/utilization-calculator/module";
import capacityPlannerModule from "../src/tools/capacity-planner/module";
import retainerCapacityModule from "../src/tools/retainer-capacity/module";
import scopeCreepCostModule from "../src/tools/scope-creep-cost/module";
import breakEvenModule from "../src/tools/break-even/module";
import paymentFeeGrossUpModule from "../src/tools/payment-fee-gross-up/module";
import latePaymentInterestModule from "../src/tools/late-payment-interest/module";
import discountImpactModule from "../src/tools/discount-impact/module";
import proposalBudgetCheckerModule from "../src/tools/proposal-budget-checker/module";
import projectProfitabilityModule from "../src/tools/project-profitability/module";
import invoiceNumberGeneratorModule from "../src/tools/invoice-number-generator/module";
import invoiceMathValidatorModule from "../src/tools/invoice-math-validator/module";
import percentageHelperModule from "../src/tools/percentage-helper/module";
import currencyScenarioModule from "../src/tools/currency-scenario/module";
import type { ToolExecutionContext } from "../src/runtime/types";
import { toolRuntime } from "../src/runtime/tool-runtime";

const context: ToolExecutionContext = {
  defaults: {
    currency: { field: "currency", value: "EUR", provenance: "profile" },
    hoursPerDay: { field: "hoursPerDay", value: "8", provenance: "tool-default" },
    timezone: { field: "timezone", value: "Europe/Rome", provenance: "profile" },
    workingHours: { field: "workingHours", value: { start: "09:00", end: "17:00" }, provenance: "tool-default" },
  },
};

interface BusinessGoldVector {
  readonly tool_id: string;
  readonly operation: BusinessOperation;
  readonly input: Record<string, unknown>;
  readonly expected: Record<string, unknown>;
}

function goldVectors(path: string): BusinessGoldVector[] {
  const value = JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as { tool_vectors?: BusinessGoldVector[] };
  return value.tool_vectors ?? [];
}

const independentGoldVectors = [
  ...goldVectors("../quality/fixtures/business-math/vectors.json"),
  ...goldVectors("../quality/fixtures/percentage-math/vectors.json"),
];

function run<T>(module: { run: (input: unknown, context: ToolExecutionContext) => unknown }, input: unknown): T {
  return module.run(input, context) as T;
}

describe("business/independent-work deterministic engine", () => {
  it("matches one independent literal Gold vector for every business-math tool", () => {
    expect(independentGoldVectors).toHaveLength(16);
    expect(new Set(independentGoldVectors.map((vector) => vector.tool_id)).size).toBe(16);
    for (const vector of independentGoldVectors) {
      const actual = runBusinessOperation(vector.operation, vector.input) as Record<string, unknown>;
      for (const [key, expected] of Object.entries(vector.expected)) expect(actual[key], `${vector.tool_id}.${key}`).toEqual(expected);
    }
  });

  it("calculates effective hourly rate from net revenue", () => {
    expect(calculateEffectiveHourlyRate({ revenue: "1200", hours: "24", costs: "200" })).toMatchObject({
      effectiveHourlyRate: "41.67",
      effectiveHourly: "41.67",
      profit: "1000.00",
    });
    expect(calculateEffectiveHourlyRate({ revenue: "10.075", hours: "1" }).effectiveHourlyRate).toBe("10.08");
  });

  it("calculates target income rate against billable and total hours", () => {
    expect(calculateTargetIncomeRate({ targetIncome: "60000", expenses: "5000", billableHours: "1200", nonBillableHours: "200" })).toMatchObject({
      requiredHourlyRate: "54.17",
      allHoursRate: "46.43",
      totalHours: "1400",
    });
  });

  it("calculates utilization without capping over-utilization", () => {
    expect(calculateUtilization({ availableHours: "160", billableHours: "120" }).utilizationPercent).toBe("75.00");
    expect(calculateUtilization({ availableHours: "40", billableHours: "50" }).utilizationPercent).toBe("125.00");
  });

  it("plans capacity after a target and reserve", () => {
    expect(planCapacity({ availableHours: "160", targetUtilizationPercent: "80", reservedHours: "16" })).toMatchObject({
      plannedBillableHours: "128.00",
      availableForDelivery: "112.00",
      overallocated: false,
    });
  });

  it("rounds retainer client capacity down to whole clients", () => {
    expect(calculateRetainerCapacity({ capacityHours: "120", deliveryHoursPerClient: "20", retainerAmount: "2000", monthlyCosts: "0", targetMarginPercent: "0" })).toMatchObject({
      clientCapacity: "6",
      capacityRemainderHours: "0.00",
      contributionPerClientHour: "100.00",
    });
  });

  it("prices scope creep and budget variance", () => {
    expect(calculateScopeCreepCost({ hourlyRate: "100", originalHours: "40", additionalHours: "5", originalBudget: "4000" })).toMatchObject({
      additionalCost: "500.00",
      revisedCost: "4500.00",
      budgetVariance: "-500.00",
    });
  });

  it("rounds break-even units upward", () => {
    expect(calculateBreakEven({ fixedCosts: "1000", unitPrice: "25", unitVariableCost: "15" })).toMatchObject({
      contributionPerUnit: "10.00",
      breakEvenUnits: "100",
      units: "100",
      breakEvenRevenue: "2500.00",
    });
  });

  it("grosses up a payment fee rather than multiplying it", () => {
    expect(grossUpForFee({ targetNet: "100", feePercent: "3" })).toMatchObject({ gross: "103.09", fee: "3.09", feeRate: "0.03" });
  });

  it("uses the selected day-count basis for late interest", () => {
    expect(calculateLatePaymentInterest({ principal: "1000", annualRatePercent: "12", daysLate: "30", dayCountBasis: 365 })).toMatchObject({ interest: "9.86", totalDue: "1009.86" });
  });

  it("shows unit and volume discount impact", () => {
    expect(calculateDiscountImpact({ originalPrice: "100", discountPercent: "10", units: "100" })).toMatchObject({
      discountedUnitPrice: "90.00",
      lostRevenue: "1000.00",
    });
  });

  it("checks a proposal against its target margin", () => {
    expect(checkProposalBudget({ quotedPrice: "10000", estimatedHours: "80", hourlyRate: "100", directCosts: "500", contingencyPercent: "10", targetMarginPercent: "30" })).toMatchObject({
      totalCost: "9300.00",
      requiredPriceForTargetMargin: "13285.71",
      meetsTargetMargin: false,
    });
  });

  it("calculates project profit and effective hourly return", () => {
    expect(calculateProjectProfitability({ revenue: "10000", fixedCosts: "1000", hours: "80", hourlyCost: "50" })).toMatchObject({
      totalCost: "5000.00",
      profit: "5000.00",
      marginPercent: "50.00",
      marginRate: "0.5000",
      effectiveHourlyRate: "125.00",
    });
  });

  it("formats an invoice number without hidden state", () => {
    expect(generateInvoiceNumber({ prefix: "inv", year: "2026", sequence: "7" })).toMatchObject({
      invoiceNumber: "INV-2026-0007",
      format: "INV{separator}{year}{separator}{sequence}",
    });
  });

  it("validates invoice tax arithmetic and reports a mismatch", () => {
    expect(validateInvoiceMath({ subtotal: "100", taxRatePercent: "20", total: "120" })).toMatchObject({ expectedTotal: "120.00", difference: "0.00", valid: true });
    expect(validateInvoiceMath({ subtotal: "100", taxRatePercent: "20", total: "121" })).toMatchObject({ difference: "1.00", valid: false, issues: ["TOTAL_MISMATCH"] });
  });

  it("adds and reverses general percentages", () => {
    expect(calculatePercentage({ base: "100", ratePercent: "20", mode: "add" })).toMatchObject({ percentageAmount: "20.00", result: "20.00", total: "120.00" });
    expect(calculatePercentage({ base: "200", percent: "20" })).toMatchObject({ result: "40.00" });
    expect(calculatePercentage({ amount: "120", ratePercent: "20", mode: "reverse" })).toMatchObject({ net: "100.00", percentageAmount: "20.00" });
  });

  it("covers the human percentage modes with exact decimal math", () => {
    expect(calculatePercentage({ base: "250", ratePercent: "12,5", mode: "of" })).toMatchObject({ result: "31.25" });
    expect(calculatePercentage({ base: "80", amount: "20", mode: "what-percent" })).toMatchObject({ result: "25.00", ratePercent: "25.00" });
    expect(calculatePercentage({ base: "80", ratePercent: "25", mode: "increase" })).toMatchObject({ result: "100.00" });
    expect(calculatePercentage({ base: "80", ratePercent: "25", mode: "decrease" })).toMatchObject({ result: "60.00" });
    expect(calculatePercentage({ base: "80", amount: "100", mode: "variation" })).toMatchObject({ result: "25.00" });
    expect(calculatePercentage({ base: "80", ratePercent: "20", mode: "reverse-discount" })).toMatchObject({ result: "100.00" });
    expect(calculatePercentage({ base: "100", rates: ["10", "20"], mode: "cascade" })).toMatchObject({ result: "72.00", ratePercent: "28.00", rates: ["10.00", "20.00"] });
  });

  it("defines negative, 100%+, and zero-denominator percentage edges", () => {
    expect(calculatePercentage({ base: "-100", ratePercent: "10", mode: "of" })).toMatchObject({ result: "-10.00" });
    expect(calculatePercentage({ base: "100", ratePercent: "125", mode: "decrease" })).toMatchObject({ result: "-25.00" });
    expect(calculatePercentage({ base: "100", ratePercent: "100", mode: "decrease" })).toMatchObject({ result: "0.00" });
    expect(() => calculatePercentage({ base: "0", amount: "2", mode: "what-percent" })).toThrow("INVALID_BASE");
    expect(() => calculatePercentage({ base: "80", ratePercent: "100", mode: "reverse-discount" })).toThrow("INVALID_RATE");
    expect(() => calculatePercentage({ base: "80", ratePercent: "-100", mode: "reverse" })).toThrow("INVALID_RATE");
  });

  it("applies a manually entered currency scenario and its inverse", () => {
    expect(calculateCurrencyScenario({ amount: "100", rate: "1.2", fromCurrency: "EUR", toCurrency: "USD" })).toMatchObject({
      convertedAmount: "120.00",
      rate: "1.2",
      inverseRate: "0.83333333",
    });
  });
});

describe("business/independent-work tool modules and canonical routes", () => {
  it("runs effective hourly rate through the module with profile provenance", () => {
    expect(run<Record<string, unknown>>(effectiveHourlyRateModule, { revenue: "1000", hours: "20", costs: "100" })).toMatchObject({ effectiveHourlyRate: "45.00", currency: "EUR", currencyProvenance: "profile" });
  });

  it("runs target income, utilization, and capacity modules", () => {
    expect(run<Record<string, unknown>>(targetIncomeRateModule, { targetIncome: "1000", billableHours: "10" })).toMatchObject({ requiredHourlyRate: "100.00" });
    expect(run<Record<string, unknown>>(utilizationCalculatorModule, { availableHours: "10", billableHours: "5" })).toMatchObject({ utilizationPercent: "50.00" });
    expect(run<Record<string, unknown>>(capacityPlannerModule, { availableHours: "10", targetUtilizationPercent: "50", reservedHours: "1" })).toMatchObject({ availableForDelivery: "4.00" });
  });

  it("runs retainer, scope, and break-even modules", () => {
    expect(run<Record<string, unknown>>(retainerCapacityModule, { capacityHours: "100", deliveryHoursPerClient: "20" })).toMatchObject({ clientCapacity: "5", currency: "EUR" });
    expect(run<Record<string, unknown>>(scopeCreepCostModule, { hourlyRate: "50", additionalHours: "2" })).toMatchObject({ additionalCost: "100.00" });
    expect(run<Record<string, unknown>>(breakEvenModule, { fixedCosts: "100", unitPrice: "10", unitVariableCost: "5" })).toMatchObject({ breakEvenUnits: "20" });
  });

  it("runs fee, late-payment, and discount modules", () => {
    expect(run<Record<string, unknown>>(paymentFeeGrossUpModule, { targetNet: "100", feePercent: "3" })).toMatchObject({ gross: "103.09" });
    expect(run<Record<string, unknown>>(latePaymentInterestModule, { principal: "1000", annualRatePercent: "12", daysLate: "30", dayCountBasis: "365" })).toMatchObject({ interest: "9.86" });
    expect(run<Record<string, unknown>>(discountImpactModule, { originalPrice: "100", discountPercent: "10" })).toMatchObject({ lostRevenue: "10.00" });
  });

  it("runs proposal, project, invoice-number, and invoice-math modules", () => {
    expect(run<Record<string, unknown>>(proposalBudgetCheckerModule, { quotedPrice: "1000", estimatedHours: "5", hourlyRate: "100", targetMarginPercent: "20" })).toMatchObject({ profit: "500.00" });
    expect(run<Record<string, unknown>>(projectProfitabilityModule, { revenue: "1000", hours: "10", hourlyCost: "20" })).toMatchObject({ profit: "800.00" });
    expect(run<Record<string, unknown>>(invoiceNumberGeneratorModule, { prefix: "INV", year: "2026", sequence: "2" })).toMatchObject({ invoiceNumber: "INV-2026-0002" });
    expect(run<Record<string, unknown>>(invoiceMathValidatorModule, { subtotal: "100", taxRatePercent: "10", total: "110" })).toMatchObject({ valid: true, expectedTotal: "110.00" });
  });

  it("runs percentage and currency modules", () => {
    expect(run<Record<string, unknown>>(percentageHelperModule, { base: "200", ratePercent: "10" })).toMatchObject({ total: "220.00" });
    expect(run<Record<string, unknown>>(percentageHelperModule, { base: "100", ratePercent: "12,5", mode: "of" })).toMatchObject({ result: "12.50" });
    expect(run<Record<string, unknown>>(percentageHelperModule, { base: "100", rates: "10; 20", mode: "cascade" })).toMatchObject({ result: "72.00" });
    expect(run<Record<string, unknown>>(currencyScenarioModule, { amount: "50", rate: "2", fromCurrency: "EUR", toCurrency: "USD" })).toMatchObject({ convertedAmount: "100.00" });
  });

  it("keeps the four existing merged candidate routes local and executable", () => {
    expect(run<Record<string, unknown>>(rateConverterModule, { amount: "50", from: "hour", to: "day" })).toMatchObject({ amount: "400.00" });
    expect(run<Record<string, unknown>>(marginMarkupModule, { price: "100", cost: "80" })).toMatchObject({ marginPercent: "20.00", markupPercent: "25.00" });
    expect(run<Record<string, unknown>>(timezoneOverlapModule, { date: "2026-09-23", otherTimeZone: "America/New_York", otherWorkingHours: { start: "09:00", end: "17:00" } })).toMatchObject({ segments: expect.any(Array) });
  });

  it("loads a new business route through the generated lazy runtime", async () => {
    const result = await toolRuntime.run(
      "effective-hourly-rate",
      { revenue: "1000", hours: "20", costs: "100" },
      { profile: { currency: "EUR" } },
    );
    expect(result).toMatchObject({ ok: true, value: { effectiveHourlyRate: "45.00", currency: "EUR" } });
  });

  it("rejects invalid denominators and preserves cancellation errors", () => {
    expect(() => calculateEffectiveHourlyRate({ revenue: "100", hours: "0" })).toThrow("INVALID_HOURS");
    expect(() => calculateBreakEven({ fixedCosts: "100", unitPrice: "10", unitVariableCost: "10" })).toThrow("INVALID_CONTRIBUTION_MARGIN");
    const aborted = new AbortController();
    aborted.abort();
    expect(() => effectiveHourlyRateModule.run({ revenue: "100", hours: "1" }, context, aborted.signal)).toThrow("Operation cancelled");
  });
});
