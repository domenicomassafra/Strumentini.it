import { buildPrintablePdf, type PrintablePdfOptions, type PrintablePdfResult, type PrintableSourceKind } from "./printable-document";

/** Ticket #056: a verified file-input gateway for semantic PRINTABLE PDFs.
 * This module intentionally does not render Word, spreadsheet or slide layout.
 * No public route or manifest is registered until the integration safety gate.
 */
export type OfficePrintDecision56 = "PRINTABLE_LOCAL" | "REFUSE_FIDELITY";
export type OfficePrintFormat56 = PrintableSourceKind | "docx" | "xlsx" | "pptx" | "odt" | "ods" | "odp" | "doc" | "xls" | "ppt";

export interface OfficePrintCapability56 {
  readonly format: OfficePrintFormat56;
  readonly decision: OfficePrintDecision56;
  readonly fidelity: "SEMANTIC_PRINT_ONLY" | "UNPROVEN_OFFICE_LAYOUT";
  readonly reason: string;
}

/** Explicit, format-specific fidelity refusals grounded in the editable OOXML
 * source corpus. Seeing a package feature is not proof of pixel/page rendering.
 * #257–259 may be reconsidered only when an approved local renderer reproduces
 * its geometry and the full fidelity corpus has independently validated PDFs.
 */
const OFFICE_FIDELITY_LIMITS_56: Readonly<Record<"docx" | "xlsx" | "pptx", string>> = {
  docx: "DOCX: font, tabelle, immagini, paginazione, intestazioni, sezioni e collegamenti non hanno una conversione PDF con fedeltà dimostrata; layout Word non riprodotto.",
  xlsx: "XLSX: font, formule, grafici, immagini, intervalli, larghezze colonne e impostazioni di stampa non hanno una conversione PDF con fedeltà dimostrata.",
  pptx: "PPTX: font, grafici, media, geometria delle forme, master, temi ed effetti non hanno una conversione PDF con fedeltà dimostrata.",
};

export const OFFICE_PRINT_CAPABILITIES_56: readonly OfficePrintCapability56[] = [
  { format: "txt", decision: "PRINTABLE_LOCAL", fidelity: "SEMANTIC_PRINT_ONLY", reason: "Testo UTF-8, caratteri WinAnsi; righe originali, Courier e ritorno a capo." },
  { format: "markdown", decision: "PRINTABLE_LOCAL", fidelity: "SEMANTIC_PRINT_ONLY", reason: "Markdown normalizzato a testo. Tabelle avanzate, immagini, stile e hyperlink visivi non conservati." },
  { format: "html", decision: "PRINTABLE_LOCAL", fidelity: "SEMANTIC_PRINT_ONLY", reason: "HTML interpretato come testo inerte; CSS, media, script e impaginazione DOM non riprodotti." },
  { format: "csv", decision: "PRINTABLE_LOCAL", fidelity: "SEMANTIC_PRINT_ONLY", reason: "CSV quote-aware, massimo otto colonne, wrap e intestazione ripetuta; stili e formule assenti." },
  ...(["docx", "xlsx", "pptx", "odt", "ods", "odp", "doc", "xls", "ppt"] as const).map((format) => ({
    format, decision: "REFUSE_FIDELITY" as const, fidelity: "UNPROVEN_OFFICE_LAYOUT" as const,
    reason: format in OFFICE_FIDELITY_LIMITS_56
      ? OFFICE_FIDELITY_LIMITS_56[format as keyof typeof OFFICE_FIDELITY_LIMITS_56]
      : "Nessun renderer Office locale approvato per font, pagine, immagini, grafici e fedeltà geometrica. Nessun server o convertitore remoto.",
  })),
];

