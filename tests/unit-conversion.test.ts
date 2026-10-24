import { describe, expect, it } from "vitest";
import {
  calculateBatteryVehiclePower,
  calculateReferenceSize,
  calculateStorageDownload,
  convertCssRelativeUnit,
  convertUnit,
  resolveUnitDescriptor,
  UNIT_REGISTRY,
} from "../src/engines/unit-conversion";

describe("ticket 136 — shared unit registry and basic dimensions", () => {
  it("rejects cross-dimension conversions and ambiguous aliases", () => {
    expect(() => convertUnit({ value: "1", from: "meter", to: "kilogram" })).toThrow("CROSS_DIMENSION_CONVERSION");
    expect(() => resolveUnitDescriptor("gal")).toThrow("AMBIGUOUS_UNIT_ALIAS");
  });

  it("models affine temperature exactly for known points", () => {
    expect(convertUnit({ value: "0", from: "celsius", to: "fahrenheit" }).result).toBe("32");
    expect(convertUnit({ value: "32", from: "fahrenheit", to: "celsius" }).result).toBe("0");
    expect(convertUnit({ value: "100", from: "celsius", to: "kelvin" }).result).toBe("373.15");
    expect(convertUnit({ value: "491.67", from: "rankine", to: "celsius" }).result).toBe("0");
  });

  it("preserves negative temperatures and absolute zero across affine scales", () => {
    expect(convertUnit({ value: "-40", from: "celsius", to: "fahrenheit" }).result).toBe("-40");
    expect(convertUnit({ value: "-273.15", from: "celsius", to: "kelvin" }).result).toBe("0");
    expect(convertUnit({ value: "0", from: "kelvin", to: "rankine" }).result).toBe("0");
  });

  it("accepts Italian decimal comma and documents no grouping", () => {
    const result = convertUnit({ value: "1,5", from: "meter", to: "centimeter" });
    expect(result.result).toBe("150");
    expect(result.assumptions.decimalInput).toContain("comma or point");
    expect(() => convertUnit({ value: "1.234,5", from: "meter", to: "centimeter" })).toThrow("INVALID_VALUE");
  });

  it("handles finite numeric values that JavaScript serializes in exponent notation", () => {
    expect(convertUnit({ value: 1e21, from: "meter", to: "kilometer" }).result).toBe("1000000000000000000");
    expect(convertUnit({ value: -1e21, from: "meter", to: "kilometer" }).result).toBe("-1000000000000000000");
    expect(convertUnit({ value: 1e-7, from: "meter", to: "millimeter" }).result).toBe("0.0001");
    expect(convertUnit({ value: 1.25e-7, from: "meter", to: "millimeter" }).result).toBe("0.000125");
    expect(() => convertUnit({ value: Number.POSITIVE_INFINITY, from: "meter", to: "kilometer" })).toThrow("INVALID_VALUE");
    expect(() => convertUnit({ value: Number.NaN, from: "meter", to: "kilometer" })).toThrow("INVALID_VALUE");
    expect(() => convertUnit({ value: Number.MAX_VALUE, from: "meter", to: "kilometer" })).toThrow("VALUE_OUT_OF_RANGE");
    expect(() => convertUnit({ value: "1e21", from: "meter", to: "kilometer" })).toThrow("INVALID_VALUE");
  });

  it("round-trips basic dimensions within the declared display precision", () => {
    const cases = [
      ["123.456", "meter", "mile"],
      ["85.25", "kilogram", "pound"],
      ["12.75", "square-meter", "square-foot"],
      ["42.5", "liter", "us-gallon"],
      ["21.125", "celsius", "fahrenheit"],
    ] as const;
    for (const [value, from, to] of cases) {
      const forward = convertUnit({ value, from, to });
      const backward = convertUnit({ value: forward.result, from: to, to: from });
      expect(Number(backward.result), `${from}→${to}→${from}`).toBeCloseTo(Number(value), 9);
    }
  });
});

