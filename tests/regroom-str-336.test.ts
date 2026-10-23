import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateMobilePickerReceipt336, verifyMobilePickerArtifacts336 } from "../scripts/lib/mobile-picker-receipt-336";

// Synthetic positive/negative fixtures exercise the receipt gate, not the OS.
// Actual acceptance requires a separately observed simulator and compiled consumer.
const simShot = (name: string) => ({ file: `${name}.png`, bytes: 1024,
  sha256: "e".repeat(64), capture: "SIMCTL_IO" as const });
const fixture = {
  schemaVersion: 1, ticket: "STR-336", evidence: "SIMULATED",
  observedAt: "2026-10-20T08:00:00.000Z",
  device: { os: "iOS", mode: "IOS_SIMULATOR", label: "iPhone 18 Pro iOS 27",
    identifier: "8c23729b-8544-4182-ad28-75b08e9722e6", runtimeVersion: "iOS 27.0",
    runtimeBuild: "24A100", physicalHardware: "NOT_OBSERVED" },
  browser: { name: "Safari", version: "27.0", userAgent: "Mozilla/5.0 iPhone Safari/27.0" },
  build: { revision: "a".repeat(40), indexSha256: "d".repeat(64),
    compiled: true, origin: "http://127.0.0.1:4966" },
  photos: {
    nativePickerOpened: "OBSERVED", fileSelected: "OBSERVED", operationCompleted: "OBSERVED",
    output: { filename: "converted.png", artifactFile: "converted.png", bytes: 96, sha256: "b".repeat(64),
      savedOnDevice: "OBSERVED", retrievedFromDevice: "OBSERVED",
      reopenedWith: "independent PNG decoder", independentlyChecked: "OBSERVED" },
    downloadRequested: "OBSERVED", screenshot: simShot("photos"),
  },
  files: {
    nativePickerOpened: "OBSERVED", fileSelected: "OBSERVED", operationCompleted: "OBSERVED",
    output: { filename: "compressed.pdf", artifactFile: "compressed.pdf", bytes: 300, sha256: "c".repeat(64),
      savedOnDevice: "OBSERVED", retrievedFromDevice: "OBSERVED",
      reopenedWith: "independent PDF parser", independentlyChecked: "OBSERVED" },
    downloadRequested: "OBSERVED", screenshot: simShot("files"),
  },
  denial: { kind: "SIMULATED_PERMISSION_OR_READ_DENIAL", previousValidResultRetained: "OBSERVED",
    retrySucceeded: "OBSERVED", screenshot: simShot("denial") },
  appReturn: { kind: "SIMULATED_BACKGROUND_AND_RETURN", previousValidResultRetained: "OBSERVED",
    screenshot: simShot("return") },
  sharing: { method: "NATIVE_SHARE_SHEET", attempted: "OBSERVED",
    outputRetainedAfterCancel: "OBSERVED", screenshot: simShot("sharing") },
  externalFileUploads: 0, pageErrors: [],
} as const;