export interface PrintableOfficeFile56 {
  readonly name: string;
  readonly type: string;
  readonly size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface OfficePrintOptions56 extends Omit<PrintablePdfOptions, "source" | "kind"> {
  /** Disallow implicit online fallback: there is no network-capable option. */
  readonly verifyEveryPage?: boolean;
}

export interface OfficePrintResult56 {
  readonly artifact: PrintablePdfResult;
  readonly sourceName: string;
  readonly sourceKind: PrintableSourceKind;
  readonly decision: "PRINTABLE_LOCAL";
  readonly fidelity: "SEMANTIC_PRINT_ONLY";
  readonly documentVerification: {
    readonly independentParser: "PDF.js";
    readonly pageCount: number;
    readonly checkedPages: number;
    readonly allPagesChecked: boolean;
    readonly pageSizePt: readonly [number, number];
    readonly containsPrintableText: true;
  };
  readonly limitations: readonly string[];
}

interface WorkerResponse56 {
  readonly kind: "complete" | "error";
  readonly output?: Omit<PrintablePdfResult, "blob">;
  readonly message?: string;
}

const MAX_TEXT_BYTES = 512 * 1024;
const INPUT_EXT: Readonly<Record<string, PrintableSourceKind>> = {
  txt: "txt", text: "txt", md: "markdown", markdown: "markdown", html: "html", htm: "html", csv: "csv",
};
const OFFICE_EXT = new Set(["docx", "xlsx", "pptx", "odt", "ods", "odp", "doc", "xls", "ppt", "docm", "xlsm", "pptm", "dotx", "xltx", "potx"]);
const ALLOWED_MIME: Readonly<Record<PrintableSourceKind, readonly string[]>> = {
  txt: ["", "application/octet-stream", "text/plain"],
  markdown: ["", "application/octet-stream", "text/plain", "text/markdown", "text/x-markdown"],
  html: ["", "application/octet-stream", "text/plain", "text/html"],
  csv: ["", "application/octet-stream", "text/plain", "text/csv", "application/csv"],
};

function fail(code: string, reason: string): never { throw new Error(`${code}: ${reason}`); }
function aborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Esportazione PDF annullata: nessun output parziale.", "AbortError");
}

/** File.arrayBuffer() has no cancellation argument. Stop awaiting a stalled read
 * as soon as the caller aborts; any late file result is discarded.
 */
async function readFile56(file: PrintableOfficeFile56, signal?: AbortSignal): Promise<ArrayBuffer> {
  aborted(signal);
  if (!signal) return file.arrayBuffer();
  let onAbort: (() => void) | undefined;
  const cancellation = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(new DOMException("Esportazione PDF annullata: nessun output parziale.", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    aborted(signal);
    return await Promise.race([file.arrayBuffer(), cancellation]);
  } finally {
    if (onAbort) signal.removeEventListener("abort", onAbort);
  }
}

/** Never trusts MIME, extension or magic independently. Refusal happens before reading Office payloads. */
export function preflightOfficePrint56(file: PrintableOfficeFile56): PrintableSourceKind {
  if (!file || typeof file.name !== "string" || typeof file.type !== "string"
    || typeof file.arrayBuffer !== "function" || file.name.length < 3 || file.name.length > 160
    || /[\u0000-\u001f\/\\]/u.test(file.name)) {
    fail("PDF56_FILE_INVALID", "Nome o oggetto file non valido.");
  }
  const extension = /\.([^.]+)$/u.exec(file.name)?.[1]?.toLowerCase() ?? "";
  const mime = file.type.toLowerCase().split(";")[0]!.trim();
  if (OFFICE_EXT.has(extension) || /(?:openxmlformats|opendocument|msword|ms-excel|ms-powerpoint|vnd\.ms-|officedocument)/iu.test(mime)) {
    fail("PDF56_OFFICE_FIDELITY_REFUSED", "DOCX/XLSX/PPTX, Office legacy e OpenDocument richiedono un renderer locale con fedeltà approvata; la conversione è rifiutata.");
  }
  const kind = INPUT_EXT[extension];
  if (!kind) fail("PDF56_FORMAT_REFUSED", "Solo .txt/.md/.markdown/.html/.htm/.csv con contenuto UTF-8; formato non riconosciuto.");
  if (!ALLOWED_MIME[kind].includes(mime)) fail("PDF56_MIME_CONFLICT", "Estensione e MIME dichiarano formati incompatibili.");
  if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > MAX_TEXT_BYTES) {
    fail("PDF56_INPUT_LIMIT", "File testuale vuoto o maggiore di 512 KiB.");
  }
  return kind;
}

