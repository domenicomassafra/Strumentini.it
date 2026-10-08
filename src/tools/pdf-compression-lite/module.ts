import { inspectPdfBytes, mutatePdf, PDF_LIMITS } from "../../engines/pdf";
import { describePdfStructuralCompression } from "../../engines/pdf/compression-profile";
import type { ToolModule } from "../../runtime/types";
import { checkSignal, mutationInput, resultArtifacts } from "../pdf/shared";
import type { PdfCompressionOutput } from "./types";

const module: ToolModule = {
  async run(value, _context, signal): Promise<PdfCompressionOutput> {
    const parsed = mutationInput(value);
    const candidate = value as { profile?: unknown; grayscale?: unknown };
    if (candidate.profile !== undefined && candidate.profile !== "structural-only") {
      throw new Error("UNSUPPORTED_CAPABILITY: Image-aware and scan PDF recompression profiles are not implemented or approved.");
    }
    if (candidate.grayscale !== undefined && candidate.grayscale !== false) {
      throw new Error("UNSUPPORTED_CAPABILITY: PDF grayscale conversion is not implemented; original vectors/text must not be silently rasterized.");
    }
    if (parsed.file.blob.size > PDF_LIMITS.maxBytes) throw new Error("PDF_LIMIT: Input exceeds the local PDF size cap.");
    checkSignal(signal);
    const sourceBytes = new Uint8Array(await parsed.file.blob.arrayBuffer());
    checkSignal(signal);
    const before = inspectPdfBytes(sourceBytes);
    const artifacts = await mutatePdf(sourceBytes, { kind: "compress", filename: parsed.options.filename }, signal);
    if (artifacts.length !== 1) throw new Error("PDF_OUTPUT_MISMATCH: Structural compression must produce one PDF.");
    const after = inspectPdfBytes(artifacts[0]!.bytes);
    const analysis = describePdfStructuralCompression(before, after);
    return {
      ...resultArtifacts(artifacts),
      policy: "Structural-only cleanup. No embedded image downsampling, recompression, grayscale or pixel-perfect/semantic equivalence is claimed.",
      analysis,
      warnings: analysis.warnings,
    };
  },
};

export default module;
