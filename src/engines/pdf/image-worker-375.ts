import { insertPdfImage375, type PdfImagePlacement375 } from "./image-placement-375";

interface Request {
  source: Uint8Array;
  image: Uint8Array;
  placement: PdfImagePlacement375;
  filename: string;
}

self.addEventListener("message", async (event: MessageEvent<Request>) => {
  try {
    const { source, image, placement, filename } = event.data;
    const result = await insertPdfImage375(source, image, placement, filename);
    self.postMessage({
      kind: "STR375_IMAGE", ok: true, bytes: result.bytes,
      filename: result.filename, pageCount: result.pageCount,
    }, { transfer: [result.bytes.buffer as ArrayBuffer] });
  } catch (error) {
    self.postMessage({ kind: "STR375_IMAGE", ok: false,
      reason: error instanceof Error ? error.message : "PDF non elaborabile; originale conservato" });
  }
});
