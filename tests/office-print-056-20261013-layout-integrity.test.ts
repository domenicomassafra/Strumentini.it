import { describe, expect, it, vi } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { buildPrintablePdf, type PrintablePdfOptions } from "../src/engines/pdf/printable-document";
import { exportOfficePrintable56 } from "../src/engines/pdf/office-print-pack-56";

/** A genuine, parsable PDF with the wrong requested layout is not an accepted export. */
describe("#056 independent PDF verification honors the caller's requested print layout", () => {
  it.each([
    { label: "page format and orientation", changes: { pageSize: "letter", orientation: "landscape" } },
    { label: "margins", changes: { marginPt: 60 } },
    { label: "font size", changes: { fontPt: 12 } },
    { label: "source format", changes: { kind: "markdown" } },
    { label: "page-number toggle", changes: { pageNumbers: false } },
    { label: "unexpected page-number footer", changes: { pageNumbers: true }, requestedPageNumbers: false },
  ] as const)("rejects a real PDF with a mismatched $label", async (scenario) => {
    const { changes } = scenario;
    let wrongPdf: Uint8Array | undefined;
    class ValidPdfWrongLayoutWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage(request: PrintablePdfOptions): void {
        const { blob: _blob, ...generated } = buildPrintablePdf({ ...request, ...changes });
        wrongPdf = generated.bytes;
        queueMicrotask(() => this.onmessage?.({ data: { kind: "complete", output: generated } } as MessageEvent));
      }
      terminate(): void { /* one-off test worker */ }
    }
    vi.stubGlobal("Worker", ValidPdfWrongLayoutWorker);
    try {
      const content = "Contenuto originale conservato anche nel PDF sbagliato";
      const file = new File([content], "contenuto.txt", { type: "text/plain" });
      // Attach the rejection handler before independent PDF.js parsing: the
      // export may reject immediately, while parser verification is async.
      const rejected = expect(exportOfficePrintable56(file, {
        pageSize: "a4", orientation: "portrait", marginPt: 43, fontPt: 11,
        ...("requestedPageNumbers" in scenario ? { pageNumbers: scenario.requestedPageNumbers } : {}),
      }))
        .rejects.toThrow(/PDF56_OUTPUT_VERIFY/u);

      // Regression precondition: these are genuine #256 PDFs, independently
      // reparsed by PDF.js, not malformed stubs which would fail for other reasons.
      await vi.waitFor(() => expect(wrongPdf).toBeDefined());
      const task = getDocument({ data: wrongPdf!.slice(), disableFontFace: true, useSystemFonts: true });
      try {
        const pdf = await task.promise;
        const page = await pdf.getPage(1);
        const text = (await page.getTextContent()).items
          .filter((item): item is typeof item & { str: string } => "str" in item)
          .map((item) => item.str).join(" ");
        expect(text.replace(/\s+/gu, " ")).toContain(content);
        page.cleanup();
      } finally { await task.destroy(); }

      await rejected;
    } finally { vi.unstubAllGlobals(); }
  });
});