describe("ticket 310 — explicit CSS px/rem/em context", () => {
  it("converts px and rem only with an explicit positive root size", () => {
    const toRem = convertCssRelativeUnit({ mode: "rem", direction: "px-to-relative", value: "32", rootFontSize: "16" });
    expect(toRem).toMatchObject({ result: "2", inputUnit: "px", outputUnit: "rem", contextFontSizePx: "16", contextKind: "root-font-size" });
    expect(convertCssRelativeUnit({ mode: "rem", direction: "relative-to-px", value: String(toRem.result), rootFontSize: "16" })).toMatchObject({ result: "32", outputUnit: "px" });
    expect(() => convertCssRelativeUnit({ mode: "rem", direction: "px-to-relative", value: "32" })).toThrow("ROOT_FONT_SIZE_REQUIRED");
    expect(() => convertCssRelativeUnit({ mode: "rem", direction: "px-to-relative", value: "32", rootFontSize: "0" })).toThrow("INVALID_ROOT_FONT_SIZE");
  });

  it("converts contextual em with no hidden browser default", () => {
    const toEm = convertCssRelativeUnit({ mode: "em", direction: "px-to-relative", value: "27", currentFontSize: "18" });
    expect(toEm).toMatchObject({ result: "1.5", inputUnit: "px", outputUnit: "em", contextFontSizePx: "18", contextKind: "current-font-size" });
    expect(convertCssRelativeUnit({ mode: "em", direction: "relative-to-px", value: "1.5", currentFontSize: "18" })).toMatchObject({ result: "27", outputUnit: "px" });
    expect(() => convertCssRelativeUnit({ mode: "em", direction: "px-to-relative", value: "27" })).toThrow("CURRENT_FONT_SIZE_REQUIRED");
    expect(() => convertCssRelativeUnit({ mode: "em", direction: "relative-to-px", value: "1", currentFontSize: "-12" })).toThrow("INVALID_CURRENT_FONT_SIZE");
  });
});

describe("ticket 137 — engineering dimensions", () => {
  it("assigns every registry unit to one declared dimension and resolves exact known literals", () => {
    expect(UNIT_REGISTRY.every((unit) => typeof unit.dimension === "string" && unit.dimension.length > 0)).toBe(true);
    expect(convertUnit({ value: "100", from: "kilometer-per-hour", to: "meter-per-second" }).result).toBe("27.777777777778");
    expect(convertUnit({ value: "1", from: "standard-atmosphere", to: "pascal" }).result).toBe("101325");
    expect(convertUnit({ value: "60", from: "revolution-per-minute", to: "hertz" }).result).toBe("1");
    expect(convertUnit({ value: "1", from: "turn", to: "degree" }).result).toBe("360");
    expect(Number(convertUnit({ value: "180", from: "degree", to: "radian" }).result)).toBeCloseTo(Math.PI, 11);
  });

  it("keeps standards/source notes on engineering units", () => {
    for (const id of ["psi", "mechanical-horsepower", "foot-candle", "btu-it"]) {
      expect(resolveUnitDescriptor(id).authority.length, id).toBeGreaterThan(20);
    }
  });
});

describe("ticket 138 — storage and download time", () => {
  it("keeps decimal and binary storage visibly distinct", () => {
    expect(calculateStorageDownload({ mode: "storage", value: "1", from: "kilobyte", to: "byte" }).result).toBe("1000");
    expect(calculateStorageDownload({ mode: "storage", value: "1", from: "kibibyte", to: "byte" }).result).toBe("1024");
    expect(calculateStorageDownload({ mode: "storage", value: "1", from: "megabyte", to: "mebibyte" }).result).toBe("0.953674316406");
  });

  it("keeps b/B case-sensitive and rejects ambiguous text", () => {
    expect(calculateStorageDownload({ mode: "storage", value: "8", from: "b", to: "B" }).result).toBe("1");
    expect(() => calculateStorageDownload({ mode: "storage", value: "1", from: "b/B", to: "byte" })).toThrow("UNKNOWN_UNIT");
  });

  it("uses only entered throughput and disclosed overhead", () => {
    const result = calculateStorageDownload({
      mode: "download-time",
      size: "100",
      sizeUnit: "megabyte",
      throughput: "100",
      throughputUnit: "megabit-per-second",
      overheadPercent: "20",
    });
    expect(result).toMatchObject({ result: "10 s", seconds: "10", enteredBitsPerSecond: "100000000", effectiveBitsPerSecond: "80000000" });
    expect(String((result.assumptions as Record<string, unknown>).throughput)).toContain("user-entered");
  });
});

