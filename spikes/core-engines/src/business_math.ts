export type RateUnit = "hour" | "day" | "week" | "project";

export interface RateBasis {
  hoursPerDay?: number;
  daysPerWeek?: number;
  projectHours?: number;
}

export interface RateConversion {
  amount: number;
  assumptions: {
    hoursPerDay: number;
    daysPerWeek: number;
    projectHours?: number;
  };
  rounding: number;
}

function finite(value: number, code: string): number {
  if (!Number.isFinite(value)) throw new Error(code);
  return value;
}

function positive(value: number, code: string): number {
  finite(value, code);
  if (value <= 0) throw new Error(code);
  return value;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function hoursFor(
  unit: RateUnit,
  hoursPerDay: number,
  daysPerWeek: number,
  projectHours?: number,
): number {
  switch (unit) {
    case "hour":
      return 1;
    case "day":
      return hoursPerDay;
    case "week":
      return hoursPerDay * daysPerWeek;
    case "project":
      if (projectHours === undefined) throw new Error("PROJECT_HOURS_REQUIRED");
      return positive(projectHours, "INVALID_PROJECT_HOURS");
  }
}

export function convertRate(
  amount: number,
  from: RateUnit,
  to: RateUnit,
  basis: RateBasis = {},
): RateConversion {
  finite(amount, "INVALID_RATE");
  if (amount < 0) throw new Error("INVALID_RATE");
  const hoursPerDay = positive(basis.hoursPerDay ?? 8, "INVALID_HOURS_PER_DAY");
  const daysPerWeek = positive(basis.daysPerWeek ?? 5, "INVALID_DAYS_PER_WEEK");
  const fromHours = hoursFor(
    from,
    hoursPerDay,
    daysPerWeek,
    basis.projectHours,
  );
  const toHours = hoursFor(to, hoursPerDay, daysPerWeek, basis.projectHours);
  const assumptions: RateConversion["assumptions"] = {
    hoursPerDay,
    daysPerWeek,
  };
  if (basis.projectHours !== undefined) {
    assumptions.projectHours = basis.projectHours;
  }
  return {
    amount: round((amount / fromHours) * toHours, 2),
    assumptions,
    rounding: 2,
  };
}

export function marginMarkup(revenue: number, cost: number): {
  profit: number;
  marginRate: number | null;
  markupRate: number | null;
  rounding: number;
} {
  finite(revenue, "INVALID_REVENUE");
  finite(cost, "INVALID_COST");
  const profit = revenue - cost;
  return {
    profit: round(profit, 2),
    marginRate: revenue === 0 ? null : round(profit / revenue, 4),
    markupRate: cost === 0 ? null : round(profit / cost, 4),
    rounding: 4,
  };
}

export interface ProjectEconomics {
  revenue: number;
  fixedCosts: number;
  hours: number;
  hourlyCost: number;
}

export function projectProfitability(input: ProjectEconomics): {
  totalCost: number;
  profit: number;
  marginRate: number | null;
  effectiveHourlyRate: number | null;
  rounding: number;
} {
  const revenue = finite(input.revenue, "INVALID_REVENUE");
  const fixedCosts = finite(input.fixedCosts, "INVALID_COST");
  const hours = finite(input.hours, "INVALID_HOURS");
  const hourlyCost = finite(input.hourlyCost, "INVALID_HOURLY_COST");
  if (hours < 0 || hourlyCost < 0) throw new Error("INVALID_PROJECT_INPUT");
  const totalCost = fixedCosts + hours * hourlyCost;
  const profit = revenue - totalCost;
  return {
    totalCost: round(totalCost, 2),
    profit: round(profit, 2),
    marginRate: revenue === 0 ? null : round(profit / revenue, 4),
    effectiveHourlyRate: hours === 0 ? null : round(revenue / hours, 2),
    rounding: 2,
  };
}

export function grossUpForFee(targetNet: number, feeRate: number): {
  gross: number;
  fee: number;
  targetNet: number;
  feeRate: number;
  rounding: number;
} {
  finite(targetNet, "INVALID_TARGET_NET");
  finite(feeRate, "INVALID_FEE_RATE");
  if (feeRate < 0 || feeRate >= 1) throw new Error("INVALID_FEE_RATE");
  const gross = targetNet / (1 - feeRate);
  return {
    gross: round(gross, 2),
    fee: round(gross - targetNet, 2),
    targetNet: round(targetNet, 2),
    feeRate: round(feeRate, 6),
    rounding: 2,
  };
}
