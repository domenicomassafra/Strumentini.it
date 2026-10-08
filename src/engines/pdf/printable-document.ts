import { convertTextMarkup } from "../text-markup-conversion";
import { parseCsvText } from "../table/csv";
import { inspectPdfBytes } from "./index";
import { pdfArray, pdfDict, pdfName, pdfNumber } from "./parser";
import { PdfBuilder } from "./writer";

export type PrintableSourceKind = "txt" | "markdown" | "html" | "csv";
export type PrintablePageSize = "a4" | "letter";
export type PrintableOrientation = "portrait" | "landscape";

export interface PrintablePdfOptions {
  readonly kind: PrintableSourceKind;
  readonly source: string;
  readonly pageSize?: PrintablePageSize;
  readonly orientation?: PrintableOrientation;
  readonly marginPt?: number;
  readonly fontPt?: number;
  readonly pageNumbers?: boolean;
}

export interface PrintablePdfResult {
  readonly bytes: Uint8Array;
  readonly blob: Blob;
  readonly filename: string;
  readonly pageCount: number;
  readonly widthPt: number;
  readonly heightPt: number;
  readonly marginPt: number;
  readonly fontPt: number;
  readonly sourceKind: PrintableSourceKind;
  readonly renderedLines: number;
  readonly tableRows: number;
  readonly warnings: readonly string[];
  readonly fontPolicy: string;
  readonly structuralPolicy: string;
}

const MAX_SOURCE_BYTES = 512 * 1024;
const MAX_PAGES = 80;
const MAX_CSV_ROWS = 1800;
const MAX_CSV_COLUMNS = 8;
const MAX_LINES = 9000;
const WINANSI_EXTRAS: Readonly<Record<number, number>> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};

function winAnsiByte(cp: number): number | null {
  if (cp >= 32 && cp <= 126) return cp;
  if (cp >= 160 && cp <= 255) return cp;
  return WINANSI_EXTRAS[cp] ?? null;
}

function verifyUnicode(input: string): void {
  for (const symbol of input) {
    const cp = symbol.codePointAt(0)!;
    if (cp === 9 || cp === 10 || cp === 13) continue;
    if (winAnsiByte(cp) === null) {
      throw new Error(`UNSUPPORTED_UNICODE: U+${cp.toString(16).toUpperCase().padStart(4, "0")} non rappresentabile nel font Courier WinAnsi. Nessuna sostituzione silenziosa.`);
    }
  }
}

function pdfLiteral(value: string): string {
  let result = "(";
  for (const char of value) {
    const byte = winAnsiByte(char.codePointAt(0)!);
    if (byte === null) throw new Error("UNSUPPORTED_UNICODE: Character must be prevalidated");
    // PDF octal escapes remain independent from JS UTF-8 encoding of the content stream.
    result += byte === 40 || byte === 41 || byte === 92 || byte > 126 || byte < 32
      ? `\\${byte.toString(8).padStart(3, "0")}` : String.fromCharCode(byte);
  }
  return `${result})`;
}

function pageDimensions(size: PrintablePageSize, orientation: PrintableOrientation): readonly [number, number] {
  const dims = size === "letter" ? [612, 792] as const : [595.28, 841.89] as const;
  return orientation === "landscape" ? [dims[1], dims[0]] : dims;
}

function normalizeText(value: string): string {
  return value.replace(/\r\n?/gu, "\n").replace(/\t/gu, "    ");
}

/** Fixed-width Courier guarantees no line can exceed the printable rectangle. */
function wrapLine(value: string, maxChars: number): string[] {
  if (value === "") return [""];
  const output: string[] = [];
  let remaining = value;
  while (remaining.length > maxChars) {
    const boundary = remaining.lastIndexOf(" ", maxChars);
    const cut = boundary >= Math.floor(maxChars / 3) ? boundary : maxChars;
    output.push(remaining.slice(0, cut).trimEnd());
    remaining = remaining.slice(cut).replace(/^ +/u, "");
  }
  output.push(remaining);
  return output;
}

type PageLine = { readonly text: string; readonly x: number; readonly baseline: number; readonly font: number };
interface LayoutPage { readonly lines: PageLine[]; readonly rules: { y: number; x1: number; x2: number }[] }

