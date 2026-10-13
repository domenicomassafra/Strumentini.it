import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IMAGE_OCR_FEASIBILITY } from "../src/engines/ocr/image-feasibility";
import { recognizeLocalItalianOcr246 } from "../src/engines/ocr/local-italian-246";

const full = resolve(import.meta.dirname, "..", IMAGE_OCR_FEASIBILITY.verifiedFixture);
const capabilities = { worker: true, wasm: true, "image-decode": true } as const;
const input = async () => new File([await readFile(full)], "fattura.png", { type: "image/png" });
const validDimensions = { width: 1280, height: 240 };

// A hung image API must never leave a test/job pending forever.
function bounded<T>(job: Promise<T>, ms = 350): Promise<T> {
  return new Promise((resolve, reject) => {
    const watchdog = setTimeout(() => reject(new Error("OCR246_TEST_WATCHDOG_UNSETTLED")), ms);
    void job.then(
      (value) => { clearTimeout(watchdog); resolve(value); },
      (error: unknown) => { clearTimeout(watchdog); reject(error); },
    );
  });
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("#246 cancellation and deadline before local OCR worker allocation", () => {
  it("interrupts an injected never-resolving image decoder on abort", async () => {
    const signal = new AbortController();
    const createWorker = vi.fn();
    let decoderEntered!: () => void;
    const entered = new Promise<void>((resolve) => { decoderEntered = resolve; });
    const job = recognizeLocalItalianOcr246(await input(), {
      signal: signal.signal, capabilities, createWorker,
      imageDecoder: async () => { decoderEntered(); return new Promise(() => {}); },
    });
    await bounded(entered);
    signal.abort();
    await expect(bounded(job)).rejects.toMatchObject({ name: "AbortError" });
    expect(createWorker).not.toHaveBeenCalled();
  });

  it("times out a never-resolving decoder before loading the OCR runtime", async () => {
    const createWorker = vi.fn();
    const job = recognizeLocalItalianOcr246(await input(), {
      timeoutMs: 25, capabilities, createWorker, imageDecoder: async () => new Promise(() => {}),
    });
    await expect(bounded(job)).rejects.toThrow(/OCR246_TIMEOUT/u);
    expect(createWorker).not.toHaveBeenCalled();
  });

  it("closes a native decoder bitmap even if it appears after the job deadline", async () => {
    const close = vi.fn();
    const createWorker = vi.fn();
    let releaseBitmap!: (bitmap: { width: number; height: number; close: () => void }) => void;
    let decodingEntered!: () => void;
    const entered = new Promise<void>((resolve) => { decodingEntered = resolve; });
    vi.stubGlobal("createImageBitmap", () => {
      decodingEntered();
      return new Promise((resolve) => { releaseBitmap = resolve; });
    });
    const job = recognizeLocalItalianOcr246(await input(), { timeoutMs: 30, capabilities, createWorker });
    await bounded(entered);
    await expect(bounded(job)).rejects.toThrow(/OCR246_TIMEOUT/u);
    releaseBitmap({ ...validDimensions, close });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(close).toHaveBeenCalledOnce();
    expect(createWorker).not.toHaveBeenCalled();
  });

  it("interrupts an unfinished PNG header read and cannot start a worker after its late completion", async () => {
    const image = await input();
    const header = await image.slice(0, 33).arrayBuffer();
    let releaseHeader!: (bytes: ArrayBuffer) => void;
    let readEntered!: () => void;
    const entered = new Promise<void>((resolve) => { readEntered = resolve; });
    const pendingHeader = new Promise<ArrayBuffer>((resolve) => { releaseHeader = resolve; });
    vi.spyOn(image, "slice").mockImplementation(() => {
      readEntered();
      return { arrayBuffer: () => pendingHeader } as Blob;
    });
    const controller = new AbortController();
    const createWorker = vi.fn();
    const job = recognizeLocalItalianOcr246(image, {
      signal: controller.signal, capabilities, createWorker,
      imageDecoder: async () => validDimensions,
    });
    await bounded(entered);
    controller.abort();
    await expect(bounded(job)).rejects.toMatchObject({ name: "AbortError" });
    releaseHeader(header);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(createWorker).not.toHaveBeenCalled();
  });

  it("closes a bitmap decoded after cancellation during rotation and never starts a worker", async () => {
    const controller = new AbortController();
    const createWorker = vi.fn();
    const close = vi.fn();
    let releaseBitmap!: (bitmap: { width: number; height: number; close: () => void }) => void;
    let bitmapEntered!: () => void;
    const entered = new Promise<void>((resolve) => { bitmapEntered = resolve; });
    vi.stubGlobal("createImageBitmap", () => {
      bitmapEntered();
      return new Promise((resolve) => { releaseBitmap = resolve; });
    });
    const job = recognizeLocalItalianOcr246(await input(), {
      rotateClockwiseDegrees: 90, capabilities, createWorker,
      imageDecoder: async () => validDimensions, signal: controller.signal,
    });
    await bounded(entered);
    controller.abort();
    await expect(bounded(job)).rejects.toMatchObject({ name: "AbortError" });
    releaseBitmap({ ...validDimensions, close });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(close).toHaveBeenCalledOnce();
    expect(createWorker).not.toHaveBeenCalled();
  });

  it("ends a pending canvas PNG encode on timeout and closes the decoded bitmap", async () => {
    const close = vi.fn();
    const createWorker = vi.fn();
    const drawImage = vi.fn();
    let encodingEntered!: () => void;
    const entered = new Promise<void>((resolve) => { encodingEntered = resolve; });
    let lateEncode!: (result: Blob | null) => void;
    const canvas = {
      width: 0, height: 0,
      getContext: () => ({ translate: vi.fn(), rotate: vi.fn(), drawImage }),
      toBlob: (callback: (result: Blob | null) => void) => { lateEncode = callback; encodingEntered(); },
    };
    vi.stubGlobal("document", { createElement: () => canvas });
    vi.stubGlobal("createImageBitmap", async () => ({ ...validDimensions, close }));
    const job = recognizeLocalItalianOcr246(await input(), {
      timeoutMs: 35, rotateClockwiseDegrees: 90, capabilities, createWorker,
      imageDecoder: async () => validDimensions,
    });
    await bounded(entered);
    await expect(bounded(job)).rejects.toThrow(/OCR246_TIMEOUT/u);
    expect(drawImage).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    lateEncode(new Blob(["late"], { type: "image/png" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(createWorker).not.toHaveBeenCalled();
  });
});
