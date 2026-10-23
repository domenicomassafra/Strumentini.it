import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import { BinaryBitmap, HybridBinarizer, QRCodeReader, RGBLuminanceSource } from "@zxing/library";
import { generateQr as original } from "../src/engines/qr/encode";
import { decodeQrMatrixValue } from "../src/engines/qr/decode";
import { QR_MAX_BYTES } from "../src/engines/qr/spec";
import { generateQrDonor278 } from "../src/engines/qr/qrcode-adapter-278";
import qrGeneratorModule from "../src/tools/qr-generator/module";

const inputs = [
  "https://strumentini.it", "https://strumentini.it/tools/qr-generator",
  "WIFI:T:WPA;S:Caffè;P:locale;;", "Città però più così — perché",
  "QR ✅ locale 🚀", "12345678901234567890", "HELLO WORLD 123",
  ...[17, 18, 32, 33, 53, 54, 78].map((length) => "x".repeat(length)),
];
const context = { defaults: {} } as const;

/** ZXing decodes pixels without calling either Strumentini QR encoder or reader. */
function zxingDecodedValue(rows: readonly string[]): string {
  const scale = 6;
  const quietZone = 4;
  const width = (rows.length + quietZone * 2) * scale;
  // RGBLuminanceSource with Uint8ClampedArray expects a *single* byte per pixel.
  const pixels = new Uint8ClampedArray(width * width);
  for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
    const dark = rows[Math.floor(y / scale) - quietZone]?.[Math.floor(x / scale) - quietZone] === "1";
    pixels[y * width + x] = dark ? 0 : 255;
  }
  const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(pixels, width, width)));
  return new QRCodeReader().decode(bitmap).getText();
}

describe("#278 pinned qrcode donor for bounded local QR generation", () => {
  it("decodes independently on varied content and matches canonical byte-mode geometry", () => {
    for (const input of inputs) {
      const expected = original(input);
      const actual = generateQrDonor278(input);
      expect(actual.engineVersion).toBe("qrcode@1.5.4-byte-L");
      expect(actual.mask).toBe(QRCode.create([{data: new TextEncoder().encode(input), mode: "byte"}], {
        version: expected.version, errorCorrectionLevel: "L",
      }).maskPattern);
      expect(actual).toMatchObject({ payload: input, byteLength: expected.byteLength,
        version: expected.version, size: expected.size, errorCorrection: "L", mode: "byte", quietZone: 4 });
      expect(decodeQrMatrixValue(actual.matrixRows).payload).toBe(input);
      expect(decodeQrMatrixValue(actual.svg).payload).toBe(input);
      expect(actual.svg).toContain('data-matrix="' + actual.matrixRows.join(";") + '"');
    }
  });
  it("decodes every donor-selected matrix with independent ZXing raster decoder", () => {
    for (const payload of inputs) {
      expect(zxingDecodedValue(generateQrDonor278(payload).matrixRows), payload).toBe(payload);
    }
  });
  it("refuses already-aborted generation before invoking the donor", () => {
    expect(() => qrGeneratorModule.run({ payload: "ciao" }, context, AbortSignal.abort()))
      .toThrow(expect.objectContaining({ name: "AbortError" }));
  });
  it("reuses exact encoding for every explicit QR mask", () => {
    for (const input of inputs) for (let mask = 0; mask < 8; mask++) {
      expect(generateQrDonor278(input, { mask }).matrixRows).toEqual(original(input, { mask }).matrixRows);
    }
  });
  it("preserves strict byte budget, empty-input and impossible mask refusal", () => {
    expect(() => generateQrDonor278("")).toThrow("QR_PAYLOAD_REQUIRED");
    expect(() => generateQrDonor278("x".repeat(QR_MAX_BYTES + 1))).toThrow("QR_PAYLOAD_TOO_LARGE");
    expect(() => generateQrDonor278("abc", { mask: 8 })).toThrow("QR_INVALID_MASK");
  });
  it("keeps the live tool module synchronous and returns the selected donor", () => {
    const generated = qrGeneratorModule.run({payload:"ciao"}, context) as
      { readonly matrixRows: string[]; readonly engineVersion: string; readonly bytesRemaining: number };
    expect(generated.engineVersion).toBe("qrcode@1.5.4-byte-L");
    expect(generated.bytesRemaining).toBe(QR_MAX_BYTES - 4);
    expect(decodeQrMatrixValue(generated.matrixRows).payload).toBe("ciao");
    expect(() => qrGeneratorModule.run({payload:"",mask:0}, context)).toThrow("QR_PAYLOAD_REQUIRED");
  });
});
