/** #246 pre-worker APNG safety and bounded input inspection. Real 2-frame
 * APNG and genuine local Tesseract are covered in the sibling browser test.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IMAGE_OCR_FEASIBILITY } from "../src/engines/ocr/image-feasibility";
import { recognizeLocalItalianOcr246 } from "../src/engines/ocr/local-italian-246";

const path = resolve(import.meta.dirname, "..", IMAGE_OCR_FEASIBILITY.verifiedFixture);
const capabilities = { worker: true, wasm: true, "image-decode": true } as const;
const fakeDimensions = async () => ({ width: 1280, height: 240 });
const validFile = async (): Promise<File> =>
  new File([await readFile(path)], "fattura.png", { type: "image/png" });

function combine(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
  let at = 0;
  for (const part of parts) { result.set(part, at); at += part.length; }
  return result;
}

function pngCrc(data: Uint8Array): number {
  let crc = 0xffff_ffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb8_8320 : 0);
  }
  return (crc ^ 0xffff_ffff) >>> 0;
}
function pngChunk(type: string, body: Uint8Array): Uint8Array {
  const output = new Uint8Array(body.length + 12);
  new DataView(output.buffer).setUint32(0, body.length, false);
  for (let i = 0; i < 4; i++) output[4 + i] = type.charCodeAt(i);
  output.set(body, 8);
  new DataView(output.buffer).setUint32(output.length - 4, pngCrc(output.subarray(4, output.length - 4)), false);
  return output;
}
function asFile(bytes: Uint8Array): File {
  return new File([new Uint8Array(bytes)], "fattura.png", { type: "image/png" });
}
async function refuseBeforeWorker(file: File, pattern: RegExp): Promise<void> {
  const createWorker = vi.fn();
  const decoder = vi.fn(fakeDimensions);
  await expect(recognizeLocalItalianOcr246(file, { createWorker, imageDecoder: decoder, capabilities }))
    .rejects.toThrow(pattern);
  expect(decoder).not.toHaveBeenCalled();
  expect(createWorker).not.toHaveBeenCalled();
}
function bounded<T>(promise: Promise<T>, ms = 450): Promise<T> {
  return new Promise((resolve, reject) => {
    const watchdog = setTimeout(() => reject(new Error("OCR246_TEST_PREWORKER_STALLED")), ms);
    void promise.then(
      value => { clearTimeout(watchdog); resolve(value); },
      error => { clearTimeout(watchdog); reject(error); },
    );
  });
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("#246 animated or malformed PNG cannot silently load a Tesseract worker", () => {
  it("rejects a valid-CRC APNG animation control immediately after genuine IHDR", async () => {
    const clean = new Uint8Array(await readFile(path));
    const animation = new Uint8Array(8);
    const view = new DataView(animation.buffer);
    view.setUint32(0, 2, false);
    view.setUint32(4, 0, false);
    const apng = combine(clean.subarray(0, 33), pngChunk("acTL", animation), clean.subarray(33));
    await refuseBeforeWorker(asFile(apng), /OCR246_ANIMATED_PNG_UNSUPPORTED/u);
  });

  it("rejects plausible extra bytes after the PNG trailer although the original decodable picture survives", async () => {
    const clean = new Uint8Array(await readFile(path));
    const trailing = combine(clean, new TextEncoder().encode("SECOND_FRAME_HIDDEN_AFTER_IEND"));
    await refuseBeforeWorker(asFile(trailing), /OCR246_INVALID_PNG_CONTAINER/u);
  });

  it("bounds adversarial chains of very small chunks before model/native decoder allocation", async () => {
    const clean = new Uint8Array(await readFile(path));
    const chunk = pngChunk("tEXt", new Uint8Array());
    const many = new Uint8Array(chunk.length * 16_385);
    for (let at = 0; at < many.length; at += chunk.length) many.set(chunk, at);
    const flood = combine(clean.subarray(0, 33), many, clean.subarray(33));
    expect(flood.length).toBeLessThan(IMAGE_OCR_FEASIBILITY.fileHardLimitBytes);
    await refuseBeforeWorker(asFile(flood), /OCR246_INVALID_PNG_CONTAINER/u);
  }, 10_000);

  it("honors abortion while the bounded whole-container read is still pending", async () => {
    const image = await validFile();
    const real = await image.arrayBuffer();
    let release!: (value: ArrayBuffer) => void;
    let entered!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    vi.spyOn(image, "arrayBuffer").mockImplementation(() => {
      entered();
      return new Promise<ArrayBuffer>(resolve => { release = resolve; });
    });
    const signal = new AbortController();
    const createWorker = vi.fn();
    const decoder = vi.fn(fakeDimensions);
    const job = recognizeLocalItalianOcr246(image, { signal: signal.signal, createWorker, imageDecoder: decoder, capabilities });
    await bounded(started);
    signal.abort();
    await expect(bounded(job)).rejects.toMatchObject({ name: "AbortError" });
    release(real);
    await new Promise(done => setTimeout(done, 0));
    expect(decoder).not.toHaveBeenCalled();
    expect(createWorker).not.toHaveBeenCalled();
  });

  it("enforces the job timeout during a pending PNG container read", async () => {
    const image = await validFile();
    vi.spyOn(image, "arrayBuffer").mockImplementation(async () => new Promise<ArrayBuffer>(() => {}));
    const createWorker = vi.fn();
    await expect(bounded(recognizeLocalItalianOcr246(image, {
      timeoutMs: 20, createWorker, imageDecoder: fakeDimensions, capabilities,
    }))).rejects.toThrow(/OCR246_TIMEOUT/u);
    expect(createWorker).not.toHaveBeenCalled();
  });
});
