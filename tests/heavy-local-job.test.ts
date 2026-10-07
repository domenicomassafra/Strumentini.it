import { describe, expect, it } from "vitest";
import {
  HEAVY_LOCAL_NETWORK_POLICY,
  createHeavyJobResourceAccountant,
  createHeavyLocalJobRunner,
  createObjectUrlHeavyWorkerLease,
  type HeavyJobResourceAccountant,
  type HeavyJobResourceSnapshot,
  type HeavyLocalJobRuntimePolicy,
  type HeavyWorkerPort,
  type HeavyWorkerResponse,
  type HeavyWorkerStartMessage,
} from "../src/runtime/heavy-local-job";
import type { HeavyJobCapabilitySnapshot } from "../src/runtime/heavy-preflight";

type TestRequest = { readonly marker: string };
type TestResult = { readonly marker: string };

const allCapabilities: HeavyJobCapabilitySnapshot = {
  worker: true,
  wasm: true,
  "image-decode": true,
};

const policy: HeavyLocalJobRuntimePolicy = {
  capabilities: { worker: "required", wasm: "preferred" },
  limits: {
    softInputBytes: 80,
    hardInputBytes: 100,
    softWorkingSetBytes: 160,
    hardWorkingSetBytes: 200,
  },
};

class ControlledWorker implements HeavyWorkerPort<TestRequest, TestResult> {
  onmessage: ((event: MessageEvent<HeavyWorkerResponse<TestResult>>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly posted: HeavyWorkerStartMessage<TestRequest>[] = [];
  readonly transfers: (readonly Transferable[] | undefined)[] = [];
  terminateCount = 0;

  postMessage(message: HeavyWorkerStartMessage<TestRequest>, transfer?: readonly Transferable[]): void {
    this.posted.push(message);
    this.transfers.push(transfer);
  }

  terminate(): void {
    this.terminateCount += 1;
  }

  emit(message: HeavyWorkerResponse<TestResult>): void {
    this.onmessage?.({ data: message } as MessageEvent<HeavyWorkerResponse<TestResult>>);
  }

  fail(message: string): void {
    this.onerror?.({ message } as ErrorEvent);
  }
}

class RecordingAccountant implements HeavyJobResourceAccountant {
  readonly events: string[] = [];
  readonly inner: HeavyJobResourceAccountant;

  constructor(hardLimitBytes: number, initialBytes: number) {
    this.inner = createHeavyJobResourceAccountant(hardLimitBytes, initialBytes);
    this.events.push(`initial:${initialBytes}`);
  }

  reserve(resourceId: string, bytes: number): HeavyJobResourceSnapshot {
    this.events.push(`reserve:${resourceId}:${bytes}`);
    return this.inner.reserve(resourceId, bytes);
  }

  release(resourceId: string): HeavyJobResourceSnapshot {
    this.events.push(`release:${resourceId}`);
    return this.inner.release(resourceId);
  }

  reset(): HeavyJobResourceSnapshot {
    this.events.push("reset");
    return this.inner.reset();
  }

  snapshot(): HeavyJobResourceSnapshot {
    return this.inner.snapshot();
  }
}

function createControlledRunner(options: {
  readonly workers?: ControlledWorker[];
  readonly runtimePolicy?: HeavyLocalJobRuntimePolicy;
  readonly capabilities?: HeavyJobCapabilitySnapshot;
  readonly createResourceAccountant?: (hardLimitBytes: number, initialBytes: number) => HeavyJobResourceAccountant;
  readonly cleanup?: () => void;
} = {}) {
  const workers = options.workers ?? [];
  return createHeavyLocalJobRunner<TestRequest, TestResult>({
    policy: options.runtimePolicy ?? policy,
    detectCapabilities: () => options.capabilities ?? allCapabilities,
    createWorker: () => {
      const worker = new ControlledWorker();
      workers.push(worker);
      return { worker, ...(options.cleanup === undefined ? {} : { cleanup: options.cleanup }) };
    },
    ...(options.createResourceAccountant === undefined ? {} : { createResourceAccountant: options.createResourceAccountant }),
    now: (() => {
      let tick = 100;
      return () => tick += 5;
    })(),
  });
}

describe("heavy local-job runtime", () => {
  it("runs behind the preflight boundary with local-only protocol, monotonic progress and bounded accounting", async () => {
    const workers: ControlledWorker[] = [];
    const accountantEvents: string[] = [];
    let released = 0;
    let leaseCleaned = 0;
    const progress: number[] = [];
    const runner = createControlledRunner({
      workers,
      cleanup: () => { leaseCleaned += 1; },
      createResourceAccountant(hardLimitBytes, initialBytes) {
        const accountant = new RecordingAccountant(hardLimitBytes, initialBytes);
        accountantEvents.push(...accountant.events);
        const proxy: HeavyJobResourceAccountant = {
          reserve(id, bytes) {
            const snapshot = accountant.reserve(id, bytes);
            accountantEvents.push(accountant.events.at(-1) ?? "");
            return snapshot;
          },
          release(id) {
            const snapshot = accountant.release(id);
            accountantEvents.push(accountant.events.at(-1) ?? "");
            return snapshot;
          },
          reset() {
            const snapshot = accountant.reset();
            accountantEvents.push(accountant.events.at(-1) ?? "");
            return snapshot;
          },
          snapshot: () => accountant.snapshot(),
        };
        return proxy;
      },
    });

    const transferred = new ArrayBuffer(8);
    const execution = runner.start({
      request: { marker: "first" },
      input: { inputBytes: 20, estimatedWorkingSetBytes: 80 },
      transfer: [transferred],
      ownedResources: [{ id: "preview-url", bytes: 10, release: () => { released += 1; } }],
      onProgress(value) {
        if (value.kind === "determinate") progress.push(value.fraction);
      },
    });
    const worker = workers[0];
    expect(worker).toBeDefined();
    expect(worker?.posted).toEqual([{
      type: "start",
      jobId: execution.jobId,
      networkPolicy: HEAVY_LOCAL_NETWORK_POLICY,
      payload: { marker: "first" },
    }]);
    expect(worker?.transfers[0]).toEqual([transferred]);

    worker?.emit({ type: "progress", jobId: execution.jobId, progress: { kind: "indeterminate", phase: "decode" } });
    worker?.emit({ type: "progress", jobId: execution.jobId, progress: { kind: "determinate", fraction: 0.25 } });
    worker?.emit({ type: "resource", jobId: execution.jobId, action: "reserve", resourceId: "rgba", bytes: 40 });
    worker?.emit({ type: "progress", jobId: execution.jobId, progress: { kind: "determinate", fraction: 0.75 } });
    worker?.emit({ type: "resource", jobId: execution.jobId, action: "release", resourceId: "rgba" });
    worker?.emit({ type: "success", jobId: execution.jobId, result: { marker: "done" } });

    const completion = await execution.promise;
    expect(completion.value).toEqual({ marker: "done" });
    expect(completion.preflight.state).toBe("supported");
    expect(progress).toEqual([0.25, 0.75]);
    expect(completion.metrics).toMatchObject({
      jobId: execution.jobId,
      progressEvents: 3,
      peakAccountedWorkingSetBytes: 70,
      accountedBytesReleasedOnCleanup: 30,
      finalAccountedWorkingSetBytes: 0,
    });
    expect(worker?.terminateCount).toBe(1);
    expect(leaseCleaned).toBe(1);
    expect(released).toBe(1);
    expect(accountantEvents).toEqual([
      "initial:20",
      "reserve:main:preview-url:10",
      "reserve:worker:rgba:40",
      "release:worker:rgba",
      "reset",
    ]);
  });

  it("fails before worker creation when capability or hard resource preflight blocks the job", () => {
    const workers: ControlledWorker[] = [];
    let released = 0;
    const runner = createControlledRunner({ workers, capabilities: { ...allCapabilities, worker: false } });

    expect(() => runner.start({
      request: { marker: "blocked" },
      input: { inputBytes: 20, estimatedWorkingSetBytes: 80 },
      ownedResources: [{ id: "local-preview", release: () => { released += 1; } }],
    })).toThrowError(expect.objectContaining({ code: "PREFLIGHT_REJECTED" }));
    expect(workers).toHaveLength(0);
    expect(released).toBe(1);

    const sizeRunner = createControlledRunner({ workers });
    expect(() => sizeRunner.start({
      request: { marker: "too-large" },
      input: { inputBytes: 101, estimatedWorkingSetBytes: 110 },
    })).toThrowError(expect.objectContaining({ code: "PREFLIGHT_REJECTED" }));
    expect(workers).toHaveLength(0);
  });

  it("cancels deterministically, ignores captured stale completion and allows a clean retry", async () => {
    const workers: ControlledWorker[] = [];
    let cleanupCount = 0;
    let released = 0;
    const runner = createControlledRunner({ workers, cleanup: () => { cleanupCount += 1; } });

    const first = runner.start({
      request: { marker: "first" },
      input: { inputBytes: 10, estimatedWorkingSetBytes: 30 },
      ownedResources: [{ id: "input-buffer", bytes: 10, release: () => { released += 1; } }],
    });
    const firstWorker = workers[0];
    const staleHandler = firstWorker?.onmessage;
    first.cancel();
    await expect(first.promise).rejects.toMatchObject({ name: "AbortError" });
    expect(firstWorker?.terminateCount).toBe(1);
    expect(released).toBe(1);
    expect(runner.activeJobId).toBeNull();

    const second = runner.start({
      request: { marker: "second" },
      input: { inputBytes: 10, estimatedWorkingSetBytes: 30 },
    });
    const secondWorker = workers[1];
    expect(second.jobId).toBeGreaterThan(first.jobId);

    staleHandler?.({
      data: { type: "success", jobId: first.jobId, result: { marker: "STALE" } },
    } as MessageEvent<HeavyWorkerResponse<TestResult>>);
    expect(runner.activeJobId).toBe(second.jobId);

    secondWorker?.emit({ type: "success", jobId: second.jobId, result: { marker: "fresh" } });
    await expect(second.promise).resolves.toMatchObject({ value: { marker: "fresh" } });
    expect(secondWorker?.terminateCount).toBe(1);
    expect(cleanupCount).toBe(2);
  });

  it("preserves an optional worker failure code without assigning undefined under exact optional types", async () => {
    const workers: ControlledWorker[] = [];
    const runner = createControlledRunner({ workers });
    const execution = runner.start({
      request: { marker: "coded-failure" },
      input: { inputBytes: 5, estimatedWorkingSetBytes: 20 },
    });
    workers[0]?.emit({
      type: "failure",
      jobId: execution.jobId,
      code: "CODEC_DECODE_FAILED",
      message: "decode failed",
    });

    await expect(execution.promise).rejects.toMatchObject({
      code: "WORKER_FAILURE",
      workerCode: "CODEC_DECODE_FAILED",
      message: "decode failed",
    });
  });

  it("terminates the worker when dynamic resource accounting would cross the hard working-set ceiling", async () => {
    const workers: ControlledWorker[] = [];
    const runner = createControlledRunner({
      workers,
      runtimePolicy: {
        limits: { hardInputBytes: 100, hardWorkingSetBytes: 50 },
      },
    });
    const execution = runner.start({
      request: { marker: "memory" },
      input: { inputBytes: 20, estimatedWorkingSetBytes: 40 },
    });
    const worker = workers[0];
    worker?.emit({ type: "resource", jobId: execution.jobId, action: "reserve", resourceId: "decoded", bytes: 31 });

    await expect(execution.promise).rejects.toMatchObject({ code: "RESOURCE_LIMIT" });
    expect(worker?.terminateCount).toBe(1);
    expect(runner.activeJobId).toBeNull();
  });

  it("releases caller-owned resources when the initial accounted working set is rejected before worker creation", () => {
    const workers: ControlledWorker[] = [];
    let released = 0;
    const runner = createControlledRunner({ workers });
    expect(() => runner.start({
      request: { marker: "initial-memory" },
      input: { inputBytes: 20, estimatedWorkingSetBytes: 80 },
      initialWorkingSetBytes: 201,
      ownedResources: [{ id: "input-buffer", release: () => { released += 1; } }],
    })).toThrowError(expect.objectContaining({ code: "RESOURCE_LIMIT" }));
    expect(workers).toHaveLength(0);
    expect(released).toBe(1);
  });

  it("fails closed on regressive determinate progress and suppresses later worker messages", async () => {
    const workers: ControlledWorker[] = [];
    const seen: number[] = [];
    const runner = createControlledRunner({ workers });
    const execution = runner.start({
      request: { marker: "progress" },
      input: { inputBytes: 5, estimatedWorkingSetBytes: 20 },
      onProgress(progress) {
        if (progress.kind === "determinate") seen.push(progress.fraction);
      },
    });
    const worker = workers[0];
    const staleHandler = worker?.onmessage;
    worker?.emit({ type: "progress", jobId: execution.jobId, progress: { kind: "determinate", fraction: 0.6 } });
    worker?.emit({ type: "progress", jobId: execution.jobId, progress: { kind: "determinate", fraction: 0.4 } });
    await expect(execution.promise).rejects.toMatchObject({ code: "PROTOCOL_ERROR" });
    expect(seen).toEqual([0.6]);
    expect(worker?.terminateCount).toBe(1);

    staleHandler?.({
      data: { type: "success", jobId: execution.jobId, result: { marker: "late" } },
    } as MessageEvent<HeavyWorkerResponse<TestResult>>);
    expect(runner.activeJobId).toBeNull();
  });

  it("normalizes worker failures and always runs worker/resource cleanup", async () => {
    const workers: ControlledWorker[] = [];
    let released = 0;
    const runner = createControlledRunner({ workers });
    const execution = runner.start({
      request: { marker: "failure" },
      input: { inputBytes: 5, estimatedWorkingSetBytes: 20 },
      ownedResources: [{ id: "bitmap", bytes: 8, release: () => { released += 1; } }],
    });
    const worker = workers[0];
    worker?.fail("worker exploded");

    await expect(execution.promise).rejects.toMatchObject({ code: "WORKER_FAILURE" });
    expect(worker?.terminateCount).toBe(1);
    expect(released).toBe(1);
  });

  it("releases object URLs exactly once through the shared worker lease on cancel", async () => {
    const worker = new ControlledWorker();
    const revoked: string[] = [];
    const lease = createObjectUrlHeavyWorkerLease<TestRequest, TestResult>(new Blob(["worker source"]), {
      createObjectURL: () => "blob:heavy-worker-1",
      revokeObjectURL: (url) => revoked.push(url),
      createWorker: () => worker,
    });
    const runner = createHeavyLocalJobRunner<TestRequest, TestResult>({
      policy,
      detectCapabilities: () => allCapabilities,
      createWorker: () => lease,
    });
    const execution = runner.start({
      request: { marker: "blob-worker" },
      input: { inputBytes: 1, estimatedWorkingSetBytes: 10 },
    });

    runner.cancel();
    await expect(execution.promise).rejects.toMatchObject({ name: "AbortError" });
    runner.cancel();
    expect(worker.terminateCount).toBe(1);
    expect(revoked).toEqual(["blob:heavy-worker-1"]);
  });

  it("disposes the runner by cancelling active work and rejecting future starts", async () => {
    const workers: ControlledWorker[] = [];
    const runner = createControlledRunner({ workers });
    const execution = runner.start({
      request: { marker: "dispose" },
      input: { inputBytes: 1, estimatedWorkingSetBytes: 10 },
    });
    runner.dispose();
    await expect(execution.promise).rejects.toMatchObject({ name: "AbortError" });
    expect(workers[0]?.terminateCount).toBe(1);
    expect(() => runner.start({
      request: { marker: "after-dispose" },
      input: { inputBytes: 1, estimatedWorkingSetBytes: 10 },
    })).toThrowError(expect.objectContaining({ code: "DISPOSED" }));
  });
});