function decodeText56(bytes: Uint8Array): string {
  if (bytes.length === 0 || bytes.length > MAX_TEXT_BYTES) fail("PDF56_INPUT_LIMIT", "File oltre il limite locale.");
  // UTF-8 decoding removes a leading BOM. Inspect the same effective header
  // that the printable path would read, or BOM-prefixed RTF/PDF/Office files
  // can evade the binary-format refusal and be printed as misleading text.
  let headerStart = 0;
  while (bytes[headerStart] === 0xef && bytes[headerStart + 1] === 0xbb && bytes[headerStart + 2] === 0xbf) {
    headerStart += 3;
  }
  const header = bytes.subarray(headerStart);
  const zip = header.length >= 4 && header[0] === 0x50 && header[1] === 0x4b
    && [[0x03, 0x04], [0x05, 0x06], [0x07, 0x08]].some(([a, b]) => header[2] === a && header[3] === b);
  const ole = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((n, i) => header[i] === n);
  const pdf = [37, 80, 68, 70, 45].every((n, i) => header[i] === n);
  const rtf = String.fromCharCode(...header.subarray(0, 6)) === "{\\rtf1";
  if (zip || ole || pdf || rtf) fail("PDF56_BINARY_REFUSED", "File binario o Office rinominato come testo: nessun falso PDF di conversione.");
  if ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff)) {
    fail("PDF56_UTF8_REQUIRED", "UTF-16 non supportato, serve UTF-8.");
  }
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { fail("PDF56_UTF8_REQUIRED", "Il file non contiene UTF-8 valido."); }
  text = text.replace(/^\uFEFF/u, "");
  if (!text.trim() || /[\u0000-\u0008\u000b\u000e-\u001f\u007f]/u.test(text)) {
    fail("PDF56_TEXT_INVALID", "Testo vuoto o caratteri di controllo/binary non ammessi.");
  }
  return text;
}

/** Browser: real preemptible Worker, terminated on cancel and every settlement.
 * Node test runner: direct call to the identical #256 engine; this path cannot
 * promise mid-layout interruption, and is not a browser fallback in production.
 */
async function generatePrintable56(request: PrintablePdfOptions, signal?: AbortSignal): Promise<PrintablePdfResult> {
  aborted(signal);
  if (typeof Worker === "undefined") {
    if (typeof window !== "undefined") fail("PDF56_WORKER_UNAVAILABLE", "Worker locale necessario per la cancellazione durante l'impaginazione.");
    return buildPrintablePdf(request);
  }
  return new Promise<PrintablePdfResult>((resolve, reject) => {
    let worker: Worker;
    try { worker = new Worker(new URL("./office-print-worker-56.ts", import.meta.url), { type: "module" }); }
    catch { reject(new Error("PDF56_WORKER_UNAVAILABLE: Worker PDF locale non disponibile.")); return; }
    let finished = false;
    const settle = (error?: Error, pdf?: PrintablePdfResult) => {
      if (finished) return;
      finished = true;
      signal?.removeEventListener("abort", onAbort);
      worker.terminate();
      if (error) reject(error);
      else if (pdf) resolve(pdf);
      else reject(new Error("PDF56_WORKER_FAILED: Output assente."));
    };
    const onAbort = () => settle(new DOMException("Esportazione PDF annullata: nessun output parziale.", "AbortError"));
    signal?.addEventListener("abort", onAbort, { once: true });
    worker.onmessage = (event: MessageEvent<WorkerResponse56>) => {
      if (signal?.aborted) { onAbort(); return; }
      if (event.data.kind === "error") {
        settle(new Error(event.data.message ?? "PDF56_WORKER_FAILED: Conversione rifiutata."));
        return;
      }
      const output = event.data.output;
      if (event.data.kind !== "complete" || !output || !(output.bytes instanceof Uint8Array)
        || output.bytes.length < 8 || output.bytes.length > 50 * 1024 * 1024
        || output.pageCount < 1 || output.pageCount > 80) {
        settle(new Error("PDF56_WORKER_FAILED: Risultato Worker invalido."));
        return;
      }
      const bytes = output.bytes;
      settle(undefined, { ...output, bytes, blob: new Blob([Uint8Array.from(bytes)], { type: "application/pdf" }) });
    };
    worker.onerror = () => settle(new Error("PDF56_WORKER_FAILED: Worker interrotto per errore."));
    try {
      if (signal?.aborted) { onAbort(); return; }
      worker.postMessage(request);
    } catch { settle(new Error("PDF56_WORKER_FAILED: Invio al Worker non disponibile.")); }
  });
}

/** The Worker is an output boundary: metadata and genuine PDF geometry must
 * both agree with the user's original layout request before publication.
 */
