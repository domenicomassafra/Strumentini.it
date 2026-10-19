import { createPdfToolkit } from "../../src/engines/pdf/vendor/pdfstudio/index.js";

let toolkit;
self.onmessage = async ({ data }) => {
  try {
    toolkit ??= await createPdfToolkit({ wasmUrl: new URL("../../src/engines/pdf/vendor/pdfstudio/wasm/qpdf.wasm", import.meta.url) });
    const result = await toolkit.compress(new Uint8Array(data));
    self.postMessage({ size: result.byteLength, bytes: result }, [result.buffer]);
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