describe("STR-336 mobile Photos/Files simulator acceptance receipt", () => {
  it("accepts complete positive iOS and Android fixture shapes, explicitly simulated", () => {
    expect(validateMobilePickerReceipt336(fixture)).toEqual([]);
    expect(validateMobilePickerReceipt336({
      ...fixture,
      device: { os: "Android", mode: "ANDROID_EMULATOR", label: "AVD str277 API35",
        identifier: "emulator-5554", runtimeVersion: "Android 15 API35",
        runtimeBuild: "google/sdk_gphone64_x86_64/emu64xa:15", physicalHardware: "NOT_OBSERVED" },
      browser: { name: "Chrome", version: "141.0", userAgent: "Mozilla/5.0 Linux Android 15 Chrome/141.0" },
      photos: { ...fixture.photos, screenshot: { ...simShot("photos"), capture: "ADB_SCREENCAP" } },
      files: { ...fixture.files, screenshot: { ...simShot("files"), capture: "ADB_SCREENCAP" } },
      denial: { ...fixture.denial, screenshot: { ...simShot("denial"), capture: "ADB_SCREENCAP" } },
      appReturn: { ...fixture.appReturn, screenshot: { ...simShot("return"), capture: "ADB_SCREENCAP" } },
      sharing: { ...fixture.sharing, method: "MANUAL_DOWNLOAD_FALLBACK",
        screenshot: { ...simShot("sharing"), capture: "ADB_SCREENCAP" } },
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
    expect(validateMobilePickerReceipt336(fixture, {
      revision: fixture.build.revision, indexSha256: fixture.build.indexSha256,
    })).toEqual([]);
    expect(validateMobilePickerReceipt336(fixture, { revision: "d".repeat(40) })).not.toEqual([]);
    expect(validateMobilePickerReceipt336(
      { ...fixture, build: { ...fixture.build, revision: "a".repeat(39) } },
    )).not.toEqual([]);
  });
  it("refuses native receipts without device, build and screenshot provenance", () => {
    for (const incomplete of [
      { device: { ...fixture.device, identifier: "" } },
      { device: { ...fixture.device, runtimeBuild: "" } },
      { build: { ...fixture.build, indexSha256: "unverified" } },
      { photos: { ...fixture.photos, screenshot: undefined } },
      { files: { ...fixture.files, screenshot: { ...simShot("files"), capture: "PLAYWRIGHT" } } },
      { denial: { ...fixture.denial, screenshot: { ...simShot("denial"), bytes: 0 } } },
      { photos: { ...fixture.photos, output: { ...fixture.photos.output, savedOnDevice: "NOT_RUN" } } },
      { files: { ...fixture.files, output: { ...fixture.files.output, retrievedFromDevice: "NOT_RUN" } } },
    ]) expect(validateMobilePickerReceipt336({ ...fixture, ...incomplete })).not.toEqual([]);
    expect(validateMobilePickerReceipt336(fixture, {
      revision: fixture.build.revision, indexSha256: "e".repeat(64),
    })).not.toEqual([]);
  });
  it("checks bytes and hashes on disk for compiled build, screenshots and retrieved files", async () => {
    // These deliberately synthetic local fixtures test integrity, not a native capture.
    const root = await mkdtemp(join(tmpdir(), "str336-receipt-fixture-"));
    const hash = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
    try {
      const index = Buffer.from("<html>compiled consumer fixture</html>");
      const png = await readFile(new URL("../quality/fixtures/image-metadata/synthetic-1x1-rgb.png", import.meta.url));
      const pdf = await readFile(new URL("../quality/fixtures/pdf-gold/simple-2page.pdf", import.meta.url));
      await writeFile(join(root, "index.html"), index);
      await writeFile(join(root, "converted.png"), png);
      await writeFile(join(root, "compressed.pdf"), pdf);
      const shot = (file: string) => ({ ...simShot(file), bytes: png.length, sha256: hash(png) });
      for (const file of ["photos", "files", "denial", "return", "sharing"]) {
        await writeFile(join(root, `${file}.png`), png);
      }
      const receipt = {
        ...fixture,
        build: { ...fixture.build, indexSha256: hash(index) },
        photos: { ...fixture.photos,
          output: { ...fixture.photos.output, bytes: png.length, sha256: hash(png) },
          screenshot: shot("photos") },
        files: { ...fixture.files,
          output: { ...fixture.files.output, bytes: pdf.length, sha256: hash(pdf) },
          screenshot: shot("files") },
        denial: { ...fixture.denial, screenshot: shot("denial") },
        appReturn: { ...fixture.appReturn, screenshot: shot("return") },
        sharing: { ...fixture.sharing, screenshot: shot("sharing") },
      };
      const expected = { revision: fixture.build.revision,
        indexFile: join(root, "index.html"), evidenceDir: root };
      expect(await verifyMobilePickerArtifacts336(receipt, expected)).toEqual([]);
      // A matching hash and PNG signature do not prove a decodable screenshot.
      const corruptPng = Buffer.concat([png.subarray(0, 8), Buffer.alloc(96)]);
      await writeFile(join(root, "sharing.png"), corruptPng);
      const forged = { ...receipt, sharing: { ...receipt.sharing,
        screenshot: { ...receipt.sharing.screenshot,
          bytes: corruptPng.length, sha256: hash(corruptPng) } } };
      expect(await verifyMobilePickerArtifacts336(forged, expected)).toContain(
        "sharing.screenshot: captured evidence is not decodable PNG",
      );
      await writeFile(join(root, "sharing.png"), Buffer.from("not a screenshot"));
      expect(await verifyMobilePickerArtifacts336(receipt, expected)).toEqual([
        "sharing.screenshot: actual bytes/hash differ from receipt",
        "sharing.screenshot: captured evidence is not PNG",
      ]);
      expect(await verifyMobilePickerArtifacts336(receipt, {
        ...expected, revision: "f".repeat(40),
      })).not.toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);
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
