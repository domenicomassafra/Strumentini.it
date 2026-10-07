import { describe, expect, it } from "vitest";
import {
  RESULT_LABELS_IT,
  formatResultBytes,
  formatResultCount,
  formatResultCurrency,
  formatResultDate,
  formatResultNumber,
  formatResultUnit,
} from "../src/i18n/it/result-format";

describe("Italian Result v2 display formatting", () => {
  it("formats Italian decimals and EUR without changing the numeric value", () => {
    const raw = 1234.5;
    expect(formatResultNumber(raw)).toBe("1.234,5");
    expect(formatResultCurrency(raw)).toMatch(/^1\.234,50\s?€/u);
    expect(raw).toBe(1234.5);
  });

  it("formats date-only values without timezone date drift", () => {
    expect(formatResultDate("2026-10-05")).toBe("05/10/2026");
    expect(formatResultDate(new Date("2026-10-05T20:30:00Z"), { timeZone: "UTC", includeTime: true }))
      .toMatch(/05\/10\/2026.*20:30/u);
  });

  it("formats bytes, units and Italian count labels deterministically", () => {
    expect(formatResultBytes(999)).toBe("999 B");
    expect(formatResultBytes(1500)).toBe("1,5 kB");
    expect(formatResultUnit(12.5, "kg")).toBe("12,5 kg");
    expect(formatResultCount(1, "file", "file")).toBe("1 file");
    expect(formatResultCount(1200, "riga", "righe")).toBe("1.200 righe");
  });

  it("centralizes reusable result labels while machine payloads remain locale-independent", () => {
    expect(RESULT_LABELS_IT.result).toBe("Risultato");
    const machinePayload = { amount: 1234.5, date: "2026-10-05", bytes: 1500 };
    const snapshot = structuredClone(machinePayload);
    void formatResultCurrency(machinePayload.amount);
    void formatResultDate(machinePayload.date);
    void formatResultBytes(machinePayload.bytes);
    expect(machinePayload).toEqual(snapshot);
    expect(JSON.stringify(machinePayload)).toBe('{"amount":1234.5,"date":"2026-10-05","bytes":1500}');
  });
});
