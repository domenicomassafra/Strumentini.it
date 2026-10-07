import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  HEAVY_LOCAL_NETWORK_POLICY,
  createHeavyLocalJobRunner,
  type HeavyLocalJobRuntimePolicy,
  type HeavyWorkerPort,
  type HeavyWorkerResponse,
  type HeavyWorkerStartMessage,
} from "../src/runtime/heavy-local-job";
import type { HeavyJobCapabilitySnapshot } from "../src/runtime/heavy-preflight";

type Request = { readonly scenario: string };
type Result = { readonly scenario: string };

const root = resolve(import.meta.dirname, "..");
const outputDir = resolve(root, "quality/benchmarks/heavy-local-runtime");
const allCapabilities: HeavyJobCapabilitySnapshot = { worker: true, wasm: true, "image-decode": true };
const policy: HeavyLocalJobRuntimePolicy = {
  capabilities: { worker: "required" },
  limits: { hardInputBytes: 8 * 1024 * 1024, hardWorkingSetBytes: 16 * 1024 * 1024 },
};

class ControlledWorker implements HeavyWorkerPort<Request, Result> {
  onmessage: ((event: MessageEvent<HeavyWorkerResponse<Result>>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly posted: HeavyWorkerStartMessage<Request>[] = [];
  terminateCount = 0;

  postMessage(message: HeavyWorkerStartMessage<Request>): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.terminateCount += 1;
  }

  emit(message: HeavyWorkerResponse<Result>): void {
    this.onmessage?.({ data: message } as MessageEvent<HeavyWorkerResponse<Result>>);
  }
}

function clock() {
  let value = 1_000;
  return () => value += 7;
}

async function successScenario() {
  const worker = new ControlledWorker();
  let cleanupCount = 0;
  let resourceReleaseCount = 0;
  const progress: unknown[] = [];
  const runner = createHeavyLocalJobRunner<Request, Result>({
    policy,
    detectCapabilities: () => allCapabilities,
    createWorker: () => ({ worker, cleanup: () => { cleanupCount += 1; } }),
    now: clock(),
  });
  const execution = runner.start({
    request: { scenario: "success" },
    input: { inputBytes: 2 * 1024 * 1024, estimatedWorkingSetBytes: 6 * 1024 * 1024 },
    initialWorkingSetBytes: 2 * 1024 * 1024,
    ownedResources: [{ id: "preview", bytes: 512 * 1024, release: () => { resourceReleaseCount += 1; } }],
    onProgress: (value) => progress.push(value),
  });
  worker.emit({ type: "progress", jobId: execution.jobId, progress: { kind: "indeterminate", phase: "decode" } });
  worker.emit({ type: "resource", jobId: execution.jobId, action: "reserve", resourceId: "decoded", bytes: 4 * 1024 * 1024 });
  worker.emit({ type: "progress", jobId: execution.jobId, progress: { kind: "determinate", fraction: 0.5, phase: "transform" } });
  worker.emit({ type: "resource", jobId: execution.jobId, action: "release", resourceId: "decoded" });
  worker.emit({ type: "success", jobId: execution.jobId, result: { scenario: "success" } });
  const completion = await execution.promise;
  return {
    status: "PASS",
    startProtocol: worker.posted[0],
    progress,
    metrics: completion.metrics,
    cleanup: { terminateCount: worker.terminateCount, leaseCleanupCount: cleanupCount, ownedResourceReleaseCount: resourceReleaseCount },
  };
}

async function cancellationRetryScenario() {
  const workers: ControlledWorker[] = [];
  let cleanupCount = 0;
  let resourceReleaseCount = 0;
  const runner = createHeavyLocalJobRunner<Request, Result>({
    policy,
    detectCapabilities: () => allCapabilities,
    createWorker: () => {
      const worker = new ControlledWorker();
      workers.push(worker);
      return { worker, cleanup: () => { cleanupCount += 1; } };
    },
    now: clock(),
  });

  const first = runner.start({
    request: { scenario: "cancelled" },
    input: { inputBytes: 1024, estimatedWorkingSetBytes: 4096 },
    ownedResources: [{ id: "input-buffer", bytes: 1024, release: () => { resourceReleaseCount += 1; } }],
  });
  const firstWorker = workers[0];
  if (firstWorker === undefined) throw new Error("first controlled worker missing");
  const staleHandler = firstWorker.onmessage;
  first.cancel();
  let cancelName = "";
  try {
    await first.promise;
  } catch (error) {
    cancelName = error instanceof Error ? error.name : String(error);
  }

  const second = runner.start({
    request: { scenario: "retry" },
    input: { inputBytes: 1024, estimatedWorkingSetBytes: 4096 },
  });
  const secondWorker = workers[1];
  if (secondWorker === undefined) throw new Error("second controlled worker missing");
  staleHandler?.({ data: { type: "success", jobId: first.jobId, result: { scenario: "STALE" } } } as MessageEvent<HeavyWorkerResponse<Result>>);
  const activeAfterStale = runner.activeJobId;
  secondWorker.emit({ type: "success", jobId: second.jobId, result: { scenario: "retry" } });
  const completion = await second.promise;
  return {
    status:
      cancelName === "AbortError" &&
      activeAfterStale === second.jobId &&
      completion.value.scenario === "retry" &&
      resourceReleaseCount === 1
        ? "PASS"
        : "FAIL",
    firstJobId: first.jobId,
    secondJobId: second.jobId,
    cancelName,
    activeAfterStale,
    staleSuppressed: activeAfterStale === second.jobId,
    workers: workers.map((worker) => ({ terminateCount: worker.terminateCount })),
    cleanupCount,
    resourceReleaseCount,
  };
}

async function resourceLimitScenario() {
  const worker = new ControlledWorker();
  const runtimePolicy: HeavyLocalJobRuntimePolicy = {
    limits: { hardInputBytes: 4 * 1024 * 1024, hardWorkingSetBytes: 5 * 1024 * 1024 },
  };
  const runner = createHeavyLocalJobRunner<Request, Result>({
    policy: runtimePolicy,
    detectCapabilities: () => allCapabilities,
    createWorker: () => ({ worker }),
    now: clock(),
  });
  const execution = runner.start({
    request: { scenario: "resource-limit" },
    input: { inputBytes: 2 * 1024 * 1024, estimatedWorkingSetBytes: 4 * 1024 * 1024 },
  });
  worker.emit({ type: "resource", jobId: execution.jobId, action: "reserve", resourceId: "decoded", bytes: 3 * 1024 * 1024 + 1 });
  let code = "";
  try {
    await execution.promise;
  } catch (error) {
    code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "UNKNOWN";
  }
  return { status: code === "RESOURCE_LIMIT" && worker.terminateCount === 1 ? "PASS" : "FAIL", code, terminateCount: worker.terminateCount };
}

function preflightScenario() {
  let workerCreated = 0;
  const runner = createHeavyLocalJobRunner<Request, Result>({
    policy,
    detectCapabilities: () => allCapabilities,
    createWorker: () => {
      workerCreated += 1;
      return { worker: new ControlledWorker() };
    },
  });
  let code = "";
  try {
    runner.start({
      request: { scenario: "preflight" },
      input: { inputBytes: 8 * 1024 * 1024 + 1, estimatedWorkingSetBytes: 10 * 1024 * 1024 },
    });
  } catch (error) {
    code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "UNKNOWN";
  }
  return { status: code === "PREFLIGHT_REJECTED" && workerCreated === 0 ? "PASS" : "FAIL", code, workerCreated };
}

const receipt = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  revision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  scope: "controlled heavy-local runtime acceptance; no codec/provider/network dependency is loaded",
  networkPolicy: HEAVY_LOCAL_NETWORK_POLICY,
  resourceAccounting: "explicit main-thread initial bytes + owned resources + worker reserve/release messages; hard working-set breach terminates worker",
  scenarios: {
    success: await successScenario(),
    cancellationRetry: await cancellationRetryScenario(),
    resourceLimit: await resourceLimitScenario(),
    preflight: preflightScenario(),
  },
};

const failed = Object.entries(receipt.scenarios).filter(([, scenario]) => scenario.status !== "PASS");
if (failed.length > 0) throw new Error(`heavy local runtime acceptance failed: ${failed.map(([name]) => name).join(", ")}`);
await mkdir(outputDir, { recursive: true });
const output = resolve(outputDir, "controlled-runtime.json");
await writeFile(output, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output, scenarios: Object.fromEntries(Object.entries(receipt.scenarios).map(([name, scenario]) => [name, scenario.status])) }, null, 2));
