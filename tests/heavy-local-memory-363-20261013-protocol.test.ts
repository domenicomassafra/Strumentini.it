/** #363: malformed responses from an actual worker must reject and release local resources. */
import { Worker } from "node:worker_threads";
import { describe, expect, it } from "vitest";
import {
  createHeavyLocalJobRunner,
  type HeavyWorkerPort,
  type HeavyWorkerResponse,
  type HeavyWorkerStartMessage,
} from "../src/runtime/heavy-local-job";

type Request = { readonly mode: "ok" | "malformed"; readonly label: string };
type Result = { readonly label: string };

const workerSource = `
  const { parentPort } = require("node:worker_threads");
  parentPort.on("message", ({jobId, payload}) => {
    parentPort.postMessage({type:"resource", jobId, action:"reserve", resourceId:"decoded", bytes:64});
    if (payload.mode === "malformed") {
      // A genuinely delivered structured-clone payload, invalid for the runner's protocol.
      parentPort.postMessage(null);
    } else {
      parentPort.postMessage({type:"success", jobId, result:{label:payload.label}});
    }
  });
`;

interface ObservedThread {
  readonly exited: Promise<number>;
  readonly faults: Error[];
  readonly getTerminationCount: () => number;
}

function liveRunner() {
  const observed: ObservedThread[] = [];
  const runner = createHeavyLocalJobRunner<Request, Result>({
    policy: { capabilities: { worker: "required" }, limits: {
      hardInputBytes: 1024, hardWorkingSetBytes: 512,
    } },
    detectCapabilities: () => ({ worker: true, wasm: true, "image-decode": true }),
    createWorker: () => {
      const thread = new Worker(workerSource, { eval: true });
      const faults: Error[] = [];
      let terminationCount = 0;
      const exited = new Promise<number>((resolve) => thread.once("exit", resolve));
      const port: HeavyWorkerPort<Request, Result> = {
        onmessage: null,
        onerror: null,
        postMessage(message: HeavyWorkerStartMessage<Request>) {
          thread.postMessage(message);
        },
        terminate() {
          terminationCount++;
          void thread.terminate();
        },
      };
      thread.on("message", (message: unknown) => {
        try {
          port.onmessage?.({ data: message } as MessageEvent<HeavyWorkerResponse<Result>>);
        } catch (error) {
          // Guard the Vitest process from an uncaught EventEmitter callback so
          // the exact missing rejection and worker lifetime remain observable.
          faults.push(error instanceof Error ? error : new Error(String(error)));
        }
      });
      thread.on("error", (error: unknown) => port.onerror?.({
        message: error instanceof Error ? error.message : String(error),
      } as ErrorEvent));
      observed.push({ exited, faults, getTerminationCount: () => terminationCount });
      return { worker: port };
    },
  });
  return { runner, observed };
}

async function withWatchdog<T>(promise: Promise<T>, controller: AbortController): Promise<T> {
  // A failing baseline must terminate without leaving a worker or a timer behind.
  const watchdog = setTimeout(() => controller.abort(), 1000);
  try {
    return await promise;
  } finally {
    clearTimeout(watchdog);
  }
}

describe("#363 wave4 real worker malformed protocol cleanup", () => {
  it("rejects null worker response as PROTOCOL_ERROR, terminates and keeps the preceding verified output", async () => {
    const { runner, observed } = liveRunner();
    let released = 0;
    let lastVerified: Result | null = null;
    try {
      const first = runner.start({
        request: { mode: "ok", label: "previous-verified" },
        input: { inputBytes: 64, estimatedWorkingSetBytes: 128 },
      });
      const firstResult = await first.promise;
      lastVerified = firstResult.value;
      expect(firstResult.metrics.peakAccountedWorkingSetBytes).toBe(128);
      expect(firstResult.metrics.finalAccountedWorkingSetBytes).toBe(0);

      const controller = new AbortController();
      const malformed = runner.start({
        request: { mode: "malformed", label: "untrusted-null-message" },
        input: { inputBytes: 64, estimatedWorkingSetBytes: 128 },
        signal: controller.signal,
        ownedResources: [{ id: "preview", bytes: 32, release: () => { released++; } }],
      });
      await expect(withWatchdog(malformed.promise, controller))
        .rejects.toMatchObject({ code: "PROTOCOL_ERROR" });
      expect(released).toBe(1);
      expect(runner.activeJobId).toBeNull();
      expect(lastVerified).toEqual({ label: "previous-verified" });

      const retry = runner.start({
        request: { mode: "ok", label: "verified-retry" },
        input: { inputBytes: 64, estimatedWorkingSetBytes: 128 },
      });
      const next = await retry.promise;
      lastVerified = next.value;
      expect(lastVerified).toEqual({ label: "verified-retry" });
      expect(next.metrics.finalAccountedWorkingSetBytes).toBe(0);
    } finally {
      runner.dispose();
      // All real worker_threads must have exited before the test completes.
      await Promise.all(observed.map((thread) => thread.exited));
    }
    expect(observed).toHaveLength(3);
    expect(observed.every((thread) => thread.getTerminationCount() === 1)).toBe(true);
    expect(observed.flatMap((thread) => thread.faults)).toEqual([]);
  }, 10000);
});
