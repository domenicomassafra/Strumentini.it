import type { PdfMutationInput, PdfArtifactOutput } from "../pdf/contracts";
export type PdfPageReorderInput = PdfMutationInput;
export type PdfPageReorderOutput = PdfArtifactOutput & { readonly order: readonly number[] };
