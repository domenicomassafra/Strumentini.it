import { assertRegexRequestBounds, regexTestOperation } from "./encoding-crypto";
import type { DeveloperWebResult } from "./types";

export const REGEX_EXECUTION_TIMEOUT_MS = 750;

export interface RegexWorkerRequest {
  readonly type: "regex-test";
  readonly pattern: string;
  readonly flags: string;
  readonly text: string;
  readonly replacement?: string;
}

export type RegexWorkerResponse =
  | { readonly type: "success"; readonly result: DeveloperWebResult }
  | { readonly type: "failure"; readonly message: string };

export interface RegexWorkerPort {
  onmessage: ((event: MessageEvent<RegexWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: RegexWorkerRequest): void;
  terminate(): void;
}

export interface RegexWorkerOptions {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly createWorker?: () => RegexWorkerPort;
}

export class RegexExecutionError extends Error {
  readonly code: "REGEX_TIMEOUT" | "REGEX_WORKER_FAILURE";

  constructor(code: RegexExecutionError["code"], message: string) {
    super(`${code}: ${message}`);
    this.name = "RegexExecutionError";
    this.code = code;
  }
}

function defaultWorker(): RegexWorkerPort {
  if (typeof Worker === "undefined") {
    throw new RegexExecutionError("REGEX_WORKER_FAILURE", "Il browser non rende disponibile l'esecuzione isolata richiesta.");
  }
  return new Worker(new URL("./regex-worker.ts", import.meta.url), { type: "module" });
}

export function regexTestInWorker(
  request: Omit<RegexWorkerRequest, "type">,
  options: RegexWorkerOptions = {},
): Promise<DeveloperWebResult> {
  assertRegexRequestBounds(request.pattern, request.text);
  if (options.signal?.aborted) return Promise.reject(new DOMException("Operation cancelled", "AbortError"));

  return new Promise((resolve, reject) => {
    let worker: RegexWorkerPort;
    try {
      worker = (options.createWorker ?? defaultWorker)();
    } catch (error) {
      reject(error instanceof RegexExecutionError
        ? error
        : new RegexExecutionError("REGEX_WORKER_FAILURE", error instanceof Error ? error.message : "Avvio del worker non riuscito."));
      return;
    }

    let settled = false;
    const timeoutMs = options.timeoutMs ?? REGEX_EXECUTION_TIMEOUT_MS;
    const timer = globalThis.setTimeout(() => {
      finish(() => reject(new RegexExecutionError("REGEX_TIMEOUT", `L'esecuzione ha superato il limite di ${timeoutMs} ms.`)));
    }, timeoutMs);
    const finish = (callback: () => void): void => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
      worker.terminate();
      callback();
    };
    const onAbort = (): void => finish(() => reject(new DOMException("Operation cancelled", "AbortError")));
    options.signal?.addEventListener("abort", onAbort, { once: true });

    worker.onerror = (event) => {
      finish(() => reject(new RegexExecutionError("REGEX_WORKER_FAILURE", event.message || "Il worker regex è terminato in modo inatteso.")));
    };
    worker.onmessage = (event) => {
      const message = event.data;
      if (message.type === "failure") {
        finish(() => reject(new Error(message.message)));
        return;
      }
      finish(() => resolve(message.result));
    };

    try {
      worker.postMessage({ type: "regex-test", ...request });
    } catch (error) {
      finish(() => reject(new RegexExecutionError("REGEX_WORKER_FAILURE", error instanceof Error ? error.message : "Invio al worker non riuscito.")));
    }
  });
}

export async function regexTestOperationBounded(
  pattern: string,
  flags: string,
  text: string,
  replacement?: string,
  signal?: AbortSignal,
): Promise<DeveloperWebResult> {
  assertRegexRequestBounds(pattern, text);
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
  if (typeof Worker === "undefined" && typeof window === "undefined") {
    return regexTestOperation(pattern, flags, text, replacement);
  }
  return regexTestInWorker(
    { pattern, flags, text, ...(replacement === undefined ? {} : { replacement }) },
    signal === undefined ? {} : { signal },
  );
}
