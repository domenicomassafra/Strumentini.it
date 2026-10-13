/** #363: a real worker_threads exit(0) after reserving resources is not success. */
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

type Request = { readonly mode: "ok" | "silent-exit" | "slow" | "blocked"; readonly label: string };
type Result = { readonly label: string };

const workerCode = String.raw`
const { parentPort } = require('node:worker_threads');
parentPort.on('message', ({ jobId, payload }) => {
  parentPort.postMessage({ type: 'resource', action: 'reserve', jobId,
    resourceId: 'frame', bytes: 64 });
  if (payload.mode === 'silent-exit') {
    // Legitimate code-0 worker exit: no success/failure/error response.
    parentPort.close();
  } else if (payload.mode === 'slow') {
    setTimeout(() => parentPort.postMessage({ type: 'success', jobId,
      result: { label: payload.label } }), 175);
  } else if (payload.mode === 'ok') {
    parentPort.postMessage({ type: 'success', jobId, result: { label: payload.label } });
  }
});
`;

interface ObservedWorker {
  readonly thread: Worker;
  readonly exited: Promise<number>;
  readonly exitCodes: number[];
  readonly terminationCalls: () => number;
  readonly subscriptionsAfterCleanup: () => number;
}

function fixture() {
  const workers: ObservedWorker[] = [];
  const accountants: HeavyJobResourceAccountant[] = [];
  const runner = createHeavyLocalJobRunner<Request, Result>({
    policy: { capabilities: { worker: "required" }, limits: {
      hardInputBytes: 1024, hardWorkingSetBytes: 512,
    } },
    detectCapabilities: () => ({ worker: true, wasm: true, "image-decode": true }),
    createResourceAccountant(hardBytes, initialBytes) {
      const accountant = createHeavyJobResourceAccountant(hardBytes, initialBytes);
      accountants.push(accountant);
      return accountant;
    },
    createWorker() {
      const thread = new Worker(workerCode, { eval: true });
      let terminations = 0;
      let subscribed = 0;
      const exitCodes: number[] = [];
      const exited = new Promise<number>((resolve) => thread.once("exit", (code) => {
        exitCodes.push(code);
        resolve(code);
      }));
      const port: HeavyWorkerPort<Request, Result> = {
        onmessage: null,
        onerror: null,
        postMessage(message: HeavyWorkerStartMessage<Request>) { thread.postMessage(message); },
        terminate() { terminations++; void thread.terminate(); },
      };
      const message = (value: unknown) => port.onmessage?.({ data: value } as MessageEvent<HeavyWorkerResponse<Result>>);
      const error = (value: Error) => port.onerror?.({ message: value.message } as ErrorEvent);
      thread.on("message", message);
      thread.on("error", error);
      workers.push({
        thread, exited, exitCodes,
        terminationCalls: () => terminations,
        subscriptionsAfterCleanup: () => subscribed,
      });
      return {
        worker: port,
        onExit(listener: (code: number) => void) {
          subscribed++;
          thread.on("exit", listener);
          return () => { subscribed--; thread.off("exit", listener); };
        },
        cleanup() {
          thread.off("message", message);
          thread.off("error", error);
        },
      };
    },
  });
  return { runner, workers, accountants };
}

function options(mode: Request["mode"], label: string, release?: () => void, signal?: AbortSignal) {
  return {
    request: { mode, label },
    input: { inputBytes: 32, estimatedWorkingSetBytes: 96 },
    ...(release ? { ownedResources: [{ id: "preview", bytes: 32, release }] } : {}),
    ...(signal ? { signal } : {}),
  };
}

async function bounded<T>(promise: Promise<T>, signal: AbortController): Promise<T> {
  // RED-only test rescue, never a runtime job limit. Clear it even on failure.
  const watchdog = setTimeout(() => signal.abort(), 1250);
  try { return await promise; } finally { clearTimeout(watchdog); }
}

