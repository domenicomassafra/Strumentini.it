import { extractPdfTextScoped, type PdfInput } from "./index";
import type { PdfTextExtractionMode } from "./types";
import { extractPdfVisualLines53 } from "./text-layout-53";

export type PdfTextExportMode53 = PdfTextExtractionMode | "visual-lines";

/** #53: Actual file exports of the PDF text operator subset, never layout/OCR claims.
 * The only extraction authority is the existing bounded PDF parser. PDF text
 * operators are not a reading-order or visually faithful transcription.
 */
export interface ScopedPdfTextExport53 {
  readonly status: "EXTRACTED_TEXT_ONLY_NOT_LAYOUT" | "VISUAL_LINES_NOT_SEMANTIC_READING_ORDER";
  readonly pages: readonly number[];
  readonly mode: PdfTextExportMode53;
  readonly text: { readonly filename: string; readonly bytes: Uint8Array; readonly mime: "text/plain;charset=utf-8" };
  readonly markdown: { readonly filename: string; readonly bytes: Uint8Array; readonly mime: "text/markdown;charset=utf-8" };
  readonly limitations: readonly string[];
}

const MAX_EXPORT_BYTES = 3 * 1024 * 1024;
const encoder = new TextEncoder();

function basename(value: string): string {
  const stem = value.replace(/\.pdf$/iu, "").replace(/[^a-zA-Z0-9_-]+/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 70);
  return stem || "pdf-extracted-text";
}

function fence(text: string): string {
  // No unbounded argument-spread of an attacker-controlled array of matches.
  // A PDF with hundreds of thousands of short backtick runs is still bounded.
  let length = 3;
  for (const match of text.matchAll(/`+/gu)) length = Math.max(length, match[0].length + 1);
  return "`".repeat(length);
}

export async function exportScopedPdfText53(
  source: PdfInput,
  options: { readonly sourceName: string; readonly pages?: readonly number[]; readonly mode?: PdfTextExportMode53 },
  signal?: AbortSignal,
): Promise<ScopedPdfTextExport53> {
  if (signal?.aborted) throw new DOMException("Esportazione testo PDF annullata", "AbortError");
  if (typeof options.sourceName !== "string" || options.sourceName.length > 200 || !options.sourceName.trim()) {
    throw new Error("PDF53_SOURCE_NAME_INVALID");
  }
  const visualInput = async (): Promise<Uint8Array> => {
    if (source instanceof Uint8Array) return source;
    if (source instanceof ArrayBuffer) return new Uint8Array(source);
    if (source instanceof Blob) return new Uint8Array(await source.arrayBuffer());
    if (source.bytes) return source.bytes;
    if (source.buffer) return new Uint8Array(source.buffer);
    if (source.blob) return new Uint8Array(await source.blob.arrayBuffer());
    throw new Error("PDF53_INPUT_INVALID");
  };
  const result = options.mode === "visual-lines" ? await extractPdfVisualLines53(
    await visualInput(), options.pages, signal,
  ) : await extractPdfTextScoped(source, {
    ...(options.pages !== undefined ? { pages: options.pages } : {}),
    ...(options.mode !== undefined ? { mode: options.mode } : {}),
  }, signal);
  if (result.truncated) throw new Error("PDF53_TEXT_TRUNCATED: Nessun download parziale dichiarato completo.");
  if (!result.pages.some((page) => page.text.trim().length > 0)) {
    throw new Error("PDF53_NO_TEXT_OCR_UNAVAILABLE: Nessun testo PDF estraibile; nessun OCR simulato.");
  }
  // Escaping via a dynamic fence makes even PDF-provided Markdown fences/HTML
  // literal text inside each page block; it is never parsed as trusted markup.
  const heading = (page: number) => `Pagina ${page}`;
  const txt = result.pages.map(({ page, text }) => `===== ${heading(page).toUpperCase()} =====\n\n${text}`).join("\n\n");
  const md = result.pages.map(({ page, text }) => {
    const delimiter = fence(text);
    return `## ${heading(page)}\n\n${delimiter}text\n${text}\n${delimiter}`;
  }).join("\n\n");
  const plain = encoder.encode(txt), markdown = encoder.encode(md);
  if (plain.byteLength > MAX_EXPORT_BYTES || markdown.byteLength > MAX_EXPORT_BYTES) {
    throw new Error("PDF53_OUTPUT_LIMIT: Esportazione oltre 3 MiB.");
  }
  if (signal?.aborted) throw new DOMException("Esportazione testo PDF annullata", "AbortError");
  const name = basename(options.sourceName);
  return {
    status: options.mode === "visual-lines" ? "VISUAL_LINES_NOT_SEMANTIC_READING_ORDER" : "EXTRACTED_TEXT_ONLY_NOT_LAYOUT",
    pages: result.pages.map((page) => page.page), mode: result.mode,
    text: { filename: `${name}.txt`, bytes: plain, mime: "text/plain;charset=utf-8" },
    markdown: { filename: `${name}.md`, bytes: markdown, mime: "text/markdown;charset=utf-8" },
    limitations: [
      options.mode === "visual-lines" ? "Righe ordinate per coordinata visiva; colonne, tabelle e scritte ruotate non sono ricostruite o vengono rifiutate." : "Ordine di contenuto PDF o righe per operatore: non è ordine di lettura geometrico garantito.",
      "Tabelle, font, immagini, hyperlink, stile e semantica visiva non vengono ricostruiti.",
      "File scansionati senza testo richiedono OCR non ancora approvato; output troncato rifiutato.",
      "Solo file UTF-8 locali; nessun recupero password, rete o conversione in layout editabile.",
    ],
  };
}
