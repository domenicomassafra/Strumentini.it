import { describe, expect, it } from "vitest";
import { calculateVat126, getVatPreset126 } from "../src/engines/italy/vat-126";

describe("#126 source-honest exact-cent VAT helper", () => {
  it("adds custom VAT and scorpora the resulting gross with a reconciled monetary breakdown", () => {
    const added = calculateVat126({ operation: "add", amountCents: 10000, rate: { kind: "custom", percent: "22" } });
    expect(added).toMatchObject({ netCents: 10000, vatCents: 2200, grossCents: 12200, rateOrigin: "USER_SUPPLIED" });
    const reversed = calculateVat126({ operation: "scorporo", amountCents: 12200, rate: { kind: "custom", percent: "22" } });
    expect(reversed).toMatchObject({ netCents: 10000, vatCents: 2200, grossCents: 12200 });
    expect(reversed.netCents + reversed.vatCents).toBe(reversed.grossCents);
  });

  it("handles half-up cents, integer-safe large amounts and signed decimal bounds without floating point", () => {
    expect(calculateVat126({ operation: "add", amountCents: 1, rate: { kind: "custom", percent: "50" } }).vatCents).toBe(1);
    expect(calculateVat126({ operation: "add", amountCents: 1, rate: { kind: "custom", percent: "49.9999" } }).vatCents).toBe(0);
    expect(calculateVat126({ operation: "add", amountCents: 10001, rate: { kind: "custom", percent: "7,125" } }).vatCents).toBe(713);
    expect(calculateVat126({ operation: "scorporo", amountCents: 1, rate: { kind: "custom", percent: "100" } })).toMatchObject({ netCents: 1, vatCents: 0, grossCents: 1 });
    const large = calculateVat126({ operation: "add", amountCents: 98765432100, rate: { kind: "custom", percent: "22" } });
    expect(large.grossCents).toBe(120493827162);
  });

  it("makes inverse rounding policy explicit and proves gross→net→gross consistency within cent", () => {
    for (const rate of ["0", "4", "5", "10", "22", "100", "17.5312"]) {
      for (const gross of [0, 1, 2, 3, 9, 10, 33, 55, 100, 101, 999, 100000, 10000001]) {
        const reversed = calculateVat126({ operation: "scorporo", amountCents: gross, rate: { kind: "custom", percent: rate } });
        const added = calculateVat126({ operation: "add", amountCents: reversed.netCents, rate: { kind: "custom", percent: rate } });
        expect(reversed.netCents + reversed.vatCents).toBe(gross);
        expect(Math.abs(added.grossCents - gross)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("refuses to present unsourced IVA values as year-specific official presets", () => {
    for (const year of [2024, 2025, 2026, 2027]) {
      for (const rate of ["ordinary", "reduced-10", "reduced-5", "super-reduced-4"]) {
        expect(() => getVatPreset126(year, rate)).toThrow(/VAT126_UNSOURCED_PRESET/u);
      }
    }
    expect(() => calculateVat126({ operation: "add", amountCents: 100, rate: { kind: "preset", taxYear: 2026, id: "ordinary" } }))
      .toThrow(/VAT126_UNSOURCED_PRESET/u);
  });

  it("rejects unsupported precision, negatives, unbounded inputs and invalid operations", () => {
    for (const percent of ["-1", "100.0001", "abc", "7.12345", "1e2", "", "1,2.3", "Infinity"]) {
      expect(() => calculateVat126({ operation: "add", amountCents: 100, rate: { kind: "custom", percent } })).toThrow(/VAT126_INVALID_RATE/u);
    }
    for (const amountCents of [-1, Number.NaN, 1.2, Number.MAX_SAFE_INTEGER]) {
      expect(() => calculateVat126({ operation: "add", amountCents, rate: { kind: "custom", percent: "22" } })).toThrow(/VAT126_INVALID_AMOUNT/u);
    }
  });
});
