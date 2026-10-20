import { afterEach, describe, expect, it, vi } from "vitest";
import { runPdfImageWorker375 } from "../src/engines/pdf/image-worker-client-375";

const oldWorker = Object.getOwnPropertyDescriptor(globalThis, "Worker");
afterEach(() => {
  vi.useRealTimers();
  if (oldWorker) Object.defineProperty(globalThis, "Worker", oldWorker);
  else Reflect.deleteProperty(globalThis, "Worker");
});
const placement = { page: 1, x: 0.1, y: 0.1, width: 0.2, rotation: 0 as const };
const pdf = () => new File([new Uint8Array(100)], "example.pdf", { type: "application/pdf" });
const raster = () => new File([new Uint8Array(100)], "image.png", { type: "image/png" });

function workerStub(reply?: unknown) {
  const state = { terminated: 0, transferred: 0 };
  class Stub {
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    postMessage(_request: unknown, transfers: Transferable[]) {
      state.transferred = transfers.length;
      if (reply) queueMicrotask(() => this.onmessage?.({ data: reply } as MessageEvent));
    }
    terminate() { state.terminated++; }
  }
  Object.defineProperty(globalThis, "Worker", { configurable: true, value: Stub });
  return state;
}

describe("STR-375 image worker: limit, cancel, and failure isolation", () => {
  it("terminates the worker on abort without delivering a partial document", async () => {
    const state = workerStub();
    const controller = new AbortController();
    const task = runPdfImageWorker375(pdf(), raster(), placement, controller.signal);
    const failure = expect(task).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await failure;
    expect(state.terminated).toBe(1);
  });
  it("refuses oversize raster before any worker is allocated", async () => {
    const state = workerStub();
    await expect(runPdfImageWorker375(pdf(),
      new File([new Uint8Array(12 * 1024 * 1024 + 1)], "large.png"), placement))
      .rejects.toThrow(/12 MiB/);
    expect(state.terminated).toBe(0);
  });
  it("rejects malformed worker replies and terminates", async () => {
    const state = workerStub({ kind: "STR375_IMAGE", ok: true,
      bytes: new Uint8Array(2), pageCount: 1, filename: "bad.pdf" });
    await expect(runPdfImageWorker375(pdf(), raster(), placement)).rejects.toThrow(/PDF_VERIFY/);
    expect(state.terminated).toBe(1);
  });
  it("reuses bytes already read on a second save when local file reads become unavailable", async () => {
    const inputPdf = pdf(), inputImage = raster();
    const pdfRead = vi.spyOn(inputPdf, "arrayBuffer");
    const imageRead = vi.spyOn(inputImage, "arrayBuffer");
    workerStub({ kind: "STR375_IMAGE", ok: true, bytes: new Uint8Array(32),
      pageCount: 1, filename: "resaved.pdf" });
    await runPdfImageWorker375(inputPdf, inputImage, placement);
    pdfRead.mockRejectedValue(new Error("offline file read unavailable"));
    imageRead.mockRejectedValue(new Error("offline file read unavailable"));
    await expect(runPdfImageWorker375(inputPdf, inputImage, placement))
      .resolves.toMatchObject({ filename: "resaved.pdf", pageCount: 1 });
    expect(pdfRead).toHaveBeenCalledTimes(1);
    expect(imageRead).toHaveBeenCalledTimes(1);
  });

  it("terminates after the 60-second timeout", async () => {
    vi.useFakeTimers();
    const state = workerStub();
    const task = runPdfImageWorker375(pdf(), raster(), placement);
    const failure = expect(task).rejects.toThrow(/60 secondi/);
    await vi.advanceTimersByTimeAsync(60_001);
    await failure;
    expect(state.terminated).toBe(1);
  });
});
