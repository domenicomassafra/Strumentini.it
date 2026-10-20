import { PDF_LIMITS } from "./types";

export class PdfPageSelectionError extends Error {
  readonly code = "INVALID_PDF_PAGE_SELECTION";
  constructor(readonly token: string, message: string) {
    super(`Selezione pagine: token "${token}" non valido — ${message}`);
    this.name = "PdfPageSelectionError";
  }
}

const MAX_SELECTION_EXPRESSION_CHARACTERS = 4096;
function assertExpressionLength(expression: string): void {
  if (expression.length > MAX_SELECTION_EXPRESSION_CHARACTERS) {
    throw new PdfPageSelectionError("(lunghezza)", "espressione troppo lunga per l'elaborazione locale");
  }
}

function assertCount(pageCount: number): void {
  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > PDF_LIMITS.maxPages) {
    throw new PdfPageSelectionError(String(pageCount), "numero di pagine fuori dai limiti locali");
  }
}

function wholeNumber(value: string, token: string): number {
  if (!/^\d+$/u.test(value) || Number(value) < 1 || !Number.isSafeInteger(Number(value))) {
    throw new PdfPageSelectionError(token, "serve un numero intero positivo");
  }
  return Number(value);
}

/** The same strict grammar is used for text entry, thumbnail selection and runtime. */
export function parsePdfPageSelection(expression: string, pageCount: number): number[] {
  assertCount(pageCount);
  assertExpressionLength(expression);
  const text = expression.trim();
  if (text === "") throw new PdfPageSelectionError("(vuoto)", "specifica le pagine da elaborare");
  if (text === "*" || /^tutte$/iu.test(text)) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const each = /^ogni\s*:?\s*(\d+)$/iu.exec(text);
  if (each !== null) {
    const stride = wholeNumber(each[1]!, text);
    if (stride > pageCount) throw new PdfPageSelectionError(text, `passo maggiore di ${pageCount}`);
    // 'ogni N' deliberately means pages N, 2N, 3N, ... (not 1, N+1).
    return Array.from({ length: Math.floor(pageCount / stride) }, (_, i) => (i + 1) * stride);
  }
  const found: number[] = [];
  const seen = new Set<number>();
  for (const raw of text.split(",")) {
    const token = raw.trim();
    if (token === "") throw new PdfPageSelectionError("(vuoto)", "separatore senza numero");
    const range = /^(\d+)\s*-\s*(\d+)$/u.exec(token);
    const pages = range !== null
      ? (() => {
          const from = wholeNumber(range[1]!, token);
          const to = wholeNumber(range[2]!, token);
          if (from > to) throw new PdfPageSelectionError(token, "intervallo decrescente");
          if (to > pageCount) throw new PdfPageSelectionError(token, `pagina oltre ${pageCount}`);
          return Array.from({ length: to - from + 1 }, (_, i) => from + i);
        })()
      : [wholeNumber(token, token)];
    for (const page of pages) {
      if (page > pageCount) throw new PdfPageSelectionError(token, `pagina oltre ${pageCount}`);
      if (seen.has(page)) throw new PdfPageSelectionError(token, `pagina ${page} ripetuta`);
      seen.add(page);
      found.push(page);
    }
  }
  return found;
}

/** Reordering requires the strict selection to contain every original page exactly once. */
export function parsePdfPageReorder(expression: string, pageCount: number): number[] {
  const pages = parsePdfPageSelection(expression, pageCount);
  if (pages.length !== pageCount) {
    throw new PdfPageSelectionError("(ordine)", `specifica tutte le ${pageCount} pagine una sola volta`);
  }
  return pages;
}

export function parsePdfPageGroups(expression: string, pageCount: number): number[][] {
  assertCount(pageCount);
  assertExpressionLength(expression);
  const text = expression.trim();
  const chunk = /^blocchi\s*:?\s*(\d+)$/iu.exec(text);
  if (chunk !== null) {
    const size = wholeNumber(chunk[1]!, text);
    if (size > pageCount) throw new PdfPageSelectionError(text, `blocco maggiore di ${pageCount}`);
    const output: number[][] = [];
    for (let page = 1; page <= pageCount; page += size) {
      output.push(Array.from({ length: Math.min(size, pageCount - page + 1) }, (_, index) => page + index));
    }
    return output;
  }
  const parts = text.split(";");
  if (parts.length > PDF_LIMITS.maxPages) throw new PdfPageSelectionError(text, "troppi gruppi");
  return parts.map((part) => parsePdfPageSelection(part, pageCount));
}

export function strictPdfPageNumbers(pages: readonly number[], pageCount: number): number[] {
  assertCount(pageCount);
  if (!Array.isArray(pages) || pages.length === 0) throw new PdfPageSelectionError("(vuoto)", "nessuna pagina selezionata");
  if (pages.length > pageCount) throw new PdfPageSelectionError(String(pages.length), "troppe pagine");
  const seen = new Set<number>();
  for (const page of pages) {
    if (!Number.isInteger(page) || page < 1 || page > pageCount || seen.has(page)) {
      throw new PdfPageSelectionError(String(page), "numero fuori intervallo o duplicato");
    }
    seen.add(page);
  }
  return [...pages];
}

export function strictPdfGroups(groups: readonly (readonly number[])[], pageCount: number): number[][] {
  assertCount(pageCount);
  if (!Array.isArray(groups) || groups.length === 0 || groups.length > PDF_LIMITS.maxPages) {
    throw new PdfPageSelectionError("(gruppi)", "numero di gruppi non valido");
  }
  return groups.map((group) => strictPdfPageNumbers(group, pageCount));
}
