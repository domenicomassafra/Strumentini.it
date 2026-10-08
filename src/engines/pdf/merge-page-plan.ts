import { PDF_LIMITS } from "./types";

/** File indices are zero-based, page identities are one-based and never positional. */
export interface PdfMergePageRef {
  readonly fileIndex: number;
  readonly page: number;
  /** Additional clockwise rotation relative to the source page, in degrees. */
  readonly rotation?: 0 | 90 | 180 | 270;
}

export function defaultPdfMergePagePlan(counts: readonly number[]): PdfMergePageRef[] {
  assertCounts(counts);
  return counts.flatMap((count, fileIndex) =>
    Array.from({ length: count }, (_, i) => ({ fileIndex, page: i + 1 })));
}

function assertCounts(counts: readonly number[]) {
  if (counts.length < 2 || counts.length > PDF_LIMITS.maxFiles
    || counts.some((count) => !Number.isInteger(count) || count < 1 || count > PDF_LIMITS.maxPages)
    || counts.reduce((sum, count) => sum + count, 0) > PDF_LIMITS.maxPages) {
    throw new Error("PDF_LIMIT: Numero di sorgenti o pagine fuori dai limiti del merge");
  }
}

export function validatePdfMergePagePlan(counts: readonly number[], value: unknown): PdfMergePageRef[] {
  assertCounts(counts);
  if (!Array.isArray(value) || value.length < 1 || value.length > PDF_LIMITS.maxPages) {
    throw new Error("INVALID_INPUT: Piano pagine vuoto o troppo lungo");
  }
  const used = new Set<string>();
  return value.map((candidate: unknown, index: number): PdfMergePageRef => {
    if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
      throw new Error(`INVALID_INPUT: Riferimento pagina ${index + 1} non valido`);
    }
    const ref = candidate as Record<string, unknown>;
    const { fileIndex, page, rotation } = ref;
    if (!Number.isInteger(fileIndex) || !Number.isInteger(page)
      || Number(fileIndex) < 0 || Number(fileIndex) >= counts.length
      || Number(page) < 1 || Number(page) > counts[Number(fileIndex)]!) {
      throw new Error(`INVALID_INPUT: Riferimento pagina ${index + 1} fuori intervallo`);
    }
    if (rotation !== undefined && rotation !== 0 && rotation !== 90 && rotation !== 180 && rotation !== 270) {
      throw new Error(`INVALID_INPUT: Rotazione pagina ${index + 1} non supportata`);
    }
    const key = `${fileIndex}:${page}`;
    if (used.has(key)) throw new Error(`INVALID_INPUT: Pagina ${key} duplicata nel piano`);
    used.add(key);
    return {
      fileIndex: Number(fileIndex),
      page: Number(page),
      ...(rotation === undefined || rotation === 0 ? {} : { rotation: rotation as 90 | 180 | 270 }),
    };
  });
}

export function movePdfMergePage(plan: readonly PdfMergePageRef[], source: string, target: string): PdfMergePageRef[] {
  const key = (ref: PdfMergePageRef) => `${ref.fileIndex}:${ref.page}`;
  const start = plan.findIndex((ref) => key(ref) === source);
  const end = plan.findIndex((ref) => key(ref) === target);
  if (start < 0 || end < 0) throw new Error("INVALID_INPUT: Pagina inesistente nel piano");
  const next = [...plan];
  next.splice(end, 0, next.splice(start, 1)[0]!);
  return next;
}