export function buildPrintablePdf(options: PrintablePdfOptions): PrintablePdfResult {
  if (!options || !["txt", "markdown", "html", "csv"].includes(options.kind) || typeof options.source !== "string") {
    throw new Error("INVALID_INPUT: Sorgente o formato non riconosciuto");
  }
  const sourceBytes = new TextEncoder().encode(options.source).byteLength;
  if (sourceBytes === 0 || sourceBytes > MAX_SOURCE_BYTES) throw new Error("PDF_LIMIT: Ingresso vuoto o oltre 512 KiB");
  const size = options.pageSize ?? "a4";
  const orientation = options.orientation ?? "portrait";
  const margin = options.marginPt ?? 42;
  const font = options.fontPt ?? 10;
  if (!["a4", "letter"].includes(size) || !["portrait", "landscape"].includes(orientation) ||
    !Number.isFinite(margin) || margin < 24 || margin > 90 ||
    !Number.isFinite(font) || font < 8 || font > 14) throw new Error("INVALID_INPUT: Layout non valido");
  const [width, height] = pageDimensions(size, orientation);
  const right = width - margin;
  const bottom = margin + (options.pageNumbers === false ? 0 : 17);
  const top = height - margin;
  const lineHeight = font * 1.35;
  const charWidth = font * 0.6;
  const maxChars = Math.floor((width - margin * 2) / charWidth);
  const warnings: string[] = [];
  const pages: LayoutPage[] = [];
  let current: LayoutPage = { lines: [], rules: [] };
  let y = top - font;
  let renderedLines = 0;
  let tableRows = 0;
  let lineLimit = 0;
  const addPage = () => {
    if (pages.length >= MAX_PAGES) throw new Error("PDF_LIMIT: Documento oltre 80 pagine");
    pages.push(current);
    current = { lines: [], rules: [] };
    y = top - font;
  };
  const placeLine = (text: string, x = margin, atFont = font) => {
    if (y - (atFont - font) < bottom) addPage();
    current.lines.push({ text, x, baseline: y, font: atFont });
    renderedLines += 1;
    lineLimit += 1;
    if (lineLimit > MAX_LINES) throw new Error("PDF_LIMIT: Più di 9000 righe impaginate");
    y -= lineHeight;
  };
  if (options.kind === "csv") {
    const parsed = parseCsvText(options.source);
    tableRows = parsed.rows.length;
    if (tableRows < 1 || tableRows > MAX_CSV_ROWS) throw new Error("PDF_LIMIT: CSV oltre 1800 righe o vuoto");
    const columns = Math.max(...parsed.rows.map((row) => row.length));
    if (columns < 1 || columns > MAX_CSV_COLUMNS) throw new Error("PDF_LIMIT: CSV oltre 8 colonne, nessuna colonna viene omessa");
    if (parsed.warnings.length > 0) warnings.push(...parsed.warnings.map((warning) => warning.message));
    const columnWidth = (width - margin * 2) / columns;
    const padding = 4;
    const charsPerCell = Math.floor((columnWidth - 2 * padding) / charWidth);
    if (charsPerCell < 4) throw new Error("PDF_LIMIT: Colonne troppo strette per la dimensione font");
    const cells = parsed.rows.map((row) => Array.from({ length: columns }, (_, index) => {
      const lines = normalizeText(row[index] ?? "").split("\n").flatMap((line) => wrapLine(line, charsPerCell));
      return lines;
    }));
    if (parsed.rows.some((row) => row.length !== columns)) warnings.push("Righe CSV irregolari: le celle mancanti sono mostrate vuote.");
    const header = cells[0]!;
    const headerHeight = Math.max(...header.map((cell) => cell.length));
    if (headerHeight * lineHeight > top - bottom - 2 * lineHeight) throw new Error("PDF_LIMIT: Intestazione CSV troppo alta");
    let repeatHeader = false;
    function renderRow(row: readonly string[][], isHeader: boolean): void {
      const count = Math.max(...row.map((cell) => cell.length));
      let offset = 0;
      while (offset < count) {
        if (y < bottom + lineHeight || (isHeader && y < bottom + headerHeight * lineHeight)) addPage();
        // Repeating header is used only for data fragments on newly created pages.
        if (!isHeader && repeatHeader) {
          repeatHeader = false;
          renderRow(header, true);
        }
        const remaining = Math.max(1, Math.floor((y - bottom) / lineHeight));
        const taken = Math.min(count - offset, remaining);
        for (let line = 0; line < taken; line += 1) {
          for (let col = 0; col < columns; col += 1) {
            current.lines.push({ text: row[col]?.[offset + line] ?? "",
              x: margin + col * columnWidth + padding, baseline: y, font });
          }
          y -= lineHeight;
          renderedLines += 1;
          lineLimit += 1;
          if (lineLimit > MAX_LINES) throw new Error("PDF_LIMIT: Più di 9000 righe impaginate");
        }
        offset += taken;
        current.rules.push({ y: y + lineHeight * 0.15, x1: margin, x2: right });
        if (offset < count) {
          addPage();
          if (!isHeader) repeatHeader = true;
        }
      }
    }
    renderRow(header, true);
    for (const row of cells.slice(1)) {
      if (y - lineHeight < bottom) {
        addPage();
        renderRow(header, true);
      }
      renderRow(row, false);
    }
    warnings.push("CSV: font Courier monospace; celle a capo, intestazione ripetuta sulle pagine successive. Grafica, formule e tipi numerici non ricostruiti.");
  } else {
    const source = options.kind === "txt" ? normalizeText(options.source) : convertTextMarkup({
      text: options.source, mode: options.kind === "markdown" ? "markdown-to-text" : "html-to-text",
    }).output;
    if (options.kind !== "txt") {
      warnings.push("Markdown/HTML: struttura normalizzata in righe e paragrafi. Formattazione, CSS, immagini e collegamenti cliccabili non sono riprodotti.");
      if (options.kind === "html") warnings.push("HTML: script, CSS, elementi incorporati e risorse esterne ignorati senza esecuzione.");
    }
    const lines = source.split("\n");
    for (const line of lines) for (const wrapped of wrapLine(line, maxChars)) placeLine(wrapped);
  }
  if (current.lines.length > 0 || pages.length === 0) pages.push(current);
  if (pages.length > MAX_PAGES) throw new Error("PDF_LIMIT: Troppe pagine");
  for (const page of pages) for (const line of page.lines) verifyUnicode(line.text);
  const builder = new PdfBuilder();
  const root = builder.reserve();
  const pageTree = builder.reserve();
  const fontRef = builder.putAuto(pdfDict({
    Type: pdfName("Font"), Subtype: pdfName("Type1"), BaseFont: pdfName("Courier"), Encoding: pdfName("WinAnsiEncoding"),
  }));
  const references = pages.map((page, index) => {
    const fragments = page.lines.map((line) =>
      `BT /F1 ${line.font.toFixed(2)} Tf 1 0 0 1 ${line.x.toFixed(2)} ${line.baseline.toFixed(2)} Tm ${pdfLiteral(line.text)} Tj ET`);
    for (const rule of page.rules) fragments.push(`0.7 w ${rule.x1.toFixed(2)} ${rule.y.toFixed(2)} m ${rule.x2.toFixed(2)} ${rule.y.toFixed(2)} l S`);
    if (options.pageNumbers !== false) {
      const label = `${index + 1} / ${pages.length}`;
      const x = width / 2 - label.length * font * 0.3;
      fragments.push(`BT /F1 ${font} Tf 1 0 0 1 ${x.toFixed(2)} ${(margin / 2).toFixed(2)} Tm ${pdfLiteral(label)} Tj ET`);
    }
    const content = builder.putAuto({ kind: "stream", dictionary: pdfDict({}),
      bytes: new TextEncoder().encode(fragments.join("\n") + "\n") });
    return builder.putAuto(pdfDict({
      Type: pdfName("Page"), Parent: pageTree, MediaBox: pdfArray([pdfNumber(0), pdfNumber(0), pdfNumber(width), pdfNumber(height)]),
      Resources: pdfDict({ Font: pdfDict({ F1: fontRef }) }), Contents: content,
    }));
  });
  builder.put(pageTree, pdfDict({ Type: pdfName("Pages"), Kids: pdfArray(references), Count: pdfNumber(references.length) }));
  builder.put(root, pdfDict({ Type: pdfName("Catalog"), Pages: pageTree }));
  const bytes = builder.build(root, null);
  const parsed = inspectPdfBytes(bytes);
  if (parsed.pageCount !== pages.length || parsed.pages.some((page) => Math.abs(page.width - width) > 0.05 ||
      Math.abs(page.height - height) > 0.05)) throw new Error("PDF_OUTPUT_MISMATCH: Contenitore e geometria non verificati");
  return {
    bytes, blob: new Blob([Uint8Array.from(bytes)], { type: "application/pdf" }),
    filename: "documento-stampabile.pdf", pageCount: pages.length,
    widthPt: width, heightPt: height, marginPt: margin, fontPt: font, sourceKind: options.kind,
    renderedLines, tableRows, warnings,
    fontPolicy: "Courier 8–14 pt, WinAnsi (Latin occidentale incluso italiano). Unicode non rappresentabile: errore esplicito; nessuna sostituzione silenziosa.",
    structuralPolicy: "PDF locale deterministico, layout a caratteri fissi; contenuto HTML passivo, nessuna risorsa esterna caricata.",
  };
}
