import {
  detectHeavyJobCapabilities,
  preflightHeavyLocalJob,
  type HeavyJobCapabilitySnapshot,
  type HeavyJobInputMetadata,
  type HeavyJobPreflightPolicy,
  type HeavyJobPreflightResult,
  type HeavyJobResourceLimits,
} from "./heavy-preflight";

export const HEAVY_LOCAL_NETWORK_POLICY = "forbidden" as const;

export type HeavyLocalJobErrorCode =
  | "PREFLIGHT_REJECTED"
  | "WORKER_FAILURE"
  | "RESOURCE_LIMIT"
  | "PROTOCOL_ERROR"
  | "CLEANUP_FAILURE"
  | "DISPOSED";

export class HeavyLocalJobError extends Error {
  readonly code: HeavyLocalJobErrorCode;
  readonly preflight?: HeavyJobPreflightResult;
  readonly workerCode?: string;

  constructor(
    code: HeavyLocalJobErrorCode,
    message: string,
    options: { readonly preflight?: HeavyJobPreflightResult; readonly workerCode?: string } = {},
  ) {
    super(message);
    this.name = "HeavyLocalJobError";
    this.code = code;
    if (options.preflight !== undefined) this.preflight = options.preflight;
    if (options.workerCode !== undefined) this.workerCode = options.workerCode;
  }
}

export interface HeavyLocalJobRuntimePolicy extends HeavyJobPreflightPolicy {
  readonly limits: HeavyJobResourceLimits & {
    readonly hardInputBytes: number;
    readonly hardWorkingSetBytes: number;
  };
}

export interface HeavyLocalJobInputMetadata extends HeavyJobInputMetadata {
  readonly inputBytes: number;
  readonly estimatedWorkingSetBytes: number;
}

export type HeavyLocalJobProgress =
  | { readonly kind: "indeterminate"; readonly phase?: string }
  | { readonly kind: "determinate"; readonly fraction: number; readonly phase?: string };

export interface HeavyWorkerStartMessage<TRequest> {
  readonly type: "start";
  readonly jobId: number;
  readonly networkPolicy: typeof HEAVY_LOCAL_NETWORK_POLICY;
  readonly payload: TRequest;
}

export type HeavyWorkerResponse<TResult> =
  | { readonly type: "progress"; readonly jobId: number; readonly progress: HeavyLocalJobProgress }
  | {
    readonly type: "resource";
    readonly jobId: number;
    readonly action: "reserve";
    readonly resourceId: string;
    readonly bytes: number;
  }
  | {
    readonly type: "resource";
    readonly jobId: number;
    readonly action: "release";
    readonly resourceId: string;
  }
  | { readonly type: "success"; readonly jobId: number; readonly result: TResult }
  | { readonly type: "failure"; readonly jobId: number; readonly code?: string; readonly message: string };

export interface HeavyWorkerPort<TRequest, TResult> {
  onmessage: ((event: MessageEvent<HeavyWorkerResponse<TResult>>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: HeavyWorkerStartMessage<TRequest>, transfer?: readonly Transferable[]): void;
  terminate(): void;
}

export interface HeavyWorkerLease<TRequest, TResult> {
  readonly worker: HeavyWorkerPort<TRequest, TResult>;
  /** Optional for runtimes such as node:worker_threads that expose `exit`.
   * Native browser Workers have no exit event; no arbitrary job deadline is inferred. */
  readonly onExit?: (listener: (code: number) => void) => () => void;
  cleanup?(): void;
}

export interface HeavyLocalOwnedResource {
  readonly id: string;
  readonly bytes?: number;
  release(): void;
}

export interface HeavyJobResourceSnapshot {
  readonly currentBytes: number;
  readonly peakBytes: number;
  readonly hardLimitBytes: number;
  readonly reservationCount: number;
}

export interface HeavyJobResourceAccountant {
  reserve(resourceId: string, bytes: number): HeavyJobResourceSnapshot;
  release(resourceId: string): HeavyJobResourceSnapshot;
  reset(): HeavyJobResourceSnapshot;
  snapshot(): HeavyJobResourceSnapshot;
}

function finiteNonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${label} must be a finite non-negative number`);
  return value;
}

function finitePositive(value: number | undefined, label: string): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be an explicit finite positive number`);
  }
  return value;
}

class DefaultHeavyJobResourceAccountant implements HeavyJobResourceAccountant {
  readonly #hardLimitBytes: number;
  readonly #reservations = new Map<string, number>();
  #currentBytes: number;
  #peakBytes: number;

