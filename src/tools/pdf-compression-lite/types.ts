import type { PdfFileInput, PdfArtifactOutput } from "../pdf/contracts";
import type { PdfStructuralCompressionAnalysis } from "../../engines/pdf/compression-profile";
export type PdfCompressionInput = PdfFileInput & { readonly profile?: "structural-only" | "image-aware" | "scan"; readonly grayscale?: boolean };
export type PdfCompressionOutput = PdfArtifactOutput & { readonly policy: string; readonly analysis: PdfStructuralCompressionAnalysis; readonly warnings: readonly string[] };
