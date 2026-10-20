import { createPdfAnnotations134, type PdfAnnotation134 } from "./annotations-134";

self.onmessage = async (event: MessageEvent<{ source: Uint8Array; marks: PdfAnnotation134[]; filename: string }>) => {
  try {
    const { source, marks, filename } = event.data;
    const result = await createPdfAnnotations134(source, marks, filename);
    self.postMessage({ kind: "STR134_ANNOTATIONS", ok: true, bytes: result.bytes, filename: result.filename, pageCount: result.pageCount }, [result.bytes.buffer]);
  } catch (error) {
    self.postMessage({ kind: "STR134_ANNOTATIONS", ok: false, reason: error instanceof Error ? error.message.slice(0, 240) : "PDF non supportato" });
  }
};
