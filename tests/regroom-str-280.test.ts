import { describe, expect, it } from "vitest";
import { androidHeavyPromotionDecision, validateAndroidHeavyRouteReceipt } from "../scripts/lib/android-heavy-receipt";
import { preflightHeavyLocalJob } from "../src/runtime/heavy-preflight";

const valid = {
  schemaVersion: 1, ticket: "STR-280", status: "SIMULATED_PASS",
  observedAt: "2026-10-19T08:00:00.000Z",
  device: { label: "Pixel 7 profile", os: "Android", mode: "PLAYWRIGHT_BROWSER_EMULATION", physicalHardware: "NOT_OBSERVED" },
  browser: { engine: "chromium", version: "139.0.0", userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit Chrome/139.0.0 Mobile" },
  build: { revision: "a".repeat(40), compiled: true }, route: "/tools/image-resize/",
  input: { class: "image", filename: "source.png", mime: "image/png", bytes: 128, sha256: "b".repeat(64) },
  memory: { scope: "CHROMIUM_JS_HEAP_ONLY", usedBeforeBytes: 1000, usedAfterBytes: 1200, jobElapsedMs: 50, actualOomObserved: false, nativeWasmGpuPeakObserved: false },
  checks: { fileSelected: "OBSERVED", progress: "OBSERVED", cancelRecoverable: "OBSERVED", retrySucceeded: "OBSERVED", downloadTriggered: "OBSERVED", independentlyReopened: "OBSERVED" },
  output: { filename: "output.jpeg", bytes: 220, sha256: "c".repeat(64), reopenedWith: "sharp decode", verifiedContent: "width=8 height=8" },
  limits: [{ kind: "CANCELLED", source: "BROWSER", recoverable: true, detail: "User cancelled operation; retry produced output" }],
  externalRequests: 0, pageErrors: [],
} as const;

describe("STR-280 Android heavy web acceptance", () => {
  it("accepts a complete simulated receipt, while STR-206 physical gate remains NO_GO", () => {
    expect(validateAndroidHeavyRouteReceipt(valid)).toEqual([]);
    expect(androidHeavyPromotionDecision(valid)).toMatchObject({ simulatedAcceptance: "PASS", physicalPromotion: "NO_GO" });
  });

  it("rejects forged physical claims, missing build/route/input and fake output reopen", () => {
    for (const corrupted of [
      { device: { ...valid.device, physicalHardware: "PASS" } },
      { device: { ...valid.device, mode: "PHYSICAL_ANDROID" } },
      { build: { revision: "unknown", compiled: true } },
      { route: "/api/upload" },
      { input: { ...valid.input, sha256: "not-hashed" } },
      { memory: { ...valid.memory, actualOomObserved: true } },
      { output: null },
      { checks: { ...valid.checks, independentlyReopened: "NOT_OBSERVED" } },
      { externalRequests: 1 },
      { limits: [{ kind: "OOM", source: "BROWSER", recoverable: false, detail: "crash" }] },
    ]) {
      const receipt = { ...valid, ...corrupted };
      expect(validateAndroidHeavyRouteReceipt(receipt).length).toBeGreaterThan(0);
      expect(androidHeavyPromotionDecision(receipt).simulatedAcceptance).toBe("NO_GO");
    }
  });

  it("captures unsupported and memory hard limits before allocation and allows a later retry", () => {
    const policy = { capabilities: { worker: "required", wasm: "required" } as const, limits: { hardWorkingSetBytes: 1024 } };
    const capabilities = { worker: false, wasm: false, "image-decode": true };
    const rejected = preflightHeavyLocalJob(policy, { inputBytes: 32, estimatedWorkingSetBytes: 2048 }, capabilities);
    expect(rejected.state).toBe("unsupported");
    expect(rejected.resourceState).toBe("blocked");
    expect(rejected.missingRequired).toEqual(["worker", "wasm"]);
    const retry = preflightHeavyLocalJob(policy, { inputBytes: 32, estimatedWorkingSetBytes: 512 }, { ...capabilities, worker: true, wasm: true });
    expect(retry.state).toBe("supported");
    expect(retry.resourceState).toBe("within-limits");
    const limited = { ...valid, status: "LIMIT", output: null, checks: { ...valid.checks, downloadTriggered: "NOT_OBSERVED", independentlyReopened: "NOT_OBSERVED" }, limits: [
      { kind: "OOM", source: "CONTROLLED_PREFLIGHT", recoverable: true, detail: rejected.reasons[0] },
      { kind: "UNSUPPORTED", source: "CONTROLLED_PREFLIGHT", recoverable: true, detail: rejected.reasons.at(-1) },
    ] };
    expect(validateAndroidHeavyRouteReceipt(limited)).toEqual([]);
    expect(androidHeavyPromotionDecision(limited)).toMatchObject({ simulatedAcceptance: "NO_GO", physicalPromotion: "NO_GO" });
  });

  it("rejects limit without evidence and success without a real reopened download", () => {
    expect(validateAndroidHeavyRouteReceipt({ ...valid, status: "LIMIT", limits: [] })).not.toEqual([]);
    expect(validateAndroidHeavyRouteReceipt({ ...valid, status: "SIMULATED_PASS", checks: { ...valid.checks, downloadTriggered: "NOT_OBSERVED" } })).not.toEqual([]);
  });
});
