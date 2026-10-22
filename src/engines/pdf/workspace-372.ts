import { PDFDocument } from "pdf-lib";
import { mutatePdf, type PdfArtifact } from "./index";
import { strictPdfPageNumbers } from "./page-selection";
import { PDF_LIMITS } from "./types";
import { copyAnnotatedPages380, hasSourceAnnotations380, verifyPdfSourceBoundExport380 } from "./source-bound-export-380";

export type PdfWorkspaceMode372 = "reorder" | "selected";

function abort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Elaborazione PDF annullata", "AbortError");
}

/**
 * Reuses the repository's PDF writer for a narrow, independently reopened
 * page operation. The source is copied and never patched in place.
 * Runs inside a disposable Worker on the browser route.
 */
export async function runPdfPageWorkspace372(
  source: Uint8Array,
  order: readonly number[],
  selected: readonly number[],
  mode: PdfWorkspaceMode372,
  filename: string,
  signal?: AbortSignal,
): Promise<PdfArtifact> {
  abort(signal);
  if (!(source instanceof Uint8Array) || source.byteLength < 8 || source.byteLength > PDF_LIMITS.maxBytes) {
    throw new Error("PDF_LIMIT: File assente o oltre 25 MiB; originale conservato");
  }
  if (!["reorder", "selected"].includes(mode)) throw new Error("INVALID_INPUT: Operazione non disponibile");
  const copy = source.slice();
  const original = await PDFDocument.load(copy, { ignoreEncryption: false, updateMetadata: false });
  abort(signal);
  const count = original.getPageCount();
  const validOrder = strictPdfPageNumbers(order, count);
  if (validOrder.length !== count) throw new Error("INVALID_INPUT: L'ordine deve comprendere ogni pagina una volta sola");
  if (selected.length > count || new Set(selected).size !== selected.length ||
      selected.some((page) => !Number.isInteger(page) || page < 1 || page > count)) {
    throw new Error("INVALID_INPUT: Selezione duplicata o fuori dal documento");
  }
  const chosen = mode === "reorder" ? validOrder : validOrder.filter((page) => selected.includes(page));
  if (chosen.length < 1) throw new Error("INVALID_INPUT: Seleziona almeno una pagina da esportare");
  abort(signal);
  const containsAnnotations = hasSourceAnnotations380(copy);
  const annotatedBytes = containsAnnotations ? await copyAnnotatedPages380(copy, chosen) : null;
  const artifact = annotatedBytes === null
    ? (await mutatePdf(copy, mode === "reorder"
        ? { kind: "reorder", order: validOrder, filename }
        : { kind: "extract", pages: chosen, filename }, signal))[0]
    : {
        bytes: annotatedBytes,
        blob: new Blob([Uint8Array.from(annotatedBytes)], { type: "application/pdf" }),
        filename: filename.replace(/\.pdf$/iu, "").slice(0, 115) + "-annotated-pages.pdf",
        mime: "application/pdf" as const,
        pageCount: chosen.length,
      };
  if (artifact === undefined || artifact.bytes.byteLength < 8 || artifact.bytes.byteLength > PDF_LIMITS.maxOutputBytes) {
    throw new Error("PDF_LIMIT: Nessun risultato PDF integro prodotto");
  }
  // The generic page writer flattens annotations. Copy annotated pages with
  // pdf-lib and require exact annotation/text readback before returning a file.
  const bytes = artifact.bytes;
  await verifyPdfSourceBoundExport380(copy, bytes, { kind: "page-transfer", sourcePages: chosen }, signal);
  abort(signal);
  // Independent parser checks exact sequence and page geometry after writing.
  const reopened = await PDFDocument.load(bytes.slice(), { ignoreEncryption: false, updateMetadata: false });
  if (reopened.getPageCount() !== chosen.length) throw new Error("PDF_VERIFY: Il numero di pagine non coincide");
  const sourcePages = original.getPages();
  const outputPages = reopened.getPages();
  for (let index = 0; index < chosen.length; index++) {
    abort(signal);
    const expected = sourcePages[chosen[index]! - 1]!;
    const actual = outputPages[index]!;
    if (Math.abs(actual.getWidth() - expected.getWidth()) > 0.01 ||
        Math.abs(actual.getHeight() - expected.getHeight()) > 0.01 ||
        actual.getRotation().angle !== expected.getRotation().angle) {
      throw new Error("PDF_VERIFY: Dimensioni o rotazione pagina non conservate");
    }
  }
  abort(signal);
  return artifact;
}
