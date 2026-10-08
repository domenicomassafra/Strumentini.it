import { inspectPdfBytes, mergePdfs } from "../../engines/pdf";
import type { ToolModule } from "../../runtime/types";
import { requireFiles, resultArtifacts } from "../pdf/shared";
import type { PdfMergeOutput } from "./types";

const module: ToolModule = {
  async run(value, _context, signal): Promise<PdfMergeOutput> {
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT: Choose PDF files to merge.");
    const files = requireFiles((value as { files?: unknown }).files, "PDF files");
    const sources: Array<{ name: string; pageCount: number; byteLength: number }> = [];
    for (const file of files) {
      if (signal?.aborted) throw new DOMException("Operazione annullata", "AbortError");
      const bytes = new Uint8Array(await file.blob.arrayBuffer());
      const inspection = inspectPdfBytes(bytes);
      if (inspection.encrypted || inspection.pageCount < 1) throw new Error("UNSUPPORTED_CAPABILITY: PDF cifrato o senza pagine");
      sources.push({ name: file.filename, pageCount: inspection.pageCount, byteLength: bytes.length });
    }
    const artifact = await mergePdfs(files.map(({ blob }) => blob), signal);
    const sourcePageCount = sources.reduce((count, file) => count + file.pageCount, 0);
    const observedPageCount = inspectPdfBytes(artifact.bytes).pageCount;
    if (sourcePageCount !== observedPageCount) throw new Error("PDF_VERIFICATION_FAILED: Il numero di pagine unite non coincide con le sorgenti");
    return {
      ...resultArtifacts([artifact]), pageCount: artifact.pageCount ?? 0,
      sources, sourcePageCount, verifiedOutputPageCount: observedPageCount,
      sourceBytes: sources.reduce((sum, file) => sum + file.byteLength, 0),
      verifiedOutputBytes: artifact.bytes.byteLength,
    };
  },
};

export default module;
