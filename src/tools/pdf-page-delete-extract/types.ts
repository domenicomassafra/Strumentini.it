import type { PdfMutationInput, PdfArtifactOutput } from "../pdf/contracts";
export type PdfPageDeleteExtractInput = PdfMutationInput & { readonly mode?: "delete" | "extract" };
export type PdfPageDeleteExtractOutput = PdfArtifactOutput & { readonly mode: "delete" | "extract"; readonly pages: readonly number[] };
