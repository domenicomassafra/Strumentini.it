import { describe, expect, it } from "vitest";
import type { ToolExecutionContext } from "../src/runtime/types";
import marginMarkupModule from "../src/tools/margin-markup/module";
import rateConverterModule from "../src/tools/rate-converter/module";
import timezoneOverlapModule from "../src/tools/timezone-overlap/module";
import type { MarginMarkupOutput } from "../src/tools/margin-markup/types";
import type { RateConverterOutput } from "../src/tools/rate-converter/types";
import type { TimezoneOverlapOutput } from "../src/tools/timezone-overlap/types";

function context(defaults: ToolExecutionContext["defaults"]): ToolExecutionContext {
  return { defaults };
}

describe("client/time/math tool modules", () => {
  it("runs timezone overlap from declared profile/tool defaults", () => {
    const output = timezoneOverlapModule.run(
      {
        date: "2026-09-23",
        otherTimeZone: "America/New_York",
        otherWorkingHours: { start: "09:00", end: "17:00" },
      },
      context({
        timezone: { field: "timezone", value: "Europe/Rome", provenance: "profile" },
        workingHours: { field: "workingHours", value: { start: "09:00", end: "17:00" }, provenance: "tool-default" },
      }),
    ) as TimezoneOverlapOutput;
    expect(output.segments[0]).toMatchObject({
      startInstant: "2026-09-23T13:00:00.000Z",
      endInstant: "2026-09-23T15:00:00.000Z",
    });
    expect(output.provenance).toEqual({ homeTimeZone: "profile", homeWorkingHours: "tool-default" });
  });

  it("runs exact rate conversion and treats missing project hours as invalid input", () => {
    const rateContext = context({
      currency: { field: "currency", value: "EUR", provenance: "profile" },
      hoursPerDay: { field: "hoursPerDay", value: "8", provenance: "tool-default" },
    });
    const output = rateConverterModule.run(
      { amount: "50", from: "hour", to: "day" },
      rateContext,
    ) as RateConverterOutput;
    expect(output).toMatchObject({
      amount: "400.00",
      currency: "EUR",
      provenance: { currency: "profile", hoursPerDay: "tool-default" },
    });
    expect(() => rateConverterModule.run(
      { amount: "1000", from: "project", to: "hour" },
      rateContext,
    )).toThrow("INVALID_PROJECT_HOURS_REQUIRED");
  });

  it("runs margin/markup with profile currency while preserving denominator errors", () => {
    const marginContext = context({
      currency: { field: "currency", value: "EUR", provenance: "profile" },
    });
    const output = marginMarkupModule.run({ price: "100", cost: "80" }, marginContext) as MarginMarkupOutput;
    expect(output).toMatchObject({
      currency: "EUR",
      currencyProvenance: "profile",
      profit: "20.00",
      marginPercent: "20.00",
      markupPercent: "25.00",
    });

    const zeroCost = marginMarkupModule.run({ price: "100", cost: "0" }, marginContext) as MarginMarkupOutput;
    expect(zeroCost.denominatorErrors).toEqual([
      expect.objectContaining({ metric: "markup", code: "INVALID_MARKUP_DENOMINATOR" }),
    ]);
  });
});
