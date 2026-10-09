import { recompressPdfEmbeddedJpegs } from "../../src/engines/pdf/jpeg-image-aware";
import { recompressPdfScannedImages } from "../../src/engines/pdf/scan-image-aware";

declare global {
  interface Window {
    compressMixed218: (profile: "scan" | "jpeg", options?: {
      readonly maxLongestEdgePx?: number; readonly grayscale?: boolean; readonly quality?: number;
    }) => Promise<{ output: number[]; analysis: unknown }>;
    cancelMixed218: () => Promise<string>;
  }
}

async function source218(): Promise<Uint8Array> {
  const file = document.querySelector<HTMLInputElement>("#source-218")?.files?.[0];
  if (!file) throw new Error("No local PDF selected in #218 fixture");
  return new Uint8Array(await file.arrayBuffer());
}

window.compressMixed218 = async (profile, options = {}) => {
  const source = await source218();
  const result = profile === "scan"
    ? await recompressPdfScannedImages(source, options)
    : await recompressPdfEmbeddedJpegs(source, options.quality === undefined ? {} : { quality: options.quality });
  return { output: Array.from(result.artifact.bytes), analysis: result.analysis };
};

window.cancelMixed218 = async () => {
  const source = await source218();
  const ctrl = new AbortController();
  const operation = recompressPdfScannedImages(source, { quality: .6, maxLongestEdgePx: 256 }, ctrl.signal);
  // Abort while pending async decompression/encoding, not merely before start.
  ctrl.abort();
  try { await operation; return "UNEXPECTED_SUCCESS"; }
  catch (reason) { return reason instanceof Error ? `${reason.name}:${reason.message}` : "UNKNOWN_ERROR"; }
};

document.body.setAttribute("data-218-ready", "true");
