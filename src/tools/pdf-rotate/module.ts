import { inspectPdfBytes, mutatePdf, PDF_LIMITS } from "../../engines/pdf";
import { parsePdfPageSelection } from "../../engines/pdf/page-selection";
import type { ToolModule } from "../../runtime/types";
import { mutationInput, requireFile, resultArtifacts } from "../pdf/shared";
import type { PdfRotateOutput } from "./types";

const module: ToolModule = {
  async run(value, _context, signal): Promise<PdfRotateOutput> {
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT: Seleziona un PDF");
    const input = value as { file?: unknown; pages?: unknown; rotation?: unknown; rotations?: unknown };
    if (input.pages === undefined && input.rotations !== undefined) {
      // Compatibility: the pre-existing verified per-page rotations contract.
      const parsed = mutationInput(value);
      const rotations = parsed.options.rotations ?? { 1: 90 };
      const artifacts = await mutatePdf(parsed.file.blob, { kind: "rotate", filename: parsed.options.filename, rotations }, signal);
      return { ...resultArtifacts(artifacts), rotations };
    }
    const file = requireFile(input.file);
    if (file.blob.size > PDF_LIMITS.maxBytes) throw new Error("PDF_LIMIT: PDF troppo grande");
    if (signal?.aborted) throw new DOMException("Operazione annullata", "AbortError");
    const inspection = inspectPdfBytes(new Uint8Array(await file.blob.arrayBuffer()));
    if (inspection.encrypted || inspection.pageCount < 1) throw new Error("UNSUPPORTED_CAPABILITY: PDF cifrato o privo di pagine");
    if (input.rotation !== 90 && input.rotation !== 180 && input.rotation !== 270) {
      throw new Error("INVALID_INPUT: La rotazione deve essere 90, 180 o 270 gradi");
    }
    const pages = typeof input.pages === "string"
      ? parsePdfPageSelection(input.pages, inspection.pageCount)
      : input.pages === undefined ? [1]
        : (() => { throw new Error("INVALID_INPUT: Espressione delle pagine non valida"); })();
    const rotations = Object.fromEntries(pages.map((page) => [page, input.rotation])) as Record<number, 90 | 180 | 270>;
    const artifacts = await mutatePdf(file.blob, { kind: "rotate", filename: file.filename, rotations }, signal);
    const observed = inspectPdfBytes(artifacts[0]!.bytes);
    if (observed.pageCount !== inspection.pageCount) throw new Error("PDF_VERIFICATION_FAILED: Numero di pagine alterato");
    for (const [index, source] of inspection.pages.entries()) {
      const target = observed.pages[index];
      if (target?.rotation !== (rotations[index + 1] ?? source.rotation)) {
        throw new Error(`PDF_VERIFICATION_FAILED: Rotazione pagina ${index + 1} incoerente`);
      }
    }
    return { ...resultArtifacts(artifacts), rotations };
  },
};

export default module;
