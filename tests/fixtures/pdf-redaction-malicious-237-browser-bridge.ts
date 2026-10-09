import { redactPdfRaster237 } from "../../src/engines/pdf/secure-raster-redaction-237";

declare global {
  interface Window {
    runMalicious237: (regions: readonly { page: number; left: number; top: number; width: number; height: number }[])
      => Promise<{ bytes: number[]; proof: unknown }>;
  }
}

window.runMalicious237 = async (regions) => {
  const source = document.querySelector<HTMLInputElement>("#source237")?.files?.[0];
  if (!source) throw new Error("Missing real local file in browser");
  const { artifact, proof } = await redactPdfRaster237(source, regions);
  return { bytes: [...artifact.bytes], proof };
};
document.body.setAttribute("data-237-ready", "true");
