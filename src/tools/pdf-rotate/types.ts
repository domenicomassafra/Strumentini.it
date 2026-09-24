import type { PdfMutationInput, PdfArtifactOutput } from "../pdf/contracts";
export type PdfRotateInput = PdfMutationInput;
export type PdfRotateOutput = PdfArtifactOutput & { readonly rotations: Readonly<Record<number, 90 | 180 | 270>> };
