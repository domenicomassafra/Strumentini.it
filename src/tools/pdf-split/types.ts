import type { PdfMutationInput, PdfArtifactOutput } from "../pdf/contracts";
export type PdfSplitInput = PdfMutationInput;
export type PdfSplitOutput = PdfArtifactOutput & { readonly operation: "split" };
