import { FileHashError, type HashProgress, type HashResult } from "./index";

export interface HashWorkerPort {
  onmessage: ((event: MessageEvent<HashWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: HashWorkerRequest): void;
  terminate(): void;
}

export type HashWorkerRequest = {
  type: "hash";
  blob: Blob;
  algorithm: string;
  chunkSize?: number;
};

export type HashWorkerResponse =
  | { type: "progress"; progress: HashProgress }
  | { type: "success"; result: HashResult }
  | { type: "failure"; code: string; message: string };

export interface HashBlobInWorkerOptions {
  algorithm?: string;
  chunkSize?: number;
  signal?: AbortSignal;
  onProgress?: (progress: HashProgress) => void;
  createWorker?: () => HashWorkerPort;
}

function defaultWorker(): HashWorkerPort {
  return new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.hasOwn(record, key);
}

function isValidResult(value: unknown, algorithm: string, byteCount: number): value is HashResult {
  return isRecord(value)
    && hasOwn(value, "algorithm") && value.algorithm === "SHA-256" && value.algorithm === algorithm
    && hasOwn(value, "bytesHashed") && Number.isSafeInteger(value.bytesHashed) && value.bytesHashed === byteCount
    && hasOwn(value, "digestHex") && typeof value.digestHex === "string" && /^[0-9a-f]{64}$/u.test(value.digestHex);
}

function isValidProgress(value: unknown, byteCount: number, previousBytes: number): value is HashProgress {
  if (!isRecord(value) || !hasOwn(value, "bytesHashed") || !hasOwn(value, "totalBytes") || !hasOwn(value, "fraction")) {
    return false;
  }
  return Number.isSafeInteger(value.bytesHashed)
    && (value.bytesHashed as number) >= previousBytes
    && (value.bytesHashed as number) <= byteCount
    && value.totalBytes === byteCount
    && typeof value.fraction === "number"
    && Number.isFinite(value.fraction)
    && value.fraction === (byteCount === 0 ? 1 : (value.bytesHashed as number) / byteCount);
}

export function hashBlobInWorker(
  blob: Blob,
  options: HashBlobInWorkerOptions = {},
): Promise<HashResult> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(new DOMException("Operation cancelled", "AbortError"));
      return;
    }

    let worker: HashWorkerPort;
    try {
      worker = (options.createWorker ?? defaultWorker)();
    } catch (error) {
      reject(new FileHashError(
        "WORKER_FAILURE",
        error instanceof Error ? `Unable to start hash worker: ${error.message}` : "Unable to start hash worker.",
      ));
      return;
    }
    let settled = false;
    let lastProgressBytes = 0;
    const algorithm = options.algorithm ?? "SHA-256";
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      options.signal?.removeEventListener("abort", onAbort);
      worker.onmessage = null;
      worker.onerror = null;
      try {
        worker.terminate();
      } catch {
        reject(new FileHashError("WORKER_FAILURE", "Unable to terminate hash worker."));
        return;
      }
      callback();
    };
    const onAbort = () => finish(() => reject(new DOMException("Operation cancelled", "AbortError")));
    options.signal?.addEventListener("abort", onAbort, { once: true });

    // createWorker may abort the signal before the listener can be installed.
    if (options.signal?.aborted) {
      onAbort();
      return;
    }

    worker.onerror = (event) => {
      finish(() => reject(new FileHashError("WORKER_FAILURE", event.message || "Hash worker failed.")));
    };
    worker.onmessage = (event) => {
      if (settled) return;
      if (options.signal?.aborted) {
        onAbort();
        return;
      }
      const message: unknown = event.data;
      if (!isRecord(message) || !hasOwn(message, "type")) {
        finish(() => reject(new FileHashError("WORKER_FAILURE", "Invalid hash worker response.")));
        return;
      }
      if (message.type === "progress") {
        if (!hasOwn(message, "progress") || !isValidProgress(message.progress, blob.size, lastProgressBytes)) {
          finish(() => reject(new FileHashError("WORKER_FAILURE", "Invalid hash worker progress.")));
          return;
        }
        lastProgressBytes = message.progress.bytesHashed;
        try {
          options.onProgress?.(message.progress);
        } catch {
          finish(() => reject(new FileHashError("WORKER_FAILURE", "Unable to report hash progress.")));
        }
        return;
      }
      if (message.type === "failure") {
        if (!hasOwn(message, "message") || typeof message.message !== "string") {
          finish(() => reject(new FileHashError("WORKER_FAILURE", "Invalid hash worker failure response.")));
          return;
        }
        const failureMessage = message.message;
        const code = hasOwn(message, "code") && (message.code === "UNSUPPORTED_ALGORITHM" || message.code === "READ_FAILURE")
          ? message.code
          : "WORKER_FAILURE";
        finish(() => reject(new FileHashError(code, failureMessage)));
        return;
      }
      if (message.type !== "success" || !hasOwn(message, "result") || !isValidResult(message.result, algorithm, blob.size)) {
        finish(() => reject(new FileHashError("WORKER_FAILURE", "Invalid hash worker success response.")));
        return;
      }
      const result = message.result;
      finish(() => resolve(result));
    };

    const request: HashWorkerRequest = {
      type: "hash",
      blob,
      algorithm,
      ...(options.chunkSize === undefined ? {} : { chunkSize: options.chunkSize }),
    };
    try {
      worker.postMessage(request);
    } catch (error) {
      finish(() => reject(new FileHashError(
        "WORKER_FAILURE",
        error instanceof Error ? `Unable to start hash operation: ${error.message}` : "Unable to start hash operation.",
      )));
    }
  });
}