function requestedLayout56(request: PrintablePdfOptions): readonly [number, number, number, number] {
  const pageSize = request.pageSize ?? "a4";
  const orientation = request.orientation ?? "portrait";
  const margin = request.marginPt ?? 42;
  const font = request.fontPt ?? 10;
  if ((pageSize !== "a4" && pageSize !== "letter")
    || (orientation !== "portrait" && orientation !== "landscape")
    || !Number.isFinite(margin) || margin < 24 || margin > 90
    || !Number.isFinite(font) || font < 8 || font > 14) {
    fail("PDF56_OUTPUT_VERIFY", "Parametri di stampa richiesti non validi.");
  }
  const [portraitWidth, portraitHeight] = pageSize === "letter" ? [612, 792] : [595.28, 841.89];
  return orientation === "landscape"
    ? [portraitHeight, portraitWidth, margin, font]
    : [portraitWidth, portraitHeight, margin, font];
}

/** Reopen the actual generated bytes with an independent PDF.js parser.
 * Checks every page's MediaBox and text unless `verifyEveryPage` is deliberately false.
 * Never follows external document URLs: input is the generated, local PDF bytes.
 */
async function verifyPrintedPdf56(result: PrintablePdfResult, request: PrintablePdfOptions, signal?: AbortSignal, verifyEveryPage = true): Promise<OfficePrintResult56["documentVerification"]> {
  aborted(signal);
  const [expectedWidth, expectedHeight, expectedMargin, expectedFont] = requestedLayout56(request);
  if (result.sourceKind !== request.kind || result.marginPt !== expectedMargin || result.fontPt !== expectedFont
    || Math.abs(result.widthPt - expectedWidth) > 0.05 || Math.abs(result.heightPt - expectedHeight) > 0.05) {
    fail("PDF56_OUTPUT_VERIFY", "Layout o formato PDF ricevuto diverso da quello richiesto.");
  }
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (typeof window !== "undefined") {
    // PDF.js legacy has no automatic workerSrc when Vite bundles its ESM
    // entrypoint. Without a local worker URL, every browser export fails at
    // the independent post-export verification gate.
    const worker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  }
  aborted(signal);
  const task = pdfjs.getDocument({ data: result.bytes.slice(), useSystemFonts: true, disableFontFace: true,
    stopAtErrors: true });
  const onAbort = () => { void task.destroy(); };
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const pdf = await task.promise;
    aborted(signal);
    if (pdf.numPages !== result.pageCount || pdf.numPages < 1 || pdf.numPages > 80) {
      fail("PDF56_OUTPUT_VERIFY", "Numero pagine non corrispondente a PDF prodotto.");
    }
    const inspect = verifyEveryPage ? Array.from({ length: pdf.numPages }, (_, i) => i + 1)
      : [...new Set([1, Math.ceil(pdf.numPages / 2), pdf.numPages])];
    let bodyText = false;
    // #256 uses one fixed Courier baseline grid for all four printable kinds.
    // Actual PDF.js glyph transforms are independent of the Worker metadata:
    // a valid PDF can otherwise claim the requested font/margins while the
    // bytes render with different dimensions and silently pass verification.
    const topBaseline = expectedHeight - expectedMargin - expectedFont;
    const lineHeight = expectedFont * 1.35;
    const characterWidth = expectedFont * 0.6;
    const bottom = expectedMargin + (request.pageNumbers === false ? 0 : 17);
    for (const number of inspect) {
      aborted(signal);
      const page = await pdf.getPage(number);
      try {
        const [x0, y0, x1, y1] = page.view;
        if (!Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(x1) || !Number.isFinite(y1)
          || Math.abs(x1! - x0! - expectedWidth) > 0.1 || Math.abs(y1! - y0! - expectedHeight) > 0.1) {
          fail("PDF56_OUTPUT_VERIFY", `MediaBox pagina ${number} non corrispondente al formato scelto.`);
        }
        const contents = await page.getTextContent();
        // Native PDF footer position is fixed by #256 at half the requested
        // margin. Source text like "1 / 1" inside the printable body must not
        // be mistaken for a generated page-number footer.
        // PDF.js can split one Courier footer into several text items (even
        // one item per character), so reconstruct the baseline before checking.
        const footerLine = contents.items.filter((item) => "str" in item
          && Math.abs(item.transform[5]! - expectedMargin / 2) < 0.5)
          .map((item) => "str" in item ? item.str : "").join("").replace(/\s+/gu, " ").trim();
        if (request.pageNumbers === false ? footerLine !== "" : footerLine !== `${number} / ${pdf.numPages}`) {
          fail("PDF56_OUTPUT_VERIFY", `Numerazione pagina ${number} diversa dall'opzione richiesta.`);
        }
        // Footer identification is based on where #256 prints it, not on a
        // numeric pattern: a file containing only "1 / 1" is legitimate body
        // text, and PDF.js may split its digits into separate text items.
        for (const item of contents.items) {
          if (!("str" in item) || !item.str.trim()) continue;
          const [scaleX, scaleY, , , x, y] = item.transform;
          if (Math.abs(y! - expectedMargin / 2) < 0.5) continue;
          const rowsFromTop = (topBaseline - y!) / lineHeight;
          const glyphPt = Math.hypot(scaleX!, scaleY!);
          const textColumn = (x! - expectedMargin) / characterWidth;
          if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(glyphPt)
            || Math.abs(glyphPt - expectedFont) > 0.1
            || x! < expectedMargin - 0.2 || x! > expectedWidth - expectedMargin + 0.2
            || y! < bottom - 0.2 || rowsFromTop < -0.02
            || Math.abs(rowsFromTop - Math.round(rowsFromTop)) * lineHeight > 0.2
            // Plain-text/markup glyph positions lie on Courier's fixed-width
            // grid, even when leading blank lines or spaces are present.
            || (request.kind !== "csv" && Math.abs(textColumn - Math.round(textColumn)) * characterWidth > 0.2)) {
            fail("PDF56_OUTPUT_VERIFY", `Geometria o dimensione font del contenuto PDF pagina ${number} diversa dalla richiesta.`);
          }
          bodyText = true;
        }
      } finally { page.cleanup(); }
    }
    aborted(signal);
    if (!bodyText) fail("PDF56_BLANK_OUTPUT", "Il PDF non contiene testo sorgente verificabile nelle pagine controllate.");
    return { independentParser: "PDF.js", pageCount: pdf.numPages, checkedPages: inspect.length,
      allPagesChecked: verifyEveryPage, pageSizePt: [expectedWidth, expectedHeight], containsPrintableText: true };
  } catch (error) {
    aborted(signal);
    if (error instanceof Error && error.message.startsWith("PDF56_")) throw error;
    return fail("PDF56_OUTPUT_VERIFY", "Riapertura PDF.js fallita; output non pubblicabile.");
  } finally {
    signal?.removeEventListener("abort", onAbort);
    await task.destroy();
  }
}

