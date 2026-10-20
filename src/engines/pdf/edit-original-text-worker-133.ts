import { editPdfOriginalText133, type PdfOriginalTextChange133 } from "./edit-original-text-133";

type Request = { source: Uint8Array; change: PdfOriginalTextChange133 };

self.addEventListener("message", (event: MessageEvent<Request>) => {
  try {
    const result = editPdfOriginalText133(event.data.source, event.data.change);
    self.postMessage({ kind: "STR133_TEXT", ok: true, result },
      { transfer: [result.bytes.buffer as ArrayBuffer] });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "PDF non supportato";
    self.postMessage({ kind: "STR133_TEXT", ok: false,
      reason: reason.slice(0, 300) });
  }
});