describe("ticket 139 — battery, vehicle and power helpers", () => {
  it("requires strictly positive voltage for mAh/Wh", () => {
    expect(calculateBatteryVehiclePower({ mode: "battery", direction: "mah-to-wh", value: "5000", voltage: "3.7" }).result).toBe("18.5");
    expect(calculateBatteryVehiclePower({ mode: "battery", direction: "wh-to-mah", value: "18.5", voltage: "3.7" }).result).toBe("5000");
    expect(() => calculateBatteryVehiclePower({ mode: "battery", direction: "mah-to-wh", value: "5000" })).toThrow("VOLTAGE_REQUIRED");
    expect(() => calculateBatteryVehiclePower({ mode: "battery", direction: "mah-to-wh", value: "5000", voltage: "0" })).toThrow("INVALID_VOLTAGE");
  });

  it("distinguishes US and Imperial MPG", () => {
    const us = calculateBatteryVehiclePower({ mode: "fuel", value: "30", from: "mpg-us", to: "l-per-100km" });
    const imperial = calculateBatteryVehiclePower({ mode: "fuel", value: "30", from: "mpg-imperial", to: "l-per-100km" });
    expect(Number(us.result)).toBeCloseTo(7.840486, 5);
    expect(Number(imperial.result)).toBeCloseTo(9.416031, 5);
    expect(us.result).not.toBe(imperial.result);
  });

  it("uses reversible documented power constants", () => {
    const hp = calculateBatteryVehiclePower({ mode: "power", value: "1", from: "mechanical-horsepower", to: "kilowatt" });
    expect(Number(hp.result)).toBeCloseTo(0.745699871582, 11);
    const back = calculateBatteryVehiclePower({ mode: "power", value: String(hp.result), from: "kilowatt", to: "mechanical-horsepower" });
    expect(Number(back.result)).toBeCloseTo(1, 10);
  });
});

describe("ticket 140 — reference-size conversion helpers", () => {
  it("converts ISO paper dimensions deterministically", () => {
    expect(calculateReferenceSize({ mode: "paper", paper: "A4", outputUnit: "millimeter" })).toMatchObject({ result: "210 × 297 mm", width: "210", height: "297" });
    expect(calculateReferenceSize({ mode: "paper", paper: "A4", outputUnit: "inch" })).toMatchObject({ paper: "A4", unit: "in" });
  });

  it("requires an explicit positive model scale", () => {
    expect(calculateReferenceSize({ mode: "model-scale", value: "6", inputUnit: "meter", outputUnit: "centimeter", scale: "50", direction: "real-to-model" }).result).toBe("12 cm");
    expect(() => calculateReferenceSize({ mode: "model-scale", value: "6", inputUnit: "meter", outputUnit: "centimeter", scale: "0", direction: "real-to-model" })).toThrow("INVALID_SCALE");
  });

  it("calculates TV geometry both directions with explicit aspect input", () => {
    const dimensions = calculateReferenceSize({ mode: "tv-diagonal-to-dimensions", diagonal: "55", inputUnit: "inch", outputUnit: "inch", aspectWidth: "16", aspectHeight: "9" });
    expect(Number(dimensions.width)).toBeCloseTo(47.94, 1);
    expect(Number(dimensions.height)).toBeCloseTo(26.96, 1);
    const diagonal = calculateReferenceSize({ mode: "tv-dimensions-to-diagonal", width: String(dimensions.width), height: String(dimensions.height), inputUnit: "inch", outputUnit: "inch" });
    expect(Number(diagonal.diagonal)).toBeCloseTo(55, 5);
    expect(() => calculateReferenceSize({ mode: "tv-diagonal-to-dimensions", diagonal: "55", inputUnit: "inch", outputUnit: "inch" })).toThrow("INVALID_INPUT");
  });

  it("refuses unsourced clothing/shoe fit claims", () => {
    expect(() => calculateReferenceSize({ mode: "shoe-size", value: "42" })).toThrow("UNSOURCED_REFERENCE_FIT");
  });
});
