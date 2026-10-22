import { afterEach, describe, expect, it, vi } from "vitest";
import { EPUB_WORKER_TIMEOUT_422, readEpubInWorker422 } from "../src/engines/epub/worker-boundary-422";
import epubModule from "../src/tools/epub-reader/module";

const example = () => new File(["EPUB bytes"], "book.epub", { type: "application/epub+zip" });
class FakeWorker {
  static current: FakeWorker;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor() { FakeWorker.current = this; }
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("STR-422 hard Worker boundary for all EPUB callers", () => {
  it("terminates a hung decoder at an absolute deadline with no result", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", FakeWorker);
    const promise = readEpubInWorker422(example());
    const assertion = expect(promise).rejects.toThrow("EPUB_TIMEOUT");
    await vi.advanceTimersByTimeAsync(EPUB_WORKER_TIMEOUT_422);
    await assertion;
    expect(FakeWorker.current.postMessage).toHaveBeenCalledTimes(1);
    expect(FakeWorker.current.terminate).toHaveBeenCalledTimes(1);
  });
  it("aborts a decoder by termination without publishing late success", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const controller = new AbortController();
    const promise = readEpubInWorker422(example(), controller.signal);
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(FakeWorker.current.terminate).toHaveBeenCalledTimes(1);
  });
  it("returns inert books and propagates parser refusals", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const safe = { title: "Libro", chapters: [{ id: "c1", title: "Capitolo", text: "Testo" }], allText: "Testo",
      source: "EPUB3 locale · solo testo · nessuna risorsa eseguita" } as const;
    const success = readEpubInWorker422(example());
    FakeWorker.current.onmessage?.({ data: { ok: true, book: safe } } as MessageEvent);
    await expect(success).resolves.toEqual(safe);
    expect(FakeWorker.current.terminate).toHaveBeenCalledTimes(1);
    const refusal = readEpubInWorker422(example());
    FakeWorker.current.onmessage?.({ data: { ok: false, code: "EPUB_ACTIVE_RESOURCE" } } as MessageEvent);
    await expect(refusal).rejects.toThrow("EPUB_ACTIVE_RESOURCE");
    expect(FakeWorker.current.terminate).toHaveBeenCalledTimes(1);
  });
  it("fails closed without Worker, also in the runtime module", async () => {
    vi.stubGlobal("Worker", undefined);
    await expect(readEpubInWorker422(example())).rejects.toThrow("EPUB_WORKER_UNAVAILABLE");
    await expect(epubModule.run({ file: example() }, { defaults: {} })).rejects.toThrow("EPUB_WORKER_UNAVAILABLE");
  });
});