describe("#363 real worker_threads normal-exit without result", () => {
  it("fails immediately on code-0 exit, frees reserve and preview, retains prior output and permits retry", async () => {
    const { runner, workers, accountants } = fixture();
    let verified: Result | null = null;
    let releases = 0;
    try {
      const good = runner.start(options("ok", "previous-verified"));
      verified = (await good.promise).value;
      expect(verified).toEqual({ label: "previous-verified" });

      const controller = new AbortController();
      const missing = runner.start(options("silent-exit", "missing-terminal", () => { releases++; }, controller.signal));
      await expect(bounded(missing.promise, controller)).rejects.toMatchObject({ code: "WORKER_FAILURE" });
      // Await the real worker exit event, rather than relying on a mock port.
      expect(await workers[1]!.exited).toBe(0);
      expect(releases).toBe(1);
      expect(runner.activeJobId).toBeNull();
      expect(accountants[1]!.snapshot()).toMatchObject({ currentBytes: 0, reservationCount: 0 });
      // Initial 32 + owner preview 32 + actual thread's `reserve` 64.
      // This proves the worker's reservation was processed before its exit.
      expect(accountants[1]!.snapshot().peakBytes).toBe(128);
      expect(verified).toEqual({ label: "previous-verified" });

      const retry = runner.start(options("ok", "verified-retry"));
      verified = (await retry.promise).value;
      expect(verified).toEqual({ label: "verified-retry" });
      expect(retry.preflight.state).toBe("supported");
    } finally {
      runner.dispose();
      await Promise.all(workers.map(({ exited }) => exited));
    }
    expect(workers).toHaveLength(3);
    expect(workers.every((entry) => entry.terminationCalls() === 1 && entry.subscriptionsAfterCleanup() === 0)).toBe(true);
    expect(workers.every((entry) => entry.exitCodes.length === 1 && entry.thread.listenerCount("exit") === 0)).toBe(true);
    expect(accountants.every((entry) => entry.snapshot().currentBytes === 0)).toBe(true);
    expect(workers.every((entry) => entry.thread.listenerCount("message") === 0 && entry.thread.listenerCount("error") === 0)).toBe(true);
  }, 12000);

  it("does not interrupt a legitimate 175ms worker job with an invented deadline", async () => {
    const { runner, workers, accountants } = fixture();
    try {
      const long = runner.start(options("slow", "legitimate-long-work"));
      const completed = await long.promise;
      expect(completed.value).toEqual({ label: "legitimate-long-work" });
      expect(completed.metrics.peakAccountedWorkingSetBytes).toBe(96);
      expect(completed.metrics.finalAccountedWorkingSetBytes).toBe(0);
    } finally {
      runner.dispose();
      await Promise.all(workers.map(({ exited }) => exited));
    }
    expect(accountants[0]!.snapshot().currentBytes).toBe(0);
    expect(workers[0]!.terminationCalls()).toBe(1);
    expect(workers[0]!.subscriptionsAfterCleanup()).toBe(0);
  }, 12000);

  it("cancellation settles once, detaches exit watcher and ignores subsequent terminate-exit", async () => {
    const { runner, workers, accountants } = fixture();
    let releases = 0;
    const signal = new AbortController();
    try {
      const pending = runner.start(options("blocked", "cancelled", () => { releases++; }, signal.signal));
      signal.abort();
      await expect(pending.promise).rejects.toMatchObject({ name: "AbortError" });
      expect(runner.activeJobId).toBeNull();
    } finally {
      runner.dispose();
      await Promise.all(workers.map(({ exited }) => exited));
    }
    expect(workers[0]!.terminationCalls()).toBe(1);
    expect(workers[0]!.subscriptionsAfterCleanup()).toBe(0);
    expect(accountants[0]!.snapshot().currentBytes).toBe(0);
    expect(releases).toBe(1);
  }, 12000);
});
