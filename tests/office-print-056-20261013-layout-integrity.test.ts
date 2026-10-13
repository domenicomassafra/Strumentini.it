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

describe("#056 PDF.js measures printed text rather than trusting Worker metadata", () => {
  it.each([
    { label: "larger actual margins", wrong: { marginPt: 60 } },
    { label: "larger actual glyphs", wrong: { fontPt: 12 } },
    { label: "both differing", wrong: { marginPt: 60, fontPt: 12 } },
  ])("refuses a true A4 PDF with $label and falsely matching metadata", async ({ wrong }) => {
    let actualBytes: Uint8Array | undefined;
    class MisreportingWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage(request: PrintablePdfOptions): void {
        const { blob: _blob, ...actual } = buildPrintablePdf({ ...request, ...wrong });
        actualBytes = actual.bytes;
        // A real #256 PDF with contradictory metadata: structural PDF.js
        // checks must catch the geometry mismatch independently.
        const output = { ...actual, marginPt: request.marginPt!, fontPt: request.fontPt! };
        queueMicrotask(() => this.onmessage?.({ data: { kind: "complete", output } } as MessageEvent));
      }
      terminate(): void { /* disposable Worker stub */ }
    }
    vi.stubGlobal("Worker", MisreportingWorker);
    try {
      const file = new File(["Contenuto A4 reale con font e margini contraffatti"], "source.txt", { type: "text/plain" });
      const check = expect(exportOfficePrintable56(file, { pageSize: "a4", marginPt: 42, fontPt: 10, pageNumbers: false }))
        .rejects.toThrow(/PDF56_OUTPUT_VERIFY/u);
      await check;
      expect(actualBytes).toBeDefined();
      const task = getDocument({ data: actualBytes!.slice(), useSystemFonts: true, disableFontFace: true });
      try {
        const pdf = await task.promise;
        const page = await pdf.getPage(1);
        const first = (await page.getTextContent()).items.find((item) => "str" in item && item.str.includes("Contenuto"));
        expect(first).toBeDefined();
        if (first && "str" in first) {
          expect(page.view[2]).toBeCloseTo(595.28);
          expect(page.view[3]).toBeCloseTo(841.89);
          if (wrong.marginPt !== undefined) expect(first.transform[4]).toBeCloseTo(wrong.marginPt);
          if (wrong.fontPt !== undefined) expect(first.transform[0]).toBeCloseTo(wrong.fontPt);
          expect(first.transform[5]).toBeCloseTo(841.89 - (wrong.marginPt ?? 42) - (wrong.fontPt ?? 10));
        }
        page.cleanup();
      } finally { await task.destroy(); }
    } finally { vi.unstubAllGlobals(); }
  });

  it.each([
    { text: "1 / 1", pageNumbers: false },
    { text: "2/7", pageNumbers: false },
    { text: "1 / 1", pageNumbers: true },
    { text: "2/7", pageNumbers: true },
  ])("accepts numeric-only genuine TXT $text with pageNumbers=$pageNumbers", async ({ text, pageNumbers }) => {
    const receipt = await exportOfficePrintable56(new File([text], "numbers.txt", { type: "text/plain" }), {
      pageSize: "a4", marginPt: 42, fontPt: 10, pageNumbers,
    });
    expect(receipt.documentVerification).toMatchObject({ containsPrintableText: true, checkedPages: 1 });
    const task = getDocument({ data: receipt.artifact.bytes.slice(), useSystemFonts: true, disableFontFace: true });
    try {
      const pdf = await task.promise;
      const page = await pdf.getPage(1);
      const rows = (await page.getTextContent()).items.filter((item) => "str" in item);
      expect(rows.filter((item) => "str" in item && item.transform[5]! > 100)
        .map((item) => "str" in item ? item.str : "").join("").replace(/\s+/gu, "")).toBe(text.replace(/\s+/gu, ""));
      page.cleanup();
    } finally { await task.destroy(); }
  });

  it("accepts genuine multiline print positions, blank-leading TXT and CSV columns with pagination", async () => {
    const cases = [
      new File(["\n\n   1 / 1\nValore 27\n"], "notes.txt", { type: "text/plain" }),
      new File(["Codice,Valore\n,2/7\nABC,3\n".repeat(75)], "tabella.csv", { type: "text/csv" }),
    ];
    for (const input of cases) {
      const output = await exportOfficePrintable56(input, { pageSize: "letter", marginPt: 35, fontPt: 9, pageNumbers: true });
      expect(output.documentVerification.checkedPages).toBe(output.artifact.pageCount);
      expect(output.artifact.bytes.length).toBeGreaterThan(500);
    }
  });
});
