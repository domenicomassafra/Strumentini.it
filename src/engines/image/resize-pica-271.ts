import type { Pica } from "pica";
import { IMAGE_LIMITS, type ResizePlan } from "./policy";

export type ImageResampling =
  | { readonly engine: "pica" }
  | {
      readonly engine: "canvas";
      readonly reason: "COVER_CROP" | "NOT_DOWNSCALE" | "MEMORY_BUDGET" | "PICA_UNAVAILABLE";
    };

// One lazy instance reuses the worker pool across warm calls. Pica selects JS
// when WebAssembly or Workers are unavailable. No remote service is involved.
let instance: Promise<Pica> | undefined;
function getResizer(): Promise<Pica> {
  instance ??= import("pica").then(({ default: createPica }) =>
    createPica({ features: ["js", "wasm", "ww"], concurrency: 1, tile: 512 })
  );
  return instance;
}

export async function resizeWithPica271(
  bitmap: ImageBitmap,
  plan: ResizePlan,
  outputCanvas: HTMLCanvasElement,
  estimatedDecodedBytes: number,
  signal?: AbortSignal,
): Promise<ImageResampling> {
  // Pica accepts the decoded ImageBitmap directly in "contain" mode; keeping
  // fractional source cropping in Canvas preserves current "cover" semantics.
  if (plan.sourceX || plan.sourceY || plan.sourceWidth !== bitmap.width || plan.sourceHeight !== bitmap.height) {
    return { engine: "canvas", reason: "COVER_CROP" };
  }
  if (
    plan.outputWidth > bitmap.width || plan.outputHeight > bitmap.height ||
    (plan.outputWidth === bitmap.width && plan.outputHeight === bitmap.height)
  ) {
    return { engine: "canvas", reason: "NOT_DOWNSCALE" };
  }

  // Pica needs one transparent result surface plus tile/worker buffers. Keep
  // the existing 96 MiB policy even when a resampling worker uses extra memory.
  const picaHeadroom = plan.outputWidth * plan.outputHeight * 4 + 16 * 1024 * 1024;
  if (estimatedDecodedBytes + picaHeadroom > IMAGE_LIMITS.maxEstimatedDecodedBytes) {
    return { engine: "canvas", reason: "MEMORY_BUDGET" };
  }

  let resizer: Pica;
  try {
    resizer = await getResizer();
  } catch {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    instance = undefined;
    return { engine: "canvas", reason: "PICA_UNAVAILABLE" };
  }
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");

  // Using a transparent temporary result retains WebP alpha. For JPEG, the
  // caller's opaque white canvas supplies the original flattening policy.
  const result = document.createElement("canvas");
  result.width = plan.outputWidth;
  result.height = plan.outputHeight;
  let rejectCancellation: (reason: unknown) => void = () => {};
  const cancelToken = new Promise<never>((_resolve, reject) => { rejectCancellation = reject; });
  const onAbort = () => rejectCancellation(new DOMException("Operation cancelled", "AbortError"));
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    await resizer.resize(bitmap, result, { cancelToken });
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    const context = outputCanvas.getContext("2d");
    if (context === null) return { engine: "canvas", reason: "PICA_UNAVAILABLE" };
    context.drawImage(result, 0, 0);
    return { engine: "pica" };
  } catch (error) {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    // Canvas is restored by the caller, including when a CSP forbids Pica's
    // worker, WebAssembly compilation or a browser rejects a Pica surface.
    return { engine: "canvas", reason: "PICA_UNAVAILABLE" };
  } finally {
    signal?.removeEventListener("abort", onAbort);
    result.width = 0;
    result.height = 0;
  }
}
