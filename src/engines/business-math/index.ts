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

const DECIMAL_PATTERN = /^([+-]?)(\d+)(?:\.(\d+))?$/u;
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

export type PercentageMode = "add" | "reverse";

export interface PercentageInput {
  readonly base?: DecimalInput;
  readonly amount?: DecimalInput;
  readonly ratePercent?: DecimalInput;
  readonly percent?: DecimalInput;
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
  readonly formulas: {
    readonly add: "base + base × rate ÷ 100";
    readonly reverse: "gross ÷ (1 + rate ÷ 100)";
  };
  readonly rounding: BusinessRounding;
}

export function calculatePercentage(input: PercentageInput): PercentageResult {
  const baseInput = input.base ?? input.amount;
  if (baseInput === undefined) throw new Error("INVALID_BASE");
  const amount = nonNegative(baseInput, "INVALID_BASE");
  const suppliedRate = input.ratePercent ?? input.percent;
  if (suppliedRate === undefined) throw new Error("INVALID_RATE");
  const rate = nonNegative(suppliedRate, "INVALID_RATE");
  const rateFraction = divide(rate, rational(100n, 1n), "INVALID_RATE");
  const mode = input.mode ?? "add";
  if (mode === "add") {
    const percentageAmount = multiply(amount, rateFraction);
    return {
      mode,
      base: money(amount),
      ratePercent: money(rate),
      percent: money(rate),
      percentageAmount: money(percentageAmount),
      result: money(percentageAmount),
      total: money(add(amount, percentageAmount)),
      net: money(amount),
      formulas: { add: "base + base × rate ÷ 100", reverse: "gross ÷ (1 + rate ÷ 100)" },
      rounding: BUSINESS_ROUNDING,
    };
  }
  const net = divide(amount, add(rational(1n, 1n), rateFraction), "INVALID_RATE");
  return {
    mode,
    base: money(amount),
    ratePercent: money(rate),
    percent: money(rate),
    percentageAmount: money(subtract(amount, net)),
    result: money(net),
    total: money(amount),
    net: money(net),
    formulas: { add: "base + base × rate ÷ 100", reverse: "gross ÷ (1 + rate ÷ 100)" },
    rounding: BUSINESS_ROUNDING,
  };
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
  return calculateCurrencyScenario(input as CurrencyScenarioInput);
}
