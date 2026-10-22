import { checkPortraitInput, checkPortraitPng, PORTRAIT_MAX_FILE_BYTES } from "./portrait-modnet-274";
import type { RawImage } from "@huggingface/transformers";

type Request = { kind: "start"; bytes?: ArrayBuffer; mime: string; memoryGB?: number; reuse?: boolean };
let running = false;
let warmedInput: { image: RawImage; bytes: number; mime: string } | null = null;

self.onmessage = async (event: MessageEvent<Request>) => {
  if (running || event.data.kind !== "start") return;
  running = true;
  try {
    const { bytes, mime, memoryGB, reuse } = event.data;
    if (!(["image/jpeg", "image/png", "image/webp"] as string[]).includes(mime)
      || (bytes && bytes.byteLength > PORTRAIT_MAX_FILE_BYTES)) throw new Error("UNSUPPORTED_IMAGE");
    if (reuse && (!warmedInput || warmedInput.mime !== mime)) throw new Error("WARM_INPUT_MISSING");
    if (!reuse && !bytes) throw new Error("INPUT_MISSING");

    self.postMessage({ kind: "progress", message: "Caricamento modello e WebAssembly locali…" });
    const { env, pipeline, RawImage } = await import("@huggingface/transformers");
    // The donor accepts RawImage directly. Retain the already-decoded RGBA
    // inside this Worker for the same file: WebKit's Blob decoder can become
    // unavailable after the user switches the browser context offline.
    const original = reuse ? warmedInput!.image : await RawImage.fromBlob(new Blob([bytes!], { type: mime }));
    const width = original.width;
    const height = original.height;
    const originalByteLength = reuse ? warmedInput!.bytes : bytes!.byteLength;
    checkPortraitInput(originalByteLength, width, height, memoryGB);
    if (!reuse) warmedInput = { image: original, bytes: originalByteLength, mime };
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    // Transformers.js 4.3.1's processor auto-detection checks local paths only
    // when they are not absolute URLs. Worker fetch, however, needs an absolute URL.
    // Bridge precisely our same-origin model path, leaving upstream code untouched.
    env.localModelPath = "/models/";
    const nativeFetch = self.fetch.bind(self);
    env.fetch = (input, init) => {
      if (typeof input === "string" && input.startsWith("/models/")) {
        return nativeFetch(new URL(input, self.location.origin), init);
      }
      return nativeFetch(input, init);
    };
    // WebKit accepts model downloads but does not retain the donor's relative
    // CacheStorage keys. An absolute same-origin key works across engines and
    // lets a new Worker use models downloaded by the previous one.
    if (typeof caches !== "undefined") {
      try {
        const modelCache = await caches.open("portrait-modnet-274");
        const localCacheKey = (key: string): string => {
          const url = new URL(key, self.location.origin);
          if (url.origin !== self.location.origin || !url.pathname.startsWith("/models/portrait-modnet/")) {
            throw new Error("CACHE_PATH_INVALID");
          }
          return url.href;
        };
        env.useCustomCache = true;
        env.customCache = {
          match: (key) => modelCache.match(localCacheKey(key)),
          put: (key, response) => modelCache.put(localCacheKey(key), response),
        };
      } catch {
        // Private browsing or storage quotas may make offline reuse unavailable.
        // Inference still uses only the same-origin local model files.
      }
    }
    const wasm = env.backends.onnx.wasm;
    if (!wasm) throw new Error("WASM_UNAVAILABLE");
    wasm.wasmPaths = {
      mjs: `${self.location.origin}/vendor/portrait-modnet/ort-wasm-simd-threaded.mjs`,
      wasm: `${self.location.origin}/vendor/portrait-modnet/ort-wasm-simd-threaded.wasm`,
    };
    wasm.numThreads = 1;
    const segmenter = await pipeline("background-removal", "portrait-modnet", {
      device: "wasm", dtype: "q8", local_files_only: true,
      progress_callback: (value) => {
        const progress = value as { status?: string; progress?: number };
        if (progress.status === "progress") {
          self.postMessage({ kind: "progress", message: `Caricamento asset locali: ${Math.round(progress.progress ?? 0)}%` });
        }
      },
    });
    self.postMessage({ kind: "progress", message: "Calcolo alpha matte sul dispositivo…" });
    const output = await segmenter(original);
    if (!output || output.width !== width || output.height !== height || output.channels !== 4
      || output.data.length !== width * height * 4) throw new Error("MASK_INVALID");
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("CANVAS_UNAVAILABLE");
    // The donor's putAlpha() replaces any alpha originally present in a PNG or
    // WebP. Preserve user-provided transparency by intersecting that alpha with
    // the predicted matte (a fully transparent input pixel stays transparent).
    const originalPixels = original.data;
    const rgba = new Uint8ClampedArray(output.data);
    let transparent = 0;
    let mixed = 0;
    let opaque = 0;
    for (let i = 3; i < rgba.length; i += 4) {
      const predictedAlpha = rgba[i];
      const sourceAlpha = originalPixels[i];
      if (predictedAlpha === undefined || sourceAlpha === undefined) throw new Error("MASK_INVALID");
      rgba[i] = Math.round(predictedAlpha * sourceAlpha / 255);
      if (rgba[i] === 0) transparent++;
      else if (rgba[i] === 255) opaque++;
      else mixed++;
    }
    if (transparent + mixed === 0 || opaque + mixed === 0) throw new Error("MASK_DEGENERATE");
    ctx.putImageData(new ImageData(rgba, width, height), 0, 0);
    const png = await canvas.convertToBlob({ type: "image/png" });
    const result = await png.arrayBuffer();
    checkPortraitPng(new Uint8Array(result), width, height);
    // Independent browser decoding, after the PNG encoder, must preserve alpha.
    if (!reuse) {
      const roundtrip = await createImageBitmap(new Blob([result], { type: "image/png" }));
      const verified = roundtrip.width === width && roundtrip.height === height;
      roundtrip.close();
      if (!verified) throw new Error("PNG_READBACK_FAILED");
    }
    await segmenter.dispose();
    self.postMessage({ kind: "result", bytes: result, width, height, transparent, mixed, opaque }, { transfer: [result] });
  } catch (error) {
    self.postMessage({ kind: "error", code: error instanceof Error ? error.message.slice(0, 100) : "UNKNOWN_ERROR" });
  } finally {
    running = false;
  }
};
