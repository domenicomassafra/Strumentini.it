import { describe, expect, it } from "vitest";
import { validateMobilePickerReceipt336 } from "../scripts/lib/mobile-picker-receipt-336";

// Synthetic positive/negative fixtures exercise the receipt gate, not the OS.
// Actual acceptance requires a separately observed simulator and compiled consumer.
const fixture = {
  schemaVersion: 1, ticket: "STR-336", evidence: "SIMULATED",
  observedAt: "2026-10-20T08:00:00.000Z",
  device: { os: "iOS", mode: "IOS_SIMULATOR", label: "iPhone 18 Pro iOS 27", physicalHardware: "NOT_OBSERVED" },
  browser: { name: "Safari", version: "27.0", userAgent: "Mozilla/5.0 iPhone Safari/27.0" },
  build: { revision: "a".repeat(40), compiled: true, origin: "http://127.0.0.1:4966" },
  photos: {
    nativePickerOpened: "OBSERVED", fileSelected: "OBSERVED", operationCompleted: "OBSERVED",
    output: { filename: "converted.png", bytes: 96, sha256: "b".repeat(64), reopenedWith: "independent PNG decoder", independentlyChecked: "OBSERVED" },
    downloadRequested: "OBSERVED",
  },
  files: {
    nativePickerOpened: "OBSERVED", fileSelected: "OBSERVED", operationCompleted: "OBSERVED",
    output: { filename: "compressed.pdf", bytes: 300, sha256: "c".repeat(64), reopenedWith: "independent PDF parser", independentlyChecked: "OBSERVED" },
    downloadRequested: "OBSERVED",
  },
  denial: { kind: "SIMULATED_PERMISSION_OR_READ_DENIAL", previousValidResultRetained: "OBSERVED", retrySucceeded: "OBSERVED" },
  appReturn: { kind: "SIMULATED_BACKGROUND_AND_RETURN", previousValidResultRetained: "OBSERVED" },
  sharing: { method: "NATIVE_SHARE_SHEET", attempted: "OBSERVED", outputRetainedAfterCancel: "OBSERVED" },
  externalFileUploads: 0, pageErrors: [],
} as const;

describe("STR-336 mobile Photos/Files simulator acceptance receipt", () => {
  it("accepts complete positive iOS and Android fixture shapes, explicitly simulated", () => {
    expect(validateMobilePickerReceipt336(fixture)).toEqual([]);
    expect(validateMobilePickerReceipt336({
      ...fixture,
      device: { os: "Android", mode: "ANDROID_EMULATOR", label: "AVD str277 API35", physicalHardware: "NOT_OBSERVED" },
      browser: { name: "Chrome", version: "141.0", userAgent: "Mozilla/5.0 Linux Android 15 Chrome/141.0" },
      sharing: { ...fixture.sharing, method: "MANUAL_DOWNLOAD_FALLBACK" },
    })).toEqual([]);
  });

  it("rejects absent or falsely successful picker, processing and downloaded output", () => {
    const failures = [
      { photos: { ...fixture.photos, nativePickerOpened: "NOT_RUN" } },
      { photos: { ...fixture.photos, fileSelected: "NOT_RUN" } },
      { files: { ...fixture.files, operationCompleted: "NOT_RUN" } },
      { files: { ...fixture.files, downloadRequested: "NOT_RUN" } },
      { files: { ...fixture.files, output: { ...fixture.files.output, independentlyChecked: "NOT_RUN" } } },
      { photos: { ...fixture.photos, output: { ...fixture.photos.output, sha256: "unverified" } } },
      { files: { ...fixture.files, output: fixture.photos.output } },
      { build: { ...fixture.build, compiled: false } },
    ];
    for (const incomplete of failures) expect(validateMobilePickerReceipt336({ ...fixture, ...incomplete })).not.toEqual([]);
  });

  it("rejects lost prior work on denied access, app return or cancelled share", () => {
    for (const incomplete of [
      { denial: { ...fixture.denial, previousValidResultRetained: "LOST" } },
      { denial: { ...fixture.denial, retrySucceeded: "NOT_RUN" } },
      { appReturn: { ...fixture.appReturn, previousValidResultRetained: "LOST" } },
      { sharing: { ...fixture.sharing, outputRetainedAfterCancel: "LOST" } },
      { sharing: { ...fixture.sharing, attempted: "NOT_RUN" } },
    ]) expect(validateMobilePickerReceipt336({ ...fixture, ...incomplete })).not.toEqual([]);
  });

  it("binds every receipt to the source revision that produced the build", () => {
    expect(validateMobilePickerReceipt336(fixture, { revision: fixture.build.revision })).toEqual([]);
    expect(validateMobilePickerReceipt336(fixture, { revision: "d".repeat(40) })).not.toEqual([]);
    expect(validateMobilePickerReceipt336(
      { ...fixture, build: { ...fixture.build, revision: "a".repeat(39) } },
    )).not.toEqual([]);
  });
  it("refuses physical claims, wrong device/browser combination, uploads and unobserved errors", () => {
    for (const incomplete of [
      { device: { ...fixture.device, physicalHardware: "PASS" } },
      { evidence: "PHYSICAL" },
      { browser: { ...fixture.browser, name: "Chrome" } },
      { device: { ...fixture.device, mode: "PLAYWRIGHT_EMULATION" } },
      { externalFileUploads: 1 },
      { pageErrors: ["unhandled rejection"] },
    ]) expect(validateMobilePickerReceipt336({ ...fixture, ...incomplete })).not.toEqual([]);
  });
});
