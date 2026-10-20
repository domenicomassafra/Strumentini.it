import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { validateAndroidChromeAvd277 } from "../scripts/lib/android-chrome-avd-277";

const sha256 = (data: Buffer) => createHash("sha256").update(data).digest("hex");
const digest = "a".repeat(64);
const fixture = {
  schemaVersion: 1, ticket: "STR-277", evidenceKind: "ANDROID_EMULATOR_CHROME_SIMULATED", physicalDeviceObserved: false,
  observedAt: "2026-10-19T16:00:00Z",
  emulator: { serial: "emulator-5554", avd: "str277-api35", api: 35, fingerprint: "google/sdk_gphone64_x86_64" },
  browser: { package: "com.android.chrome", version: "139.0.0.0", userAgent: "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/139.0.0.0 Mobile" },
  build: { revision: "b".repeat(40), compiled: true, route: "/tools/image-resize/", htmlSha256: digest },
  input: { filename: "str277-source.png", mime: "image/png", bytes: 500, sha256: digest, width: 320, height: 240 },
  operation: { androidPickerOpened: true, fileSelected: true, resizedInChrome: true, androidDownloadSaved: true },
  negative: { pickerCancelledWithoutSelection: true, corruptJpegRefused: true, offsiteRequests: 0 },
  screenshot: { file: "quality/receipts/android-chrome-avd-277-simulated.jpg", kind: "ANDROID_EMULATOR_SCREENSHOT_SIMULATED", bytes: 100, sha256: digest },
  output: { filename: "str277-output.jpg", mime: "image/jpeg", bytes: 300, sha256: digest, width: 160, height: 120, decoder: "sharp/libvips", reopened: true },
};

const errors = (mutate: (data: typeof fixture) => void) => {
  const copy = structuredClone(fixture);
  mutate(copy);
  return validateAndroidChromeAvd277(copy);
};

describe("STR-277 Android Emulator + Chrome image resize acceptance", () => {
  it("accepts a complete, explicitly simulated AVD Chrome evidence fixture", () => {
    expect(validateAndroidChromeAvd277(fixture)).toEqual([]);
  });

  it("rejects impersonation of a physical phone, browser absence and stale build fingerprints", () => {
    expect(errors((d) => { d.physicalDeviceObserved = true; })).toContain("evidence must declare simulated Android Chrome, never physical hardware");
    expect(errors((d) => { d.evidenceKind = "PHYSICAL_ANDROID_CHROME"; })).toContain("evidence must declare simulated Android Chrome, never physical hardware");
    expect(errors((d) => { d.browser.version = ""; })).toContain("Android Chrome package/version/UA missing");
    expect(errors((d) => { d.build.htmlSha256 = "unknown"; })).toContain("compiled route fingerprint missing");
  });

  it("rejects incomplete picker, resize/download, MIME/bytes and decoder claims", () => {
    expect(errors((d) => { d.operation.androidPickerOpened = false; })).toContain("Android picker/resize/download interaction incomplete");
    expect(errors((d) => { d.operation.androidDownloadSaved = false; })).toContain("Android picker/resize/download interaction incomplete");
    expect(errors((d) => { d.output.sha256 = "unknown"; })).toContain("independent download readback incomplete");
    expect(errors((d) => { d.output.mime = "image/png"; })).toContain("independent download readback incomplete");
    expect(errors((d) => { d.output.width = 320; })).toContain("output was not resized smaller");
    expect(errors((d) => { d.negative.corruptJpegRefused = false; })).toContain("negative picker/format/network proof missing");
    expect(errors((d) => { d.negative.offsiteRequests = 1 as 0; })).toContain("negative picker/format/network proof missing");
    expect(errors((d) => { d.screenshot.sha256 = "unknown"; })).toContain("simulated screenshot proof missing");
  });

  it("independently reopens the downloaded Android Chrome artifact and verifies declared bytes, MIME and dimensions", async () => {
    const root = resolve(import.meta.dirname, "..");
    const receipt = JSON.parse(readFileSync(resolve(root, "quality/receipts/android-chrome-avd-277.json"), "utf8"));
    expect(validateAndroidChromeAvd277(receipt)).toEqual([]);
    const bytes = readFileSync(resolve(root, "quality/receipts/android-chrome-avd-277-output.jpg"));
    expect(bytes.length).toBe(receipt.output.bytes);
    expect(sha256(bytes)).toBe(receipt.output.sha256);
    expect(bytes.subarray(0, 3).toString("hex")).toBe("ffd8ff");
    const decoded = await sharp(bytes, { failOn: "error" }).metadata();
    expect(decoded.format).toBe("jpeg");
    const decodedPixels = await sharp(bytes, { failOn: "error" }).ensureAlpha().raw().toBuffer();
    expect(decodedPixels.length).toBe(decoded.width! * decoded.height! * 4);
    expect([decoded.width, decoded.height]).toEqual([receipt.output.width, receipt.output.height]);
    const screenshot = readFileSync(resolve(root, receipt.screenshot.file));
    expect(screenshot.length).toBe(receipt.screenshot.bytes);
    expect(sha256(screenshot)).toBe(receipt.screenshot.sha256);
    expect((await sharp(screenshot).metadata()).format).toBe("jpeg");
    const source = readFileSync(resolve(root, "tests/fixtures/android-chrome-avd-277-input.png"));
    expect(source.length).toBe(receipt.input.bytes);
    expect(sha256(source)).toBe(receipt.input.sha256);
    const sourceDecoded = await sharp(source).metadata();
    expect([sourceDecoded.format, sourceDecoded.width, sourceDecoded.height]).toEqual(["png", receipt.input.width, receipt.input.height]);
  });
});
