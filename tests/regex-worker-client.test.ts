import { describe, expect, it } from "vitest";
import {
  RegexExecutionError,
  regexTestInWorker,
  type RegexWorkerPort,
  type RegexWorkerRequest,
  type RegexWorkerResponse,
} from "../src/engines/developer-web/regex-worker-client";

class ControlledRegexWorker implements RegexWorkerPort {
  onmessage: ((event: MessageEvent<RegexWorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly posted: RegexWorkerRequest[] = [];
  terminateCount = 0;

  postMessage(message: RegexWorkerRequest): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.terminateCount += 1;
  }

  succeed(result: RegexWorkerResponse & { type: "success" }): void {
    this.onmessage?.({ data: result } as MessageEvent<RegexWorkerResponse>);
  }
}

describe("regex isolated worker execution", () => {
  it("returns a benign result and terminates the worker exactly once", async () => {
    const worker = new ControlledRegexWorker();
    const pending = regexTestInWorker(
      { pattern: "a+", flags: "g", text: "aaa" },
      { createWorker: () => worker, timeoutMs: 100 },
    );
    expect(worker.posted).toEqual([{ type: "regex-test", pattern: "a+", flags: "g", text: "aaa" }]);
    worker.succeed({ type: "success", result: { valid: true, matchCount: 1 } });
    await expect(pending).resolves.toMatchObject({ valid: true, matchCount: 1 });
    expect(worker.terminateCount).toBe(1);
  });

  it("hard-times out a non-responsive worker with a distinct operational error", async () => {
    const worker = new ControlledRegexWorker();
    const pending = regexTestInWorker(
      { pattern: "^(a|aa)+$", flags: "", text: `${"a".repeat(40)}b` },
      { createWorker: () => worker, timeoutMs: 5 },
    );
    await expect(pending).rejects.toMatchObject({ code: "REGEX_TIMEOUT", name: "RegexExecutionError" } satisfies Partial<RegexExecutionError>);
    expect(worker.terminateCount).toBe(1);
  });

  it("cancels by terminating the worker and reports AbortError rather than timeout", async () => {
    const worker = new ControlledRegexWorker();
    const controller = new AbortController();
    const pending = regexTestInWorker(
      { pattern: "a", flags: "", text: "a" },
      { createWorker: () => worker, timeoutMs: 100, signal: controller.signal },
    );
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(worker.terminateCount).toBe(1);
  });

  it("rejects oversized input before any worker can be created", () => {
    let workerCreated = false;
    expect(() => regexTestInWorker(
      { pattern: "a", flags: "", text: "a".repeat(100_001) },
      { createWorker: () => { workerCreated = true; return new ControlledRegexWorker(); } },
    )).toThrow(/INVALID_INPUT_TOO_LARGE/u);
    expect(workerCreated).toBe(false);
  });
});
