import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { IMAGE_OCR_FEASIBILITY } from "../src/engines/ocr/image-feasibility";
import { recognizeLocalItalianOcr246, OCR_LOCAL_ASSETS_246 } from "../src/engines/ocr/local-italian-246";

const full = resolve(import.meta.dirname, "..", IMAGE_OCR_FEASIBILITY.verifiedFixture);
const capabilities = { worker: true, wasm: true, "image-decode": true } as const;
const input = async () => new File([await readFile(full)], "fattura.png", { type: "image/png" });
const imageDecoder = async (_: File) => ({ width: 1280, height: 240 });

describe("#246 local Italian OCR actual worker adapter (experimental, no production promotion)", () => {
  it("never starts any worker on unsupported language, oversized input or aborted signal", async () => {
    const createWorker = vi.fn(async () => { throw new Error("must not initialize"); });
    const img = await input();
    await expect(recognizeLocalItalianOcr246(img, { language: "eng", createWorker, imageDecoder, capabilities })).rejects.toThrow(/OCR_LANGUAGE_NOT_ACCEPTED/u);
    await expect(recognizeLocalItalianOcr246(img, { rotateClockwiseDegrees: 45 as 90, createWorker, imageDecoder, capabilities })).rejects.toThrow(/OCR246_INVALID_ROTATION/u);
    await expect(recognizeLocalItalianOcr246(new File([new Uint8Array(IMAGE_OCR_FEASIBILITY.fileHardLimitBytes + 1)], "huge.png", { type: "image/png" }), { createWorker, imageDecoder, capabilities })).rejects.toThrow(/OCR_FILE_LIMIT/u);
    const abort = new AbortController(); abort.abort();
    await expect(recognizeLocalItalianOcr246(img, { signal: abort.signal, createWorker, imageDecoder, capabilities })).rejects.toMatchObject({ name: "AbortError" });
    expect(createWorker).not.toHaveBeenCalled();
  });

  it("returns real worker-provided Italian text/confidence and terminates worker on success", async () => {
    const terminate = vi.fn(async () => {});
    const recognize = vi.fn(async () => ({ data: { text: "Fattura numero 12345 - Totale euro 678,90\n", confidence: 94.37 } }));
    const createWorker = vi.fn(async () => ({ recognize, terminate }));
    const res = await recognizeLocalItalianOcr246(await input(), { createWorker, imageDecoder, capabilities });
    expect(res).toMatchObject({ language: "ita", text: "Fattura numero 12345 - Totale euro 678,90", confidence: 94.37,
      rotateClockwiseDegrees: 0,
      confidenceOrigin: "TESSERACT_ENGINE_SCORE_NOT_CALIBRATED", image: { name: "fattura.png", width: 1280, height: 240 },
      onDevice: true });
    expect(createWorker).toHaveBeenCalledTimes(1);
    expect(recognize).toHaveBeenCalledOnce();
    expect(terminate).toHaveBeenCalledOnce();
  });

  it("preserves null confidence instead of inventing a score, and always cleans up on OCR errors", async () => {
    const terminate = vi.fn(async () => {});
    const res = await recognizeLocalItalianOcr246(await input(), {
      createWorker: async () => ({ recognize: async () => ({ data: { text: "ciao", confidence: Number.NaN } }), terminate }),
      imageDecoder, capabilities,
    });
    expect(res.confidence).toBeNull();
    const failTerminate = vi.fn(async () => {});
    await expect(recognizeLocalItalianOcr246(await input(), {
      createWorker: async () => ({ recognize: async () => { throw new Error("OCR_WASM_ERROR"); }, terminate: failTerminate }),
      imageDecoder, capabilities,
    })).rejects.toThrow(/OCR_WASM_ERROR/u);
    expect(terminate).toHaveBeenCalledOnce();
    expect(failTerminate).toHaveBeenCalledOnce();
  });

  it("aborts an active recognition, terminates worker and does not return stale text", async () => {
    const abort = new AbortController();
    const terminate = vi.fn(async () => {});
    const job = recognizeLocalItalianOcr246(await input(), { signal: abort.signal,
      createWorker: async () => ({ recognize: async () => new Promise<never>(() => {}), terminate }),
      imageDecoder, capabilities,
    });
    await new Promise((done) => setTimeout(done, 20));
    abort.abort();
    await expect(job).rejects.toMatchObject({ name: "AbortError" });
    expect(terminate).toHaveBeenCalledOnce();
  });

  it("explicitly same-origin vendor URLs, complete LSTM core variants and no CDN fallbacks", () => {
    expect(OCR_LOCAL_ASSETS_246.modelUrl).toBe("/ocr-246/lang/ita.traineddata.gz");
    expect(OCR_LOCAL_ASSETS_246.workerUrl).toBe("/ocr-246/vendor/worker.min.js");
    expect(OCR_LOCAL_ASSETS_246.coreUrl).toBe("/ocr-246/core");
    expect(OCR_LOCAL_ASSETS_246.productionPromotion).toMatch(/REFUSED_271/u);
  });
});
