import { describe, expect, it } from "vitest";
import { prepareOcrTextExport395 } from "../src/engines/ocr/correction-395";
import { evaluateImageOcrPreflight } from "../src/engines/ocr/image-feasibility";

describe("STR-395 separate editable transcription from actual OCR confidence", () => {
  it("exports the exact edited Unicode text and retains the uncalibrated original engine score", () => {
    const source = { text: "Fattura numero 12345", confidence: 28.3 };
    const edited = "Fattura numero 12345 — verificare €";
    expect(prepareOcrTextExport395(source, edited)).toEqual({
      text: edited, manuallyCorrected: true, engineConfidence: 28.3, authoritative: false,
    });
    expect(source.text).toBe("Fattura numero 12345");
    expect(prepareOcrTextExport395(source, source.text)).toMatchObject({
      manuallyCorrected: false, authoritative: false,
    });
  });

  it("never invents confidence or an authoritative claim for low-quality and incomplete outputs", () => {
    expect(prepareOcrTextExport395({ text: "???", confidence: null }, "corretto manualmente"))
      .toMatchObject({ engineConfidence: null, authoritative: false, manuallyCorrected: true });
    for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, -1, 101]) {
      expect(prepareOcrTextExport395({ text: "???", confidence: invalid }, "testo revisionato"))
        .toMatchObject({ engineConfidence: null, authoritative: false });
    }
    expect(() => prepareOcrTextExport395({ text: "???", confidence: 0 }, " \n"))
      .toThrow(/OCR395_INVALID_CORRECTION/u);
    expect(() => prepareOcrTextExport395({ text: "???", confidence: 0 }, "x".repeat(100_001)))
      .toThrow(/OCR395_INVALID_CORRECTION/u);
  });

  it("keeps unsupported English OCR refused before any worker is eligible to start", () => {
    const caps = { worker: true, wasm: true, "image-decode": true } as const;
    const en = evaluateImageOcrPreflight(new Uint8Array(33), 33, "eng", "image/png", caps);
    expect(en.canRunOcr).toBe(false);
    expect(en.errors).toContainEqual(expect.stringMatching(/OCR_LANGUAGE_NOT_ACCEPTED/u));
  });
});
