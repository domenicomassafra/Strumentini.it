import { convertUnit, resolveUnitDescriptor } from "../unit-conversion";

export const BUSINESS_MATH_ENGINE_VERSION = "business-math-v1";

export type DecimalInput = string | number;

export interface BusinessRounding {
  readonly mode: "half-up";
  readonly moneyDecimalPlaces: 2;
  readonly percentDecimalPlaces: 2;
  readonly stage: "final-only";
}

export const BUSINESS_ROUNDING: BusinessRounding = {
  mode: "half-up",
  moneyDecimalPlaces: 2,
  percentDecimalPlaces: 2,
  stage: "final-only",
};

interface Rational {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

const DECIMAL_PATTERN = /^([+-]?)(\d+)(?:[.,](\d+))?$/u;
const MAX_DECIMAL_DIGITS = 80;

function gcd(left: bigint, right: bigint): bigint {
  let first = left < 0n ? -left : left;
  let second = right < 0n ? -right : right;
  while (second !== 0n) {
    const remainder = first % second;
    first = second;
    second = remainder;
  }
  return first === 0n ? 1n : first;
}

function rational(numerator: bigint, denominator: bigint): Rational {
  if (denominator === 0n) throw new Error("INVALID_DENOMINATOR");
  const sign = denominator < 0n ? -1n : 1n;
  const normalizedNumerator = numerator * sign;
  const normalizedDenominator = denominator * sign;
  const divisor = gcd(normalizedNumerator, normalizedDenominator);
  return {
    numerator: normalizedNumerator / divisor,
    denominator: normalizedDenominator / divisor,
  };
}

function numberText(value: number): string {
  if (!Number.isFinite(value)) throw new Error("INVALID_DECIMAL");
  const text = String(value).toLowerCase();
  const match = /^([+-]?)(\d+)(?:\.(\d+))?[e]([+-]?\d+)$/u.exec(text);
  if (match === null) return text;
  const sign = match[1] ?? "";
  const whole = match[2] ?? "0";
  const fraction = match[3] ?? "";
  const exponent = Number(match[4]);
  const digits = `${whole}${fraction}`;
  const decimalIndex = whole.length + exponent;
  if (decimalIndex <= 0) return `${sign}0.${"0".repeat(-decimalIndex)}${digits}`;
  if (decimalIndex >= digits.length) return `${sign}${digits}${"0".repeat(decimalIndex - digits.length)}`;
  return `${sign}${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
}

export function parseBusinessDecimal(value: DecimalInput, code = "INVALID_DECIMAL"): Rational {
  const text = (typeof value === "number" ? numberText(value) : value.trim());
  const match = DECIMAL_PATTERN.exec(text);
  if (match === null) throw new Error(code);
  const whole = match[2] ?? "";
  const fraction = match[3] ?? "";
  if (whole.length + fraction.length > MAX_DECIMAL_DIGITS) throw new Error(code);
  const sign = match[1] === "-" ? -1n : 1n;
  return rational(sign * BigInt(`${whole}${fraction}` || "0"), 10n ** BigInt(fraction.length));
}

function compareZero(value: Rational): -1 | 0 | 1 {
  return value.numerator === 0n ? 0 : value.numerator < 0n ? -1 : 1;
}

function compare(left: Rational, right: Rational): -1 | 0 | 1 {
  const difference = left.numerator * right.denominator - right.numerator * left.denominator;
  return difference === 0n ? 0 : difference < 0n ? -1 : 1;
}

function add(left: Rational, right: Rational): Rational {
  return rational(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

function subtract(left: Rational, right: Rational): Rational {
  return rational(
    left.numerator * right.denominator - right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

function multiply(left: Rational, right: Rational): Rational {
  return rational(left.numerator * right.numerator, left.denominator * right.denominator);
}

function divide(left: Rational, right: Rational, code = "INVALID_DENOMINATOR"): Rational {
  if (right.numerator === 0n) throw new Error(code);
  return rational(left.numerator * right.denominator, left.denominator * right.numerator);
}

function formatRounded(value: Rational, decimalPlaces: number): string {
  const negative = value.numerator < 0n;
  const numerator = negative ? -value.numerator : value.numerator;
  const scale = 10n ** BigInt(decimalPlaces);
  const scaled = numerator * scale;
  let quotient = scaled / value.denominator;
  const remainder = scaled % value.denominator;
  if (remainder * 2n >= value.denominator) quotient += 1n;
  const whole = quotient / scale;
  const fraction = quotient % scale;
  const sign = negative && quotient !== 0n ? "-" : "";
  if (decimalPlaces === 0) return `${sign}${whole}`;
  return `${sign}${whole}.${fraction.toString().padStart(decimalPlaces, "0")}`;
}

export function formatBusinessDecimal(value: DecimalInput, decimalPlaces = 2): string {
  return formatRounded(parseBusinessDecimal(value), decimalPlaces);
}

function nonNegative(value: DecimalInput, code: string): Rational {
  const parsed = parseBusinessDecimal(value, code);
  if (compareZero(parsed) < 0) throw new Error(code);
  return parsed;
}

function positive(value: DecimalInput, code: string): Rational {
  const parsed = parseBusinessDecimal(value, code);
  if (compareZero(parsed) <= 0) throw new Error(code);
  return parsed;
}

function money(value: Rational): string {
  return formatRounded(value, 2);
}

function percent(value: Rational): string {
  return formatRounded(multiply(value, rational(100n, 1n)), 2);
}

function ratioPercent(numerator: Rational, denominator: Rational, code: string): string {
  return percent(divide(numerator, denominator, code));
}

function ceilRational(value: Rational): bigint {
  const numerator = value.numerator;
  const denominator = value.denominator;
  const quotient = numerator / denominator;
  return numerator >= 0n && numerator % denominator !== 0n ? quotient + 1n : quotient;
}

function floorRational(value: Rational): bigint {
  const numerator = value.numerator;
  const denominator = value.denominator;
  const quotient = numerator / denominator;
  return numerator < 0n && numerator % denominator !== 0n ? quotient - 1n : quotient;
}

function exact(value: Rational): string {
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
  if (denominator !== 1n) throw new Error("NON_TERMINATING_DECIMAL");
  const places = Math.max(twos, fives);
  const multiplier = 2n ** BigInt(places - twos) * 5n ** BigInt(places - fives);
  const scaled = value.numerator * multiplier;
  const negative = scaled < 0n;
  const digits = (negative ? -scaled : scaled).toString().padStart(places + 1, "0");
  if (places === 0) return `${negative ? "-" : ""}${digits}`;
  const whole = digits.slice(0, -places) || "0";
  const fraction = digits.slice(-places).replace(/0+$/u, "");
  return `${negative ? "-" : ""}${whole}${fraction === "" ? "" : `.${fraction}`}`;
}

function displayRate(value: Rational): string {
  try {
    return exact(value);
  } catch {
    return formatRounded(value, 8);
  }
}

function optional(value: DecimalInput | undefined, fallback: DecimalInput): DecimalInput {
  return value === undefined ? fallback : value;
}

export interface EffectiveHourlyRateInput {
  readonly revenue: DecimalInput;
  readonly hours: DecimalInput;
  readonly costs?: DecimalInput;
}

export interface EffectiveHourlyRateResult {
  readonly revenue: string;
  readonly costs: string;
  readonly totalCost: string;
  readonly profit: string;
  readonly hours: string;
  readonly effectiveHourlyRate: string;
  readonly effectiveHourly: string;
  readonly revenueHourlyRate: string;
  readonly netHourlyRate: string;
  readonly assumptions: { readonly costsIncluded: true };
  readonly formulas: {
    readonly profit: "revenue − costs";
    readonly effectiveHourlyRate: "(revenue − costs) ÷ hours";
  };
  readonly rounding: BusinessRounding;
}

export function calculateEffectiveHourlyRate(input: EffectiveHourlyRateInput): EffectiveHourlyRateResult {
  const revenue = nonNegative(input.revenue, "INVALID_REVENUE");
  const hours = positive(input.hours, "INVALID_HOURS");
  const costs = nonNegative(optional(input.costs, "0"), "INVALID_COSTS");
  const profit = subtract(revenue, costs);
  return {
    revenue: money(revenue),
    costs: money(costs),
    totalCost: money(costs),
    profit: money(profit),
    hours: exact(hours),
    effectiveHourlyRate: money(divide(profit, hours, "INVALID_HOURS")),
    effectiveHourly: money(divide(profit, hours, "INVALID_HOURS")),
    revenueHourlyRate: money(divide(revenue, hours, "INVALID_HOURS")),
    netHourlyRate: money(divide(profit, hours, "INVALID_HOURS")),
    assumptions: { costsIncluded: true },
    formulas: {
      profit: "revenue − costs",
      effectiveHourlyRate: "(revenue − costs) ÷ hours",
    },
    rounding: BUSINESS_ROUNDING,
  };
}

export const effectiveHourlyRate = calculateEffectiveHourlyRate;

export interface TargetIncomeRateInput {
  readonly targetIncome: DecimalInput;
  readonly billableHours: DecimalInput;
  readonly nonBillableHours?: DecimalInput;
  readonly expenses?: DecimalInput;
  readonly hoursPerDay?: DecimalInput;
}

export interface TargetIncomeRateResult {
  readonly targetIncome: string;
  readonly expenses: string;
  readonly billableHours: string;
  readonly nonBillableHours: string;
  readonly totalHours: string;
  readonly requiredHourlyRate: string;
  readonly requiredDailyRate: string;
  readonly allHoursRate: string;
  readonly assumptions: { readonly nonBillableHoursIncludedInTotal: true };
  readonly formulas: {
    readonly requiredHourlyRate: "(target income + expenses) ÷ billable hours";
    readonly allHoursRate: "(target income + expenses) ÷ total hours";
  };
  readonly rounding: BusinessRounding;
}

export function calculateTargetIncomeRate(input: TargetIncomeRateInput): TargetIncomeRateResult {
  const targetIncome = nonNegative(input.targetIncome, "INVALID_TARGET_INCOME");
  const billableHours = positive(input.billableHours, "INVALID_BILLABLE_HOURS");
  const nonBillableHours = nonNegative(optional(input.nonBillableHours, "0"), "INVALID_NON_BILLABLE_HOURS");
  const expenses = nonNegative(optional(input.expenses, "0"), "INVALID_EXPENSES");
  const hoursPerDay = positive(optional(input.hoursPerDay, "8"), "INVALID_HOURS_PER_DAY");
  const totalHours = add(billableHours, nonBillableHours);
  const required = add(targetIncome, expenses);
  const requiredHourly = divide(required, billableHours, "INVALID_BILLABLE_HOURS");
  return {
    targetIncome: money(targetIncome),
    expenses: money(expenses),
    billableHours: exact(billableHours),
    nonBillableHours: exact(nonBillableHours),
    totalHours: exact(totalHours),
    requiredHourlyRate: money(requiredHourly),
    requiredDailyRate: money(multiply(requiredHourly, hoursPerDay)),
    allHoursRate: money(divide(required, totalHours, "INVALID_TOTAL_HOURS")),
    assumptions: { nonBillableHoursIncludedInTotal: true },
    formulas: {
      requiredHourlyRate: "(target income + expenses) ÷ billable hours",
      allHoursRate: "(target income + expenses) ÷ total hours",
    },
    rounding: BUSINESS_ROUNDING,
  };
}

export const targetIncomeRate = calculateTargetIncomeRate;

export interface UtilizationInput {
  readonly availableHours: DecimalInput;
  readonly billableHours: DecimalInput;
}

export interface UtilizationResult {
  readonly availableHours: string;
  readonly billableHours: string;
  readonly unbilledHours: string;
  readonly utilizationPercent: string;
  readonly formulas: { readonly utilizationPercent: "billable hours ÷ available hours × 100" };
  readonly rounding: BusinessRounding;
}

export function calculateUtilization(input: UtilizationInput): UtilizationResult {
  const availableHours = positive(input.availableHours, "INVALID_AVAILABLE_HOURS");
  const billableHours = nonNegative(input.billableHours, "INVALID_BILLABLE_HOURS");
  return {
    availableHours: exact(availableHours),
    billableHours: exact(billableHours),
    unbilledHours: exact(subtract(availableHours, billableHours)),
    utilizationPercent: ratioPercent(billableHours, availableHours, "INVALID_AVAILABLE_HOURS"),
    formulas: { utilizationPercent: "billable hours ÷ available hours × 100" },
    rounding: BUSINESS_ROUNDING,
  };
}

export const utilization = calculateUtilization;

export interface CapacityPlannerInput {
  readonly availableHours: DecimalInput;
  readonly targetUtilizationPercent?: DecimalInput;
  readonly reservedHours?: DecimalInput;
}

export interface CapacityPlannerResult {
  readonly availableHours: string;
  readonly targetUtilizationPercent: string;
  readonly plannedBillableHours: string;
  readonly reservedHours: string;
  readonly availableForDelivery: string;
  readonly overallocated: boolean;
  readonly formulas: {
    readonly plannedBillableHours: "available hours × target utilization ÷ 100";
    readonly availableForDelivery: "planned billable hours − reserved hours";
  };
  readonly rounding: BusinessRounding;
}

export function planCapacity(input: CapacityPlannerInput): CapacityPlannerResult {
  const availableHours = nonNegative(input.availableHours, "INVALID_AVAILABLE_HOURS");
  const target = nonNegative(optional(input.targetUtilizationPercent, "80"), "INVALID_TARGET_UTILIZATION");
  if (compare(target, rational(100n, 1n)) > 0) throw new Error("INVALID_TARGET_UTILIZATION");
  const reservedHours = nonNegative(optional(input.reservedHours, "0"), "INVALID_RESERVED_HOURS");
  const planned = multiply(availableHours, divide(target, rational(100n, 1n), "INVALID_TARGET_UTILIZATION"));
  const availableForDelivery = subtract(planned, reservedHours);
  return {
    availableHours: exact(availableHours),
    targetUtilizationPercent: money(target),
    plannedBillableHours: money(planned),
    reservedHours: exact(reservedHours),
    availableForDelivery: money(availableForDelivery),
    overallocated: compareZero(availableForDelivery) < 0,
    formulas: {
      plannedBillableHours: "available hours × target utilization ÷ 100",
      availableForDelivery: "planned billable hours − reserved hours",
    },
    rounding: BUSINESS_ROUNDING,
  };
}

export const capacityPlanner = planCapacity;

export interface RetainerCapacityInput {
  readonly capacityHours: DecimalInput;
  readonly deliveryHoursPerClient: DecimalInput;
  readonly retainerAmount?: DecimalInput;
  readonly monthlyCosts?: DecimalInput;
  readonly targetMarginPercent?: DecimalInput;
}

export interface RetainerCapacityResult {
  readonly capacityHours: string;
  readonly deliveryHoursPerClient: string;
  readonly clientCapacity: string;
  readonly capacityRemainderHours: string;
  readonly retainerAmount: string;
  readonly monthlyCosts: string;
  readonly contribution: string;
  readonly contributionPerClientHour: string;
  readonly allocatedBusinessCostPerClient: string;
  readonly minimumRetainerForTargetMargin: string;
  readonly formulas: {
    readonly clientCapacity: "capacity hours ÷ delivery hours per client, rounded down";
    readonly minimumRetainerForTargetMargin: "monthly costs ÷ client capacity";
  };
  readonly rounding: BusinessRounding;
}

export function calculateRetainerCapacity(input: RetainerCapacityInput): RetainerCapacityResult {
  const capacityHours = nonNegative(input.capacityHours, "INVALID_CAPACITY_HOURS");
  const deliveryHours = positive(input.deliveryHoursPerClient, "INVALID_DELIVERY_HOURS");
  const clientCount = floorRational(divide(capacityHours, deliveryHours, "INVALID_DELIVERY_HOURS"));
  const actualClients = clientCount < 0n ? 0n : clientCount;
  const retainerAmount = nonNegative(optional(input.retainerAmount, "0"), "INVALID_RETAINER_AMOUNT");
  const monthlyCosts = nonNegative(optional(input.monthlyCosts, "0"), "INVALID_MONTHLY_COSTS");
  const targetMargin = nonNegative(optional(input.targetMarginPercent, "0"), "INVALID_TARGET_MARGIN");
  if (compare(targetMargin, rational(100n, 1n)) >= 0) throw new Error("INVALID_TARGET_MARGIN");
  const allocatedBusinessCost = actualClients === 0n
    ? rational(0n, 1n)
    : divide(monthlyCosts, rational(actualClients, 1n), "INVALID_CLIENT_CAPACITY");
  const contributionPerClient = subtract(retainerAmount, allocatedBusinessCost);
  const contribution = multiply(contributionPerClient, rational(actualClients, 1n));
  const contributionPerHour = compareZero(capacityHours) === 0
    ? rational(0n, 1n)
    : divide(contribution, capacityHours, "INVALID_CAPACITY_HOURS");
  const minimumRetainer = actualClients === 0n
    ? rational(0n, 1n)
    : divide(monthlyCosts, rational(actualClients, 1n), "INVALID_CLIENT_CAPACITY");
  const targetRetainer = actualClients === 0n
    ? rational(0n, 1n)
    : divide(
      minimumRetainer,
      subtract(rational(1n, 1n), divide(targetMargin, rational(100n, 1n), "INVALID_TARGET_MARGIN")),
      "INVALID_TARGET_MARGIN",
    );
  return {
    capacityHours: exact(capacityHours),
    deliveryHoursPerClient: exact(deliveryHours),
    clientCapacity: actualClients.toString(),
    capacityRemainderHours: money(subtract(capacityHours, multiply(deliveryHours, rational(actualClients, 1n)))),
    retainerAmount: money(retainerAmount),
    monthlyCosts: money(monthlyCosts),
    contribution: money(contribution),
    contributionPerClientHour: money(contributionPerHour),
    allocatedBusinessCostPerClient: money(allocatedBusinessCost),
    minimumRetainerForTargetMargin: money(targetRetainer),
    formulas: {
      clientCapacity: "capacity hours ÷ delivery hours per client, rounded down",
      minimumRetainerForTargetMargin: "monthly costs ÷ client capacity",
    },
    rounding: BUSINESS_ROUNDING,
  };
}

export const retainerCapacity = calculateRetainerCapacity;

export interface ScopeCreepCostInput {
  readonly hourlyRate: DecimalInput;
  readonly additionalHours: DecimalInput;
  readonly originalHours?: DecimalInput;
  readonly originalBudget?: DecimalInput;
}

export interface ScopeCreepCostResult {
  readonly hourlyRate: string;
  readonly originalHours: string;
  readonly additionalHours: string;
  readonly originalCost: string;
  readonly additionalCost: string;
  readonly revisedCost: string;
  readonly budgetVariance: string | null;
  readonly formulas: {
    readonly additionalCost: "additional hours × hourly rate";
    readonly revisedCost: "original cost + additional cost";
  };
  readonly rounding: BusinessRounding;
}

export function calculateScopeCreepCost(input: ScopeCreepCostInput): ScopeCreepCostResult {
  const hourlyRate = nonNegative(input.hourlyRate, "INVALID_HOURLY_RATE");
  const additionalHours = nonNegative(input.additionalHours, "INVALID_ADDITIONAL_HOURS");
  const originalHours = nonNegative(optional(input.originalHours, "0"), "INVALID_ORIGINAL_HOURS");
  const originalCost = multiply(originalHours, hourlyRate);
  const additionalCost = multiply(additionalHours, hourlyRate);
  const revisedCost = add(originalCost, additionalCost);
  const originalBudget = input.originalBudget === undefined
    ? undefined
    : nonNegative(input.originalBudget, "INVALID_ORIGINAL_BUDGET");
  return {
    hourlyRate: money(hourlyRate),
    originalHours: exact(originalHours),
    additionalHours: exact(additionalHours),
    originalCost: money(originalCost),
    additionalCost: money(additionalCost),
    revisedCost: money(revisedCost),
    budgetVariance: originalBudget === undefined ? null : money(subtract(originalBudget, revisedCost)),
    formulas: {
      additionalCost: "additional hours × hourly rate",
      revisedCost: "original cost + additional cost",
    },
    rounding: BUSINESS_ROUNDING,
  };
}

export const scopeCreepCost = calculateScopeCreepCost;

export interface BreakEvenInput {
  readonly fixedCosts: DecimalInput;
  readonly unitPrice: DecimalInput;
  readonly unitVariableCost: DecimalInput;
  readonly units?: DecimalInput;
}

export interface BreakEvenResult {
  readonly fixedCosts: string;
  readonly unitPrice: string;
  readonly unitVariableCost: string;
  readonly contributionPerUnit: string;
  readonly contributionRatioPercent: string;
  readonly breakEvenUnits: string;
  readonly units: string;
  readonly breakEvenRevenue: string;
  readonly currentUnits: string;
  readonly currentRevenue: string;
  readonly currentProfit: string;
  readonly scenarioRows: readonly {
    readonly label: string;
    readonly units: string;
    readonly revenue: string;
    readonly totalCosts: string;
    readonly profit: string;
  }[];
  readonly formulas: {
    readonly contributionPerUnit: "unit price − unit variable cost";
    readonly breakEvenUnits: "fixed costs ÷ contribution per unit, rounded up";
  };
  readonly rounding: BusinessRounding;
}

export function calculateBreakEven(input: BreakEvenInput): BreakEvenResult {
  const fixedCosts = nonNegative(input.fixedCosts, "INVALID_FIXED_COSTS");
  const unitPrice = positive(input.unitPrice, "INVALID_UNIT_PRICE");
  const variableCost = nonNegative(input.unitVariableCost, "INVALID_VARIABLE_COST");
  const contribution = subtract(unitPrice, variableCost);
  if (compareZero(contribution) <= 0) throw new Error("INVALID_CONTRIBUTION_MARGIN");
  const currentUnits = nonNegative(optional(input.units, "0"), "INVALID_UNITS");
  const breakEvenUnits = ceilRational(divide(fixedCosts, contribution, "INVALID_CONTRIBUTION_MARGIN"));
  const scenarios = new Map<string, { label: string; count: Rational }>();
  const addScenario = (label: string, count: Rational) => {
    const key = exact(count);
    if (!scenarios.has(key)) scenarios.set(key, { label, count });
  };
  addScenario(breakEvenUnits === 0n ? "Punto di pareggio" : "Senza vendite", rational(0n, 1n));
  if (breakEvenUnits > 0n) addScenario("Un'unità prima del pareggio", rational(breakEvenUnits - 1n, 1n));
  addScenario("Punto di pareggio", rational(breakEvenUnits, 1n));
  addScenario("Un'unità dopo il pareggio", rational(breakEvenUnits + 1n, 1n));
  addScenario("Unità attuali", currentUnits);
  const scenarioRows = [...scenarios.values()].map(({ label, count }) => {
    const revenue = multiply(count, unitPrice);
    const totalCosts = add(fixedCosts, multiply(count, variableCost));
    return { label, units: exact(count), revenue: money(revenue), totalCosts: money(totalCosts), profit: money(subtract(revenue, totalCosts)) };
  });
  return {
    fixedCosts: money(fixedCosts),
    unitPrice: money(unitPrice),
    unitVariableCost: money(variableCost),
    contributionPerUnit: money(contribution),
    contributionRatioPercent: ratioPercent(contribution, unitPrice, "INVALID_UNIT_PRICE"),
    breakEvenUnits: breakEvenUnits.toString(),
    units: breakEvenUnits.toString(),
    breakEvenRevenue: money(multiply(rational(breakEvenUnits, 1n), unitPrice)),
    currentUnits: exact(currentUnits),
    currentRevenue: money(multiply(currentUnits, unitPrice)),
    currentProfit: money(subtract(multiply(currentUnits, unitPrice), add(fixedCosts, multiply(currentUnits, variableCost)))),
    scenarioRows,
    formulas: {
      contributionPerUnit: "unit price − unit variable cost",
      breakEvenUnits: "fixed costs ÷ contribution per unit, rounded up",
    },
    rounding: BUSINESS_ROUNDING,
  };
}

export const breakEven = calculateBreakEven;

export interface PaymentFeeInput {
  readonly targetNet: DecimalInput;
  readonly feeRate?: DecimalInput;
  readonly feePercent?: DecimalInput;
}

export interface PaymentFeeResult {
  readonly targetNet: string;
  readonly feeRatePercent: string;
  readonly feeRate: string;
  readonly gross: string;
  readonly fee: string;
  readonly net: string;
  readonly formulas: { readonly gross: "target net ÷ (1 − fee rate)" };
  readonly rounding: BusinessRounding;
}

export function grossUpForFee(input: PaymentFeeInput): PaymentFeeResult;
export function grossUpForFee(targetNet: DecimalInput, feeRate: DecimalInput): PaymentFeeResult;
export function grossUpForFee(input: PaymentFeeInput | DecimalInput, positionalFeeRate?: DecimalInput): PaymentFeeResult {
  const normalized: PaymentFeeInput = typeof input === "string" || typeof input === "number"
    ? { targetNet: input, ...(positionalFeeRate === undefined ? {} : { feeRate: positionalFeeRate }) }
    : input;
  const targetNet = nonNegative(normalized.targetNet, "INVALID_TARGET_NET");
  const suppliedRate = normalized.feeRate === undefined
    ? normalized.feePercent === undefined
      ? undefined
      : divide(parseBusinessDecimal(normalized.feePercent, "INVALID_FEE_RATE"), rational(100n, 1n), "INVALID_FEE_RATE")
    : parseBusinessDecimal(normalized.feeRate, "INVALID_FEE_RATE");
  if (suppliedRate === undefined) throw new Error("INVALID_FEE_RATE");
  if (compareZero(suppliedRate) < 0 || compare(suppliedRate, rational(1n, 1n)) >= 0) throw new Error("INVALID_FEE_RATE");
  const gross = divide(targetNet, subtract(rational(1n, 1n), suppliedRate), "INVALID_FEE_RATE");
  const fee = subtract(gross, targetNet);
  return {
    targetNet: money(targetNet),
    feeRatePercent: percent(suppliedRate),
    feeRate: displayRate(suppliedRate),
    gross: money(gross),
    fee: money(fee),
    net: money(targetNet),
    formulas: { gross: "target net ÷ (1 − fee rate)" },
    rounding: BUSINESS_ROUNDING,
  };
}

export const paymentFeeGrossUp = grossUpForFee;

export interface LatePaymentInput {
  readonly principal: DecimalInput;
  readonly annualRatePercent?: DecimalInput;
  readonly annualRate?: DecimalInput;
  readonly daysLate: DecimalInput;
  readonly dayCountBasis?: 360 | 365;
}

export interface LatePaymentResult {
  readonly principal: string;
  readonly annualRatePercent: string;
  readonly daysLate: string;
  readonly dayCountBasis: 360 | 365;
  readonly interest: string;
  readonly totalDue: string;
  readonly formulas: { readonly interest: "principal × annual rate × days late ÷ day-count basis" };
  readonly rounding: BusinessRounding;
}

export function calculateLatePaymentInterest(input: LatePaymentInput): LatePaymentResult {
  const principal = nonNegative(input.principal, "INVALID_PRINCIPAL");
  const daysLate = nonNegative(input.daysLate, "INVALID_DAYS_LATE");
  const annualRate = input.annualRatePercent === undefined
    ? input.annualRate === undefined
      ? undefined
      : parseBusinessDecimal(input.annualRate, "INVALID_ANNUAL_RATE")
    : divide(parseBusinessDecimal(input.annualRatePercent, "INVALID_ANNUAL_RATE"), rational(100n, 1n), "INVALID_ANNUAL_RATE");
  if (annualRate === undefined || compareZero(annualRate) < 0) throw new Error("INVALID_ANNUAL_RATE");
  const basis = input.dayCountBasis ?? 365;
  const interest = divide(multiply(multiply(principal, annualRate), daysLate), rational(BigInt(basis), 1n), "INVALID_DAY_COUNT_BASIS");
  return {
    principal: money(principal),
    annualRatePercent: percent(annualRate),
    daysLate: exact(daysLate),
    dayCountBasis: basis,
    interest: money(interest),
    totalDue: money(add(principal, interest)),
    formulas: { interest: "principal × annual rate × days late ÷ day-count basis" },
    rounding: BUSINESS_ROUNDING,
  };
}

export const latePaymentInterest = calculateLatePaymentInterest;

export interface DiscountImpactInput {
  readonly originalPrice: DecimalInput;
  readonly discountPercent?: DecimalInput;
  readonly discountRate?: DecimalInput;
  readonly units?: DecimalInput;
}

export interface DiscountImpactResult {
  readonly originalPrice: string;
  readonly discountPercent: string;
  readonly discountedUnitPrice: string;
  readonly amountSavedPerUnit: string;
  readonly originalRevenue: string;
  readonly discountedRevenue: string;
  readonly lostRevenue: string;
  readonly units: string;
  readonly formulas: {
    readonly discountedUnitPrice: "original price × (1 − discount rate)";
    readonly lostRevenue: "original revenue − discounted revenue";
  };
  readonly rounding: BusinessRounding;
}

export function calculateDiscountImpact(input: DiscountImpactInput): DiscountImpactResult {
  const originalPrice = nonNegative(input.originalPrice, "INVALID_ORIGINAL_PRICE");
  const discount = input.discountPercent === undefined
    ? input.discountRate === undefined
      ? undefined
      : parseBusinessDecimal(input.discountRate, "INVALID_DISCOUNT_RATE")
    : divide(parseBusinessDecimal(input.discountPercent, "INVALID_DISCOUNT_RATE"), rational(100n, 1n), "INVALID_DISCOUNT_RATE");
  if (discount === undefined || compareZero(discount) < 0 || compare(discount, rational(1n, 1n)) >= 0) throw new Error("INVALID_DISCOUNT_RATE");
  const units = nonNegative(optional(input.units, "1"), "INVALID_UNITS");
  const discounted = multiply(originalPrice, subtract(rational(1n, 1n), discount));
  const originalRevenue = multiply(originalPrice, units);
  const discountedRevenue = multiply(discounted, units);
  return {
    originalPrice: money(originalPrice),
    discountPercent: percent(discount),
    discountedUnitPrice: money(discounted),
    amountSavedPerUnit: money(subtract(originalPrice, discounted)),
    originalRevenue: money(originalRevenue),
    discountedRevenue: money(discountedRevenue),
    lostRevenue: money(subtract(originalRevenue, discountedRevenue)),
    units: exact(units),
    formulas: {
      discountedUnitPrice: "original price × (1 − discount rate)",
      lostRevenue: "original revenue − discounted revenue",
    },
    rounding: BUSINESS_ROUNDING,
  };
}

export const discountImpact = calculateDiscountImpact;

export interface ProposalBudgetInput {
  readonly quotedPrice: DecimalInput;
  readonly estimatedHours: DecimalInput;
  readonly hourlyRate: DecimalInput;
  readonly directCosts?: DecimalInput;
  readonly contingencyPercent?: DecimalInput;
  readonly targetMarginPercent?: DecimalInput;
}

export interface ProposalBudgetResult {
  readonly quotedPrice: string;
  readonly estimatedHours: string;
  readonly hourlyRate: string;
  readonly laborCost: string;
  readonly directCosts: string;
  readonly contingency: string;
  readonly totalCost: string;
  readonly profit: string;
  readonly marginPercent: string;
  readonly requiredPriceForTargetMargin: string;
  readonly priceGap: string;
  readonly meetsTargetMargin: boolean;
  readonly formulas: {
    readonly totalCost: "direct costs + labor cost + contingency";
    readonly requiredPriceForTargetMargin: "total cost ÷ (1 − target margin)";
  };
  readonly rounding: BusinessRounding;
}

export function checkProposalBudget(input: ProposalBudgetInput): ProposalBudgetResult {
  const quotedPrice = nonNegative(input.quotedPrice, "INVALID_QUOTED_PRICE");
  const estimatedHours = nonNegative(input.estimatedHours, "INVALID_ESTIMATED_HOURS");
  const hourlyRate = nonNegative(input.hourlyRate, "INVALID_HOURLY_RATE");
  const directCosts = nonNegative(optional(input.directCosts, "0"), "INVALID_DIRECT_COSTS");
  const contingencyPercent = nonNegative(optional(input.contingencyPercent, "0"), "INVALID_CONTINGENCY");
  const targetMargin = nonNegative(optional(input.targetMarginPercent, "0"), "INVALID_TARGET_MARGIN");
  if (compare(targetMargin, rational(100n, 1n)) >= 0) throw new Error("INVALID_TARGET_MARGIN");
  const laborCost = multiply(estimatedHours, hourlyRate);
  const contingency = multiply(laborCost, divide(contingencyPercent, rational(100n, 1n), "INVALID_CONTINGENCY"));
  const totalCost = add(directCosts, add(laborCost, contingency));
  const profit = subtract(quotedPrice, totalCost);
  const requiredPrice = divide(
    totalCost,
    subtract(rational(1n, 1n), divide(targetMargin, rational(100n, 1n), "INVALID_TARGET_MARGIN")),
    "INVALID_TARGET_MARGIN",
  );
  const margin = ratioPercent(profit, quotedPrice, "INVALID_QUOTED_PRICE");
  return {
    quotedPrice: money(quotedPrice),
    estimatedHours: exact(estimatedHours),
    hourlyRate: money(hourlyRate),
    laborCost: money(laborCost),
    directCosts: money(directCosts),
    contingency: money(contingency),
    totalCost: money(totalCost),
    profit: money(profit),
    marginPercent: margin,
    requiredPriceForTargetMargin: money(requiredPrice),
    priceGap: money(subtract(quotedPrice, requiredPrice)),
    meetsTargetMargin: compareZero(quotedPrice) === 0
      ? false
      : compare(
        divide(profit, quotedPrice, "INVALID_QUOTED_PRICE"),
        divide(targetMargin, rational(100n, 1n), "INVALID_TARGET_MARGIN"),
      ) >= 0,
    formulas: {
      totalCost: "direct costs + labor cost + contingency",
      requiredPriceForTargetMargin: "total cost ÷ (1 − target margin)",
    },
    rounding: BUSINESS_ROUNDING,
  };
}

export const proposalBudget = checkProposalBudget;

export interface ProjectProfitabilityInput {
  readonly revenue: DecimalInput;
  readonly fixedCosts?: DecimalInput;
  readonly hours: DecimalInput;
  readonly hourlyCost?: DecimalInput;
}

export interface ProjectProfitabilityResult {
  readonly revenue: string;
  readonly fixedCosts: string;
  readonly hours: string;
  readonly hourlyCost: string;
  readonly totalCost: string;
  readonly profit: string;
  readonly marginPercent: string | null;
  readonly marginRate: string | null;
  readonly effectiveHourlyRate: string | null;
  readonly formulas: {
    readonly totalCost: "fixed costs + hours × hourly cost";
    readonly profit: "revenue − total cost";
  };
  readonly rounding: BusinessRounding;
}

export function calculateProjectProfitability(input: ProjectProfitabilityInput): ProjectProfitabilityResult {
  const revenue = nonNegative(input.revenue, "INVALID_REVENUE");
  const fixedCosts = nonNegative(optional(input.fixedCosts, "0"), "INVALID_FIXED_COSTS");
  const hours = nonNegative(input.hours, "INVALID_HOURS");
  const hourlyCost = nonNegative(optional(input.hourlyCost, "0"), "INVALID_HOURLY_COST");
  const totalCost = add(fixedCosts, multiply(hours, hourlyCost));
  const profit = subtract(revenue, totalCost);
  const margin = compareZero(revenue) === 0 ? null : ratioPercent(profit, revenue, "INVALID_REVENUE");
  const marginRate = compareZero(revenue) === 0 ? null : formatRounded(divide(profit, revenue, "INVALID_REVENUE"), 4);
  const effectiveRate = compareZero(hours) === 0 ? null : money(divide(revenue, hours, "INVALID_HOURS"));
  return {
    revenue: money(revenue),
    fixedCosts: money(fixedCosts),
    hours: exact(hours),
    hourlyCost: money(hourlyCost),
    totalCost: money(totalCost),
    profit: money(profit),
    marginPercent: margin,
    marginRate,
    effectiveHourlyRate: effectiveRate,
    formulas: {
      totalCost: "fixed costs + hours × hourly cost",
      profit: "revenue − total cost",
    },
    rounding: BUSINESS_ROUNDING,
  };
}

export const projectProfitability = calculateProjectProfitability;

export interface InvoiceNumberInput {
  readonly prefix: string;
  readonly sequence: string | number;
  readonly year: string | number;
  readonly padding?: number;
  readonly separator?: string;
}

export interface InvoiceNumberResult {
  readonly prefix: string;
  readonly sequence: string;
  readonly year: string;
  readonly padding: number;
  readonly separator: string;
  readonly invoiceNumber: string;
  readonly format: string;
}

function integerText(value: string | number, code: string): string {
  const text = typeof value === "number" ? numberText(value) : value.trim();
  if (!/^\d+$/u.test(text)) throw new Error(code);
  return text.replace(/^0+(?=\d)/u, "");
}

export function generateInvoiceNumber(input: InvoiceNumberInput): InvoiceNumberResult {
  const prefix = input.prefix.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9]*$/u.test(prefix)) throw new Error("INVALID_INVOICE_PREFIX");
  const sequence = integerText(input.sequence, "INVALID_SEQUENCE");
  const year = integerText(input.year, "INVALID_YEAR");
  if (year.length !== 4) throw new Error("INVALID_YEAR");
  const padding = input.padding ?? 4;
  if (!Number.isInteger(padding) || padding < 1 || padding > 20) throw new Error("INVALID_PADDING");
  const separator = input.separator ?? "-";
  if (!/^[A-Za-z0-9/_-]+$/u.test(separator)) throw new Error("INVALID_SEPARATOR");
  const sequenceText = sequence.padStart(padding, "0");
  const format = `${prefix}{separator}{year}{separator}{sequence}`;
  return {
    prefix,
    sequence: sequenceText,
    year,
    padding,
    separator,
    invoiceNumber: `${prefix}${separator}${year}${separator}${sequenceText}`,
    format,
  };
}

export const invoiceNumber = generateInvoiceNumber;

export interface InvoiceLineItem {
  readonly quantity: DecimalInput;
  readonly unitPrice: DecimalInput;
  readonly discountPercent?: DecimalInput;
}

export interface InvoiceMathInput {
  readonly lineItems?: readonly InvoiceLineItem[];
  readonly subtotal?: DecimalInput;
  readonly taxRatePercent?: DecimalInput;
  readonly discountPercent?: DecimalInput;
  readonly total?: DecimalInput;
}

export interface InvoiceMathResult {
  readonly subtotal: string;
  readonly discountAmount: string;
  readonly taxableAmount: string;
  readonly taxRatePercent: string;
  readonly taxAmount: string;
  readonly expectedTotal: string;
  readonly providedTotal: string | null;
  readonly difference: string | null;
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly formulas: {
    readonly taxableAmount: "subtotal − discount";
    readonly expectedTotal: "taxable amount + tax";
  };
  readonly rounding: BusinessRounding;
}

export function validateInvoiceMath(input: InvoiceMathInput): InvoiceMathResult {
  let subtotal = rational(0n, 1n);
  if (input.lineItems !== undefined) {
    if (!Array.isArray(input.lineItems) || input.lineItems.length === 0) throw new Error("INVALID_LINE_ITEMS");
    for (const item of input.lineItems) {
      if (item === null || typeof item !== "object") throw new Error("INVALID_LINE_ITEMS");
      const quantity = nonNegative(item.quantity, "INVALID_QUANTITY");
      const unitPrice = nonNegative(item.unitPrice, "INVALID_UNIT_PRICE");
      const itemDiscount = item.discountPercent === undefined
        ? rational(0n, 1n)
        : divide(parseBusinessDecimal(item.discountPercent, "INVALID_DISCOUNT_RATE"), rational(100n, 1n), "INVALID_DISCOUNT_RATE");
      if (compareZero(itemDiscount) < 0 || compare(itemDiscount, rational(1n, 1n)) >= 0) throw new Error("INVALID_DISCOUNT_RATE");
      subtotal = add(subtotal, multiply(multiply(quantity, unitPrice), subtract(rational(1n, 1n), itemDiscount)));
    }
  } else {
    subtotal = nonNegative(optional(input.subtotal, "0"), "INVALID_SUBTOTAL");
  }
  const orderDiscount = input.discountPercent === undefined
    ? rational(0n, 1n)
    : divide(parseBusinessDecimal(input.discountPercent, "INVALID_DISCOUNT_RATE"), rational(100n, 1n), "INVALID_DISCOUNT_RATE");
  if (compareZero(orderDiscount) < 0 || compare(orderDiscount, rational(1n, 1n)) >= 0) throw new Error("INVALID_DISCOUNT_RATE");
  const taxableAmount = multiply(subtotal, subtract(rational(1n, 1n), orderDiscount));
  const taxRate = input.taxRatePercent === undefined
    ? rational(0n, 1n)
    : divide(parseBusinessDecimal(input.taxRatePercent, "INVALID_TAX_RATE"), rational(100n, 1n), "INVALID_TAX_RATE");
  if (compareZero(taxRate) < 0) throw new Error("INVALID_TAX_RATE");
  const taxAmount = multiply(taxableAmount, taxRate);
  const expectedTotal = add(taxableAmount, taxAmount);
  const providedTotal = input.total === undefined ? undefined : nonNegative(input.total, "INVALID_TOTAL");
  const difference = providedTotal === undefined ? undefined : subtract(providedTotal, expectedTotal);
  const issues: string[] = [];
  if (difference !== undefined && formatRounded(difference, 2) !== "0.00") issues.push("TOTAL_MISMATCH");
  return {
    subtotal: money(subtotal),
    discountAmount: money(subtract(subtotal, taxableAmount)),
    taxableAmount: money(taxableAmount),
    taxRatePercent: percent(taxRate),
    taxAmount: money(taxAmount),
    expectedTotal: money(expectedTotal),
    providedTotal: providedTotal === undefined ? null : money(providedTotal),
    difference: difference === undefined ? null : money(difference),
    valid: issues.length === 0,
    issues,
    formulas: {
      taxableAmount: "subtotal − discount",
      expectedTotal: "taxable amount + tax",
    },
    rounding: BUSINESS_ROUNDING,
  };
}

export const invoiceMath = validateInvoiceMath;

export type PercentageMode =
  | "add"
  | "reverse"
  | "of"
  | "what-percent"
  | "increase"
  | "decrease"
  | "variation"
  | "reverse-discount"
  | "reverse-cascade"
  | "cascade";

export interface PercentageInput {
  readonly base?: DecimalInput;
  readonly amount?: DecimalInput;
  readonly ratePercent?: DecimalInput;
  readonly percent?: DecimalInput;
  readonly rates?: readonly DecimalInput[];
  readonly mode?: PercentageMode;
}

export interface PercentageResult {
  readonly mode: PercentageMode;
  readonly base: string;
  readonly ratePercent: string;
  readonly percent: string;
  readonly percentageAmount: string;
  readonly result: string;
  readonly total: string;
  readonly net: string;
  readonly rates?: readonly string[];
  readonly formulas: {
    readonly add: "base + base × rate ÷ 100";
    readonly reverse: "gross ÷ (1 + rate ÷ 100)";
    readonly selected: string;
  };
  readonly rounding: BusinessRounding;
}

export function calculatePercentage(input: PercentageInput): PercentageResult {
  const mode = input.mode ?? "add";
  const baseInput = input.base ?? input.amount;
  if (baseInput === undefined) throw new Error("INVALID_BASE");
  const base = parseBusinessDecimal(baseInput, "INVALID_BASE");
  const suppliedRate = input.ratePercent ?? input.percent;
  const formulas = {
    add: "base + base × rate ÷ 100" as const,
    reverse: "gross ÷ (1 + rate ÷ 100)" as const,
  };
  const withRate = (): { rate: Rational; rateFraction: Rational } => {
    if (suppliedRate === undefined) throw new Error("INVALID_RATE");
    const rate = parseBusinessDecimal(suppliedRate, "INVALID_RATE");
    return { rate, rateFraction: divide(rate, rational(100n, 1n), "INVALID_RATE") };
  };
  const result = (
    value: Rational,
    percentageAmount: Rational,
    total: Rational,
    net: Rational,
    rate: Rational,
    selected: string,
    rates?: readonly string[],
  ): PercentageResult => ({
    mode,
    base: money(base),
    ratePercent: money(rate),
    percent: money(rate),
    percentageAmount: money(percentageAmount),
    result: money(value),
    total: money(total),
    net: money(net),
    ...(rates === undefined ? {} : { rates }),
    formulas: { ...formulas, selected },
    rounding: BUSINESS_ROUNDING,
  });

  if (mode === "what-percent") {
    if (compareZero(base) === 0) throw new Error("INVALID_BASE");
    if (input.amount === undefined) throw new Error("INVALID_AMOUNT");
    const amount = parseBusinessDecimal(input.amount, "INVALID_AMOUNT");
    const rate = multiply(divide(amount, base, "INVALID_BASE"), rational(100n, 1n));
    return result(rate, amount, amount, base, rate, "amount ÷ base × 100");
  }

  if (mode === "variation") {
    if (compareZero(base) === 0) throw new Error("INVALID_BASE");
    if (input.amount === undefined) throw new Error("INVALID_AMOUNT");
    const amount = parseBusinessDecimal(input.amount, "INVALID_AMOUNT");
    const delta = subtract(amount, base);
    const rate = multiply(divide(delta, base, "INVALID_BASE"), rational(100n, 1n));
    return result(rate, delta, amount, base, rate, "(new − old) ÷ old × 100");
  }

  if (mode === "cascade" || mode === "reverse-cascade") {
    const forward = mode === "cascade";
    const rawRates = input.rates ?? (suppliedRate === undefined ? [] : [suppliedRate]);
    if (rawRates.length === 0) throw new Error("INVALID_RATE");
    const parsedRates = rawRates.map((value) => parseBusinessDecimal(value, "INVALID_RATE"));
    let factor = rational(1n, 1n);
    for (const rate of parsedRates) {
      if (compare(rate, rational(0n, 1n)) < 0 || compare(rate, rational(100n, 1n)) > 0
        || (!forward && compare(rate, rational(100n, 1n)) === 0)) throw new Error("INVALID_RATE");
      factor = multiply(factor, subtract(rational(1n, 1n), divide(rate, rational(100n, 1n))));
    }
    const total = forward ? multiply(base, factor) : divide(base, factor, "INVALID_RATE");
    const effectiveRate = compareZero(base) === 0 ? rational(0n, 1n)
      : multiply(subtract(rational(1n, 1n), factor), rational(100n, 1n));
    return result(
      total,
      forward ? subtract(base, total) : subtract(total, base),
      forward ? total : base,
      forward ? base : total,
      effectiveRate,
      forward ? "base × ∏(1 − discount ÷ 100)" : "discounted ÷ ∏(1 − discount ÷ 100)",
      parsedRates.map((rate) => money(rate)),
    );
  }

  const { rate, rateFraction } = withRate();
  if (mode === "add" || mode === "increase" || mode === "of" || mode === "decrease") {
    const part = multiply(base, rateFraction);
    if (mode === "of") return result(part, part, base, base, rate, "base × rate ÷ 100");
    const total = mode === "decrease" ? subtract(base, part) : add(base, part);
    return result(mode === "add" ? part : total, part, total, base, rate,
      mode === "decrease" ? "base − base × rate ÷ 100" : formulas.add);
  }

  if (mode === "reverse-discount") {
    if (compare(rate, rational(0n, 1n)) < 0 || compare(rate, rational(100n, 1n)) >= 0) throw new Error("INVALID_RATE");
    const denominator = subtract(rational(1n, 1n), rateFraction);
    const original = divide(base, denominator, "INVALID_RATE");
    return result(original, subtract(original, base), base, original, rate, "discounted ÷ (1 − rate ÷ 100)");
  }

  const net = divide(base, add(rational(1n, 1n), rateFraction), "INVALID_RATE");
  return result(net, subtract(base, net), base, net, rate, formulas.reverse);
}

export const percentageHelper = calculatePercentage;

export interface CurrencyScenarioInput {
  readonly amount: DecimalInput;
  readonly rate?: DecimalInput;
  readonly fromRate?: DecimalInput;
  readonly toRate?: DecimalInput;
  readonly fromCurrency?: string;
  readonly toCurrency?: string;
}

export interface CurrencyScenarioResult {
  readonly sourceAmount: string;
  readonly rate: string;
  readonly convertedAmount: string;
  readonly converted: string;
  readonly inverseRate: string;
  readonly fromCurrency: string;
  readonly toCurrency: string;
  readonly rateMeaning: "target currency units per source currency unit";
  readonly formulas: { readonly convertedAmount: "source amount × user-entered rate" };
  readonly rounding: BusinessRounding;
}

export function calculateCurrencyScenario(input: CurrencyScenarioInput): CurrencyScenarioResult {
  const amount = nonNegative(input.amount, "INVALID_AMOUNT");
  const rate = input.rate === undefined
    ? input.fromRate === undefined || input.toRate === undefined
      ? undefined
      : divide(parseBusinessDecimal(input.toRate, "INVALID_RATE"), parseBusinessDecimal(input.fromRate, "INVALID_RATE"), "INVALID_RATE")
    : positive(input.rate, "INVALID_RATE");
  if (rate === undefined) throw new Error("INVALID_RATE");
  const inverse = divide(rational(1n, 1n), rate, "INVALID_RATE");
  return {
    sourceAmount: money(amount),
    rate: displayRate(rate),
    convertedAmount: money(multiply(amount, rate)),
    converted: money(multiply(amount, rate)),
    inverseRate: displayRate(inverse),
    fromCurrency: input.fromCurrency?.trim().toUpperCase() ?? "SOURCE",
    toCurrency: input.toCurrency?.trim().toUpperCase() ?? "TARGET",
    rateMeaning: "target currency units per source currency unit",
    formulas: { convertedAmount: "source amount × user-entered rate" },
    rounding: BUSINESS_ROUNDING,
  };
}

export const currencyScenario = calculateCurrencyScenario;

const MAX_SCIENTIFIC_EXPRESSION_LENGTH = 512;
const MAX_SCIENTIFIC_TOKENS = 256;
const MAX_SCIENTIFIC_DEPTH = 32;

type ScientificToken =
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "identifier"; readonly value: string }
  | { readonly kind: "symbol"; readonly value: "+" | "-" | "*" | "/" | "^" | "(" | ")" }
  | { readonly kind: "eof" };

const SCIENTIFIC_CONSTANTS: Readonly<Record<string, number>> = {
  pi: Math.PI,
  e: Math.E,
};

function scientificFinite(value: number, code = "NON_FINITE_RESULT"): number {
  if (!Number.isFinite(value)) throw new Error(code);
  return value;
}

function scientificFunction(name: string, value: number): number {
  if (name === "abs") return Math.abs(value);
  if (name === "sqrt") {
    if (value < 0) throw new Error("MATH_DOMAIN_ERROR");
    return Math.sqrt(value);
  }
  if (name === "sin") return Math.sin(value);
  if (name === "cos") return Math.cos(value);
  if (name === "tan") return scientificFinite(Math.tan(value));
  if (name === "asin") {
    if (value < -1 || value > 1) throw new Error("MATH_DOMAIN_ERROR");
    return Math.asin(value);
  }
  if (name === "acos") {
    if (value < -1 || value > 1) throw new Error("MATH_DOMAIN_ERROR");
    return Math.acos(value);
  }
  if (name === "atan") return Math.atan(value);
  if (name === "ln") {
    if (value <= 0) throw new Error("MATH_DOMAIN_ERROR");
    return Math.log(value);
  }
  if (name === "log" || name === "log10") {
    if (value <= 0) throw new Error("MATH_DOMAIN_ERROR");
    return Math.log10(value);
  }
  if (name === "exp") return scientificFinite(Math.exp(value));
  if (name === "floor") return Math.floor(value);
  if (name === "ceil") return Math.ceil(value);
  if (name === "round") return Math.round(value);
  throw new Error("UNSUPPORTED_IDENTIFIER");
}

function tokenizeScientificExpression(expression: string): readonly ScientificToken[] {
  if (expression.trim() === "") throw new Error("EMPTY_EXPRESSION");
  if (expression.length > MAX_SCIENTIFIC_EXPRESSION_LENGTH) throw new Error("EXPRESSION_TOO_COMPLEX");
  const tokens: ScientificToken[] = [];
  let index = 0;
  while (index < expression.length) {
    const char = expression[index] ?? "";
    if (/\s/u.test(char)) {
      index += 1;
      continue;
    }
    if (/[+\-*/^()]/u.test(char)) {
      tokens.push({ kind: "symbol", value: char as Extract<ScientificToken, { kind: "symbol" }>["value"] });
      index += 1;
    } else if (/\d/u.test(char) || ((char === "." || char === ",") && /\d/u.test(expression[index + 1] ?? ""))) {
      const rest = expression.slice(index);
      const match = /^(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?/u.exec(rest);
      if (match === null) throw new Error("INVALID_EXPRESSION");
      const raw = match[0];
      const mantissaDigits = raw.replace(/[.,eE+\-]/gu, "");
      if (mantissaDigits.length > 40) throw new Error("EXPRESSION_TOO_COMPLEX");
      const value = Number(raw.replace(",", "."));
      if (!Number.isFinite(value)) throw new Error("NON_FINITE_RESULT");
      tokens.push({ kind: "number", value });
      index += raw.length;
    } else if (/[A-Za-z]/u.test(char)) {
      const match = /^[A-Za-z][A-Za-z0-9]*/u.exec(expression.slice(index));
      if (match === null) throw new Error("INVALID_EXPRESSION");
      tokens.push({ kind: "identifier", value: match[0].toLowerCase() });
      index += match[0].length;
    } else {
      throw new Error("INVALID_EXPRESSION");
    }
    if (tokens.length > MAX_SCIENTIFIC_TOKENS) throw new Error("EXPRESSION_TOO_COMPLEX");
  }
  return [...tokens, { kind: "eof" }];
}

class ScientificExpressionParser {
  private index = 0;
  private depth = 0;

  constructor(private readonly tokens: readonly ScientificToken[]) {}

  parse(): number {
    const value = this.parseExpression();
    if (this.peek().kind !== "eof") throw new Error("INVALID_EXPRESSION");
    return scientificFinite(value);
  }

  private peek(): ScientificToken {
    return this.tokens[this.index] ?? { kind: "eof" };
  }

  private take(): ScientificToken {
    const token = this.peek();
    this.index += 1;
    return token;
  }

  private symbol(value: Extract<ScientificToken, { kind: "symbol" }>["value"]): boolean {
    const token = this.peek();
    return token.kind === "symbol" && token.value === value;
  }

  private parseExpression(): number {
    let value = this.parseTerm();
    while (this.symbol("+") || this.symbol("-")) {
      const operator = this.take() as Extract<ScientificToken, { kind: "symbol" }>;
      const right = this.parseTerm();
      value = scientificFinite(operator.value === "+" ? value + right : value - right);
    }
    return value;
  }

  private parseTerm(): number {
    let value = this.parseUnary();
    while (this.symbol("*") || this.symbol("/")) {
      const operator = this.take() as Extract<ScientificToken, { kind: "symbol" }>;
      const right = this.parseUnary();
      if (operator.value === "/" && right === 0) throw new Error("DIVISION_BY_ZERO");
      value = scientificFinite(operator.value === "*" ? value * right : value / right);
    }
    return value;
  }

  private parseUnary(): number {
    if (this.symbol("+") || this.symbol("-")) {
      const operator = this.take() as Extract<ScientificToken, { kind: "symbol" }>;
      const value = this.parseUnary();
      return operator.value === "-" ? -value : value;
    }
    return this.parsePower();
  }

  private parsePower(): number {
    const left = this.parsePrimary();
    if (!this.symbol("^")) return left;
    this.take();
    const right = this.parseUnary();
    return scientificFinite(Math.pow(left, right), "MATH_DOMAIN_ERROR");
  }

  private withDepth<T>(callback: () => T): T {
    this.depth += 1;
    if (this.depth > MAX_SCIENTIFIC_DEPTH) throw new Error("EXPRESSION_TOO_COMPLEX");
    try {
      return callback();
    } finally {
      this.depth -= 1;
    }
  }

  private parsePrimary(): number {
    const token = this.take();
    if (token.kind === "number") return token.value;
    if (token.kind === "identifier") {
      const constant = SCIENTIFIC_CONSTANTS[token.value];
      if (constant !== undefined && !this.symbol("(")) return constant;
      if (!this.symbol("(")) throw new Error("UNSUPPORTED_IDENTIFIER");
      this.take();
      return this.withDepth(() => {
        const argument = this.parseExpression();
        if (!this.symbol(")")) throw new Error("INVALID_EXPRESSION");
        this.take();
        return scientificFinite(scientificFunction(token.value, argument));
      });
    }
    if (token.kind === "symbol" && token.value === "(") {
      return this.withDepth(() => {
        const value = this.parseExpression();
        if (!this.symbol(")")) throw new Error("INVALID_EXPRESSION");
        this.take();
        return value;
      });
    }
    throw new Error("INVALID_EXPRESSION");
  }
}

export interface ScientificExpressionInput {
  readonly expression: string;
}

export interface ScientificExpressionResult {
  readonly result: number;
  readonly expression: string;
  readonly assumptions: {
    readonly angleUnit: "radians";
    readonly constants: "pi, e";
  };
  readonly formulas: {
    readonly precedence: "parentheses/functions → powers → unary signs → multiplication/division → addition/subtraction";
    readonly supportedFunctions: "abs, sqrt, sin, cos, tan, asin, acos, atan, ln, log/log10, exp, floor, ceil, round";
  };
}

export function calculateScientificExpression(input: ScientificExpressionInput): ScientificExpressionResult {
  if (typeof input.expression !== "string") throw new Error("INVALID_EXPRESSION");
  const expression = input.expression.trim();
  const result = new ScientificExpressionParser(tokenizeScientificExpression(expression)).parse();
  return {
    result,
    expression,
    assumptions: { angleUnit: "radians", constants: "pi, e" },
    formulas: {
      precedence: "parentheses/functions → powers → unary signs → multiplication/division → addition/subtraction",
      supportedFunctions: "abs, sqrt, sin, cos, tan, asin, acos, atan, ln, log/log10, exp, floor, ceil, round",
    },
  };
}

const MAX_INTEGER_DIGITS = 100;
const MAX_FACTOR_INPUT = 1_000_000_000_000n;
const MAX_COMBINATORIC_N = 1_000n;
const MAX_WORDS_ABS = 999_999_999_999n;

function parseToolkitInteger(value: string, code = "INVALID_INTEGER"): bigint {
  const text = value.trim();
  if (!/^[+-]?\d+$/u.test(text)) throw new Error(code);
  const digits = text.replace(/^[+-]/u, "").replace(/^0+/u, "") || "0";
  if (digits.length > MAX_INTEGER_DIGITS) throw new Error("INTEGER_OUT_OF_RANGE");
  return BigInt(text);
}

function parseFraction(value: string): Rational {
  const text = value.trim();
  if (text.length > 256) throw new Error("FRACTION_OUT_OF_RANGE");
  const match = /^([+-]?\d+)(?:\/([+-]?\d+))?$/u.exec(text);
  if (match === null) throw new Error("INVALID_FRACTION");
  const numeratorText = match[1] ?? "0";
  const denominatorText = match[2] ?? "1";
  if (numeratorText.replace(/^[+-]/u, "").length > MAX_INTEGER_DIGITS || denominatorText.replace(/^[+-]/u, "").length > MAX_INTEGER_DIGITS) {
    throw new Error("FRACTION_OUT_OF_RANGE");
  }
  const denominator = BigInt(denominatorText);
  if (denominator === 0n) throw new Error("INVALID_DENOMINATOR");
  return rational(BigInt(numeratorText), denominator);
}

function formatFraction(value: Rational): string {
  return value.denominator === 1n ? value.numerator.toString() : `${value.numerator}/${value.denominator}`;
}

function integerGcd(left: bigint, right: bigint): bigint {
  let first = left < 0n ? -left : left;
  let second = right < 0n ? -right : right;
  while (second !== 0n) [first, second] = [second, first % second];
  return first;
}

function integerLcm(left: bigint, right: bigint): bigint {
  if (left === 0n || right === 0n) return 0n;
  const divisor = integerGcd(left, right);
  const value = (left / divisor) * right;
  return value < 0n ? -value : value;
}

function factorizeInteger(value: bigint): readonly bigint[] {
  const absolute = value < 0n ? -value : value;
  if (absolute > MAX_FACTOR_INPUT) throw new Error("INTEGER_OUT_OF_RANGE");
  if (absolute === 0n) throw new Error("FACTORIZATION_UNDEFINED_ZERO");
  if (absolute === 1n) return value < 0n ? [-1n] : [1n];
  const factors: bigint[] = value < 0n ? [-1n] : [];
  let remaining = absolute;
  while (remaining % 2n === 0n) {
    factors.push(2n);
    remaining /= 2n;
  }
  let candidate = 3n;
  while (candidate * candidate <= remaining) {
    while (remaining % candidate === 0n) {
      factors.push(candidate);
      remaining /= candidate;
    }
    candidate += 2n;
  }
  if (remaining > 1n) factors.push(remaining);
  return factors;
}

function isPrimeInteger(value: bigint): boolean {
  if (value < 2n) return false;
  const factors = factorizeInteger(value);
  return factors.length === 1 && factors[0] === value;
}

function factorialRange(high: bigint, count: bigint): bigint {
  let result = 1n;
  for (let offset = 0n; offset < count; offset += 1n) result *= high - offset;
  return result;
}

function permutation(n: bigint, r: bigint): bigint {
  if (n < 0n || r < 0n || r > n || n > MAX_COMBINATORIC_N) throw new Error("COMBINATORIC_OUT_OF_RANGE");
  return factorialRange(n, r);
}

function combination(n: bigint, r: bigint): bigint {
  if (n < 0n || r < 0n || r > n || n > MAX_COMBINATORIC_N) throw new Error("COMBINATORIC_OUT_OF_RANGE");
  const smaller = r < n - r ? r : n - r;
  let result = 1n;
  for (let index = 1n; index <= smaller; index += 1n) result = (result * (n - smaller + index)) / index;
  return result;
}

const ROMAN_PARTS: readonly [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

function integerToRoman(value: number): string {
  if (!Number.isInteger(value) || value < 1 || value > 3999) throw new Error("ROMAN_OUT_OF_RANGE");
  let remaining = value;
  let output = "";
  for (const [numeric, symbol] of ROMAN_PARTS) {
    while (remaining >= numeric) {
      output += symbol;
      remaining -= numeric;
    }
  }
  return output;
}

function romanToInteger(value: string): number {
  const text = value.trim().toUpperCase();
  if (!/^[IVXLCDM]+$/u.test(text)) throw new Error("INVALID_ROMAN");
  const values: Readonly<Record<string, number>> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let index = 0; index < text.length; index += 1) {
    const current = values[text[index] ?? ""] ?? 0;
    const next = values[text[index + 1] ?? ""] ?? 0;
    total += current < next ? -current : current;
  }
  if (total < 1 || total > 3999 || integerToRoman(total) !== text) throw new Error("INVALID_ROMAN");
  return total;
}

const SMALL_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
] as const;
const TENS_WORDS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"] as const;

function wordsBelowThousand(value: number): string {
  if (value < 20) return SMALL_WORDS[value] ?? "";
  if (value < 100) {
    const tens = TENS_WORDS[Math.floor(value / 10)] ?? "";
    const remainder = value % 10;
    return remainder === 0 ? tens : `${tens}-${SMALL_WORDS[remainder]}`;
  }
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  return remainder === 0 ? `${SMALL_WORDS[hundreds]} hundred` : `${SMALL_WORDS[hundreds]} hundred ${wordsBelowThousand(remainder)}`;
}

function integerToEnglishWords(value: bigint): string {
  const absolute = value < 0n ? -value : value;
  if (absolute > MAX_WORDS_ABS) throw new Error("INTEGER_OUT_OF_RANGE");
  if (absolute === 0n) return "zero";
  const groups: readonly [bigint, string][] = [[1_000_000_000n, "billion"], [1_000_000n, "million"], [1_000n, "thousand"]];
  let remaining = absolute;
  const parts: string[] = [];
  for (const [scale, label] of groups) {
    if (remaining >= scale) {
      const count = Number(remaining / scale);
      parts.push(`${wordsBelowThousand(count)} ${label}`);
      remaining %= scale;
    }
  }
  if (remaining > 0n) parts.push(wordsBelowThousand(Number(remaining)));
  return `${value < 0n ? "minus " : ""}${parts.join(" ")}`;
}

export type ExactIntegerToolkitMode = "fraction" | "gcd-lcm" | "prime-factor" | "combinatorics" | "roman" | "number-words";
export type ExactIntegerToolkitOperation = "add" | "subtract" | "multiply" | "divide" | "combination" | "permutation";

export interface ExactIntegerToolkitInput {
  readonly mode: ExactIntegerToolkitMode;
  readonly left: string;
  readonly right?: string;
  readonly operation?: ExactIntegerToolkitOperation;
}

export function calculateExactIntegerToolkit(input: ExactIntegerToolkitInput): Record<string, unknown> {
  if (input.mode === "fraction") {
    const left = parseFraction(input.left);
    const right = parseFraction(input.right ?? "");
    const operation = input.operation ?? "add";
    const value = operation === "add" ? add(left, right)
      : operation === "subtract" ? subtract(left, right)
        : operation === "multiply" ? multiply(left, right)
          : operation === "divide" ? divide(left, right, "DIVISION_BY_ZERO")
            : (() => { throw new Error("INVALID_OPERATION"); })();
    return {
      result: formatFraction(value),
      left: formatFraction(left),
      right: formatFraction(right),
      operation,
      assumptions: {
        arithmetic: "exact BigInt rational arithmetic",
        bounds: `numerator and denominator each use at most ${MAX_INTEGER_DIGITS} decimal digits; denominator must be non-zero`,
      },
      formulas: { reduction: "numerator and denominator are reduced by GCD after every operation" },
    };
  }
  if (input.mode === "gcd-lcm") {
    const left = parseToolkitInteger(input.left);
    const right = parseToolkitInteger(input.right ?? "");
    const gcdValue = integerGcd(left, right);
    const lcmValue = integerLcm(left, right);
    return {
      result: gcdValue.toString(),
      gcd: gcdValue.toString(),
      lcm: lcmValue.toString(),
      assumptions: {
        signPolicy: "GCD and LCM are non-negative; gcd(0, 0) = 0; lcm with zero = 0",
        bounds: `each signed integer uses at most ${MAX_INTEGER_DIGITS} decimal digits`,
      },
      formulas: { gcd: "Euclidean algorithm", lcm: "abs((a / gcd(a,b)) × b)" },
    };
  }
  if (input.mode === "prime-factor") {
    const value = parseToolkitInteger(input.left);
    const factors = factorizeInteger(value);
    return {
      result: factors.map(String).join(" × "),
      isPrime: isPrimeInteger(value),
      factors: factors.map(String),
      assumptions: { range: `absolute value ≤ ${MAX_FACTOR_INPUT.toString()}`, zero: "factorization of zero is undefined" },
      formulas: { factorization: "trial division through sqrt(remaining factor)" },
    };
  }
  if (input.mode === "combinatorics") {
    const n = parseToolkitInteger(input.left);
    const r = parseToolkitInteger(input.right ?? "");
    const operation = input.operation ?? "combination";
    const value = operation === "combination" ? combination(n, r)
      : operation === "permutation" ? permutation(n, r)
        : (() => { throw new Error("INVALID_OPERATION"); })();
    return {
      result: value.toString(),
      n: n.toString(),
      r: r.toString(),
      operation,
      assumptions: { bounds: `0 ≤ r ≤ n ≤ ${MAX_COMBINATORIC_N.toString()}` },
      formulas: { combination: "n! / (r! × (n-r)!)", permutation: "n! / (n-r)!" },
    };
  }
  if (input.mode === "roman") {
    if (/^[+-]?\d+$/u.test(input.left.trim())) {
      const value = parseToolkitInteger(input.left);
      const numeric = Number(value);
      return {
        result: integerToRoman(numeric),
        decimal: value.toString(),
        assumptions: { canonicalRange: "1..3999" },
        formulas: { validation: "Roman output uses canonical subtractive notation" },
      };
    }
    const numeric = romanToInteger(input.left);
    return {
      result: numeric.toString(),
      roman: integerToRoman(numeric),
      assumptions: { canonicalRange: "I..MMMCMXCIX" },
      formulas: { validation: "input must round-trip to the same canonical Roman representation" },
    };
  }
  if (input.mode === "number-words") {
    const value = parseToolkitInteger(input.left);
    return {
      result: integerToEnglishWords(value),
      value: value.toString(),
      assumptions: { language: "English", bounds: `absolute value ≤ ${MAX_WORDS_ABS.toString()}` },
      formulas: { grouping: "billions, millions, thousands, then hundreds/tens/ones" },
    };
  }
  throw new Error("INVALID_MODE");
}

const MAX_STATS_ITEMS = 1_000;
const MAX_STATS_ABS = rational(1_000_000_000_000n, 1n);

function rationalAbs(value: Rational): Rational {
  return value.numerator < 0n ? rational(-value.numerator, value.denominator) : value;
}

function rationalToFiniteNumber(value: Rational, code = "NUMBER_OUT_OF_RANGE"): number {
  const result = Number(value.numerator) / Number(value.denominator);
  if (!Number.isFinite(result)) throw new Error(code);
  return result;
}

function parseStatisticList(text: string, code: string): readonly Rational[] {
  if (typeof text !== "string" || text.trim() === "") throw new Error(code);
  const parts = text.trim().split(/[;\s]+/u).filter(Boolean);
  if (parts.length === 0) throw new Error(code);
  if (parts.length > MAX_STATS_ITEMS) throw new Error("TOO_MANY_VALUES");
  return parts.map((part) => {
    const value = parseBusinessDecimal(part, code);
    if (compare(rationalAbs(value), MAX_STATS_ABS) > 0) throw new Error("NUMBER_OUT_OF_RANGE");
    return value;
  });
}

function rationalSum(values: readonly Rational[]): Rational {
  return values.reduce((sum, value) => add(sum, value), rational(0n, 1n));
}

function statisticMode(values: readonly Rational[]): readonly string[] {
  const counts = new Map<string, { count: number; value: Rational }>();
  let maxCount = 0;
  for (const value of values) {
    const key = `${value.numerator}/${value.denominator}`;
    const current = counts.get(key);
    const nextCount = (current?.count ?? 0) + 1;
    counts.set(key, { count: nextCount, value });
    maxCount = Math.max(maxCount, nextCount);
  }
  if (maxCount <= 1) return [];
  return [...counts.values()]
    .filter(({ count }) => count === maxCount)
    .map(({ value }) => displayRate(value))
    .toSorted((left, right) => Number(left) - Number(right));
}

export type StatisticsGradeMode = "descriptive" | "weighted" | "completion";

export interface StatisticsGradeInput {
  readonly mode: StatisticsGradeMode;
  readonly values?: string;
  readonly weights?: string;
  readonly completed?: DecimalInput;
  readonly total?: DecimalInput;
}

export function calculateStatisticsGrade(input: StatisticsGradeInput): Record<string, unknown> {
  if (input.mode === "descriptive") {
    const values = parseStatisticList(input.values ?? "", "INVALID_VALUES");
    const count = values.length;
    const sum = rationalSum(values);
    const mean = divide(sum, rational(BigInt(count), 1n));
    const sorted = [...values].sort(compare);
    const middle = Math.floor(count / 2);
    const median = count % 2 === 1
      ? sorted[middle] ?? rational(0n, 1n)
      : divide(add(sorted[middle - 1] ?? rational(0n, 1n), sorted[middle] ?? rational(0n, 1n)), rational(2n, 1n));
    const squared = values.map((value) => {
      const difference = subtract(value, mean);
      return multiply(difference, difference);
    });
    const squareSum = rationalSum(squared);
    const populationVariance = divide(squareSum, rational(BigInt(count), 1n));
    const sampleVariance = count > 1 ? divide(squareSum, rational(BigInt(count - 1), 1n)) : null;
    const populationStdDev = Math.sqrt(rationalToFiniteNumber(populationVariance));
    const sampleStdDev = sampleVariance === null ? null : Math.sqrt(rationalToFiniteNumber(sampleVariance));
    const modes = statisticMode(values);
    return {
      result: rationalToFiniteNumber(mean),
      count,
      sum: displayRate(sum),
      mean: displayRate(mean),
      median: displayRate(median),
      mode: modes,
      modeStatus: modes.length === 0 ? "none" : modes.length === 1 ? "single" : "tie",
      populationVariance: formatRounded(populationVariance, 8),
      populationStdDev: populationStdDev.toFixed(8),
      sampleVariance: sampleVariance === null ? null : formatRounded(sampleVariance, 8),
      sampleStdDev: sampleStdDev === null ? null : sampleStdDev.toFixed(8),
      assumptions: { variance: "population uses n; sample uses n-1 and is undefined for a singleton" },
      formulas: { mean: "Σx / n", variance: "Σ(x-mean)² / n or (n-1)", standardDeviation: "sqrt(variance)" },
    };
  }
  if (input.mode === "weighted") {
    const values = parseStatisticList(input.values ?? "", "INVALID_VALUES");
    const weights = parseStatisticList(input.weights ?? "", "INVALID_WEIGHTS");
    if (values.length !== weights.length) throw new Error("WEIGHT_LENGTH_MISMATCH");
    if (weights.some((weight) => compareZero(weight) < 0)) throw new Error("INVALID_WEIGHTS");
    const weightSum = rationalSum(weights);
    if (compareZero(weightSum) === 0) throw new Error("ZERO_WEIGHT_SUM");
    const weightedSum = rationalSum(values.map((value, index) => multiply(value, weights[index] ?? rational(0n, 1n))));
    const average = divide(weightedSum, weightSum);
    return {
      result: rationalToFiniteNumber(average),
      count: values.length,
      weightedSum: displayRate(weightedSum),
      weightSum: displayRate(weightSum),
      weightedAverage: displayRate(average),
      assumptions: { weights: "weights must be non-negative and their total must be greater than zero" },
      formulas: { weightedAverage: "Σ(value × weight) / Σweight" },
    };
  }
  if (input.mode === "completion") {
    if (input.completed === undefined || input.total === undefined) throw new Error("INVALID_COMPLETION");
    const completed = nonNegative(input.completed, "INVALID_COMPLETION");
    const total = positive(input.total, "INVALID_COMPLETION");
    if (compare(completed, total) > 0) throw new Error("COMPLETED_EXCEEDS_TOTAL");
    const percentage = multiply(divide(completed, total), rational(100n, 1n));
    return {
      result: rationalToFiniteNumber(percentage),
      completed: displayRate(completed),
      total: displayRate(total),
      remaining: displayRate(subtract(total, completed)),
      completionPercent: formatRounded(percentage, 2),
      assumptions: { range: "0 ≤ completed ≤ total; total > 0" },
      formulas: { completion: "completed / total × 100" },
    };
  }
  throw new Error("INVALID_MODE");
}

const MAX_FINANCE_AMOUNT = rational(1_000_000_000_000_000n, 1n);
const MAX_FINANCE_RATE_PERCENT = rational(10_000n, 1n);
const MAX_FINANCE_YEARS = rational(200n, 1n);
const MAX_FINANCE_PERIODS = 100_000;

function boundedFinanceDecimal(value: DecimalInput, max: Rational, code: string, allowNegative = false): Rational {
  const parsed = parseBusinessDecimal(value, code);
  if ((!allowNegative && compareZero(parsed) < 0) || compare(rationalAbs(parsed), max) > 0) throw new Error(code);
  return parsed;
}

function financeNumber(value: Rational, code: string): number {
  return rationalToFiniteNumber(value, code);
}

function finalMoneyNumber(value: number): string {
  if (!Number.isFinite(value)) throw new Error("FINANCE_RESULT_OUT_OF_RANGE");
  return value.toFixed(2);
}

export type InterestSavingsMode = "simple" | "compound" | "contribution" | "goal";

export interface InterestSavingsInput {
  readonly mode: InterestSavingsMode;
  readonly principal: DecimalInput;
  readonly annualRatePercent: DecimalInput;
  readonly years: DecimalInput;
  readonly compoundsPerYear?: DecimalInput;
  readonly periodicContribution?: DecimalInput;
  readonly target?: DecimalInput;
}

function financePeriods(years: Rational, compoundsPerYear: bigint): number {
  const exactPeriods = multiply(years, rational(compoundsPerYear, 1n));
  if (exactPeriods.denominator !== 1n || exactPeriods.numerator < 0n || exactPeriods.numerator > BigInt(MAX_FINANCE_PERIODS)) {
    throw new Error("INVALID_PERIOD_COUNT");
  }
  return Number(exactPeriods.numerator);
}

export function calculateInterestSavings(input: InterestSavingsInput): Record<string, unknown> {
  const principalRational = boundedFinanceDecimal(input.principal, MAX_FINANCE_AMOUNT, "INVALID_PRINCIPAL");
  const rateRational = boundedFinanceDecimal(input.annualRatePercent, MAX_FINANCE_RATE_PERCENT, "INVALID_RATE", true);
  const yearsRational = boundedFinanceDecimal(input.years, MAX_FINANCE_YEARS, "INVALID_YEARS");
  const principal = financeNumber(principalRational, "INVALID_PRINCIPAL");
  const annualRatePercent = financeNumber(rateRational, "INVALID_RATE");
  const years = financeNumber(yearsRational, "INVALID_YEARS");
  const annualRate = annualRatePercent / 100;
  if (input.mode === "simple") {
    const futureValue = principal * (1 + annualRate * years);
    const interestEarned = futureValue - principal;
    scientificFinite(futureValue, "FINANCE_RESULT_OUT_OF_RANGE");
    return {
      result: futureValue,
      mode: input.mode,
      futureValue: finalMoneyNumber(futureValue),
      interestEarned: finalMoneyNumber(interestEarned),
      assumptions: { interest: "simple annual interest; no taxes, fees or inflation" },
      formulas: { futureValue: "principal × (1 + annualRate × years)" },
      rounding: BUSINESS_ROUNDING,
    };
  }

  const cadenceInput = input.compoundsPerYear ?? 12;
  const cadence = parseBusinessDecimal(cadenceInput, "INVALID_COMPOUNDING");
  if (cadence.denominator !== 1n || cadence.numerator < 1n || cadence.numerator > 365n) throw new Error("INVALID_COMPOUNDING");
  const compoundsPerYear = cadence.numerator;
  const periods = financePeriods(yearsRational, compoundsPerYear);
  const periodicRate = annualRate / Number(compoundsPerYear);
  if (1 + periodicRate <= 0) throw new Error("INVALID_RATE");
  const growth = Math.pow(1 + periodicRate, periods);
  scientificFinite(growth, "FINANCE_RESULT_OUT_OF_RANGE");

  if (input.mode === "compound") {
    const futureValue = principal * growth;
    const interestEarned = futureValue - principal;
    return {
      result: scientificFinite(futureValue, "FINANCE_RESULT_OUT_OF_RANGE"),
      mode: input.mode,
      years,
      annualRatePercent,
      compoundsPerYear: Number(compoundsPerYear),
      periods,
      periodicRate,
      futureValue: finalMoneyNumber(futureValue),
      interestEarned: finalMoneyNumber(interestEarned),
      assumptions: { contributions: "none", timing: "interest compounds at the selected cadence" },
      formulas: { futureValue: "principal × (1 + annualRate / m)^(m × years)" },
      rounding: BUSINESS_ROUNDING,
    };
  }

  if (annualRatePercent < 0) throw new Error("INVALID_SAVINGS_RATE");
  if (input.mode === "contribution") {
    if (input.periodicContribution === undefined) throw new Error("INVALID_CONTRIBUTION");
    const contributionRational = boundedFinanceDecimal(input.periodicContribution, MAX_FINANCE_AMOUNT, "INVALID_CONTRIBUTION");
    const contribution = financeNumber(contributionRational, "INVALID_CONTRIBUTION");
    const contributionGrowth = periods === 0 ? 0 : periodicRate === 0 ? contribution * periods : contribution * ((growth - 1) / periodicRate);
    const futureValue = principal * growth + contributionGrowth;
    return {
      result: scientificFinite(futureValue, "FINANCE_RESULT_OUT_OF_RANGE"),
      mode: input.mode,
      years,
      annualRatePercent,
      compoundsPerYear: Number(compoundsPerYear),
      periods,
      periodicRate,
      futureValue: finalMoneyNumber(futureValue),
      totalContributions: finalMoneyNumber(principal + contribution * periods),
      interestEarned: finalMoneyNumber(futureValue - principal - contribution * periods),
      assumptions: { contributionTiming: "end of each compounding period", feesTaxesInflation: "not modeled" },
      formulas: { futureValue: "principal × growth + contribution × ((growth − 1) / periodicRate); zero-rate uses contribution × periods" },
      rounding: BUSINESS_ROUNDING,
    };
  }

  if (input.mode === "goal") {
    if (input.target === undefined) throw new Error("INVALID_TARGET");
    const targetRational = boundedFinanceDecimal(input.target, MAX_FINANCE_AMOUNT, "INVALID_TARGET");
    const target = financeNumber(targetRational, "INVALID_TARGET");
    if (periods === 0) {
      if (principal >= target) {
        return {
          result: 0,
          mode: input.mode,
          years,
          annualRatePercent,
          compoundsPerYear: Number(compoundsPerYear),
          periods,
          requiredPeriodicContribution: "0.00",
          assumptions: { feasibility: "target already met at period zero" },
          formulas: { requiredContribution: "0 because principal already meets target" },
          rounding: BUSINESS_ROUNDING,
        };
      }
      throw new Error("INFEASIBLE_GOAL");
    }
    const principalFuture = principal * growth;
    const gap = target - principalFuture;
    const required = gap <= 0 ? 0 : periodicRate === 0 ? gap / periods : gap * periodicRate / (growth - 1);
    if (!Number.isFinite(required) || required < 0) throw new Error("INFEASIBLE_GOAL");
    return {
      result: required,
      mode: input.mode,
      years,
      annualRatePercent,
      compoundsPerYear: Number(compoundsPerYear),
      periods,
      target: finalMoneyNumber(target),
      principalFuture: finalMoneyNumber(principalFuture),
      requiredPeriodicContribution: finalMoneyNumber(required),
      assumptions: { contributionTiming: "end of each compounding period", feesTaxesInflation: "not modeled" },
      formulas: { requiredContribution: "(target − principal × growth) × periodicRate / (growth − 1); zero-rate uses gap / periods" },
      rounding: BUSINESS_ROUNDING,
    };
  }

  throw new Error("INVALID_MODE");
}

const MAX_MORTGAGE_PRINCIPAL = rational(1_000_000_000_000n, 1n);
const MAX_MORTGAGE_RATE_PERCENT = rational(1_000n, 1n);
const MAX_MORTGAGE_MONTHS = 3_600n;

function roundRationalToInteger(value: Rational): bigint {
  const negative = value.numerator < 0n;
  const numerator = negative ? -value.numerator : value.numerator;
  let quotient = numerator / value.denominator;
  const remainder = numerator % value.denominator;
  if (remainder * 2n >= value.denominator) quotient += 1n;
  return negative ? -quotient : quotient;
}

function moneyCents(value: Rational): bigint {
  return roundRationalToInteger(multiply(value, rational(100n, 1n)));
}

function centsToMoney(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

function centsToNumber(value: bigint): number {
  const numeric = Number(value) / 100;
  if (!Number.isFinite(numeric)) throw new Error("FINANCE_RESULT_OUT_OF_RANGE");
  return numeric;
}

function positiveInteger(value: DecimalInput, max: bigint, code: string): bigint {
  const parsed = parseBusinessDecimal(value, code);
  if (parsed.denominator !== 1n || parsed.numerator <= 0n || parsed.numerator > max) throw new Error(code);
  return parsed.numerator;
}

export interface MortgageAmortizationInput {
  readonly principal: DecimalInput;
  readonly annualRatePercent: DecimalInput;
  readonly termMonths: DecimalInput;
  /** Optional one-time cost entered explicitly by the user. It never changes the amortization rate or principal schedule. */
  readonly explicitFees?: DecimalInput;
}

export interface MortgageScheduleRow {
  readonly period: number;
  readonly payment: string;
  readonly principal: string;
  readonly interest: string;
  readonly balance: string;
}

export interface MortgageAmortizationResult {
  readonly result: number;
  readonly monthlyPayment: number;
  readonly lastPayment: string;
  readonly totalInterest: string;
  readonly totalRepaid: string;
  readonly explicitFees: string;
  readonly totalCost: string;
  readonly principal: string;
  readonly tanPercent: string;
  readonly periodicRatePercent: string;
  readonly termMonths: number;
  readonly scheduleRows: readonly MortgageScheduleRow[];
  readonly schedulePreview: readonly MortgageScheduleRow[];
  readonly scheduleCsv: string;
  readonly assumptions: Readonly<Record<string, string>>;
  readonly formulas: Readonly<Record<string, string>>;
  readonly rounding: BusinessRounding;
}

function mortgagePreview(rows: readonly MortgageScheduleRow[]): readonly MortgageScheduleRow[] {
  if (rows.length <= 8) return rows;
  return [...rows.slice(0, 4), ...rows.slice(-4)];
}

function mortgageCsv(rows: readonly MortgageScheduleRow[]): string {
  return [
    "period,payment,principal,interest,balance",
    ...rows.map((row) => `${row.period},${row.payment},${row.principal},${row.interest},${row.balance}`),
  ].join("\n") + "\n";
}

export function calculateMortgageAmortization(input: MortgageAmortizationInput): MortgageAmortizationResult {
  const principalRational = parseBusinessDecimal(input.principal, "INVALID_PRINCIPAL");
  if (compareZero(principalRational) <= 0 || compare(principalRational, MAX_MORTGAGE_PRINCIPAL) > 0) throw new Error("INVALID_PRINCIPAL");
  const rateRational = parseBusinessDecimal(input.annualRatePercent, "INVALID_RATE");
  if (compareZero(rateRational) < 0 || compare(rateRational, MAX_MORTGAGE_RATE_PERCENT) > 0) throw new Error("INVALID_RATE");
  const monthsBigInt = positiveInteger(input.termMonths, MAX_MORTGAGE_MONTHS, "INVALID_TERM_MONTHS");
  const months = Number(monthsBigInt);
  const principalCents = moneyCents(principalRational);
  if (principalCents <= 0n) throw new Error("INVALID_PRINCIPAL");
  const feeRational = input.explicitFees === undefined
    ? rational(0n, 1n)
    : parseBusinessDecimal(input.explicitFees, "INVALID_FEES");
  if (compareZero(feeRational) < 0) throw new Error("INVALID_FEES");
  const explicitFeesCents = moneyCents(feeRational);

  const monthlyRateRational = divide(rateRational, rational(1_200n, 1n));
  const monthlyRate = rationalToFiniteNumber(monthlyRateRational, "FINANCE_RESULT_OUT_OF_RANGE");
  const principal = centsToNumber(principalCents);
  const annuityDenominator = monthlyRate === 0
    ? null
    : -Math.expm1(-months * Math.log1p(monthlyRate));
  const rawPayment = annuityDenominator === null
    ? principal / months
    : principal * monthlyRate / annuityDenominator;
  if (!Number.isFinite(rawPayment) || rawPayment <= 0) throw new Error("FINANCE_RESULT_OUT_OF_RANGE");
  const nominalPaymentCents = moneyCents(parseBusinessDecimal(rawPayment.toFixed(12), "FINANCE_RESULT_OUT_OF_RANGE"));
  if (nominalPaymentCents <= 0n) throw new Error("TERM_NOT_REPRESENTABLE_AT_CENT_PRECISION");

  const schedule: MortgageScheduleRow[] = [];
  let balanceCents = principalCents;
  let totalInterestCents = 0n;
  let totalRepaidCents = 0n;
  let lastPaymentCents = 0n;
  for (let period = 1; period <= months; period += 1) {
    const interestCents = roundRationalToInteger(multiply(rational(balanceCents, 1n), monthlyRateRational));
    const isLast = period === months;
    let principalPartCents = isLast ? balanceCents : nominalPaymentCents - interestCents;
    if (!isLast && (principalPartCents <= 0n || principalPartCents >= balanceCents)) {
      throw new Error("TERM_NOT_REPRESENTABLE_AT_CENT_PRECISION");
    }
    if (principalPartCents > balanceCents) principalPartCents = balanceCents;
    const paymentCents = principalPartCents + interestCents;
    balanceCents -= principalPartCents;
    totalInterestCents += interestCents;
    totalRepaidCents += paymentCents;
    lastPaymentCents = paymentCents;
    schedule.push({
      period,
      payment: centsToMoney(paymentCents),
      principal: centsToMoney(principalPartCents),
      interest: centsToMoney(interestCents),
      balance: centsToMoney(balanceCents),
    });
  }
  if (balanceCents !== 0n) throw new Error("AMORTIZATION_RECONCILIATION_ERROR");

  return {
    result: centsToNumber(nominalPaymentCents),
    monthlyPayment: centsToNumber(nominalPaymentCents),
    lastPayment: centsToMoney(lastPaymentCents),
    totalInterest: centsToMoney(totalInterestCents),
    totalRepaid: centsToMoney(totalRepaidCents),
    explicitFees: centsToMoney(explicitFeesCents),
    totalCost: centsToMoney(totalRepaidCents + explicitFeesCents),
    principal: centsToMoney(principalCents),
    tanPercent: formatRounded(rateRational, 4),
    periodicRatePercent: formatRounded(divide(rateRational, rational(12n, 1n)), 8),
    termMonths: months,
    scheduleRows: schedule,
    schedulePreview: mortgagePreview(schedule),
    scheduleCsv: mortgageCsv(schedule),
    assumptions: {
      tan: "TAN nominale annuo inserito dall'utente; non è un tasso annuo effettivo.",
      periodicity: "Rate mensili posticipate; tasso periodale = TAN ÷ 12 ÷ 100.",
      feesAndTaeg: explicitFeesCents === 0n
        ? "TAEG, spese, assicurazioni, imposte e costi accessori non sono inferiti né inclusi: nessuna spesa esplicita è stata inserita."
        : "Solo la spesa una tantum inserita esplicitamente è sommata al costo totale; non modifica capitale, TAN, rata o piano. TAEG, imposte, assicurazioni e altri costi non sono inferiti.",
      rounding: "Capitale iniziale e rata nominale sono arrotondati half-up ai centesimi; ogni quota interessi è arrotondata half-up ai centesimi e l'ultima rata chiude esattamente il saldo.",
    },
    formulas: {
      payment: monthlyRate === 0 ? "rata = capitale ÷ numero rate" : "rata = capitale × i ÷ (1 − (1 + i)^−n)",
      reconciliation: "totale rimborsato = somma rate del piano; interessi totali = totale rimborsato − capitale arrotondato ai centesimi",
      totalCost: "costo totale scenario = totale rimborsato del piano + spese una tantum inserite esplicitamente",
    },
    rounding: BUSINESS_ROUNDING,
  };
}

export type GeometryEquationMotionMode = "rectangle" | "circle" | "rectangular-prism" | "pythagorean" | "quadratic" | "speed" | "distance" | "time";

export interface GeometryEquationMotionInput {
  readonly mode: GeometryEquationMotionMode;
  readonly width?: DecimalInput;
  readonly height?: DecimalInput;
  readonly depth?: DecimalInput;
  readonly radius?: DecimalInput;
  readonly legA?: DecimalInput;
  readonly legB?: DecimalInput;
  readonly coefficientA?: DecimalInput;
  readonly coefficientB?: DecimalInput;
  readonly coefficientC?: DecimalInput;
  readonly lengthUnit?: string;
  readonly speed?: DecimalInput;
  readonly speedUnit?: string;
  readonly distance?: DecimalInput;
  readonly distanceUnit?: string;
  readonly time?: DecimalInput;
  readonly timeUnit?: string;
}

function explicitLengthUnit(unit: string | undefined): string {
  if (unit === undefined) throw new Error("INVALID_LENGTH_UNIT");
  const descriptor = resolveUnitDescriptor(unit);
  if (descriptor.dimension !== "length") throw new Error("INVALID_LENGTH_UNIT");
  return descriptor.symbol;
}

function boundedDisplayNumber(value: number, places = 8): string {
  if (!Number.isFinite(value)) throw new Error("NUMBER_OUT_OF_RANGE");
  return formatRounded(parseBusinessDecimal(value.toFixed(Math.min(12, Math.max(places + 2, 8)))), places);
}

function convertedBusinessRational(value: DecimalInput, from: string, to: string, code: string, allowZero: boolean): Rational {
  const parsed = allowZero ? nonNegative(value, code) : positive(value, code);
  const converted = convertUnit({ value: displayRate(parsed), from, to });
  return parseBusinessDecimal(converted.result, code);
}

export function calculateGeometryEquationMotion(input: GeometryEquationMotionInput): Record<string, unknown> {
  if (input.mode === "rectangle") {
    if (input.width === undefined || input.height === undefined) throw new Error("INVALID_DIMENSION");
    const width = positive(input.width, "INVALID_DIMENSION");
    const height = positive(input.height, "INVALID_DIMENSION");
    const symbol = explicitLengthUnit(input.lengthUnit);
    const area = multiply(width, height);
    const perimeter = multiply(add(width, height), rational(2n, 1n));
    return { result: rationalToFiniteNumber(area), area: `${formatRounded(area, 8)} ${symbol}²`, perimeter: `${formatRounded(perimeter, 8)} ${symbol}`, assumptions: { unit: `larghezza e altezza sono entrambe espresse in ${symbol}` }, formulas: { area: "larghezza × altezza", perimeter: "2 × (larghezza + altezza)" } };
  }
  if (input.mode === "circle") {
    if (input.radius === undefined) throw new Error("INVALID_DIMENSION");
    const radiusRational = positive(input.radius, "INVALID_DIMENSION");
    const radius = rationalToFiniteNumber(radiusRational);
    const symbol = explicitLengthUnit(input.lengthUnit);
    const area = Math.PI * radius * radius;
    const perimeter = 2 * Math.PI * radius;
    return { result: area, area: `${boundedDisplayNumber(area)} ${symbol}²`, perimeter: `${boundedDisplayNumber(perimeter)} ${symbol}`, assumptions: { unit: `raggio espresso in ${symbol}`, pi: "π usa Math.PI del runtime JavaScript" }, formulas: { area: "πr²", perimeter: "2πr" } };
  }
  if (input.mode === "rectangular-prism") {
    if (input.width === undefined || input.height === undefined || input.depth === undefined) throw new Error("INVALID_DIMENSION");
    const width = positive(input.width, "INVALID_DIMENSION");
    const height = positive(input.height, "INVALID_DIMENSION");
    const depth = positive(input.depth, "INVALID_DIMENSION");
    const symbol = explicitLengthUnit(input.lengthUnit);
    const volume = multiply(multiply(width, height), depth);
    return { result: rationalToFiniteNumber(volume), volume: `${formatRounded(volume, 8)} ${symbol}³`, assumptions: { unit: `tutte le dimensioni sono espresse in ${symbol}` }, formulas: { volume: "larghezza × altezza × profondità" } };
  }
  if (input.mode === "pythagorean") {
    if (input.legA === undefined || input.legB === undefined) throw new Error("INVALID_DIMENSION");
    const a = rationalToFiniteNumber(positive(input.legA, "INVALID_DIMENSION"));
    const b = rationalToFiniteNumber(positive(input.legB, "INVALID_DIMENSION"));
    const symbol = explicitLengthUnit(input.lengthUnit);
    const hypotenuse = Math.hypot(a, b);
    return { result: hypotenuse, hypotenuse: `${boundedDisplayNumber(hypotenuse)} ${symbol}`, assumptions: { triangle: "triangolo rettangolo; i due valori inseriti sono i cateti" }, formulas: { hypotenuse: "√(a² + b²)" } };
  }
  if (input.mode === "quadratic") {
    if (input.coefficientA === undefined || input.coefficientB === undefined || input.coefficientC === undefined) throw new Error("INVALID_COEFFICIENT");
    const aR = parseBusinessDecimal(input.coefficientA, "INVALID_COEFFICIENT");
    const bR = parseBusinessDecimal(input.coefficientB, "INVALID_COEFFICIENT");
    const cR = parseBusinessDecimal(input.coefficientC, "INVALID_COEFFICIENT");
    if (compareZero(aR) === 0) throw new Error("DEGENERATE_QUADRATIC");
    const discriminantR = subtract(multiply(bR, bR), multiply(rational(4n, 1n), multiply(aR, cR)));
    const discriminantSign = compareZero(discriminantR);
    const discriminant = rationalToFiniteNumber(discriminantR);
    if (discriminantSign < 0) {
      return { result: "Nessuna radice reale", discriminant: displayRate(discriminantR), rootType: "non-real", assumptions: { roots: "questa modalità restituisce solo radici reali; con discriminante negativo non calcola numeri complessi" }, formulas: { discriminant: "b² − 4ac", roots: "(−b ± √Δ) ÷ 2a quando Δ ≥ 0" } };
    }
    const a = rationalToFiniteNumber(aR);
    const b = rationalToFiniteNumber(bR);
    const rootDelta = Math.sqrt(Math.max(0, discriminant));
    const root1 = (-b + rootDelta) / (2 * a);
    const root2 = (-b - rootDelta) / (2 * a);
    return { result: root1, root1: boundedDisplayNumber(root1), root2: boundedDisplayNumber(root2), discriminant: displayRate(discriminantR), rootType: discriminantSign === 0 ? "double-real" : "two-real", assumptions: { roots: "solo radici reali; il caso Δ < 0 è riportato esplicitamente senza inferire radici complesse" }, formulas: { discriminant: "b² − 4ac", roots: "(−b ± √Δ) ÷ 2a" } };
  }

  if (input.distanceUnit === undefined || input.timeUnit === undefined || input.speedUnit === undefined) throw new Error("INVALID_UNIT");
  if (input.mode === "speed") {
    if (input.distance === undefined || input.time === undefined) throw new Error("INVALID_MOTION_INPUT");
    const distanceMeters = convertedBusinessRational(input.distance, input.distanceUnit, "meter", "INVALID_DISTANCE", true);
    const timeSeconds = convertedBusinessRational(input.time, input.timeUnit, "second", "INVALID_TIME", false);
    const metersPerSecond = divide(distanceMeters, timeSeconds, "INVALID_TIME");
    const output = convertUnit({ value: displayRate(metersPerSecond), from: "meter-per-second", to: input.speedUnit });
    return { result: Number(output.result), value: `${output.result} ${resolveUnitDescriptor(input.speedUnit).symbol}`, assumptions: { normalization: "distanza normalizzata in metri e tempo in secondi prima della divisione" }, formulas: { speed: "distanza ÷ tempo" } };
  }
  if (input.mode === "distance") {
    if (input.speed === undefined || input.time === undefined) throw new Error("INVALID_MOTION_INPUT");
    const speedMps = convertedBusinessRational(input.speed, input.speedUnit, "meter-per-second", "INVALID_SPEED", true);
    const timeSeconds = convertedBusinessRational(input.time, input.timeUnit, "second", "INVALID_TIME", true);
    const meters = multiply(speedMps, timeSeconds);
    const output = convertUnit({ value: displayRate(meters), from: "meter", to: input.distanceUnit });
    return { result: Number(output.result), value: `${output.result} ${resolveUnitDescriptor(input.distanceUnit).symbol}`, assumptions: { normalization: "velocità normalizzata in m/s e tempo in secondi prima della moltiplicazione" }, formulas: { distance: "velocità × tempo" } };
  }
  if (input.mode === "time") {
    if (input.distance === undefined || input.speed === undefined) throw new Error("INVALID_MOTION_INPUT");
    const distanceMeters = convertedBusinessRational(input.distance, input.distanceUnit, "meter", "INVALID_DISTANCE", true);
    const speedMps = convertedBusinessRational(input.speed, input.speedUnit, "meter-per-second", "INVALID_SPEED", false);
    const seconds = divide(distanceMeters, speedMps, "INVALID_SPEED");
    const output = convertUnit({ value: displayRate(seconds), from: "second", to: input.timeUnit });
    return { result: Number(output.result), value: `${output.result} ${resolveUnitDescriptor(input.timeUnit).symbol}`, assumptions: { normalization: "distanza normalizzata in metri e velocità in m/s prima della divisione" }, formulas: { time: "distanza ÷ velocità" } };
  }
  throw new Error("INVALID_MODE");
}

export type EverydayCostMode = "unit-price" | "split-bill" | "annual-subscription" | "energy-cost" | "car-trip-cost" | "salary-hourly";

export interface EverydayCostInput {
  readonly mode: EverydayCostMode;
  readonly price?: DecimalInput;
  readonly quantity?: DecimalInput;
  readonly quantityUnit?: string;
  readonly normalizeUnit?: string;
  readonly bill?: DecimalInput;
  readonly tipPercent?: DecimalInput;
  readonly people?: DecimalInput;
  readonly periodicCost?: DecimalInput;
  readonly periodsPerYear?: DecimalInput;
  readonly power?: DecimalInput;
  readonly powerUnit?: string;
  readonly usageHours?: DecimalInput;
  readonly pricePerKwh?: DecimalInput;
  readonly distance?: DecimalInput;
  readonly distanceUnit?: string;
  readonly consumptionLitersPer100Km?: DecimalInput;
  readonly fuelPricePerLiter?: DecimalInput;
  readonly salaryDirection?: "salary-to-hourly" | "hourly-to-salary";
  readonly amount?: DecimalInput;
  readonly hoursPerWeek?: DecimalInput;
  readonly weeksPerYear?: DecimalInput;
}

function moneyResult(value: Rational): { readonly result: number; readonly amount: string } {
  const amount = formatRounded(value, 2);
  return { result: rationalToFiniteNumber(parseBusinessDecimal(amount)), amount };
}

export function calculateEverydayCost(input: EverydayCostInput): Record<string, unknown> {
  if (input.mode === "unit-price") {
    if (input.price === undefined || input.quantity === undefined || input.quantityUnit === undefined || input.normalizeUnit === undefined) throw new Error("INVALID_UNIT_PRICE_INPUT");
    const price = nonNegative(input.price, "INVALID_PRICE");
    const normalized = convertUnit({ value: displayRate(positive(input.quantity, "INVALID_QUANTITY")), from: input.quantityUnit, to: input.normalizeUnit });
    const quantity = positive(normalized.result, "INVALID_QUANTITY");
    const unitPrice = divide(price, quantity, "INVALID_QUANTITY");
    return { ...moneyResult(unitPrice), unitPrice: formatRounded(unitPrice, 4), normalizedQuantity: `${normalized.result} ${resolveUnitDescriptor(input.normalizeUnit).symbol}`, assumptions: { normalization: "la quantità viene convertita esplicitamente nell'unità scelta prima di dividere il prezzo" }, formulas: { unitPrice: "prezzo ÷ quantità normalizzata" } };
  }
  if (input.mode === "split-bill") {
    if (input.bill === undefined || input.people === undefined) throw new Error("INVALID_SPLIT_INPUT");
    const billCents = moneyCents(nonNegative(input.bill, "INVALID_BILL"));
    const tip = nonNegative(input.tipPercent ?? "0", "INVALID_TIP");
    const people = positiveInteger(input.people, 100_000n, "INVALID_PEOPLE");
    const tipCents = roundRationalToInteger(divide(multiply(rational(billCents, 1n), tip), rational(100n, 1n)));
    const totalCents = billCents + tipCents;
    const baseShare = totalCents / people;
    const remainder = totalCents % people;
    const higherShare = baseShare + (remainder > 0n ? 1n : 0n);
    return { result: centsToNumber(baseShare), baseShare: centsToMoney(baseShare), higherShare: centsToMoney(higherShare), peopleWithHigherShare: Number(remainder), people: Number(people), tipAmount: centsToMoney(tipCents), totalWithTip: centsToMoney(totalCents), assumptions: { remainder: "la divisione avviene in centesimi: le prime N persone, dove N è il resto, pagano un centesimo in più", rounding: "conto e mancia sono arrotondati half-up ai centesimi prima della divisione" }, formulas: { total: "conto + mancia", split: "quoziente e resto interi sui centesimi" } };
  }
  if (input.mode === "annual-subscription") {
    if (input.periodicCost === undefined || input.periodsPerYear === undefined) throw new Error("INVALID_SUBSCRIPTION_INPUT");
    const costCents = moneyCents(nonNegative(input.periodicCost, "INVALID_COST"));
    const periods = positiveInteger(input.periodsPerYear, 366n, "INVALID_PERIODS");
    const annualCents = costCents * periods;
    return { result: centsToNumber(annualCents), annualCost: centsToMoney(annualCents), periodicCost: centsToMoney(costCents), periodsPerYear: Number(periods), assumptions: { cadence: "il numero di addebiti annui è quello inserito; non vengono inferiti rinnovi o sconti" }, formulas: { annualCost: "costo per periodo × periodi annui" } };
  }
  if (input.mode === "energy-cost") {
    if (input.power === undefined || input.powerUnit === undefined || input.usageHours === undefined || input.pricePerKwh === undefined) throw new Error("INVALID_ENERGY_INPUT");
    const power = convertUnit({ value: displayRate(nonNegative(input.power, "INVALID_POWER")), from: input.powerUnit, to: "kilowatt" });
    const kilowatts = nonNegative(power.result, "INVALID_POWER");
    const hours = nonNegative(input.usageHours, "INVALID_USAGE");
    const price = nonNegative(input.pricePerKwh, "INVALID_PRICE");
    const energyKwh = multiply(kilowatts, hours);
    const cost = multiply(energyKwh, price);
    return { ...moneyResult(cost), energyKwh: formatRounded(energyKwh, 6), powerKw: formatRounded(kilowatts, 6), assumptions: { usage: "potenza costante per le ore indicate; consumo a zero ore = costo zero", tariff: "prezzo energia inserito dall'utente per kWh; quote fisse e imposte non sono inferite" }, formulas: { energy: "kW × ore", cost: "kWh × prezzo per kWh" } };
  }
  if (input.mode === "car-trip-cost") {
    if (input.distance === undefined || input.distanceUnit === undefined || input.consumptionLitersPer100Km === undefined || input.fuelPricePerLiter === undefined) throw new Error("INVALID_TRIP_INPUT");
    const distance = convertUnit({ value: displayRate(nonNegative(input.distance, "INVALID_DISTANCE")), from: input.distanceUnit, to: "kilometer" });
    const km = nonNegative(distance.result, "INVALID_DISTANCE");
    const consumption = positive(input.consumptionLitersPer100Km, "INVALID_CONSUMPTION");
    const fuelPrice = nonNegative(input.fuelPricePerLiter, "INVALID_FUEL_PRICE");
    const liters = divide(multiply(km, consumption), rational(100n, 1n));
    const cost = multiply(liters, fuelPrice);
    return { ...moneyResult(cost), distanceKm: formatRounded(km, 6), liters: formatRounded(liters, 6), assumptions: { consumption: "consumo inserito in L/100 km e mantenuto costante; distanza zero = costo zero", exclusions: "pedaggi, parcheggi, usura e altri costi del viaggio non sono inferiti" }, formulas: { liters: "km × (L/100 km) ÷ 100", cost: "litri × prezzo per litro" } };
  }
  if (input.mode === "salary-hourly") {
    if (input.amount === undefined || input.hoursPerWeek === undefined || input.weeksPerYear === undefined || input.salaryDirection === undefined) throw new Error("INVALID_SALARY_INPUT");
    const amount = nonNegative(input.amount, "INVALID_AMOUNT");
    const hoursPerWeek = positive(input.hoursPerWeek, "INVALID_HOURS");
    const weeksPerYear = positive(input.weeksPerYear, "INVALID_WEEKS");
    const annualHours = multiply(hoursPerWeek, weeksPerYear);
    if (input.salaryDirection === "salary-to-hourly") {
      const hourly = divide(amount, annualHours, "INVALID_HOURS");
      return { ...moneyResult(hourly), annualSalary: formatRounded(amount, 2), hourlyRate: formatRounded(hourly, 2), assumedAnnualHours: displayRate(annualHours), assumptions: { workingBasis: `${displayRate(hoursPerWeek)} ore/settimana × ${displayRate(weeksPerYear)} settimane/anno; ferie, straordinari, imposte e benefit non sono inferiti` }, formulas: { hourlyRate: "salario annuo ÷ ore annue assunte" } };
    }
    if (input.salaryDirection === "hourly-to-salary") {
      const salary = multiply(amount, annualHours);
      return { ...moneyResult(salary), annualSalary: formatRounded(salary, 2), hourlyRate: formatRounded(amount, 2), assumedAnnualHours: displayRate(annualHours), assumptions: { workingBasis: `${displayRate(hoursPerWeek)} ore/settimana × ${displayRate(weeksPerYear)} settimane/anno; ferie, straordinari, imposte e benefit non sono inferiti` }, formulas: { annualSalary: "tariffa oraria × ore annue assunte" } };
    }
    throw new Error("INVALID_SALARY_DIRECTION");
  }
  throw new Error("INVALID_MODE");
}

export const calculateCapacity = planCapacity;
export const calculateScopeCreep = calculateScopeCreepCost;
export const calculateLateInterest = calculateLatePaymentInterest;
export const calculateDiscount = calculateDiscountImpact;
export const calculateProposalBudget = checkProposalBudget;
export const calculateInvoiceNumber = generateInvoiceNumber;
export const calculateVat = calculatePercentage;
export const calculatePercentageHelper = calculatePercentage;
export const calculateCurrency = calculateCurrencyScenario;

export type BusinessOperation =
  | "effective-hourly-rate"
  | "target-income-rate"
  | "utilization"
  | "capacity-planner"
  | "retainer-capacity"
  | "scope-creep-cost"
  | "break-even"
  | "payment-fee-gross-up"
  | "late-payment-interest"
  | "discount-impact"
  | "proposal-budget"
  | "project-profitability"
  | "invoice-number"
  | "invoice-math"
  | "percentage-helper"
  | "scientific-expression-calculator"
  | "exact-fractions-integer-toolkit"
  | "descriptive-statistics-grades"
  | "interest-savings-calculator"
  | "mortgage-amortization-calculator"
  | "geometry-equation-motion-helper"
  | "everyday-cost-calculator"
  | "currency-scenario";

export function runBusinessOperation(operation: BusinessOperation, input: unknown): unknown {
  if (operation === "effective-hourly-rate") return calculateEffectiveHourlyRate(input as EffectiveHourlyRateInput);
  if (operation === "target-income-rate") return calculateTargetIncomeRate(input as TargetIncomeRateInput);
  if (operation === "utilization") return calculateUtilization(input as UtilizationInput);
  if (operation === "capacity-planner") return planCapacity(input as CapacityPlannerInput);
  if (operation === "retainer-capacity") return calculateRetainerCapacity(input as RetainerCapacityInput);
  if (operation === "scope-creep-cost") return calculateScopeCreepCost(input as ScopeCreepCostInput);
  if (operation === "break-even") return calculateBreakEven(input as BreakEvenInput);
  if (operation === "payment-fee-gross-up") return grossUpForFee(input as PaymentFeeInput);
  if (operation === "late-payment-interest") return calculateLatePaymentInterest(input as LatePaymentInput);
  if (operation === "discount-impact") return calculateDiscountImpact(input as DiscountImpactInput);
  if (operation === "proposal-budget") return checkProposalBudget(input as ProposalBudgetInput);
  if (operation === "project-profitability") return calculateProjectProfitability(input as ProjectProfitabilityInput);
  if (operation === "invoice-number") return generateInvoiceNumber(input as InvoiceNumberInput);
  if (operation === "invoice-math") return validateInvoiceMath(input as InvoiceMathInput);
  if (operation === "percentage-helper") return calculatePercentage(input as PercentageInput);
  if (operation === "scientific-expression-calculator") return calculateScientificExpression(input as ScientificExpressionInput);
  if (operation === "exact-fractions-integer-toolkit") return calculateExactIntegerToolkit(input as ExactIntegerToolkitInput);
  if (operation === "descriptive-statistics-grades") return calculateStatisticsGrade(input as StatisticsGradeInput);
  if (operation === "interest-savings-calculator") return calculateInterestSavings(input as InterestSavingsInput);
  if (operation === "mortgage-amortization-calculator") return calculateMortgageAmortization(input as MortgageAmortizationInput);
  if (operation === "geometry-equation-motion-helper") return calculateGeometryEquationMotion(input as GeometryEquationMotionInput);
  if (operation === "everyday-cost-calculator") return calculateEverydayCost(input as EverydayCostInput);
  return calculateCurrencyScenario(input as CurrencyScenarioInput);
}
