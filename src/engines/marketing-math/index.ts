export const MARKETING_MATH_ENGINE_VERSION = "marketing-math-v1";

type Rational = { readonly numerator: bigint; readonly denominator: bigint };

const DECIMAL_PATTERN = /^([+-]?)(\d+)(?:\.(\d+))?$/u;
const MAX_DIGITS = 100;

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a === 0n ? 1n : a;
}

function rational(numerator: bigint, denominator: bigint): Rational {
  if (denominator === 0n) throw new Error("INVALID_DENOMINATOR");
  const sign = denominator < 0n ? -1n : 1n;
  const n = numerator * sign;
  const d = denominator * sign;
  const divisor = gcd(n, d);
  return { numerator: n / divisor, denominator: d / divisor };
}

function parseDecimal(value: string, code = "INVALID_DECIMAL"): Rational {
  const input = value.trim();
  const match = DECIMAL_PATTERN.exec(input);
  if (match === null) throw new Error(code);
  const whole = match[2] ?? "";
  const fraction = match[3] ?? "";
  if (whole.length + fraction.length > MAX_DIGITS) throw new Error(code);
  const sign = match[1] === "-" ? -1n : 1n;
  return rational(sign * BigInt(`${whole}${fraction}` || "0"), 10n ** BigInt(fraction.length));
}

function multiply(left: Rational, right: Rational): Rational {
  return rational(left.numerator * right.numerator, left.denominator * right.denominator);
}

function divide(left: Rational, right: Rational, code = "INVALID_DENOMINATOR"): Rational {
  if (right.numerator === 0n) throw new Error(code);
  return rational(left.numerator * right.denominator, left.denominator * right.numerator);
}

function format(value: Rational, places = 2): string {
  const negative = value.numerator < 0n;
  const numerator = negative ? -value.numerator : value.numerator;
  const scale = 10n ** BigInt(places);
  const scaled = numerator * scale;
  let quotient = scaled / value.denominator;
  const remainder = scaled % value.denominator;
  if (remainder * 2n >= value.denominator) quotient += 1n;
  const whole = quotient / scale;
  const fraction = quotient % scale;
  const sign = negative && quotient !== 0n ? "-" : "";
  return places === 0 ? `${sign}${whole}` : `${sign}${whole}.${fraction.toString().padStart(places, "0")}`;
}

function formatExact(value: Rational): string {
  let denominator = value.denominator;
  let twos = 0;
  let fives = 0;
  while (denominator % 2n === 0n) {
    denominator /= 2n;
    twos += 1;
  }
  while (denominator % 5n === 0n) {
    denominator /= 5n;
    fives += 1;
  }
  if (denominator !== 1n) return `${value.numerator}/${value.denominator}`;
  const places = Math.max(twos, fives);
  const scaled = value.numerator * 2n ** BigInt(places - twos) * 5n ** BigInt(places - fives);
  const negative = scaled < 0n;
  const digits = (negative ? -scaled : scaled).toString().padStart(places + 1, "0");
  if (places === 0) return `${negative ? "-" : ""}${digits}`;
  const whole = digits.slice(0, -places) || "0";
  const fraction = digits.slice(-places).replace(/0+$/u, "");
  return `${negative ? "-" : ""}${whole}${fraction === "" ? "" : `.${fraction}`}`;
}

function nonNegative(value: Rational, code: string): Rational {
  if (value.numerator < 0n) throw new Error(code);
  return value;
}

function nonZero(value: Rational, code: string): Rational {
  if (value.numerator === 0n) throw new Error(code);
  return value;
}

function ratio(numerator: Rational, denominator: Rational, code: string): Rational {
  return divide(numerator, nonZero(denominator, code), code);
}

function percent(value: Rational): Rational {
  return multiply(value, rational(100n, 1n));
}

export interface RoasResult {
  readonly spend: string;
  readonly revenue: string;
  readonly roas: string;
  readonly roasExact: string;
  readonly roasPercent: string;
  readonly formula: "revenue ÷ spend";
  readonly rounding: { readonly mode: "half-up"; readonly decimalPlaces: 2; readonly stage: "final-only" };
  readonly engineVersion: string;
}

export function calculateRoas(spendInput: string, revenueInput: string): RoasResult {
  const spend = nonNegative(parseDecimal(spendInput, "INVALID_SPEND"), "INVALID_SPEND");
  const revenue = nonNegative(parseDecimal(revenueInput, "INVALID_REVENUE"), "INVALID_REVENUE");
  const roas = ratio(revenue, spend, "INVALID_SPEND_DENOMINATOR");
  return {
    spend: format(spend),
    revenue: format(revenue),
    roas: format(roas),
    roasExact: formatExact(roas),
    roasPercent: format(percent(roas)),
    formula: "revenue ÷ spend",
    rounding: { mode: "half-up", decimalPlaces: 2, stage: "final-only" },
    engineVersion: MARKETING_MATH_ENGINE_VERSION,
  };
}

export type PerformanceMetric = "cpa" | "cpc" | "cpm";

export interface PerformanceResult {
  readonly metric: PerformanceMetric;
  readonly spend: string;
  readonly denominator: string;
  readonly value: string;
  readonly formula: string;
  readonly rounding: { readonly mode: "half-up"; readonly decimalPlaces: 2; readonly stage: "final-only" };
  readonly engineVersion: string;
}

