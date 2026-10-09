import { buildPrintablePdf, type PrintablePdfOptions } from "./printable-document";

/** Dedicated browser worker for #056. Cancelling a job terminates this worker,
 * interrupting #256's synchronous layout without leaving a downloadable PDF.
 * The caller must independently reopen/verify bytes after this worker returns.
 */
self.onmessage = (event: MessageEvent<PrintablePdfOptions>) => {
  try {
    const pdf = buildPrintablePdf(event.data);
    const { blob: _blob, ...metadata } = pdf;
    const bytes = Uint8Array.from(pdf.bytes);
    self.postMessage({ kind: "complete", output: { ...metadata, bytes } }, { transfer: [bytes.buffer] });
  } catch (error) {
    self.postMessage({ kind: "error", message: error instanceof Error ? error.message : "PDF56_WORKER_FAILED: Generazione PDF fallita." });
  }
};
