import { checkPortraitInput, checkPortraitPng, PORTRAIT_MAX_FILE_BYTES } from "./portrait-modnet-274";
import type { RawImage } from "@huggingface/transformers";

type Request = { kind: "start"; bytes?: ArrayBuffer; mime: string; memoryGB?: number; reuse?: boolean };
let running = false;
let warmedInput: { image: RawImage; bytes: number; mime: string } | null = null;

self.onmessage = async (event: MessageEvent<Request>) => {
  if (running || event.data.kind !== "start") return;
  running = true;
  let stage = "validate";
  try {
    const { bytes, mime, memoryGB, reuse } = event.data;
    if (!(["image/jpeg", "image/png", "image/webp"] as string[]).includes(mime)
      || (bytes && bytes.byteLength > PORTRAIT_MAX_FILE_BYTES)) throw new Error("UNSUPPORTED_IMAGE");
    if (reuse && (!warmedInput || warmedInput.mime !== mime)) throw new Error("WARM_INPUT_MISSING");
    if (!reuse && !bytes) throw new Error("INPUT_MISSING");
    stage = "decode-input";
    const imageBlob = reuse ? null : new Blob([bytes!], { type: mime });
    if (imageBlob) {
      // Reject oversized decoded dimensions before allocating the full RGBA
      // buffer, even if someone posts directly to this Worker.
      const bitmap = await createImageBitmap(imageBlob);
      try { checkPortraitInput(bytes!.byteLength, bitmap.width, bitmap.height, memoryGB); }
      finally { bitmap.close(); }
    }

    self.postMessage({ kind: "progress", message: "Caricamento modello e WebAssembly locali…" });
    stage = "load-runtime";
    const { env, pipeline, RawImage } = await import("@huggingface/transformers");
    // The donor accepts RawImage directly. Retain the already-decoded RGBA
    // inside this Worker for the same file: WebKit's Blob decoder can become
    // unavailable after the user switches the browser context offline.
    stage = "prepare-input";
    const original = reuse ? warmedInput!.image : await RawImage.fromBlob(imageBlob!);
    const width = original.width;
    const height = original.height;
    const originalByteLength = reuse ? warmedInput!.bytes : bytes!.byteLength;
    checkPortraitInput(originalByteLength, width, height, memoryGB);
    if (original.channels !== 4 || original.data.length !== width * height * 4) throw new Error("INPUT_PIXELS_INVALID");
    if (!reuse) warmedInput = { image: original, bytes: originalByteLength, mime };
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("CANVAS_UNAVAILABLE");
    ctx.putImageData(new ImageData(new Uint8ClampedArray(original.data), width, height), 0, 0);
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
    stage = "open-model";
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
    // BackgroundRemovalPipeline reads its input twice; the donor explicitly
    // accepts RawImage and clones it for putAlpha(). Give each inference a copy
    // so warmedInput is immutable, and avoid Blob decoding after going offline.
    stage = "infer";
    const output = await segmenter(original.clone());
    if (!output || output.width !== width || output.height !== height || output.channels !== 4
      || output.data.length !== width * height * 4) throw new Error("MASK_INVALID");
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
    stage = "encode-png";
    const png = await canvas.convertToBlob({ type: "image/png" });
    stage = "read-png";
    const result = await png.arrayBuffer();
    stage = "verify-png";
    checkPortraitPng(new Uint8Array(result), width, height);
    // Independent browser decoding, after the PNG encoder, must preserve alpha.
    if (!reuse) {
      stage = "readback-png";
      const roundtrip = await createImageBitmap(new Blob([result], { type: "image/png" }));
      const verified = roundtrip.width === width && roundtrip.height === height;
      roundtrip.close();
      if (!verified) throw new Error("PNG_READBACK_FAILED");
    }
    await segmenter.dispose();
    self.postMessage({ kind: "result", bytes: result, width, height, transparent, mixed, opaque }, { transfer: [result] });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Preserve stable machine error codes; tag unexpected browser IO failures
    // so offline WebKit acceptance identifies the actual failing operation.
    const code = /I\/?O read operation failed|error occured reading the Blob/iu.test(message)
      ? `${stage}: ${message}` : message;
    self.postMessage({ kind: "error", code: code.slice(0, 100) });
  } finally {
    running = false;
  }
};
