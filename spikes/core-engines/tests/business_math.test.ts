import assert from "node:assert/strict";
import {
  convertRate,
  grossUpForFee,
  marginMarkup,
  projectProfitability,
} from "../src/business_math.ts";

Deno.test("rate conversion states and applies its work-basis assumptions", () => {
  assert.deepEqual(convertRate(100, "hour", "day"), {
    amount: 800,
    assumptions: { hoursPerDay: 8, daysPerWeek: 5 },
    rounding: 2,
  });
  assert.equal(
    convertRate(4000, "project", "hour", { projectHours: 20 }).amount,
    200,
  );
});

Deno.test("margin and markup remain distinct formulas", () => {
  assert.deepEqual(marginMarkup(125, 100), {
    profit: 25,
    marginRate: 0.2,
    markupRate: 0.25,
    rounding: 4,
  });
  assert.equal(marginMarkup(0, 100).marginRate, null);
  assert.equal(marginMarkup(100, 0).markupRate, null);
});

Deno.test("project profitability includes labor cost and effective hourly rate", () => {
  assert.deepEqual(
    projectProfitability({
      revenue: 1000,
      fixedCosts: 200,
      hours: 10,
      hourlyCost: 30,
    }),
    {
      totalCost: 500,
      profit: 500,
      marginRate: 0.5,
      effectiveHourlyRate: 100,
      rounding: 2,
    },
  );
});

Deno.test("fee gross-up hits the requested net and rejects impossible rates", () => {
  assert.deepEqual(grossUpForFee(97, 0.03), {
    gross: 100,
    fee: 3,
    targetNet: 97,
    feeRate: 0.03,
    rounding: 2,
  });
  assert.throws(() => grossUpForFee(10, 1), /INVALID_FEE_RATE/);
});

Deno.test("rate conversion rejects missing project basis", () => {
  assert.throws(
    () => convertRate(1000, "project", "hour"),
    /PROJECT_HOURS_REQUIRED/,
  );
});
