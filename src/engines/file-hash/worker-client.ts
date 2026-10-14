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

function ownedPacket(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.hasOwn(record, key);
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
    const requestedAlgorithm = options.algorithm ?? "SHA-256";
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      options.signal?.removeEventListener("abort", onAbort);
      // Previously queued Worker events may still be delivered after
      // terminate(). They belong to a settled job and cannot update progress
      // or publish a second outcome, even when the captured callback runs.
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
      callback();
    };
    const onAbort = () => finish(() => reject(new DOMException("Operation cancelled", "AbortError")));
    options.signal?.addEventListener("abort", onAbort, { once: true });

    // A caller-provided Worker factory may synchronously abort while creating
    // the worker. The first signal check happens before that factory runs.
    if (options.signal?.aborted) {
      onAbort();
      return;
    }

    worker.onerror = (event) => {
      finish(() => reject(new FileHashError("WORKER_FAILURE", event.message || "Hash worker failed.")));
    };
    worker.onmessage = (event) => {
      if (settled) return;
      // postMessage() data is an unchecked structured clone at runtime:
      // a TypeScript union does not establish message provenance or bounds.
      const message = event.data as unknown;
      const invalid = () => finish(() => reject(new FileHashError("WORKER_FAILURE", "Invalid hash worker response.")));
      if (!ownedPacket(message)) { invalid(); return; }
      const packet = message as Record<string, unknown>;
      if (!hasOwn(packet, "type")) { invalid(); return; }
      if (packet.type === "progress") {
        const progress = packet.progress;
        if (!ownedPacket(progress)) { invalid(); return; }
        const update = progress as Record<string, unknown>;
        if (!hasOwn(update, "bytesHashed") || !hasOwn(update, "totalBytes") || !hasOwn(update, "fraction") ||
            !Number.isSafeInteger(update.bytesHashed) || !Number.isSafeInteger(update.totalBytes) ||
            update.totalBytes !== blob.size || (update.bytesHashed as number) < lastProgressBytes ||
            (update.bytesHashed as number) > blob.size || typeof update.fraction !== "number" ||
            !Number.isFinite(update.fraction) || update.fraction < 0 || update.fraction > 1 ||
            Math.abs(update.fraction - (blob.size === 0 ? 1 : (update.bytesHashed as number) / blob.size)) > 1e-12) {
          invalid(); return;
        }
        lastProgressBytes = update.bytesHashed as number;
        try {
          options.onProgress?.(update as unknown as HashProgress);
        } catch {
          invalid();
        }
        return;
      }
      if (packet.type === "failure") {
        const code = packet.code === "UNSUPPORTED_ALGORITHM" || packet.code === "READ_FAILURE"
          ? packet.code
          : "WORKER_FAILURE";
        finish(() => reject(new FileHashError(code, typeof packet.message === "string" ? packet.message : "Hash worker failed.")));
        return;
      }
      if (packet.type !== "success" || !hasOwn(packet, "result") || !ownedPacket(packet.result)) {
        invalid(); return;
      }
      const result = packet.result as Record<string, unknown>;
      if (!hasOwn(result, "algorithm") || !hasOwn(result, "bytesHashed") || !hasOwn(result, "digestHex") ||
          result.algorithm !== "SHA-256" || result.algorithm !== requestedAlgorithm || result.bytesHashed !== blob.size ||
          typeof result.digestHex !== "string" || !/^[0-9a-f]{64}$/u.test(result.digestHex)) {
        invalid(); return;
      }
      finish(() => resolve(result as unknown as HashResult));
    };

    const request: HashWorkerRequest = {
      type: "hash",
      blob,
      algorithm: requestedAlgorithm,
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
