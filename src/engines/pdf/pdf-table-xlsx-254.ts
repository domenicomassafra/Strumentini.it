/**
 * Ticket #254: deliberately narrow, local, fail-closed PDF table -> XLSX.
 *
 * Not OCR, not arbitrary page-to-spreadsheet conversion. A user explicitly
 * selects ONE ruled rectangular grid; PDF.js must prove every horizontal and
 * vertical separator. All cells must contain unambiguous selectable text.
 * XLSX values are text, not formulas or automatically inferred numbers.
 */
import type { SheetData } from "write-excel-file/universal";

export interface PdfTableRegion254 {
  /** PDF.js viewport at scale 1: top-left origin, in points, rotation zero. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
export interface PdfTableSelection254 {
  readonly page: number;
  readonly region: PdfTableRegion254;
}
export interface PdfTablePreview254 {
  readonly page: number;
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly region: PdfTableRegion254;
  readonly columns: number;
  readonly rows: number;
  readonly cells: readonly (readonly string[])[];
  readonly sourceFilename: string;
  readonly sourceSha256: string;
  readonly classification: "explicit-rectangular-stroked-grid-selectable-text";
  readonly warnings: readonly string[];
}
export interface PdfTableXlsx254 {
  readonly bytes: Uint8Array;
  readonly blob: Blob;
  readonly sheetName: string;
  readonly preview: PdfTablePreview254;
  readonly policy: "text-only-no-formulas-no-ocr";
}
export const PDF_TABLE_254_LIMITS = {
  maxInputBytes: 8 * 1024 * 1024,
  maxOutputBytes: 2 * 1024 * 1024,
  maxPages: 12,
  maxColumns: 12,
  maxRows: 120,
  maxCells: 1440,
  maxRules: 512,
  maxTextItems: 5000,
} as const;

function fail(code: string, description: string): never {
  throw new Error(`${code}: ${description}`);
}
function stop(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Lettura PDF annullata", "AbortError");
}
function decimal(value: number): string { return Number(value.toFixed(2)).toString(); }
export function provenanceRows254(preview: PdfTablePreview254): string[][] {
  const { region } = preview;
  return [
    ["Origine PDF", preview.sourceFilename],
    ["SHA256 del PDF", preview.sourceSha256],
    ["Pagina originale (1-based)", String(preview.page)],
    ["Regione (pt, origine alto-sinistra)", `x=${decimal(region.x)};y=${decimal(region.y)};w=${decimal(region.width)};h=${decimal(region.height)}`],
    ["Metodo", preview.classification],
    ["", ""],
    ...preview.cells.map((row) => [...row]),
  ];
}
function near(a: number, b: number, tolerance = 1.4): boolean {
  return Math.abs(a - b) <= tolerance;
}
function uniqueCoords(values: readonly number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const unique: number[] = [];
  for (const value of sorted) if (unique.length === 0 || !near(unique[unique.length - 1]!, value)) unique.push(value);
  return unique;
}
type Segment = { a: number; b: number; axis: number };
function projectedLines(opList: { fnArray: number[]; argsArray: unknown[][] }, pageHeight: number) {
  const horizontals: Segment[] = [];
  const verticals: Segment[] = [];
  // PDF.js constructPath opcode 91, with paint op 20/21 (stroke/closeStroke).
  // The path is compact: 0=moveTo, 1=lineTo, 2=rectangle. We intentionally
  // refuse unsupported curves, clips, transforms and inferred column whitespace.
  for (let i = 0; i < opList.fnArray.length; i++) {
    if (opList.fnArray[i] !== 91) continue;
    const arguments_ = opList.argsArray[i] ?? [];
    if (arguments_[0] !== 20 && arguments_[0] !== 21) continue;
    const raw = arguments_[1];
    if (!Array.isArray(raw)) continue;
    for (const path of raw) {
      if (!path || typeof path !== "object" || !("length" in path)) continue;
      const encoded = Array.from(path as ArrayLike<number>);
      if (encoded.length > 30000) fail("PDF_LIMIT", "Path too large");
      let offset = 0;
      let last: readonly [number, number] | null = null;
      while (offset < encoded.length) {
        const op = encoded[offset++]!;
        if (op !== 0 && op !== 1) { last = null; break; }
        if (offset + 1 >= encoded.length) break;
        const x = encoded[offset++]!, y = pageHeight - encoded[offset++]!;
        if (!Number.isFinite(x) || !Number.isFinite(y)) break;
        if (op === 1 && last) {
          const [oldX, oldY] = last;
          if (near(y, oldY, 0.65) && Math.abs(x - oldX) >= 8) {
            horizontals.push({ a: Math.min(x, oldX), b: Math.max(x, oldX), axis: (y + oldY) / 2 });
          } else if (near(x, oldX, 0.65) && Math.abs(y - oldY) >= 8) {
            verticals.push({ a: Math.min(y, oldY), b: Math.max(y, oldY), axis: (x + oldX) / 2 });
          }
        }
        last = [x, y];
      }
    }
  }
  if (horizontals.length + verticals.length > PDF_TABLE_254_LIMITS.maxRules) {
    fail("PDF_LIMIT", "Too many strokes on selected page");
  }
  return { horizontals, verticals };
}
function assertedRegion(region: PdfTableRegion254, width: number, height: number): void {
  if (!region || ![region.x, region.y, region.width, region.height].every(Number.isFinite) ||
      region.x < 0 || region.y < 0 || region.width < 55 || region.height < 30 ||
      region.x + region.width > width + 0.5 || region.y + region.height > height + 0.5) {
    fail("INVALID_REGION", "Seleziona un rettangolo valido, almeno 55×30 pt, all'interno della pagina");
  }
}
function gridAxes(region: PdfTableRegion254, lines: ReturnType<typeof projectedLines>) {
  const xMin = region.x - 1.5, xMax = region.x + region.width + 1.5;
  const yMin = region.y - 1.5, yMax = region.y + region.height + 1.5;
  const horizontal = lines.horizontals.filter((line) =>
    line.axis >= yMin && line.axis <= yMax && line.a >= xMin && line.b <= xMax);
  const vertical = lines.verticals.filter((line) =>
    line.axis >= xMin && line.axis <= xMax && line.a >= yMin && line.b <= yMax);
  const xs = uniqueCoords(vertical.map((line) => line.axis));
  const ys = uniqueCoords(horizontal.map((line) => line.axis));
  const cols = xs.length - 1, rows = ys.length - 1;
  if (cols < 2 || rows < 2) fail("NOT_A_RULED_TABLE", "Occorrono almeno 2 colonne e 2 righe delimitate da linee PDF reali");
  if (cols > PDF_TABLE_254_LIMITS.maxColumns || rows > PDF_TABLE_254_LIMITS.maxRows ||
      cols * rows > PDF_TABLE_254_LIMITS.maxCells) fail("PDF_LIMIT", "Tabella oltre 12 colonne / 120 righe / 1440 celle");
  // Strict complete mesh: every row/column boundary must physically span the
  // full table, not merely be visually suggested by aligned whitespace.
  for (const x of xs) {
    if (!vertical.some((segment) => near(segment.axis, x) &&
      segment.a <= ys[0]! + 1.5 && segment.b >= ys[ys.length - 1]! - 1.5)) {
      fail("AMBIGUOUS_GRID", "Almeno una linea verticale non delimita tutte le righe");
    }
  }
  for (const y of ys) {
    if (!horizontal.some((segment) => near(segment.axis, y) &&
      segment.a <= xs[0]! + 1.5 && segment.b >= xs[xs.length - 1]! - 1.5)) {
      fail("AMBIGUOUS_GRID", "Almeno una linea orizzontale non delimita tutte le colonne");
    }
  }
  if (xs.some((x, i) => i > 0 && x - xs[i - 1]! < 16) ||
    ys.some((y, i) => i > 0 && y - ys[i - 1]! < 10)) {
    fail("AMBIGUOUS_GRID", "Celle troppo sottili per una lettura attendibile");
  }
  return { xs, ys, cols, rows };
}

export async function previewPdfTable254(file: File, selection: PdfTableSelection254, signal?: AbortSignal): Promise<PdfTablePreview254> {
  if (!(file instanceof File) || file.size < 8 || file.size > PDF_TABLE_254_LIMITS.maxInputBytes) {
    fail("PDF_LIMIT", "Serve un PDF locale fino a 8 MiB");
  }
  if (!/\.pdf$/iu.test(file.name) || !Number.isInteger(selection?.page) || selection.page < 1) {
    fail("INVALID_INPUT", "Indica un PDF e una pagina numerata da 1");
  }
  stop(signal);
  const bytes = new Uint8Array(await file.arrayBuffer());
  stop(signal);
  // Browser uses Vite's explicit worker URL; Node unit tests use PDF.js'
  // legacy fake worker without a browser-only /@fs asset path.
  const pdfjs = typeof document === "undefined"
    ? await import("pdfjs-dist/legacy/build/pdf.mjs")
    : await import("pdfjs-dist");
  if (typeof document !== "undefined") {
    const worker = await import("pdfjs-dist/build/pdf.worker.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  }
  const loading = pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: true });
  const abort = () => { void loading.destroy(); };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const pdf = await loading.promise;
    if (pdf.numPages > PDF_TABLE_254_LIMITS.maxPages || selection.page > pdf.numPages) {
      fail("PDF_LIMIT", "Sono disponibili al massimo 12 pagine; seleziona una pagina esistente");
    }
    const page = await pdf.getPage(selection.page);
    try {
      if (page.rotate !== 0) fail("UNSUPPORTED_ROTATION", "Per sicurezza sono supportate solo pagine senza rotazione");
      const viewport = page.getViewport({ scale: 1 });
      const width = viewport.width, height = viewport.height;
      assertedRegion(selection.region, width, height);
      const [list, content] = await Promise.all([page.getOperatorList(), page.getTextContent()]);
      stop(signal);
      const lines = projectedLines(list, height);
      const grid = gridAxes(selection.region, lines);
      if (content.items.length > PDF_TABLE_254_LIMITS.maxTextItems) fail("PDF_LIMIT", "Troppi frammenti di testo PDF");
      const result: Array<Array<Array<{ text: string; x: number; y: number }>>> =
        Array.from({ length: grid.rows }, () => Array.from({ length: grid.cols }, () => []));
      for (const item of content.items) {
        if (!("str" in item) || typeof item.str !== "string" || item.str.trim() === "") continue;
        const [a, b, c, d, x, baseline] = item.transform;
        if (![a, b, c, d, x, baseline, item.width, item.height].every(Number.isFinite)) fail("AMBIGUOUS_TEXT", "Frammenti PDF non validi");
        const itemY = height - baseline - item.height * 0.45;
        const right = x + item.width;
        if (right < grid.xs[0]! || x > grid.xs[grid.xs.length - 1]! ||
            itemY < grid.ys[0]! || itemY > grid.ys[grid.ys.length - 1]!) continue;
        if (Math.abs(b) > 0.05 || Math.abs(c) > 0.05 || a <= 0 || d <= 0) fail("AMBIGUOUS_TEXT", "Testo ruotato non supportato");
        const col = grid.xs.findIndex((start, index) => index < grid.cols &&
          x >= start + 1 && right <= grid.xs[index + 1]! - 1);
        const row = grid.ys.findIndex((start, index) => index < grid.rows &&
          itemY > start + 1 && itemY < grid.ys[index + 1]! - 1);
        if (col < 0 || row < 0) fail("AMBIGUOUS_TEXT", "Testo a cavallo di due celle o linee");
        if (/\r|\n|\t/u.test(item.str)) fail("AMBIGUOUS_TEXT", "Frammento PDF multilinea non supportato");
        result[row]![col]!.push({ text: item.str, x, y: itemY });
      }
      const cells = result.map((row) => row.map((fragments) => {
        if (fragments.length < 1) fail("AMBIGUOUS_GRID", "Cella senza testo: nessuna ricostruzione di campi vuoti");
        if (fragments.length > 1) fail("AMBIGUOUS_TEXT", "Cella con frammenti PDF multipli: concatenazione incerta, seleziona una griglia più semplice");
        const maxY = Math.max(...fragments.map((part) => part.y));
        const minY = Math.min(...fragments.map((part) => part.y));
        if (maxY - minY > 2) fail("AMBIGUOUS_TEXT", "Cella con testo multilinea non ricostruibile con certezza");
        const sorted = fragments.toSorted((a, b) => a.x - b.x);
        for (let i = 1; i < sorted.length; i++) if (sorted[i]!.x < sorted[i - 1]!.x) fail("AMBIGUOUS_TEXT", "Ordine celle incerto");
        return sorted.map((part) => part.text).join(" ").trim();
      }));
      const hash = await crypto.subtle.digest("SHA-256", bytes);
      const sourceSha256 = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
      return {
        page: selection.page, pageWidth: width, pageHeight: height,
        region: { ...selection.region }, rows: grid.rows, columns: grid.cols, cells,
        sourceFilename: file.name, sourceSha256,
        classification: "explicit-rectangular-stroked-grid-selectable-text",
        warnings: [
          "Solo singole griglie completamente delimitate da linee PDF e celle testuali su una riga; nessun OCR.",
          "Date e cifre, inclusi zeri iniziali, rimangono testo. Nessuna formula viene eseguita.",
          "Celle vuote, linee mancanti, immagini, rotazioni e layout incerti sono rifiutati.",
        ],
      };
    } finally { page.cleanup(); }
  } finally {
    signal?.removeEventListener("abort", abort);
    await loading.destroy().catch(() => undefined);
  }
}

export async function exportPdfTableXlsx254(preview: PdfTablePreview254, signal?: AbortSignal): Promise<PdfTableXlsx254> {
  stop(signal);
  if (preview.classification !== "explicit-rectangular-stroked-grid-selectable-text" ||
      preview.rows < 2 || preview.columns < 2 ||
      preview.cells.length !== preview.rows || preview.cells.some((row) => row.length !== preview.columns) ||
      preview.rows * preview.columns > PDF_TABLE_254_LIMITS.maxCells ||
      !/^[a-f0-9]{64}$/u.test(preview.sourceSha256)) fail("INVALID_GRID", "Anteprima certificata richiesta");
  const sheetName = `P${String(preview.page).padStart(2, "0")}_Griglia`;
  const expected = provenanceRows254(preview);
  const data: SheetData = expected.map((row) => row.map((value) => ({ value, type: String })));
  const [{ default: writer }, { default: reader }] = await Promise.all([
    import("write-excel-file/universal"), import("read-excel-file/universal"),
  ]);
  stop(signal);
  const blob = await writer([{ sheet: sheetName, data }]).toBlob();
  if (blob.size < 80 || blob.size > PDF_TABLE_254_LIMITS.maxOutputBytes) fail("XLSX_LIMIT", "Workbook oltre il limite o vuoto");
  const buffer = await blob.arrayBuffer();
  stop(signal);
  // Independent XLSX reader (not writer internals): values, provenance and
  // dimensions must exactly reopen; strings starting '=' remain inert strings.
  const reopened = await reader(buffer) as Array<{ sheet: string; data: unknown[][] }>;
  const wrong = expected.flatMap((row, r) => row.flatMap((cell, c) =>
    (reopened[0]?.data[r]?.[c] ?? "") === cell ? [] : [{ row: r + 1, column: c + 1,
      expected: cell, actual: reopened[0]?.data[r]?.[c] }])).at(0);
  if (reopened.length !== 1 || reopened[0]?.sheet !== sheetName ||
      reopened[0].data.length !== expected.length || wrong) {
    fail("XLSX_REOPEN_MISMATCH", `Workbook riaperto: valori o origine non coincidono (${wrong ? `riga ${wrong.row}, colonna ${wrong.column}` : "numero di fogli/righe"})`);
  }
  const bytes = new Uint8Array(buffer);
  return { bytes, blob: new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    sheetName, preview, policy: "text-only-no-formulas-no-ocr" };
}
