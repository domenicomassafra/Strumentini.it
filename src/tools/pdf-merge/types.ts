import type { PdfFilesInput, PdfArtifactOutput } from "../pdf/contracts";
export type PdfMergeInput = PdfFilesInput;
export type PdfMergeOutput = PdfArtifactOutput & { readonly pageCount: number };
