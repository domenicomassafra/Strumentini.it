import { inspectPdfBytes } from "./index";
import { parsePdf, type PdfDocumentModel } from "./parser";
import { buildPdfFromPages } from "./writer";
import { PDF_LIMITS, type PdfArtifact } from "./types";

const MAX_PARTS = 50;
const MAX_CANDIDATE_BUILDS = 400;

function abort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Split by size cancelled", "AbortError");
}

export interface PdfMeasuredPart249 {
  readonly filename: string;
  readonly pages: readonly number[];
  readonly bytes: number;
  readonly limitBytes: number;
}

export class PdfSinglePageLimit249 extends Error {
  readonly code = "PDF_SINGLE_PAGE_TOO_LARGE";
  constructor(readonly page: number, readonly minimumBytes: number, readonly targetBytes: number) {
    super(`PDF_SINGLE_PAGE_TOO_LARGE: Page ${page} needs ${minimumBytes} bytes; requested ceiling ${targetBytes}. Remove that page or raise the ceiling.`);
    this.name = "PdfSinglePageLimit249";
  }
}

/**
 * Greedy, actual-byte sizing: there is no formula or estimated PDF share per
 * source page. Rebuild each candidate and verify the final part's page count,
 * page geometry and byte ceiling. Never silently omit a page to meet target.
 */
export function splitPdfBySize249(source: Uint8Array, maxPartBytes: number, signal?: AbortSignal): {
  readonly artifacts: readonly PdfArtifact[];
  readonly parts: readonly PdfMeasuredPart249[];
  readonly allSourcePagesCovered: true;
  readonly attemptedCandidateBuilds: number;
} {
  if (!(source instanceof Uint8Array) || source.length < 8 || source.length > PDF_LIMITS.maxBytes) {
    throw new Error("PDF_LIMIT: Invalid source PDF for size splitter");
  }
  if (!Number.isSafeInteger(maxPartBytes) || maxPartBytes < 1024 || maxPartBytes > 20 * 1024 * 1024) {
    throw new Error("INVALID_INPUT: Per-part PDF maximum must be between 1 KiB and 20 MiB in exact bytes");
  }
  abort(signal);
  const model = parsePdf(source);
  if (model.encrypted || model.pages.length === 0 || model.pages.length > PDF_LIMITS.maxPages) {
    throw new Error("UNSUPPORTED_CAPABILITY: Encrypted, empty, or oversized PDF cannot be split");
  }
  const before = inspectPdfBytes(source);
  // The limited writer has not certified round-tripping interactive graphs.
  if (before.forms.length > 0 || before.pages.some((page) => page.annotationCount > 0)) {
    throw new Error("UNSUPPORTED_CAPABILITY: PDF form and annotation preservation requires separate validation");
  }
  let builds = 0;
  const build = (selected: readonly number[]) => {
    abort(signal);
    if (++builds > MAX_CANDIDATE_BUILDS) throw new Error("PDF_LIMIT: Size splitter candidate budget exhausted");
    const out = buildPdfFromPages(selected.map((number) => ({ document: model, page: model.pages[number - 1]! })),
      { flatten: false, stripMetadata: false, compress: false });
    const verified = inspectPdfBytes(out);
    if (verified.pageCount !== selected.length || verified.encrypted || selected.some((number, index) => {
      const expected = before.pages[number - 1];
      const actual = verified.pages[index];
      return expected?.width !== actual?.width || expected?.height !== actual?.height || expected?.rotation !== actual?.rotation;
    })) throw new Error("PDF_OUTPUT_MISMATCH: Split output changed page count or geometry");
    abort(signal);
    return out;
  };
  const parts: PdfMeasuredPart249[] = [];
  const artifacts: PdfArtifact[] = [];
  let currentPages: number[] = [];
  let currentOutput: Uint8Array | null = null;
  const finalize = () => {
    if (currentPages.length === 0 || currentOutput === null) return;
    if (parts.length >= MAX_PARTS) throw new Error("PDF_LIMIT: Split requires more than 50 parts");
    const filename = `pdf-part-${String(parts.length + 1).padStart(3, "0")}-pages-${currentPages[0]}-${currentPages.at(-1)}.pdf`;
    const bytes = Uint8Array.from(currentOutput);
    if (bytes.length > maxPartBytes) throw new Error("PDF_OUTPUT_MISMATCH: A part exceeds its requested exact-byte ceiling");
    parts.push({ filename, pages: [...currentPages], bytes: bytes.length, limitBytes: maxPartBytes });
    artifacts.push({ filename, bytes, blob: new Blob([bytes], { type: "application/pdf" }),
      mime: "application/pdf", pageCount: currentPages.length });
    currentPages = [];
    currentOutput = null;
  };
  for (let page = 1; page <= model.pages.length; page += 1) {
    abort(signal);
    const proposed = [...currentPages, page];
    const candidate = build(proposed);
    if (candidate.length <= maxPartBytes) {
      currentPages = proposed;
      currentOutput = candidate;
      continue;
    }
    if (currentPages.length === 0) throw new PdfSinglePageLimit249(page, candidate.length, maxPartBytes);
    finalize();
    const singleton = build([page]);
    if (singleton.length > maxPartBytes) throw new PdfSinglePageLimit249(page, singleton.length, maxPartBytes);
    currentPages = [page];
    currentOutput = singleton;
  }
  finalize();
  const flattened = parts.flatMap((part) => part.pages);
  if (flattened.length !== model.pages.length || flattened.some((page, index) => page !== index + 1)) {
    throw new Error("PDF_OUTPUT_MISMATCH: Size split lost or reordered a source page");
  }
  return { artifacts, parts, allSourcePagesCovered: true, attemptedCandidateBuilds: builds };
}
