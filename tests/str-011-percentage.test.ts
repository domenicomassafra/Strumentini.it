import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calculatePercentage } from "../src/engines/business-math";
import { percentageJobs } from "../src/components/tools/business-math/percentage-jobs";
import { ANNUAL_VAT_2025_WINDOW_117 } from "../src/reference-data/italy/fiscal-annual-vat-117";
import percentageHelperModule from "../src/tools/percentage-helper/module";

const context = { defaults: { currency: { field: "currency", value: "EUR", provenance: "tool-default" as const } } };

describe("STR-011 percentage jobs", () => {
  it("presents a distinct labeled example and formula for every public calculation, with an inverse", () => {
    expect(percentageJobs.map((job) => job.mode)).toEqual([
      "of", "what-percent", "increase", "reverse", "decrease",
      "reverse-discount", "variation", "cascade", "reverse-cascade",
    ]);
    for (const job of percentageJobs) {
      expect(job.label.length).toBeGreaterThan(8);
      expect(job.formula).toContain("=");
      expect(job.example).toMatch(/[0-9]/u);
      expect(percentageJobs.find((entry) => entry.mode === job.inverse)?.inverse).toBe(job.mode);
      expect(job.fields.every((field) => field.label.length > 5 && field.value !== "")).toBe(true);
    }
  });

  it("calculates each worked example and its inverse with decimal arithmetic", () => {
    const examples = [
      { mode: "of", base: "80", ratePercent: "25", result: "20.00" },
      { mode: "what-percent", base: "80", amount: "20", result: "25.00" },
      { mode: "increase", base: "80", ratePercent: "25", result: "100.00" },
      { mode: "reverse", base: "100", ratePercent: "25", result: "80.00" },
      { mode: "decrease", base: "80", ratePercent: "25", result: "60.00" },
      { mode: "reverse-discount", base: "60", ratePercent: "25", result: "80.00" },
      { mode: "variation", base: "80", amount: "100", result: "25.00" },
      { mode: "cascade", base: "100", rates: ["10", "20"], result: "72.00" },
      { mode: "reverse-cascade", base: "72", rates: ["10", "20"], result: "100.00" },
    ] as const;
    for (const { result, ...input } of examples) {
      expect(calculatePercentage(input).result, input.mode).toBe(result);
    }
    expect(calculatePercentage({ mode: "variation", base: "100", amount: "80" }).result).toBe("-20.00");
    expect(calculatePercentage({ mode: "reverse-cascade", base: "72", rates: ["10", "20"] }).ratePercent).toBe("28.00");
    expect(calculatePercentage({ mode: "of", base: "80", ratePercent: "12,5" }).result).toBe("10.00");
    expect(calculatePercentage({ mode: "reverse-discount", base: "0", ratePercent: "99.99" }).result).toBe("0.00");
  });

  it("accepts the localized UI input through the actual tool module", () => {
    const input = { mode: "reverse-cascade", base: "72", rates: "10; 20" };
    expect(percentageHelperModule.run(input, context)).toMatchObject({
      mode: "reverse-cascade", result: "100.00", ratePercent: "28.00", currency: "EUR",
    });
  });

  it("rejects undefined ratios, zero inverse factors and malformed discounts", () => {
    expect(() => calculatePercentage({ mode: "variation", base: "0", amount: "5" })).toThrow("INVALID_BASE");
    expect(() => calculatePercentage({ mode: "what-percent", base: "0", amount: "5" })).toThrow("INVALID_BASE");
    for (const rate of ["100", "-1", "101"]) {
      expect(() => calculatePercentage({ mode: "reverse-discount", base: "10", ratePercent: rate })).toThrow("INVALID_RATE");
    }
    for (const rates of [["100"], ["10", "100"], ["-5"], ["101"]]) {
      expect(() => calculatePercentage({ mode: "reverse-cascade", base: "30", rates })).toThrow("INVALID_RATE");
    }
    expect(() => calculatePercentage({ mode: "cascade", base: "100", rates: ["101"] })).toThrow("INVALID_RATE");
    expect(() => percentageHelperModule.run({ mode: "reverse-cascade", base: "72", rates: "10; abc" }, context)).toThrow("INVALID_RATE");
  });

  it("keeps the source/year boundary of VAT arithmetic explicit", () => {
    // Normative references: D.P.R. 633/1972, art. 16 (2016–2026) and
    // Tabella A (version from 13/12/2025), official printed MEF documents:
    // see ANNUAL_VAT_2025_WINDOW_117.sources[0].url and .sources[1].url,
    // both at https://def.giustiziatributaria.gov.it/DocTribFrontend/.
    // The site does not assert 2026 category eligibility from a user-entered rate.
    const file = readFileSync(new URL("../src/pages/tools/percentage-helper.astro", import.meta.url), "utf8");
    expect(file).toContain("13–31 dicembre 2025");
    expect(file).toContain("D.P.R. 633/1972");
    expect(file).toContain("non ha un anno di validità verificato");
    expect(file).toContain("ANNUAL_VAT_2025_WINDOW_117.sources[0].url");
    for (const source of ANNUAL_VAT_2025_WINDOW_117.sources) {
      expect(source.url).toMatch(/^https:\/\/def\.giustiziatributaria\.gov\.it\/DocTribFrontend\//u);
      expect(source.printedEffectiveFrom).toBeTruthy();
      expect(source.printedEffectiveToExclusive).toBe("2027-01-01");
    }
  });
});