  constructor(hardLimitBytes: number, initialBytes: number) {
    this.#hardLimitBytes = finitePositive(hardLimitBytes, "hardWorkingSetBytes");
    this.#currentBytes = finiteNonNegative(initialBytes, "initialWorkingSetBytes");
    if (this.#currentBytes > this.#hardLimitBytes) {
      throw new HeavyLocalJobError(
        "RESOURCE_LIMIT",
        `Initial accounted working set is ${this.#currentBytes} bytes, above the hard limit of ${this.#hardLimitBytes} bytes.`,
      );
    }
    this.#peakBytes = this.#currentBytes;
  }

  reserve(resourceId: string, bytes: number): HeavyJobResourceSnapshot {
    if (resourceId.length === 0) throw new HeavyLocalJobError("PROTOCOL_ERROR", "Resource id cannot be empty.");
    if (this.#reservations.has(resourceId)) {
      throw new HeavyLocalJobError("PROTOCOL_ERROR", `Resource is already reserved: ${resourceId}.`);
    }
    const normalized = finiteNonNegative(bytes, `resource ${resourceId} bytes`);
    const next = this.#currentBytes + normalized;
    if (!Number.isSafeInteger(next) || next > this.#hardLimitBytes) {
      throw new HeavyLocalJobError(
        "RESOURCE_LIMIT",
        `Resource ${resourceId} would raise the accounted working set to ${next} bytes, above the hard limit of ${this.#hardLimitBytes} bytes.`,
      );
    }
    this.#reservations.set(resourceId, normalized);
    this.#currentBytes = next;
    this.#peakBytes = Math.max(this.#peakBytes, this.#currentBytes);
    return this.snapshot();
  }

  release(resourceId: string): HeavyJobResourceSnapshot {
    const bytes = this.#reservations.get(resourceId);
    if (bytes === undefined) throw new HeavyLocalJobError("PROTOCOL_ERROR", `Unknown resource release: ${resourceId}.`);
    this.#reservations.delete(resourceId);
    this.#currentBytes -= bytes;
    return this.snapshot();
  }

  reset(): HeavyJobResourceSnapshot {
    this.#reservations.clear();
    this.#currentBytes = 0;
    return this.snapshot();
  }

  snapshot(): HeavyJobResourceSnapshot {
    return {
      currentBytes: this.#currentBytes,
      peakBytes: this.#peakBytes,
      hardLimitBytes: this.#hardLimitBytes,
      reservationCount: this.#reservations.size,
    };
  }
}

export function createHeavyJobResourceAccountant(
  hardLimitBytes: number,
  initialBytes = 0,
): HeavyJobResourceAccountant {
  return new DefaultHeavyJobResourceAccountant(hardLimitBytes, initialBytes);
}

export interface HeavyLocalJobMetrics {
  readonly jobId: number;
  readonly durationMs: number;
  readonly progressEvents: number;
  readonly peakAccountedWorkingSetBytes: number;
  readonly accountedBytesReleasedOnCleanup: number;
  readonly finalAccountedWorkingSetBytes: number;
}

export interface HeavyLocalJobCompletion<TResult> {
  readonly value: TResult;
  readonly preflight: HeavyJobPreflightResult;
  readonly metrics: HeavyLocalJobMetrics;
}

export interface HeavyLocalJobExecution<TResult> {
  readonly jobId: number;
  readonly preflight: HeavyJobPreflightResult;
  readonly promise: Promise<HeavyLocalJobCompletion<TResult>>;
  cancel(): void;
}

export interface HeavyLocalJobStartOptions<TRequest> {
  readonly request: TRequest;
  readonly input: HeavyLocalJobInputMetadata;
  readonly initialWorkingSetBytes?: number;
  readonly transfer?: readonly Transferable[];
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: HeavyLocalJobProgress) => void;
  readonly ownedResources?: readonly HeavyLocalOwnedResource[];
}

export interface HeavyLocalJobRunnerOptions<TRequest, TResult> {
  readonly policy: HeavyLocalJobRuntimePolicy;
  readonly createWorker: () => HeavyWorkerLease<TRequest, TResult>;
  readonly detectCapabilities?: () => HeavyJobCapabilitySnapshot;
  readonly createResourceAccountant?: (hardLimitBytes: number, initialBytes: number) => HeavyJobResourceAccountant;
  readonly now?: () => number;
}

