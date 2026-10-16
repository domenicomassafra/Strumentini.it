/** #363: a real worker may post any structured-clone action despite a typed
 * TypeScript protocol. An unknown resource action must never decrement the
 * accounted working set while the real worker still owns allocated frames. */
import { Worker } from "node:worker_threads";
import { describe, expect, it } from "vitest";
import {
  createHeavyJobResourceAccountant,
  createHeavyLocalJobRunner,
  type HeavyJobResourceAccountant,
  type HeavyWorkerPort,
  type HeavyWorkerResponse,
  type HeavyWorkerStartMessage,
} from "../src/runtime/heavy-local-job";

type Mode = "valid-reserve" | "valid-release" | "unknown-action" | "numeric-id" | "missing-id";
type Request = { readonly mode: Mode; readonly marker: string };
type Result = { readonly marker: string; readonly liveFrameBytes: number };

const realWorker = String.raw`
const { parentPort } = require('node:worker_threads');
let liveFrames = [];
parentPort.on('message', ({ jobId, payload }) => {
  // Real independently allocated/retained binary frame, not an accounting mock.
  const frame = new Uint8Array(384);
  frame[0] = 123;
  liveFrames.push(frame);
  const resourceId = payload.mode === 'numeric-id' ? '123' : payload.mode === 'missing-id' ? 'undefined' : 'frame-1';
  parentPort.postMessage({ type: 'resource', action: 'reserve', jobId, resourceId, bytes: frame.byteLength });
  if (payload.mode === 'valid-release') {
    liveFrames.pop();
    parentPort.postMessage({ type: 'resource', action: 'release', jobId, resourceId: 'frame-1' });
  }
  if (payload.mode === 'unknown-action') {
    // This must be a PROTOCOL_ERROR; the original main-thread switch treated
    // every non-'reserve' action as 'release', falsely freeing 384 live bytes.
    parentPort.postMessage({ type: 'resource', action: 'discard-without-freeing', jobId, resourceId: 'frame-1' });
    const second = new Uint8Array(384);
    second[0] = 234;
    liveFrames.push(second);
    parentPort.postMessage({ type: 'resource', action: 'reserve', jobId, resourceId: 'frame-2', bytes: second.byteLength });
  }
  if (payload.mode === 'numeric-id' || payload.mode === 'missing-id') {
    // Untyped numeric ID 123 must not alias reserved string '123', nor an
    // omitted ID silently alias reserved literal 'undefined'.
    if (payload.mode === 'numeric-id') {
      parentPort.postMessage({ type: 'resource', action: 'release', jobId, resourceId: 123 });
    } else {
      parentPort.postMessage({ type: 'resource', action: 'release', jobId });
    }
    const second = new Uint8Array(384);
    second[0] = 234;
    liveFrames.push(second);
    parentPort.postMessage({ type: 'resource', action: 'reserve', jobId, resourceId: 'frame-2', bytes: second.byteLength });
  }
  parentPort.postMessage({ type: 'success', jobId, result: {
    marker: payload.marker,
    liveFrameBytes: liveFrames.reduce((bytes, value) => bytes + value.byteLength, 0),
  }});
});
`;

function actualThreadHarness() {
  const observed: Array<{ readonly exited: Promise<number>; readonly terminated: () => number }> = [];
  const accountants: HeavyJobResourceAccountant[] = [];
  const runner = createHeavyLocalJobRunner<Request, Result>({
    policy: { capabilities: { worker: "required" }, limits: { hardInputBytes: 1024, hardWorkingSetBytes: 700 } },
    detectCapabilities: () => ({ worker: true, wasm: true, "image-decode": true }),
    createResourceAccountant(hardLimit, initial) {
      const accountant = createHeavyJobResourceAccountant(hardLimit, initial);
      accountants.push(accountant);
      return accountant;
    },
    createWorker() {
      const thread = new Worker(realWorker, { eval: true });
      const exited = new Promise<number>((resolve) => thread.once("exit", resolve));
      let terminationCount = 0;
      const port: HeavyWorkerPort<Request, Result> = {
        onmessage: null,
        onerror: null,
        postMessage(message: HeavyWorkerStartMessage<Request>) { thread.postMessage(message); },
        terminate() { terminationCount++; void thread.terminate(); },
      };
      const onMessage = (data: unknown) => port.onmessage?.({ data } as MessageEvent<HeavyWorkerResponse<Result>>);
      const onError = (error: Error) => port.onerror?.({ message: error.message } as ErrorEvent);
      thread.on("message", onMessage);
      thread.on("error", onError);
      observed.push({ exited, terminated: () => terminationCount });
      return {
        worker: port,
        cleanup() { thread.off("message", onMessage); thread.off("error", onError); },
      };
    },
  });
  return { runner, observed, accountants };
}

