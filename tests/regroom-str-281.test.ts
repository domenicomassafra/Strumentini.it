import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { IOS281_ROUTES, validateIosSafariSim281 } from "../scripts/lib/ios-safari-sim-281";

const SHA = "a".repeat(64);
const REVISION = "b".repeat(40);
function simulatedReceipt() {
  const pages = Object.fromEntries(IOS281_ROUTES.map((route) => [route, SHA]));
  return {
    schemaVersion: 1, ticket: 109, evidenceKind: "SIMULATED_DESKTOP_WEBKIT_MOBILE",
    physicalDeviceObserved: false,
    browser: { platform: "macOS Playwright", engine: "webkit", version: "26.6", deviceProfile: "iPhone 17" },
    build: { revision: REVISION, pages,
      fingerprintSha256: createHash("sha256").update(JSON.stringify(pages)).digest("hex") },
    routes: IOS281_ROUTES.map((route) => ({
      route, status: "PASS",
      picker: { mechanism: "playwright-setInputFiles", nativeIosPickerObserved: false, selection: "PASS" },
      memory: { measurement: "POLICY_ESTIMATE_ONLY", estimatedBytes: 16044, hardLimitBytes: 24 * 1024 * 1024,
        observedPeakBytes: null as number | null, limitation: "Browser heap peaks cannot be measured in mobile WebKit emulation." },
      recovery: { invalidInput: "PASS", cancel: "PASS", retry: "PASS" } as {
        invalidInput: string; cancel: string; retry: string; cancelLimitation?: string;
      },
      download: { filename: "example.wav", bytes: 16044, sha256: SHA, blobHref: true, reopenedIndependently: "PASS" },
      share: { status: "NOT_RUN", limitation: "Native iOS Share sheet cannot be observed in macOS Playwright." },
      network: { offsite: [], uploads: [] as string[] },
    })),
  };
}
function withTamper(mutator: (receipt: ReturnType<typeof simulatedReceipt>) => void) {
  const receipt = simulatedReceipt();
  mutator(receipt);
  return validateIosSafariSim281(receipt);
}

describe("STR-281 iOS Safari simulated acceptance receipts", () => {
  it("accepts complete simulated receipts with per-route fingerprints, memory ceilings and recovery", () => {
    expect(validateIosSafariSim281(simulatedReceipt())).toEqual([]);
  });

  it("refuses a forged physical iPhone PASS and an unlabeled WebKit emulation", () => {
    expect(withTamper((receipt) => { receipt.physicalDeviceObserved = true; })).toContain(
      "receipt must be explicitly simulated and non-physical");
    expect(withTamper((receipt) => { receipt.evidenceKind = "PHYSICAL_IOS_SAFARI"; })).toContain(
      "receipt must be explicitly simulated and non-physical");
  });

  it("rejects stale or absent build fingerprints, missing routes and duplicated routes", () => {
    expect(withTamper((receipt) => { receipt.build.pages[IOS281_ROUTES[0]] = "missing"; }))
      .toContain("built route HTML fingerprints missing");
    expect(withTamper((receipt) => { receipt.build.fingerprintSha256 = "not-hashed"; }))
      .toContain("build revision/fingerprint missing");
    expect(withTamper((receipt) => { receipt.build.pages[IOS281_ROUTES[0]] = "c".repeat(64); }))
      .toContain("aggregate fingerprint does not match the route hashes");
    expect(withTamper((receipt) => { receipt.routes[1]!.route = receipt.routes[0]!.route; }))
      .toContain("expected exactly the two distinct representative heavy routes");
  });

  it("refuses invented measured Safari heap usage and policy violations", () => {
    expect(withTamper((receipt) => { receipt.routes[0]!.memory.observedPeakBytes = 1; }))
      .toContain("/tools/image-resize/ memory bounds/unsupported measurement invalid");
    expect(withTamper((receipt) => { receipt.routes[0]!.memory.estimatedBytes = 25 * 1024 * 1024; }))
      .toContain("/tools/image-resize/ memory bounds/unsupported measurement invalid");
  });

  it("fails on missing Blob/download reopen, upload, unproven picker or cancel/retry", () => {
    expect(withTamper((receipt) => { receipt.routes[0]!.download.reopenedIndependently = "NOT_RUN"; }))
      .toContain("/tools/image-resize/ Blob/download/reopen proof incomplete");
    expect(withTamper((receipt) => { receipt.routes[0]!.picker.nativeIosPickerObserved = true; }))
      .toContain("/tools/image-resize/ picker identity/selection missing");
    expect(withTamper((receipt) => { receipt.routes[1]!.recovery.cancel = "NOT_OBSERVED"; }))
      .toContain("audio cancellation must be observed");
    expect(withTamper((receipt) => { receipt.routes[1]!.recovery.retry = "FAIL"; }))
      .toContain("/tools/audio-generator/ refusal/cancel/retry evidence incomplete");
    expect(withTamper((receipt) => { receipt.routes[1]!.network.uploads = ["POST"]; }))
      .toContain("/tools/audio-generator/ unexpected offsite/upload traffic");
  });

  it("allows a fast image cancel to be NOT_OBSERVED only with a detailed limitation", () => {
    const receipt = simulatedReceipt();
    receipt.routes[0]!.recovery.cancel = "NOT_OBSERVED";
    receipt.routes[0]!.recovery.cancelLimitation = "Operation completed before the cancel control became actionable.";
    expect(validateIosSafariSim281(receipt)).toEqual([]);
    receipt.routes[0]!.recovery.cancelLimitation = "";
    expect(validateIosSafariSim281(receipt)).toContain("/tools/image-resize/ refusal/cancel/retry evidence incomplete");
  });

  it("revalidates the committed simulated consumer receipt independently", () => {
    const path = resolve(import.meta.dirname, "../quality/receipts/ios-safari-simulated-281.json");
    const receipt = JSON.parse(readFileSync(path, "utf8"));
    expect(validateIosSafariSim281(receipt)).toEqual([]);
  });
});
import { createHash } from "node:crypto";