interface ActiveRun<TRequest, TResult> {
  readonly jobId: number;
  readonly workerLease: HeavyWorkerLease<TRequest, TResult>;
  readonly accountant: HeavyJobResourceAccountant;
  readonly ownedResources: readonly HeavyLocalOwnedResource[];
  readonly preflight: HeavyJobPreflightResult;
  readonly startedAt: number;
  readonly resolve: (value: HeavyLocalJobCompletion<TResult>) => void;
  readonly reject: (reason: unknown) => void;
  readonly signal?: AbortSignal;
  abortListener?: () => void;
  unsubscribeExit?: () => void;
  readonly onProgress?: (progress: HeavyLocalJobProgress) => void;
  settled: boolean;
  progressEvents: number;
  lastDeterminateFraction: number | null;
}

function abortError(message = "Operation cancelled"): Error {
  if (typeof DOMException !== "undefined") return new DOMException(message, "AbortError");
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function normalizePolicy(policy: HeavyLocalJobRuntimePolicy): HeavyLocalJobRuntimePolicy {
  finitePositive(policy.limits.hardInputBytes, "hardInputBytes");
  finitePositive(policy.limits.hardWorkingSetBytes, "hardWorkingSetBytes");
  return {
    ...policy,
    capabilities: {
      ...policy.capabilities,
      worker: "required",
    },
  };
}

function releaseOwnedResources(resources: readonly HeavyLocalOwnedResource[]): Error[] {
  const errors: Error[] = [];
  for (const resource of resources) {
    try {
      resource.release();
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }
  }
  return errors;
}

function throwCleanupFailure(errors: readonly Error[]): void {
  if (errors.length === 0) return;
  throw new HeavyLocalJobError("CLEANUP_FAILURE", `Heavy job cleanup failed: ${errors[0]?.message ?? "unknown cleanup error"}.`);
}

function protocolProgress(progress: HeavyLocalJobProgress, lastFraction: number | null): number | null {
  if (progress.kind === "indeterminate") return lastFraction;
  if (!Number.isFinite(progress.fraction) || progress.fraction < 0 || progress.fraction > 1) {
    throw new HeavyLocalJobError("PROTOCOL_ERROR", "Determinate worker progress must be a finite fraction from 0 to 1.");
  }
  if (lastFraction !== null && progress.fraction < lastFraction) {
    throw new HeavyLocalJobError(
      "PROTOCOL_ERROR",
      `Determinate worker progress regressed from ${lastFraction} to ${progress.fraction}.`,
    );
  }
  return progress.fraction;
}

export function createHeavyLocalJobRunner<TRequest, TResult>(
  options: HeavyLocalJobRunnerOptions<TRequest, TResult>,
) {
  const policy = normalizePolicy(options.policy);
  const detectCapabilities = options.detectCapabilities ?? detectHeavyJobCapabilities;
  const createAccountant = options.createResourceAccountant ?? createHeavyJobResourceAccountant;
  const now = options.now ?? (() => performance.now());
  let generation = 0;
  let active: ActiveRun<TRequest, TResult> | null = null;
  let disposed = false;

  function cleanup(run: ActiveRun<TRequest, TResult>): { readonly before: HeavyJobResourceSnapshot; readonly after: HeavyJobResourceSnapshot; readonly errors: Error[] } {
    const errors: Error[] = [];
    if (run.signal !== undefined && run.abortListener !== undefined) {
      run.signal.removeEventListener("abort", run.abortListener);
    }
    if (run.unsubscribeExit !== undefined) {
      try {
        run.unsubscribeExit();
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
      run.unsubscribeExit = undefined;
    }
    run.workerLease.worker.onmessage = null;
    run.workerLease.worker.onerror = null;
    try {
      run.workerLease.worker.terminate();
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }
    if (run.workerLease.cleanup !== undefined) {
      try {
        run.workerLease.cleanup();
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }
    errors.push(...releaseOwnedResources(run.ownedResources));
    const before = run.accountant.snapshot();
    let after = before;
    try {
      after = run.accountant.reset();
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }
    return { before, after, errors };
  }

  function settleFailure(run: ActiveRun<TRequest, TResult>, error: unknown): void {
    if (run.settled) return;
    run.settled = true;
    if (active === run) active = null;
    const cleaned = cleanup(run);
    if (cleaned.errors.length > 0 && !(error instanceof HeavyLocalJobError && error.code === "CLEANUP_FAILURE")) {
      run.reject(new HeavyLocalJobError("CLEANUP_FAILURE", `Heavy job cleanup failed: ${cleaned.errors[0]?.message ?? "unknown cleanup error"}.`));
      return;
    }
    run.reject(error);
  }

  function cancelRun(run: ActiveRun<TRequest, TResult>, message = "Operation cancelled"): void {
    settleFailure(run, abortError(message));
  }

  function start(startOptions: HeavyLocalJobStartOptions<TRequest>): HeavyLocalJobExecution<TResult> {
    if (disposed) throw new HeavyLocalJobError("DISPOSED", "Heavy local-job runner has been disposed.");
    const ownedResources = startOptions.ownedResources ?? [];
    if (startOptions.signal?.aborted) {
      throwCleanupFailure(releaseOwnedResources(ownedResources));
      throw abortError();
    }

    let preflight: HeavyJobPreflightResult;
    try {
      preflight = preflightHeavyLocalJob(policy, startOptions.input, detectCapabilities());
    } catch (error) {
      throwCleanupFailure(releaseOwnedResources(ownedResources));
      throw error;
    }
    if (preflight.state === "unsupported") {
      throwCleanupFailure(releaseOwnedResources(ownedResources));
      throw new HeavyLocalJobError(
        "PREFLIGHT_REJECTED",
        preflight.reasons[0] ?? "Heavy local job is unsupported by the current capability/resource policy.",
        { preflight },
      );
    }

    let initialWorkingSetBytes: number;
    try {
      initialWorkingSetBytes = finiteNonNegative(
        startOptions.initialWorkingSetBytes ?? startOptions.input.inputBytes,
        "initialWorkingSetBytes",
      );
    } catch (error) {
      throwCleanupFailure(releaseOwnedResources(ownedResources));
      throw error;
    }
    let accountant: HeavyJobResourceAccountant;
    try {
      accountant = createAccountant(policy.limits.hardWorkingSetBytes, initialWorkingSetBytes);
    } catch (error) {
      throwCleanupFailure(releaseOwnedResources(ownedResources));
      throw error;
    }
    try {
      for (const resource of ownedResources) {
        if (resource.id.length === 0) throw new HeavyLocalJobError("PROTOCOL_ERROR", "Owned resource id cannot be empty.");
        if (resource.bytes !== undefined) accountant.reserve(`main:${resource.id}`, resource.bytes);
      }
    } catch (error) {
      const cleanupErrors = releaseOwnedResources(ownedResources);
      accountant.reset();
      throwCleanupFailure(cleanupErrors);
      throw error;
    }

    const workerLease = (() => {
      try {
        return options.createWorker();
      } catch (error) {
        const cleanupErrors = releaseOwnedResources(ownedResources);
        accountant.reset();
        throwCleanupFailure(cleanupErrors);
        throw new HeavyLocalJobError(
          "WORKER_FAILURE",
          error instanceof Error ? `Unable to start heavy local worker: ${error.message}` : "Unable to start heavy local worker.",
        );
      }
    })();

    const jobId = ++generation;
    let resolvePromise!: (value: HeavyLocalJobCompletion<TResult>) => void;
    let rejectPromise!: (reason: unknown) => void;
    const promise = new Promise<HeavyLocalJobCompletion<TResult>>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });
    const run: ActiveRun<TRequest, TResult> = {
      jobId,
      workerLease,
      accountant,
      ownedResources,
      preflight,
      startedAt: now(),
      resolve: resolvePromise,
      reject: rejectPromise,
      ...(startOptions.signal === undefined ? {} : { signal: startOptions.signal }),
      ...(startOptions.onProgress === undefined ? {} : { onProgress: startOptions.onProgress }),
      settled: false,
      progressEvents: 0,
      lastDeterminateFraction: null,
    };
    const failCurrent = (error: unknown) => {
      if (active !== run || run.settled) return;
      settleFailure(run, error);
    };

    const abortListener = () => cancelRun(run);
    if (startOptions.signal !== undefined) {
      run.abortListener = abortListener;
      startOptions.signal.addEventListener("abort", abortListener, { once: true });
    }

    workerLease.worker.onerror = (event) => {
      failCurrent(new HeavyLocalJobError("WORKER_FAILURE", event.message || "Heavy local worker failed."));
    };
    workerLease.worker.onmessage = (event) => {
      if (active !== run || run.settled) return;
      const message = event.data;
      // A worker can send any structured-clone value at runtime, regardless
      // of its TypeScript response type. Never dereference a null/primitive
      // packet outside the guarded failure path: it would strand the worker,
      // owned previews and its pending promise until an unrelated abort.
      if (typeof message !== "object" || message === null || Array.isArray(message) ||
        !Number.isSafeInteger(message.jobId)) {
        failCurrent(new HeavyLocalJobError("PROTOCOL_ERROR", "Heavy worker sent a malformed message envelope."));
        return;
      }
      if (message.jobId !== run.jobId) return;
      try {
        if (message.type === "progress") {
          run.lastDeterminateFraction = protocolProgress(message.progress, run.lastDeterminateFraction);
          run.progressEvents += 1;
          run.onProgress?.(message.progress);
          return;
        }
        if (message.type === "resource") {
          if (message.action === "reserve") run.accountant.reserve(`worker:${message.resourceId}`, message.bytes);
          else run.accountant.release(`worker:${message.resourceId}`);
          return;
        }
        if (message.type === "failure") {
          failCurrent(new HeavyLocalJobError(
            "WORKER_FAILURE",
            message.message,
            message.code === undefined ? {} : { workerCode: message.code },
          ));
          return;
        }
        if (message.type !== "success") {
          failCurrent(new HeavyLocalJobError("PROTOCOL_ERROR", "Heavy worker emitted an unknown message type."));
          return;
        }

        const accountingBeforeCleanup = run.accountant.snapshot();
        run.settled = true;
        active = null;
        const cleaned = cleanup(run);
        if (cleaned.errors.length > 0) {
          run.reject(new HeavyLocalJobError("CLEANUP_FAILURE", `Heavy job cleanup failed: ${cleaned.errors[0]?.message ?? "unknown cleanup error"}.`));
          return;
        }
        run.resolve({
          value: message.result,
          preflight: run.preflight,
          metrics: {
            jobId: run.jobId,
            durationMs: Math.max(0, now() - run.startedAt),
            progressEvents: run.progressEvents,
            peakAccountedWorkingSetBytes: accountingBeforeCleanup.peakBytes,
            accountedBytesReleasedOnCleanup: cleaned.before.currentBytes,
            finalAccountedWorkingSetBytes: cleaned.after.currentBytes,
          },
        });
      } catch (error) {
        failCurrent(error);
      }
    };

    const startMessage: HeavyWorkerStartMessage<TRequest> = {
      type: "start",
      jobId,
      networkPolicy: HEAVY_LOCAL_NETWORK_POLICY,
      payload: startOptions.request,
    };
    // Worker creation and listener installation can synchronously trigger an
    // AbortSignal. Never post a job that was already cancelled, and never
    // supersede a valid prior run with an invalid or already-aborted candidate.
    if (startOptions.signal?.aborted) {
      cancelRun(run);
    } else {
      if (active !== null) cancelRun(active, "Operation superseded by a newer heavy local job");
      active = run;
      try {
        // Worker error events do not cover a normal node:worker_threads
        // exit(0). If the lease can observe exit, settle before an owner-owned
        // preview or resource reservation is stranded without terminal reply.
        if (workerLease.onExit !== undefined) {
          const unsubscribeExit = workerLease.onExit((code) => {
            failCurrent(new HeavyLocalJobError(
              "WORKER_FAILURE", `Heavy local worker exited without a terminal reply (code ${code}).`,
            ));
          });
          // A lease adapter may report an already observed exit immediately
          // during subscription. Do not retain that listener after settlement.
          if (run.settled) unsubscribeExit();
          else run.unsubscribeExit = unsubscribeExit;
        }
        if (active === run && !run.settled) workerLease.worker.postMessage(startMessage, startOptions.transfer);
      } catch (error) {
        failCurrent(new HeavyLocalJobError(
          "WORKER_FAILURE",
          error instanceof Error ? `Unable to start heavy local job: ${error.message}` : "Unable to start heavy local job.",
        ));
      }
    }

    return {
      jobId,
      preflight,
      promise,
      cancel: () => {
        if (active === run) cancelRun(run);
      },
    };
  }

  return {
    start,
    cancel(): void {
      if (active !== null) cancelRun(active);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      if (active !== null) cancelRun(active, "Heavy local-job runner disposed");
    },
    get activeJobId(): number | null {
      return active?.jobId ?? null;
    },
  };
}

export interface ObjectUrlWorkerEnvironment<TRequest, TResult> {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
  createWorker(url: string): HeavyWorkerPort<TRequest, TResult>;
}

export function createObjectUrlHeavyWorkerLease<TRequest, TResult>(
  script: Blob,
  environment?: ObjectUrlWorkerEnvironment<TRequest, TResult>,
): HeavyWorkerLease<TRequest, TResult> {
  const runtime = environment ?? {
    createObjectURL: (blob: Blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url: string) => URL.revokeObjectURL(url),
    createWorker: (url: string) => new Worker(url, { type: "module" }) as unknown as HeavyWorkerPort<TRequest, TResult>,
  };
  const url = runtime.createObjectURL(script);
  let cleaned = false;
  try {
    const worker = runtime.createWorker(url);
    return {
      worker,
      cleanup() {
        if (cleaned) return;
        cleaned = true;
        runtime.revokeObjectURL(url);
      },
    };
  } catch (error) {
    runtime.revokeObjectURL(url);
    throw error;
  }
}
