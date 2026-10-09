import { describe, expect, it, vi } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { buildPrintablePdf, type PrintablePdfOptions } from "../src/engines/pdf/printable-document";
import {
  OFFICE_PRINT_CAPABILITIES_56, exportOfficePrintable56, preflightOfficePrint56,
  type PrintableOfficeFile56,
} from "../src/engines/pdf/office-print-pack-56";

function documentFile(name: string, text: string, type = "text/plain"): File {
  return new File([new TextEncoder().encode(text)], name, { type });
}

async function independentPages(bytes: Uint8Array): Promise<{ text: string; width: number; height: number }[]> {
  const task = getDocument({ data: bytes.slice(), useSystemFonts: true, disableFontFace: true });
  try {
    const doc = await task.promise;
    const output = [];
    for (let index = 1; index <= doc.numPages; index++) {
      const page = await doc.getPage(index);
      const content = await page.getTextContent();
      const str = content.items.filter((item): item is typeof item & { str: string } => "str" in item).map((item) => item.str).join(" ");
      const [left, bottom, right, top] = page.view;
      output.push({ text: str, width: right! - left!, height: top! - bottom! });
      page.cleanup();
    }
    return output;
  } finally { await task.destroy(); }
}

describe("#056 Office-printable pack: explicit fidelity refusal and independent PDF outputs", () => {
  it("states supported semantic print and refuses all unapproved Office renderers", () => {
    expect(OFFICE_PRINT_CAPABILITIES_56.filter((row) => row.decision === "PRINTABLE_LOCAL").map((row) => row.format))
      .toEqual(["txt", "markdown", "html", "csv"]);
    expect(OFFICE_PRINT_CAPABILITIES_56.filter((row) => row.decision === "REFUSE_FIDELITY").map((row) => row.format))
      .toEqual(expect.arrayContaining(["docx", "xlsx", "pptx", "odt", "ods", "odp"]));
    expect(OFFICE_PRINT_CAPABILITIES_56.every((row) => row.fidelity === "SEMANTIC_PRINT_ONLY" || row.fidelity === "UNPROVEN_OFFICE_LAYOUT")).toBe(true);
  });

  it("creates and independently opens multi-page, numbered TXT A4 with exact source tail", async () => {
    const source = Array.from({ length: 100 }, (_, index) => `RIGA-${String(index).padStart(3, "0")} ${"parola ".repeat(20)}CODA-${index}`).join("\n");
    const file = documentFile("capitolo.txt", source);
    const receipt = await exportOfficePrintable56(file, { pageSize: "a4", marginPt: 46, fontPt: 10 });
    expect(receipt).toMatchObject({ sourceKind: "txt", decision: "PRINTABLE_LOCAL", fidelity: "SEMANTIC_PRINT_ONLY" });
    expect(receipt.artifact.pageCount).toBeGreaterThan(2);
    expect(receipt.documentVerification.checkedPages).toBe(receipt.artifact.pageCount);
    expect(receipt.documentVerification.allPagesChecked).toBe(true);
    expect(receipt.artifact.filename).toBe("documento-stampabile.pdf");
    const independent = await independentPages(receipt.artifact.bytes);
    expect(independent).toHaveLength(receipt.artifact.pageCount);
    expect(independent.every((page) => Math.abs(page.width - 595.28) < 0.1 && Math.abs(page.height - 841.89) < 0.1)).toBe(true);
    const corpus = independent.map(({ text }) => text).join("\n");
    expect(corpus).toContain("RIGA-000");
    expect(corpus).toContain("CODA-99");
    for (let i = 0; i < independent.length; i++) expect(independent[i]!.text).toContain(`${i + 1} / ${independent.length}`);
  });

  it("makes a genuine Markdown PDF, with transparent lossy formatting limitations and stable bytes", async () => {
    const file = documentFile("appunti.md", "# Guida locale\n\n- Primo punto\n- Secondo punto\n\nIl documento è già pronto.", "text/markdown");
    const first = await exportOfficePrintable56(file, { pageSize: "letter", orientation: "landscape", pageNumbers: false });
    const second = await exportOfficePrintable56(file, { pageSize: "letter", orientation: "landscape", pageNumbers: false });
    expect(first.artifact.bytes).toEqual(second.artifact.bytes);
    expect(first.artifact.widthPt).toBe(792);
    expect(first.artifact.heightPt).toBe(612);
    expect(first.artifact.warnings.join(" ")).toMatch(/struttura normalizzata/u);
    expect(first.limitations.join(" ")).toMatch(/Markdown\/HTML perdono/u);
    const [page] = await independentPages(first.artifact.bytes);
    expect(page!.text).toContain("Guida locale");
    expect(page!.text).toContain("Primo punto");
    expect(page!.text).toContain("già pronto");
    expect(page!.text).not.toContain("# Guida");
  });

  it("prints HTML only as inert text; never executes script or downloads remote media", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("OFFSITE_NETWORK_FORBIDDEN"); });
    const before = (globalThis as { pdf56Executed?: boolean }).pdf56Executed;
    try {
      const file = documentFile("passivo.html", '<h1>Testo stampabile</h1><script>globalThis.pdf56Executed=true</script><style>p{background:url(https://example.invalid/leak)}</style><p>Solo <b>contenuto</b> locale &amp; verificato.</p><img src="https://example.invalid/x.png">', "text/html");
      const receipt = await exportOfficePrintable56(file);
      const pages = await independentPages(receipt.artifact.bytes);
      const contents = pages.map((page) => page.text).join(" ");
      expect(contents).toContain("Testo stampabile");
      expect(contents).toContain("contenuto locale & verificato");
      expect(contents).not.toContain("pdf56Executed");
      expect(contents).not.toContain("leak");
      expect(new TextDecoder("latin1").decode(receipt.artifact.bytes)).not.toContain("example.invalid");
      expect(fetchSpy).not.toHaveBeenCalled();
      expect((globalThis as { pdf56Executed?: boolean }).pdf56Executed).toBe(before);
    } finally { fetchSpy.mockRestore(); }
  });

  it("accepts real quoted multiline CSV into multipage Letter landscape; verifies heading and final row", async () => {
    const data = ["Codice,Descrizione,Esito", ...Array.from({ length: 65 }, (_, i) =>
      `Q${String(i).padStart(3, "0")},"${"descrizione lunga ".repeat(16)}",Verificato`),
      'FINALE,"Prima riga\nSeconda riga",OK'].join("\n");
    const receipt = await exportOfficePrintable56(documentFile("tabella.csv", data, "text/csv"), { pageSize: "letter", orientation: "landscape", marginPt: 30, fontPt: 9 });
    expect(receipt.sourceKind).toBe("csv");
    expect(receipt.artifact.tableRows).toBe(67);
    expect(receipt.artifact.pageCount).toBeGreaterThan(1);
    const pages = await independentPages(receipt.artifact.bytes);
    expect(pages.every((page) => page.text.includes("Codice") && page.width === 792 && page.height === 612)).toBe(true);
    expect(pages.map((page) => page.text).join(" ")).toContain("FINALE");
    expect(pages.map((page) => page.text).join(" ")).toContain("Seconda riga");
  });

  it("refuses DOCX/XLSX/PPTX/ODT and legacy Office before even reading input; no PDF artifact", async () => {
    for (const extension of ["docx", "xlsx", "pptx", "odt", "ods", "odp", "doc", "xls", "ppt", "docm", "xlsm"]) {
      let reads = 0;
      const file: PrintableOfficeFile56 = { name: `documento.${extension}`, size: 200, type: "application/octet-stream",
        arrayBuffer: async () => { reads++; return new ArrayBuffer(200); } };
      await expect(exportOfficePrintable56(file)).rejects.toThrow(/PDF56_OFFICE_FIDELITY_REFUSED/u);
      expect(reads).toBe(0);
    }
    await expect(exportOfficePrintable56({ name: "documento.txt", size: 5,
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      arrayBuffer: async () => new TextEncoder().encode("plain").buffer })).rejects.toThrow(/PDF56_OFFICE_FIDELITY_REFUSED/u);
  });

  it("refuses Office binaries renamed to TXT, MIME mismatch and unsupported RTF, PDF, UTF-16", async () => {
    const renamed = [
      [0x50, 0x4b, 0x03, 0x04, 0, 0], // OOXML/ODT ZIP signature
      [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], // classic Office/OLE
      [...new TextEncoder().encode("%PDF-1.7\n")],
      [...new TextEncoder().encode("{\\rtf1 ")],
    ];
    for (const bytes of renamed) {
      const file = new File([Uint8Array.from(bytes)], "renamed.txt", { type: "text/plain" });
      await expect(exportOfficePrintable56(file)).rejects.toThrow(/PDF56_BINARY_REFUSED/u);
    }
    await expect(exportOfficePrintable56(documentFile("name.rtf", "{\\rtf1 test}"))).rejects.toThrow(/PDF56_FORMAT_REFUSED/u);
    await expect(exportOfficePrintable56(documentFile("name.txt", "TXT", "text/html"))).rejects.toThrow(/PDF56_MIME_CONFLICT/u);
    await expect(exportOfficePrintable56(new File([Uint8Array.of(0xff, 0xfe, 0x41, 0)], "utf16.txt"))).rejects.toThrow(/PDF56_UTF8_REQUIRED/u);
    await expect(exportOfficePrintable56(new File([Uint8Array.of(0xc3, 0x28)], "invalid.txt"))).rejects.toThrow(/PDF56_UTF8_REQUIRED/u);
    await expect(exportOfficePrintable56(new File([Uint8Array.of(65, 0, 66)], "binary.txt"))).rejects.toThrow(/PDF56_TEXT_INVALID/u);
    await expect(exportOfficePrintable56(documentFile("only-active.html", "<script>globalThis.attacked=true</script>", "text/html")))
      .rejects.toThrow(/PDF56_BLANK_OUTPUT/u);
  });

  it("checks source bounds before read and refuses source changing during async read", async () => {
    let reads = 0;
    const tooLarge: PrintableOfficeFile56 = { name: "oversize.txt", type: "text/plain", size: 512 * 1024 + 1,
      arrayBuffer: async () => { reads++; return new ArrayBuffer(0); } };
    await expect(exportOfficePrintable56(tooLarge)).rejects.toThrow(/PDF56_INPUT_LIMIT/u);
    expect(reads).toBe(0);
    const changing: PrintableOfficeFile56 = { name: "changed.md", type: "text/plain", size: 100,
      arrayBuffer: async () => new TextEncoder().encode("# actual only").buffer };
    await expect(exportOfficePrintable56(changing)).rejects.toThrow(/PDF56_INPUT_CHANGED/u);
    await expect(exportOfficePrintable56(documentFile("emoji.md", "# 🔥 unsupported"))).rejects.toThrow(/UNSUPPORTED_UNICODE/u);
    expect(preflightOfficePrint56(documentFile("test.md", "# valid"))).toBe("markdown");
  });

  it("cancels before source read and after pending async read, with no partial PDF returned", async () => {
    const already = new AbortController(); already.abort();
    const file = documentFile("notes.txt", "Documento");
    await expect(exportOfficePrintable56(file, {}, already.signal)).rejects.toMatchObject({ name: "AbortError" });

    let releaseRead!: (buffer: ArrayBuffer) => void;
    let beginRead!: () => void;
    const reading = new Promise<ArrayBuffer>((resolve) => { releaseRead = resolve; });
    const entered = new Promise<void>((resolve) => { beginRead = resolve; });
    const slow: PrintableOfficeFile56 = { name: "slow.txt", type: "text/plain", size: 5,
      arrayBuffer: () => { beginRead(); return reading; } };
    const stop = new AbortController();
    const job = exportOfficePrintable56(slow, {}, stop.signal);
    await entered;
    stop.abort();
    releaseRead(new TextEncoder().encode("Ciao!").buffer);
    await expect(job).rejects.toMatchObject({ name: "AbortError" });
  });

  it("rejects abort promptly even when the file read never settles", async () => {
    let notifyRead!: () => void;
    const started = new Promise<void>((resolve) => { notifyRead = resolve; });
    const neverFinishes = new Promise<ArrayBuffer>(() => {});
    const file: PrintableOfficeFile56 = { name: "stalled.txt", type: "text/plain", size: 5,
      arrayBuffer: () => { notifyRead(); return neverFinishes; } };
    const controller = new AbortController();
    const pending = exportOfficePrintable56(file, {}, controller.signal);
    await started;
    controller.abort();

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const outcome = await Promise.race([
        pending.then(() => "unexpected-success", (error: unknown) =>
          error instanceof Error && error.name === "AbortError" ? "aborted" : "unexpected-error"),
        new Promise<string>((resolve) => { timer = setTimeout(() => resolve("stalled"), 100); }),
      ]);
      expect(outcome).toBe("aborted");
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  });

  it("terminates a browser Worker on mid-layout cancel and never returns partial bytes", async () => {
    class FakeWorker {
      static current: FakeWorker | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      terminated = false;
      constructor() { FakeWorker.current = this; }
      postMessage(_value: unknown) { /* leave the actual layout pending until cancellation */ }
      terminate() { this.terminated = true; }
    }
    vi.stubGlobal("Worker", FakeWorker);
    try {
      const controller = new AbortController();
      const active = exportOfficePrintable56(documentFile("readme.txt", "Ciao"), {}, controller.signal);
      for (let i = 0; i < 10 && FakeWorker.current === null; i++) await Promise.resolve();
      expect(FakeWorker.current).not.toBeNull();
      const worker = FakeWorker.current!;
      controller.abort();
      await expect(active).rejects.toMatchObject({ name: "AbortError" });
      expect(worker.terminated).toBe(true);
      // A completed response delivered after cancellation cannot revive a result.
      worker.onmessage?.({ data: { kind: "complete", output: { bytes: new Uint8Array([37, 80, 68, 70, 45]), pageCount: 1 } } } as MessageEvent);
    } finally { vi.unstubAllGlobals(); }
  });

  it("accepts real output via the isolated Worker protocol and still independently reopens it", async () => {
    class FakeWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      terminated = false;
      postMessage(options: PrintablePdfOptions) {
        const pdf = buildPrintablePdf(options);
        queueMicrotask(() => this.onmessage?.({ data: { kind: "complete", output: { ...pdf, blob: undefined } } } as MessageEvent));
      }
      terminate() { this.terminated = true; }
    }
    vi.stubGlobal("Worker", FakeWorker);
    try {
      const receipt = await exportOfficePrintable56(documentFile("worker.md", "# Prova\n\nTesto locale e concreto"));
      expect(receipt.documentVerification).toMatchObject({ independentParser: "PDF.js", allPagesChecked: true, containsPrintableText: true });
      const pages = await independentPages(receipt.artifact.bytes);
      expect(pages[0]!.text).toContain("Testo locale e concreto");
    } finally { vi.unstubAllGlobals(); }
  });
});
