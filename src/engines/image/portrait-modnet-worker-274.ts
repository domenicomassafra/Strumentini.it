import { checkPortraitInput, checkPortraitPng, PORTRAIT_MAX_FILE_BYTES } from "./portrait-modnet-274";

type Request = { kind: "start"; bytes: ArrayBuffer; mime: string; memoryGB?: number };
let running = false;

self.onmessage = async (event: MessageEvent<Request>) => {
  if (running || event.data.kind !== "start") return;
  running = true;
  try {
    const { bytes, mime, memoryGB } = event.data;
    if (!(["image/jpeg", "image/png", "image/webp"] as string[]).includes(mime)
      || bytes.byteLength > PORTRAIT_MAX_FILE_BYTES) throw new Error("UNSUPPORTED_IMAGE");
    const imageBlob = new Blob([bytes], { type: mime });
    const bitmap = await createImageBitmap(imageBlob);
    const width = bitmap.width;
    const height = bitmap.height;
    bitmap.close();
    checkPortraitInput(bytes.byteLength, width, height, memoryGB);

    self.postMessage({ kind: "progress", message: "Caricamento modello e WebAssembly locali…" });
    const { env, pipeline } = await import("@huggingface/transformers");
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
    const output = await segmenter(imageBlob);
    if (!output || output.width !== width || output.height !== height || output.channels !== 4
      || output.data.length !== width * height * 4) throw new Error("MASK_INVALID");
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("CANVAS_UNAVAILABLE");
    // The donor's putAlpha() replaces any alpha originally present in a PNG or
    // WebP. Preserve user-provided transparency by intersecting that alpha with
    // the predicted matte (a fully transparent input pixel stays transparent).
    const sourceBitmap = await createImageBitmap(imageBlob);
    ctx.drawImage(sourceBitmap, 0, 0);
    sourceBitmap.close();
    const originalPixels = ctx.getImageData(0, 0, width, height).data;
    const rgba = new Uint8ClampedArray(output.data);
    let transparent = 0;
    let mixed = 0;
    let opaque = 0;
    for (let i = 3; i < rgba.length; i += 4) {
      rgba[i] = Math.round(rgba[i] * originalPixels[i] / 255);
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
    const roundtrip = await createImageBitmap(new Blob([result], { type: "image/png" }));
    const verified = roundtrip.width === width && roundtrip.height === height;
    roundtrip.close();
    if (!verified) throw new Error("PNG_READBACK_FAILED");
    self.postMessage({ kind: "result", bytes: result, width, height, transparent, mixed, opaque }, { transfer: [result] });
    await segmenter.dispose();
  } catch (error) {
    self.postMessage({ kind: "error", code: error instanceof Error ? error.message.slice(0, 100) : "UNKNOWN_ERROR" });
  } finally {
    running = false;
  }
};