export function calculatePerformanceMetric(metricInput: string, spendInput: string, denominatorInput: string): PerformanceResult {
  const metric = metricInput.trim().toLowerCase();
  if (metric !== "cpa" && metric !== "cpc" && metric !== "cpm") throw new Error("INVALID_PERFORMANCE_METRIC");
  const spend = nonNegative(parseDecimal(spendInput, "INVALID_SPEND"), "INVALID_SPEND");
  const denominator = nonZero(nonNegative(parseDecimal(denominatorInput, "INVALID_DENOMINATOR"), "INVALID_DENOMINATOR"), "INVALID_DENOMINATOR");
  const value = ratio(spend, denominator, "INVALID_DENOMINATOR");
  const formulas: Readonly<Record<PerformanceMetric, string>> = {
    cpa: "spend ÷ conversions",
    cpc: "spend ÷ clicks",
    cpm: "spend ÷ impressions × 1,000",
  };
  const adjusted = metric === "cpm" ? multiply(value, rational(1000n, 1n)) : value;
  return {
    metric,
    spend: format(spend),
    denominator: format(denominator, metric === "cpm" ? 0 : 2),
    value: format(adjusted),
    formula: formulas[metric],
    rounding: { mode: "half-up", decimalPlaces: 2, stage: "final-only" },
    engineVersion: MARKETING_MATH_ENGINE_VERSION,
  };
}

export function calculateCpa(spend: string, conversions: string): PerformanceResult {
  return calculatePerformanceMetric("cpa", spend, conversions);
}

export function calculateCpc(spend: string, clicks: string): PerformanceResult {
  return calculatePerformanceMetric("cpc", spend, clicks);
}

export function calculateCpm(spend: string, impressions: string): PerformanceResult {
  return calculatePerformanceMetric("cpm", spend, impressions);
}

export interface ConversionRateResult {
  readonly conversions: string;
  readonly visits: string;
  readonly rate: string;
  readonly ratePercent: string;
  readonly formula: "conversions ÷ visits × 100";
  readonly rounding: { readonly mode: "half-up"; readonly decimalPlaces: 2; readonly stage: "final-only" };
  readonly engineVersion: string;
}

export function calculateConversionRate(conversionsInput: string, visitsInput: string): ConversionRateResult {
  const conversions = nonNegative(parseDecimal(conversionsInput, "INVALID_CONVERSIONS"), "INVALID_CONVERSIONS");
  const visits = nonZero(nonNegative(parseDecimal(visitsInput, "INVALID_VISITS"), "INVALID_VISITS"), "INVALID_VISITS");
  const rate = ratio(conversions, visits, "INVALID_VISITS_DENOMINATOR");
  return {
    conversions: format(conversions),
    visits: format(visits),
    rate: format(rate, 4).replace(/0+$/u, "").replace(/\.$/u, ""),
    ratePercent: format(percent(rate)),
    formula: "conversions ÷ visits × 100",
    rounding: { mode: "half-up", decimalPlaces: 2, stage: "final-only" },
    engineVersion: MARKETING_MATH_ENGINE_VERSION,
  };
}

export interface ConversionScenarioResult {
  readonly visits: string;
  readonly baselineConversions: string;
  readonly baselineRatePercent: string;
  readonly targetRatePercent: string;
  readonly projectedConversions: string;
  readonly liftPercent: string;
  readonly absoluteLift: string;
  readonly formula: "projected conversions = visits × target rate ÷ 100";
  readonly rounding: { readonly mode: "half-up"; readonly decimalPlaces: 2; readonly stage: "final-only" };
  readonly engineVersion: string;
}

export function calculateConversionScenario(
  visitsInput: string,
  baselineConversionsInput: string,
  targetRatePercentInput: string,
): ConversionScenarioResult {
  const visits = nonZero(nonNegative(parseDecimal(visitsInput, "INVALID_VISITS"), "INVALID_VISITS"), "INVALID_VISITS");
  const baselineConversions = nonNegative(parseDecimal(baselineConversionsInput, "INVALID_CONVERSIONS"), "INVALID_CONVERSIONS");
  const targetRate = nonNegative(parseDecimal(targetRatePercentInput, "INVALID_TARGET_RATE"), "INVALID_TARGET_RATE");
  const baselineRate = ratio(baselineConversions, visits, "INVALID_VISITS_DENOMINATOR");
  const projected = divide(multiply(visits, targetRate), rational(100n, 1n), "INVALID_VISITS_DENOMINATOR");
  const lift = baselineRate.numerator === 0n ? null : ratio(subtract(targetRate, percent(baselineRate)), percent(baselineRate), "INVALID_BASELINE_DENOMINATOR");
  return {
    visits: format(visits),
    baselineConversions: format(baselineConversions),
    baselineRatePercent: format(percent(baselineRate)),
    targetRatePercent: format(targetRate),
    projectedConversions: format(projected),
    liftPercent: lift === null ? "undefined" : format(percent(lift)),
    absoluteLift: format(subtract(projected, baselineConversions)),
    formula: "projected conversions = visits × target rate ÷ 100",
    rounding: { mode: "half-up", decimalPlaces: 2, stage: "final-only" },
    engineVersion: MARKETING_MATH_ENGINE_VERSION,
  };
}

function subtract(left: Rational, right: Rational): Rational {
  return rational(left.numerator * right.denominator - right.numerator * left.denominator, left.denominator * right.denominator);
}

export function calculateScenario(
  visits: string,
  baselineConversions: string,
  targetRatePercent: string,
): ConversionScenarioResult {
  return calculateConversionScenario(visits, baselineConversions, targetRatePercent);
}
