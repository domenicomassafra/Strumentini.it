import { describe, expect, it } from "vitest";
import {
  detectHeavyJobCapabilities,
  preflightHeavyLocalJob,
  type HeavyJobCapabilitySnapshot,
} from "../src/runtime/heavy-preflight";

const allCapabilities: HeavyJobCapabilitySnapshot = {
  worker: true,
  wasm: true,
  "image-decode": true,
};

describe("heavy local-job preflight", () => {
  it("keeps worker, wasm and image decode requirements independent", () => {
    const result = preflightHeavyLocalJob({
      capabilities: { worker: "required", wasm: "preferred", "image-decode": "unused" },
    }, {}, { worker: true, wasm: false, "image-decode": false });

    expect(result.state).toBe("degraded");
    expect(result.requiredCapabilities).toEqual(["worker"]);
    expect(result.preferredCapabilities).toEqual(["wasm"]);
    expect(result.missingRequired).toEqual([]);
    expect(result.missingPreferred).toEqual(["wasm"]);
  });

  it("rejects a missing required capability before any heavy work is requested", () => {
    const result = preflightHeavyLocalJob({
      capabilities: { worker: "required", wasm: "required", "image-decode": "required" },
    }, { inputBytes: 1024 }, { worker: true, wasm: false, "image-decode": true });

    expect(result.state).toBe("unsupported");
    expect(result.missingRequired).toEqual(["wasm"]);
    expect(result.reasons).toContain("Required browser capability is unavailable: wasm.");
  });

  it("blocks hard resource limits and warns at soft limits", () => {
    const policy = {
      limits: {
        softInputBytes: 10,
        hardInputBytes: 20,
        softWorkingSetBytes: 40,
        hardWorkingSetBytes: 80,
      },
    } as const;

    expect(preflightHeavyLocalJob(policy, { inputBytes: 11, estimatedWorkingSetBytes: 40 }, allCapabilities))
      .toMatchObject({ state: "degraded", resourceState: "warning" });
    expect(preflightHeavyLocalJob(policy, { inputBytes: 20, estimatedWorkingSetBytes: 81 }, allCapabilities))
      .toMatchObject({ state: "unsupported", resourceState: "blocked" });
  });

  it("fails invalid resource policies closed", () => {
    expect(() => preflightHeavyLocalJob({ limits: { softInputBytes: 100, hardInputBytes: 50 } }, {}, allCapabilities))
      .toThrow(/softInputBytes cannot exceed hardInputBytes/u);
    expect(() => preflightHeavyLocalJob({}, { inputBytes: -1 }, allCapabilities)).toThrow(/inputBytes/u);
  });

  it("feature-detects browser APIs without user-agent checks", () => {
    const fake = {
      Worker: class FakeWorker {},
      WebAssembly: {},
      createImageBitmap: () => undefined,
    } as unknown as typeof globalThis;
    expect(detectHeavyJobCapabilities(fake)).toEqual({
      worker: true,
      wasm: true,
      "image-decode": true,
    });
  });
});
