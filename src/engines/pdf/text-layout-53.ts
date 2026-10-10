import { inspectPdfBytes } from "./index";
import { PDF_LIMITS, type PdfTextPage } from "./types";

export interface VisualLineText53 {
  readonly pages: readonly PdfTextPage[];
  readonly selectedPages: readonly number[];
  readonly mode: "visual-lines";
  readonly truncated: false;
}

type Glyph53 = { readonly text: string; readonly x: number; readonly y: number; readonly end: number };

/** Coarse top-to-bottom, left-to-right visible lines. Refuse tilted/vertical glyphs.
 * Does not infer reading order of columns, tagged structures or tables.
 */
export function visualLines53(items: readonly { str: string; transform: readonly number[]; width: number }[]): string {
  if (items.length > 20000) throw new Error("PDF53_LAYOUT_LIMIT: Troppi frammenti di testo");
  const glyphs: Glyph53[] = [];
  for (const item of items) {
    if (!item.str.trim()) continue;
    const [a, b, c, d, x, y] = item.transform;
    if (![a, b, c, d, x, y, item.width].every((value) => typeof value === "number" && Number.isFinite(value))) {
      throw new Error("PDF53_LAYOUT_UNSUPPORTED: Coordinate del testo mancanti");
    }
    if (Math.abs(b!) > .03 * Math.max(1, Math.abs(a!)) || Math.abs(c!) > .03 * Math.max(1, Math.abs(d!)) || a! <= 0) {
      throw new Error("PDF53_LAYOUT_UNSUPPORTED: Testo inclinato, rovesciato o verticale; ordine visivo non verificabile");
    }
    glyphs.push({ text: item.str, x: x!, y: y!, end: x! + Math.max(0, item.width) });
  }
  glyphs.sort((left, right) => right.y - left.y || left.x - right.x);
  const lines: Glyph53[][] = [];
  for (const glyph of glyphs) {
    const last = lines.at(-1);
    if (last && Math.abs(last[0]!.y - glyph.y) <= 2) last.push(glyph);
    else lines.push([glyph]);
  }
  return lines.map((line) => {
    line.sort((a, b) => a.x - b.x);
    let end = -Infinity;
    let text = "";
    for (const glyph of line) {
      const gap = glyph.x - end;
      text += text.length && gap > 1.5 && !/\s$/u.test(text) && !/^\s/u.test(glyph.text) ? " " + glyph.text : glyph.text;
      end = Math.max(end, glyph.end);
    }
    return text.trim();
  }).filter(Boolean).join("\n");
}

export async function extractPdfVisualLines53(source: Uint8Array, pages?: readonly number[], signal?: AbortSignal): Promise<VisualLineText53> {
  if (signal?.aborted) throw new DOMException("Estrazione PDF annullata", "AbortError");
  if (!(source instanceof Uint8Array) || source.byteLength < 8 || source.byteLength > PDF_LIMITS.maxBytes) {
    throw new Error("PDF53_INPUT_LIMIT: PDF non valido o oltre 25 MiB");
  }
  const inspected = inspectPdfBytes(source);
  if (inspected.encrypted) throw new Error("PDF53_PASSWORD_REQUIRED: Sblocca il PDF tramite lo strumento password autorizzata");
  const selected = pages === undefined ? Array.from({ length: inspected.pageCount }, (_, index) => index + 1) : [...pages];
  if (!selected.length || new Set(selected).size !== selected.length || selected.some((page) => !Number.isInteger(page) || page < 1 || page > inspected.pageCount)) {
    throw new Error("PDF53_PAGE_SELECTION_INVALID: Pagine fuori intervallo o ripetute");
  }
  const pdfjs = typeof window === "undefined" ? await import("pdfjs-dist/legacy/build/pdf.mjs") : await import("pdfjs-dist");
  if (typeof window !== "undefined") pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
  if (signal?.aborted) throw new DOMException("Estrazione PDF annullata", "AbortError");
  const loading = pdfjs.getDocument({ data: source.slice(), useSystemFonts: true, disableFontFace: true });
  const abort = () => { void loading.destroy(); };
  signal?.addEventListener("abort", abort, { once: true });
  const output: PdfTextPage[] = [];
  let total = 0;
  try {
    const doc = await loading.promise;
    if (doc.numPages !== inspected.pageCount) throw new Error("PDF53_PAGE_COUNT_MISMATCH");
    for (const pageNumber of selected) {
      if (signal?.aborted) throw new DOMException("Estrazione PDF annullata", "AbortError");
      const page = await doc.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        const text = visualLines53(content.items.filter((item) => "str" in item).map((item) => ({
          str: item.str, transform: item.transform, width: item.width,
        })));
        total += text.length;
        if (total > PDF_LIMITS.maxTextBytes) throw new Error("PDF53_TEXT_LIMIT: Output oltre 2 MiB, nessun documento parziale");
        output.push({ page: pageNumber, text, truncated: false });
      } finally { page.cleanup(); }
    }
    return { pages: output, selectedPages: selected, mode: "visual-lines", truncated: false };
  } finally {
    signal?.removeEventListener("abort", abort);
    await loading.destroy().catch(() => undefined);
  }
}
