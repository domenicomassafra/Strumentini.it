import { afterEach, describe, expect, it, vi } from "vitest";
import { repairPdfInWorker418 } from "../src/engines/pdf/repair-worker-client-418";

const previousWorker = Object.getOwnPropertyDescriptor(globalThis, "Worker");
afterEach(() => {
  vi.useRealTimers();
  if (previousWorker) Object.defineProperty(globalThis, "Worker", previousWorker);
  else Reflect.deleteProperty(globalThis, "Worker");
});

function installHungWorker() {
  const created: Array<{ terminated: boolean; transferCount: number }> = [];
  class HungWorker {
    onerror: ((error: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    private readonly state = { terminated: false, transferCount: 0 };
    constructor() { created.push(this.state); }
    postMessage(_payload: unknown, transfer: Transferable[]) {
      this.state.transferCount += transfer.length;
    }
    terminate() { this.state.terminated = true; }
  }
  Object.defineProperty(globalThis, "Worker", { configurable: true, value: HungWorker });
  return created;
}

describe("STR-418 worker isolation boundary", () => {
  it("terminates a hung worker at a hard wall timeout", async () => {
    const workers = installHungWorker();
    vi.useFakeTimers();
    const task = repairPdfInWorker418(new Uint8Array(150));
    const failure = expect(task).rejects.toThrow(/PDF418_TIMEOUT/);
    await vi.advanceTimersByTimeAsync(20_001);
    await failure;
    expect(workers).toEqual([{ terminated: true, transferCount: 1 }]);
  });

  it("terminates worker immediately on abort", async () => {
    const workers = installHungWorker();
    const controller = new AbortController();
    const task = repairPdfInWorker418(new Uint8Array(150), controller.signal);
    const failure = expect(task).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await failure;
    expect(workers).toEqual([{ terminated: true, transferCount: 1 }]);
  });

  it("ignores unrelated PDF.js messages until its tagged result arrives", async () => {
    const states: Array<{ terminated: boolean }> = [];
    class MixedWorker {
      onerror: ((error: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      private readonly state = { terminated: false };
      constructor() { states.push(this.state); }
      postMessage() {
        queueMicrotask(() => {
          this.onmessage?.({ data: { type: "ready", source: "pdfjs" } } as MessageEvent);
          this.onmessage?.({ data: {
            kind: "STR418_REPAIR_RESULT", ok: true,
            bytes: new Uint8Array(150), pageCount: 1, losses: [],
            profile: "single-classic-xref-pointer-only", originalBytes: 150, repairedBytes: 150,
          } } as MessageEvent);
        });
      }
      terminate() { this.state.terminated = true; }
    }
    Object.defineProperty(globalThis, "Worker", { configurable: true, value: MixedWorker });
    const repaired = await repairPdfInWorker418(new Uint8Array(150));
    expect(repaired.pageCount).toBe(1);
    expect(states).toEqual([{ terminated: true }]);
  });

  it("refuses oversized inputs before worker construction", async () => {
    const workers = installHungWorker();
    await expect(repairPdfInWorker418(new Uint8Array(4 * 1024 * 1024 + 1))).rejects.toThrow(/PDF418_LIMIT/);
    expect(workers).toEqual([]);
  });
});
