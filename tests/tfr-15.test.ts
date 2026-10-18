import { describe, expect, it } from "vitest";
import { calculateTfr15, parseTfrRows15 } from "../src/engines/italy/tfr-15";

describe("STR-015 — TFR lordo e rivalutazione", () => {
  it("calcola accantonamento separato dalla rivalutazione dell'anno precedente", () => {
    const out = calculateTfr15(parseTfrRows15("2023;27000;\n2024;27000;4\n2025;27000;2"));
    // Quota anno 27.000 / 13,5 - 0,50% = 1.865 euro.
    expect(out.accruedGrossCents).toBe(559500);
    expect(out.lines[0]).toMatchObject({ annualAccrualCents: 186500, revaluationCents: 0, yearEndGrossCents: 186500 });
    // 2024: 1,5 + 75%*4 = 4,5% su 1.865,00 = 83,93.
    expect(out.lines[1]).toMatchObject({ revaluationPercent: 4.5, revaluationCents: 8393, yearEndGrossCents: 381393 });
    // 2025: 1,5 + 75%*2 = 3% su 3813,93 = 114,42.
    expect(out.lines[2]).toMatchObject({ revaluationPercent: 3, revaluationCents: 11442, yearEndGrossCents: 579335 });
    expect(out).toMatchObject({ status: "COMPLETE", totalRevaluationCents: 19835, grossTotalCents: 579335 });
  });
  it("manca FOI: quote note, montante e rivalutazione dichiarati incompleti", () => {
    const out = calculateTfr15(parseTfrRows15("2023;30000;\n2024;30000;\n2025;30000;1,0815"));
    expect(out).toMatchObject({ status: "PARTIAL", grossTotalCents: null, totalRevaluationCents: null, missingFoiYears: [2024] });
    expect(out.accruedGrossCents).toBeGreaterThan(0);
  });
  it("riduzione 0 esenzione esplicita e input errati rifiutati", () => {
    expect(calculateTfr15(parseTfrRows15("2025;13500;"), 0).accruedGrossCents).toBe(100000);
    expect(() => calculateTfr15(parseTfrRows15("2023;20000;\n2025;20000;1"))).toThrow(/anni completi/u);
    expect(() => parseTfrRows15("2025;15000,999;")).toThrow(/due decimali/u);
    expect(() => calculateTfr15(parseTfrRows15("2025;13500;"), 0.6)).toThrow(/IVS/u);
  });
});
