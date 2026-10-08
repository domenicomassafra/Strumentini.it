import { inspectPdfBytes, mutatePdf, PDF_LIMITS } from "../../engines/pdf";
import { parsePdfPageGroups, strictPdfGroups } from "../../engines/pdf/page-selection";
import { createZip, inspectZip } from "../../engines/file-privacy";
import type { ToolModule } from "../../runtime/types";
import { resultArtifacts } from "../pdf/shared";
import type { PdfSplitOutput } from "./types";

const module: ToolModule = {
  async run(value, _context, signal): Promise<PdfSplitOutput> {
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT: Scegli un PDF da dividere");
    const candidate = value as { file?: unknown; groups?: unknown };
    // Avoid the legacy array-only mutationInput on the new strict expression grammar.
    const file = candidate.file;
    if (!(file instanceof Blob) || file.size > PDF_LIMITS.maxBytes || file.size < 5) throw new Error("PDF_LIMIT: PDF locale non valido");
    if (signal?.aborted) throw new DOMException("Operazione annullata", "AbortError");
    const original = new Uint8Array(await file.arrayBuffer());
    const source = inspectPdfBytes(original);
    if (source.encrypted || source.pageCount < 1) throw new Error("UNSUPPORTED_CAPABILITY: PDF cifrato o privo di pagine");
    const groups = candidate.groups === undefined
      ? [Array.from({ length: source.pageCount }, (_, index) => index + 1)]
      : typeof candidate.groups === "string"
        ? parsePdfPageGroups(candidate.groups, source.pageCount)
        : strictPdfGroups(candidate.groups as readonly number[][], source.pageCount);
    const filename = "name" in file && typeof file.name === "string" ? file.name : "document.pdf";
    const outputs = await mutatePdf(file, { kind: "split", filename, groups }, signal);
    if (outputs.length !== groups.length) throw new Error("PDF_VERIFICATION_FAILED: Numero parti PDF non coerente");
    const verified = outputs.map((artifact, index) => {
      const pages = inspectPdfBytes(artifact.bytes).pageCount;
      if (pages !== groups[index]!.length) throw new Error("PDF_VERIFICATION_FAILED: Una parte PDF contiene pagine inattese");
      return { filename: artifact.filename, pages: groups[index]!, pageCount: pages, byteLength: artifact.bytes.byteLength };
    });
    const artifacts = [...outputs];
    let zipIncluded = false;
    let zipEntries = 0;
    if (outputs.length > 1) {
      if (signal?.aborted) throw new DOMException("Operazione annullata", "AbortError");
      const zipFiles = outputs.map((artifact) => new File([artifact.bytes.slice().buffer as ArrayBuffer], artifact.filename, { type: "application/pdf" }));
      const zip = await createZip({ files: zipFiles }, signal);
      if (!(zip.blob instanceof Blob)) throw new Error("ZIP_VERIFY_FAILED: Archivio non prodotto");
      const zipBytes = new Uint8Array(await zip.blob.arrayBuffer());
      const inspected = await inspectZip({ files: [new File([zipBytes], "pdf-divisi.zip", { type: "application/zip" })] }, signal);
      const entries = Array.isArray(inspected.entries) ? inspected.entries : [];
      if (entries.length !== outputs.length || entries.some((entry, index) =>
        entry.path !== outputs[index]?.filename || entry.uncompressedSize !== outputs[index]?.bytes.byteLength || entry.pathTraversal || entry.encrypted
      )) throw new Error("ZIP_VERIFY_FAILED: Indice ZIP diverso dalle parti prodotte");
      const { unzipSync } = await import("fflate");
      const expanded = unzipSync(zipBytes);
      for (const artifact of outputs) {
        if (signal?.aborted) throw new DOMException("Operazione annullata", "AbortError");
        const actual = expanded[artifact.filename];
        if (actual === undefined || actual.length !== artifact.bytes.length ||
            actual.some((byte, index) => byte !== artifact.bytes[index])) {
          throw new Error("ZIP_VERIFY_FAILED: I byte riaperti non corrispondono alla parte PDF originale");
        }
      }
      artifacts.push({ bytes: zipBytes, blob: zip.blob, mime: "application/zip", filename: "pdf-divisi.zip" });
      zipIncluded = true;
      zipEntries = outputs.length;
    }
    return { ...resultArtifacts(artifacts), operation: "split", groups, verified, sourcePageCount: source.pageCount, zipIncluded, zipEntries };
  },
};

export default module;
