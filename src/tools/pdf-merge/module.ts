import { inspectPdfBytes, mergePdfsWithPagePlan, type PdfMergePageRef } from "../../engines/pdf";
import { validatePdfMergePagePlan } from "../../engines/pdf/merge-page-plan";
import type { ToolModule } from "../../runtime/types";
import { requireFiles, resultArtifacts } from "../pdf/shared";
import type { PdfMergeOutput } from "./types";

const module: ToolModule = {
  async run(value, _context, signal): Promise<PdfMergeOutput> {
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT: Choose PDF files to merge.");
    const request = value as { files?: unknown; pagePlan?: unknown };
    const files = requireFiles(request.files, "PDF files");
    const sources: Array<{ name: string; pageCount: number; byteLength: number; rotations: readonly number[] }> = [];
    for (const file of files) {
      if (signal?.aborted) throw new DOMException("Operazione annullata", "AbortError");
      const bytes = new Uint8Array(await file.blob.arrayBuffer());
      const inspection = inspectPdfBytes(bytes);
      if (inspection.encrypted || inspection.pageCount < 1) throw new Error("UNSUPPORTED_CAPABILITY: PDF cifrato o senza pagine");
      sources.push({ name: file.filename, pageCount: inspection.pageCount, byteLength: bytes.length,
        rotations: inspection.pages.map((page) => page.rotation) });
    }
    const normalizedPlan = request.pagePlan === undefined ? undefined
      : validatePdfMergePagePlan(sources.map((source) => source.pageCount), request.pagePlan);
    const artifact = await mergePdfsWithPagePlan(files.map(({ blob }) => blob), normalizedPlan, signal);
    const sourcePageCount = sources.reduce((count, file) => count + file.pageCount, 0);
    const observed = inspectPdfBytes(artifact.bytes);
    const expectedPageCount = normalizedPlan?.length ?? sourcePageCount;
    if (expectedPageCount !== observed.pageCount) throw new Error("PDF_VERIFICATION_FAILED: Il numero di pagine unite non coincide con il piano selezionato");
    if (normalizedPlan !== undefined) {
      for (const [index, ref] of normalizedPlan.entries()) {
        const source = sources[ref.fileIndex]!;
        const originalPage = source.rotations[ref.page - 1]!;
        const expectedRotation = (originalPage + (ref.rotation ?? 0)) % 360;
        if (observed.pages[index]?.rotation !== expectedRotation) {
          throw new Error(`PDF_VERIFICATION_FAILED: Rotazione della pagina prodotta ${index + 1} diversa dal piano`);
        }
      }
    }
    return {
      ...resultArtifacts([artifact]), pageCount: artifact.pageCount ?? 0,
      sources: sources.map(({ name, pageCount, byteLength }) => ({ name, pageCount, byteLength })),
      sourcePageCount, verifiedOutputPageCount: observed.pageCount,
      sourceBytes: sources.reduce((sum, file) => sum + file.byteLength, 0),
      verifiedOutputBytes: artifact.bytes.byteLength,
      ...(normalizedPlan === undefined ? {} : {
        pagePlan: normalizedPlan as readonly PdfMergePageRef[],
        removedPages: sourcePageCount - normalizedPlan.length,
      }),
    };
  },
};

export default module;
