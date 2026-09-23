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
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      options.signal?.removeEventListener("abort", onAbort);
      worker.terminate();
      callback();
    };
    const onAbort = () => finish(() => reject(new DOMException("Operation cancelled", "AbortError")));
    options.signal?.addEventListener("abort", onAbort, { once: true });

    worker.onerror = (event) => {
      finish(() => reject(new FileHashError("WORKER_FAILURE", event.message || "Hash worker failed.")));
    };
    worker.onmessage = (event) => {
      const message = event.data;
      if (message.type === "progress") {
        options.onProgress?.(message.progress);
        return;
      }
      if (message.type === "failure") {
        const code = message.code === "UNSUPPORTED_ALGORITHM" || message.code === "READ_FAILURE"
          ? message.code
          : "WORKER_FAILURE";
        finish(() => reject(new FileHashError(code, message.message)));
        return;
      }
      finish(() => resolve(message.result));
    };

    const request: HashWorkerRequest = {
      type: "hash",
      blob,
      algorithm: options.algorithm ?? "SHA-256",
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
