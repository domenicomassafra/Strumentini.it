import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  calculateExactIntegerToolkit,
  calculateInterestSavings,
  calculateScientificExpression,
  calculateStatisticsGrade,
} from "../src/engines/business-math";

interface CalculatorMathFixture {
  readonly scientific: readonly { readonly expression: string; readonly expected: number }[];
  readonly fractions: readonly { readonly left: string; readonly right: string; readonly operation: "add" | "subtract" | "multiply" | "divide"; readonly expected: string }[];
  readonly integers: readonly { readonly mode: string; readonly left: string; readonly right?: string; readonly operation?: string; readonly expected?: string; readonly gcd?: string; readonly lcm?: string }[];
  readonly statistics: readonly { readonly mode: string; readonly values?: string; readonly weights?: string; readonly completed?: string; readonly total?: string; readonly expected?: number; readonly mean?: string; readonly median?: string; readonly populationVariance?: string }[];
  readonly finance: readonly { readonly mode: string; readonly principal: string; readonly annualRatePercent: string; readonly years: string; readonly compoundsPerYear?: string; readonly periodicContribution?: string; readonly target?: string; readonly expected: string }[];
}

const fixtures = JSON.parse(
  readFileSync(new URL("../quality/fixtures/calculator-math-core/vectors.json", import.meta.url), "utf8"),
) as CalculatorMathFixture;

