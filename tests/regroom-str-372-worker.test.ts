import { afterEach, describe, expect, it, vi } from "vitest";
import { runPdfWorkspaceWorker372 } from "../src/engines/pdf/workspace-worker-client-372";

const previous = Object.getOwnPropertyDescriptor(globalThis, "Worker");
afterEach(() => {
  vi.useRealTimers();
  if (previous) Object.defineProperty(globalThis, "Worker", previous);
  else Reflect.deleteProperty(globalThis, "Worker");
});
function source() { return new File([new Uint8Array(100)], "proof.pdf", { type: "application/pdf" }); }
function mockWorker(reply?: unknown) {
  const state = { terminated: false, transfers: 0 };
  class WorkerStub {
    onerror: ((e: Event) => void) | null = null;
    onmessage: ((e: MessageEvent) => void) | null = null;
    postMessage(_data: unknown, transfer: Transferable[]) {
      state.transfers += transfer.length;
      if (reply) queueMicrotask(() => this.onmessage?.({ data: reply } as MessageEvent));
    }
    terminate() { state.terminated = true; }
  }
  Object.defineProperty(globalThis, "Worker", { configurable: true, value: WorkerStub });
  return state;
}

describe("STR-372 disposable PDF worker", () => {
  it("aborts immediately and terminates even after source bytes are loaded", async () => {
    const state = mockWorker();
    const controller = new AbortController();
    const operation = runPdfWorkspaceWorker372(source(), [1], [], "reorder", controller.signal);
    const rejected = expect(operation).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await rejected;
    expect(state.terminated).toBe(true);
  });
  it("rejects oversized input before constructing a Worker", async () => {
    const state = mockWorker();
    const file = new File([new Uint8Array(25 * 1024 * 1024 + 1)], "huge.pdf");
    await expect(runPdfWorkspaceWorker372(file, [1], [], "reorder")).rejects.toThrow(/25 MiB/);
    expect(state.transfers).toBe(0);
  });
  it("rejects malformed successful replies and terminates without a download", async () => {
    const state = mockWorker({ kind: "STR372_WORKSPACE", ok: true, bytes: new Uint8Array([1, 2]), filename: "x.pdf", pageCount: 2 });
    await expect(runPdfWorkspaceWorker372(source(), [1], [], "reorder")).rejects.toThrow(/non valido/);
    expect(state.terminated).toBe(true);
  });
  it("enforces the 60-second wall timeout and releases the Worker", async () => {
    vi.useFakeTimers();
    const state = mockWorker();
    const operation = runPdfWorkspaceWorker372(source(), [1], [], "reorder");
    const failure = expect(operation).rejects.toThrow(/Timeout/);
    await vi.advanceTimersByTimeAsync(60_001);
    await failure;
    expect(state.terminated).toBe(true);
  });
});
