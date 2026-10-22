import { runPdfPageWorkspace372, type PdfWorkspaceMode372 } from "./workspace-372";

interface Request {
  source: Uint8Array;
  order: number[];
  selected: number[];
  mode: PdfWorkspaceMode372;
  filename: string;
}

self.addEventListener("message", async (event: MessageEvent<Request>) => {
  try {
    const { source, order, selected, mode, filename } = event.data;
    const result = await runPdfPageWorkspace372(source, order, selected, mode, filename);
    self.postMessage({
      kind: "STR372_WORKSPACE", ok: true, bytes: result.bytes,
      pageCount: result.pageCount, filename: result.filename,
    }, { transfer: [result.bytes.buffer as ArrayBuffer] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const reason = /PDF_LIMIT/u.test(message) ? "LIMIT"
      : /encrypt|password|cifrat/iu.test(message) ? "ENCRYPTED"
      : /INVALID_INPUT|Selezione pagine/iu.test(message) ? "SELECTION"
      : /PDF_VERIFY/u.test(message) ? "VERIFY" : "UNREADABLE";
    self.postMessage({ kind: "STR372_WORKSPACE", ok: false, reason });
  }
});