/** Local-only printable export. Output is published only after independent reopen.
 * Browser cancellation terminates its private Worker; Node test fallback uses
 * synchronous #256 core and cannot preempt mid-layout.
 */
export async function exportOfficePrintable56(file: PrintableOfficeFile56, options: OfficePrintOptions56 = {}, signal?: AbortSignal): Promise<OfficePrintResult56> {
  aborted(signal);
  const kind = preflightOfficePrint56(file);
  const content = await readFile56(file, signal);
  aborted(signal);
  if (content.byteLength !== file.size) fail("PDF56_INPUT_CHANGED", "Dimensione file cambiata durante la lettura.");
  const source = decodeText56(new Uint8Array(content));
  aborted(signal);
  const request: PrintablePdfOptions = { kind, source,
    ...(options.pageSize !== undefined ? { pageSize: options.pageSize } : {}),
    ...(options.orientation !== undefined ? { orientation: options.orientation } : {}),
    ...(options.marginPt !== undefined ? { marginPt: options.marginPt } : {}),
    ...(options.fontPt !== undefined ? { fontPt: options.fontPt } : {}),
    ...(options.pageNumbers !== undefined ? { pageNumbers: options.pageNumbers } : {}),
  };
  const artifact = await generatePrintable56(request, signal);
  aborted(signal);
  const verification = await verifyPrintedPdf56(artifact, request, signal, options.verifyEveryPage !== false);
  aborted(signal);
  return { artifact, sourceName: file.name, sourceKind: kind, decision: "PRINTABLE_LOCAL", fidelity: "SEMANTIC_PRINT_ONLY",
    documentVerification: verification, limitations: [
      "Stampa semantica in Courier WinAnsi con regole #256: non è rendering fedele di DOCX/XLSX/PPTX/ODT.",
      "Markdown/HTML perdono stili, tabelle avanzate, immagini, media e geometria; CSV non conserva formattazione o formule.",
      "Nel browser la generazione usa un Worker terminabile; i test Node diretti non preemptano il calcolo sincrono.",
      ...artifact.warnings,
    ] };
}