async function watchdog<T>(promise: Promise<T>, controller: AbortController): Promise<T> {
  const timeout = setTimeout(() => controller.abort(), 1500);
  try { return await promise; } finally { clearTimeout(timeout); }
}

describe("#363 unknown Worker resource action must fail closed", () => {
  it("refuses a real worker's fake release without publishing an over-budget binary result; previous output/retry survive", async () => {
    const { runner, observed, accountants } = actualThreadHarness();
    let released = 0;
    let verified: Result | null = null;
    try {
      const before = runner.start({
        request: { mode: "valid-reserve", marker: "good-before" },
        input: { inputBytes: 64, estimatedWorkingSetBytes: 128 },
      });
      verified = (await before.promise).value;
      expect(verified).toEqual({ marker: "good-before", liveFrameBytes: 384 });
      expect(accountants[0]?.snapshot()).toMatchObject({ currentBytes: 0, peakBytes: 448 });

      const cancel = new AbortController();
      const invalid = runner.start({
        request: { mode: "unknown-action", marker: "BAD-768-BYTES" },
        input: { inputBytes: 64, estimatedWorkingSetBytes: 128 },
        ownedResources: [{ id: "preview", bytes: 32, release: () => { released++; } }],
        signal: cancel.signal,
      });
      // RED: old code resolves success and falsely reports only 480 bytes peak
      // while the thread still owns two 384-byte frames (768 B) with a 700 B cap.
      await expect(watchdog(invalid.promise, cancel))
        .rejects.toMatchObject({ code: "PROTOCOL_ERROR" });
      expect(released).toBe(1);
      expect(runner.activeJobId).toBeNull();
      expect(accountants[1]?.snapshot()).toMatchObject({ currentBytes: 0, reservationCount: 0, peakBytes: 480 });
      expect(verified).toEqual({ marker: "good-before", liveFrameBytes: 384 });

      const retry = runner.start({
        request: { mode: "valid-release", marker: "good-after" },
        input: { inputBytes: 64, estimatedWorkingSetBytes: 128 },
      });
      const retryCompletion = await retry.promise;
      verified = retryCompletion.value;
      expect(verified).toEqual({ marker: "good-after", liveFrameBytes: 0 });
      expect(retryCompletion.metrics.finalAccountedWorkingSetBytes).toBe(0);
    } finally {
      runner.dispose();
      await Promise.all(observed.map(({ exited }) => exited));
    }
    expect(observed).toHaveLength(3);
    expect(observed.every((entry) => entry.terminated() === 1)).toBe(true);
    expect(accountants.every((entry) => entry.snapshot().currentBytes === 0)).toBe(true);
  }, 12000);

  it.each([
    ["numeric-id", "numeric release ID 123 aliases reserved string '123'"],
    ["missing-id", "missing release ID aliases reserved string 'undefined'"],
  ] as const)("refuses %s: %s", async (mode, _description) => {
    const { runner, observed, accountants } = actualThreadHarness();
    let released = 0;
    try {
      const cancel = new AbortController();
      const invalid = runner.start({
        request: { mode, marker: "BAD-ALISED-RESOURCE-ID" },
        input: { inputBytes: 64, estimatedWorkingSetBytes: 128 },
        ownedResources: [{ id: "preview", bytes: 32, release: () => { released++; } }],
        signal: cancel.signal,
      });
      await expect(watchdog(invalid.promise, cancel))
        .rejects.toMatchObject({ code: "PROTOCOL_ERROR" });
      expect(released).toBe(1);
      expect(runner.activeJobId).toBeNull();
    } finally {
      runner.dispose();
      await Promise.all(observed.map(({ exited }) => exited));
    }
    expect(observed).toHaveLength(1);
    expect(observed[0]?.terminated()).toBe(1);
    expect(accountants[0]?.snapshot()).toMatchObject({ currentBytes: 0, reservationCount: 0, peakBytes: 480 });
  }, 12000);
});
