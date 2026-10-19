/** Accumulation of end-of-period payments, stable even when 1 + rate rounds to 1. */
export function savingsAnnuityFactor(periodicRate: number, periods: number): number {
  const factor = periods === 0 ? 0 : periodicRate === 0
    ? periods
    : Math.expm1(periods * Math.log1p(periodicRate)) / periodicRate;
  if (!Number.isFinite(factor)) throw new Error("FINANCE_RESULT_OUT_OF_RANGE");
  return factor;
}

/** Smallest whole cent whose projection reaches the goal using the contribution formula. */
export function minimumSavingsCents(required: number, principalFuture: number, target: number, factor: number): bigint {
  if (required <= 0) return 0n;
  const reachesTarget = (cents: bigint): boolean =>
    principalFuture + (Number(cents) / 100) * factor >= target;
  let lower = 0n;
  let upper = BigInt(Math.max(1, Math.ceil(required * 100)));
  while (!reachesTarget(upper)) upper *= 2n;
  while (lower < upper) {
    const midpoint = (lower + upper) / 2n;
    if (reachesTarget(midpoint)) upper = midpoint;
    else lower = midpoint + 1n;
  }
  return lower;
}