function record(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

describe("ticket 141 — safe scientific expression calculator", () => {
  it("uses deterministic operator precedence and documented functions", () => {
    for (const vector of fixtures.scientific) {
      expect(calculateScientificExpression({ expression: vector.expression }).result, vector.expression).toBeCloseTo(vector.expected, 12);
    }
    expect(calculateScientificExpression({ expression: "log10(1000)" }).result).toBe(3);
  });

  it("fails closed on identifiers, property/code syntax, domains, infinity, and complexity", () => {
    expect(() => calculateScientificExpression({ expression: "globalThis" })).toThrow("UNSUPPORTED_IDENTIFIER");
    expect(() => calculateScientificExpression({ expression: "Math.sin(0)" })).toThrow("INVALID_EXPRESSION");
    expect(() => calculateScientificExpression({ expression: "constructor.constructor(1)" })).toThrow("INVALID_EXPRESSION");
    expect(() => calculateScientificExpression({ expression: "sqrt(-1)" })).toThrow("MATH_DOMAIN_ERROR");
    expect(() => calculateScientificExpression({ expression: "1 / 0" })).toThrow("DIVISION_BY_ZERO");
    expect(() => calculateScientificExpression({ expression: "exp(10000)" })).toThrow("NON_FINITE_RESULT");
    expect(() => calculateScientificExpression({ expression: `${"(".repeat(40)}1${")".repeat(40)}` })).toThrow("EXPRESSION_TOO_COMPLEX");
  });
});

describe("ticket 142 — exact fractions and integer toolkit", () => {
  it("reduces fraction operations exactly", () => {
    for (const vector of fixtures.fractions) {
      const result = calculateExactIntegerToolkit({ mode: "fraction", left: vector.left, right: vector.right, operation: vector.operation });
      expect(result.result, `${vector.left} ${vector.operation} ${vector.right}`).toBe(vector.expected);
    }
    expect(() => calculateExactIntegerToolkit({ mode: "fraction", left: "1/2", right: "0", operation: "divide" })).toThrow("DIVISION_BY_ZERO");
  });

  it("defines integer zero, negative, combinatoric, factorization and Roman policies", () => {
    const gcd = calculateExactIntegerToolkit({ mode: "gcd-lcm", left: "0", right: "0" });
    expect(gcd).toMatchObject({ gcd: "0", lcm: "0" });
    expect(calculateExactIntegerToolkit({ mode: "prime-factor", left: "-12" }).result).toBe("-1 × 2 × 2 × 3");
    expect(() => calculateExactIntegerToolkit({ mode: "prime-factor", left: "0" })).toThrow("FACTORIZATION_UNDEFINED_ZERO");
    expect(() => calculateExactIntegerToolkit({ mode: "prime-factor", left: "1000000000001" })).toThrow("INTEGER_OUT_OF_RANGE");
    expect(calculateExactIntegerToolkit({ mode: "combinatorics", left: "10", right: "3", operation: "combination" }).result).toBe("120");
    expect(() => calculateExactIntegerToolkit({ mode: "combinatorics", left: "1001", right: "2", operation: "combination" })).toThrow("COMBINATORIC_OUT_OF_RANGE");
    expect(calculateExactIntegerToolkit({ mode: "roman", left: "MCMXCIV" }).result).toBe("1994");
    expect(() => calculateExactIntegerToolkit({ mode: "roman", left: "IIII" })).toThrow("INVALID_ROMAN");
    expect(() => calculateExactIntegerToolkit({ mode: "roman", left: "IC" })).toThrow("INVALID_ROMAN");
    expect(calculateExactIntegerToolkit({ mode: "number-words", left: "-42" }).result).toBe("minus forty-two");
  });

  it("matches independent integer fixture literals", () => {
    for (const vector of fixtures.integers) {
      const result = calculateExactIntegerToolkit({
        mode: vector.mode as "gcd-lcm" | "prime-factor" | "combinatorics" | "roman",
        left: vector.left,
        ...(vector.right === undefined ? {} : { right: vector.right }),
        ...(vector.operation === undefined ? {} : { operation: vector.operation as "combination" | "permutation" }),
      });
      if (vector.expected !== undefined) expect(result.result).toBe(vector.expected);
      if (vector.gcd !== undefined) expect(result.gcd).toBe(vector.gcd);
      if (vector.lcm !== undefined) expect(result.lcm).toBe(vector.lcm);
    }
  });
});

describe("ticket 143 — descriptive statistics, grades and completion", () => {
  it("keeps population/sample semantics and intermediate counts explicit", () => {
    const result = record(calculateStatisticsGrade({ mode: "descriptive", values: "1; 2; 2; 5" }));
    expect(result).toMatchObject({
      count: 4,
      sum: "10",
      mean: "2.5",
      median: "2",
      mode: ["2"],
      modeStatus: "single",
      populationVariance: "2.25000000",
      sampleVariance: "3.00000000",
    });
    expect(record(result.assumptions).variance).toContain("population uses n");
  });

  it("defines singleton, ties, zero-weight and completion boundaries", () => {
    expect(calculateStatisticsGrade({ mode: "descriptive", values: "7" })).toMatchObject({ count: 1, mode: [], modeStatus: "none", sampleVariance: null, sampleStdDev: null });
    expect(calculateStatisticsGrade({ mode: "descriptive", values: "1; 1; 2; 2" })).toMatchObject({ mode: ["1", "2"], modeStatus: "tie" });
    expect(calculateStatisticsGrade({ mode: "weighted", values: "18; 24; 30", weights: "1; 2; 1" })).toMatchObject({ result: 24, count: 3, weightedAverage: "24" });
    expect(() => calculateStatisticsGrade({ mode: "weighted", values: "1; 2", weights: "0; 0" })).toThrow("ZERO_WEIGHT_SUM");
    expect(() => calculateStatisticsGrade({ mode: "weighted", values: "1; 2", weights: "1" })).toThrow("WEIGHT_LENGTH_MISMATCH");
    expect(calculateStatisticsGrade({ mode: "completion", completed: "75", total: "120" })).toMatchObject({ result: 62.5, remaining: "45", completionPercent: "62.50" });
    expect(() => calculateStatisticsGrade({ mode: "completion", completed: "1", total: "0" })).toThrow("INVALID_COMPLETION");
    expect(() => calculateStatisticsGrade({ mode: "completion", completed: "101", total: "100" })).toThrow("COMPLETED_EXCEEDS_TOTAL");
  });
});

describe("ticket 145 — interest and savings goal calculators", () => {
  it("matches independent simple, compound, contribution and reverse-goal literals", () => {
    for (const vector of fixtures.finance) {
      const result = calculateInterestSavings({
        mode: vector.mode as "simple" | "compound" | "contribution" | "goal",
        principal: vector.principal,
        annualRatePercent: vector.annualRatePercent,
        years: vector.years,
        ...(vector.compoundsPerYear === undefined ? {} : { compoundsPerYear: vector.compoundsPerYear }),
        ...(vector.periodicContribution === undefined ? {} : { periodicContribution: vector.periodicContribution }),
        ...(vector.target === undefined ? {} : { target: vector.target }),
      });
      const displayed = vector.mode === "goal" ? result.requiredPeriodicContribution : result.futureValue;
      expect(displayed, vector.mode).toBe(vector.expected);
    }
  });

  it("defines zero-rate, zero-period, feasibility and cadence behavior", () => {
    expect(calculateInterestSavings({ mode: "compound", principal: "1234.56", annualRatePercent: "0", years: "0", compoundsPerYear: "12" })).toMatchObject({ futureValue: "1234.56", periods: 0, compoundsPerYear: 12, annualRatePercent: 0 });
    expect(calculateInterestSavings({ mode: "goal", principal: "5000", annualRatePercent: "0", years: "0", compoundsPerYear: "12", target: "4000" })).toMatchObject({ requiredPeriodicContribution: "0.00", periods: 0 });
    expect(() => calculateInterestSavings({ mode: "goal", principal: "1000", annualRatePercent: "0", years: "0", compoundsPerYear: "12", target: "2000" })).toThrow("INFEASIBLE_GOAL");
    expect(() => calculateInterestSavings({ mode: "goal", principal: "1000", annualRatePercent: "-1", years: "1", compoundsPerYear: "12", target: "2000" })).toThrow("INVALID_SAVINGS_RATE");
    expect(() => calculateInterestSavings({ mode: "compound", principal: "1000", annualRatePercent: "5", years: "0.1", compoundsPerYear: "12" })).toThrow("INVALID_PERIOD_COUNT");
  });
});
