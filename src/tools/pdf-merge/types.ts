import type { PdfFilesInput, PdfArtifactOutput } from "../pdf/contracts";
export type PdfMergeInput = PdfFilesInput;
export type PdfMergeOutput = PdfArtifactOutput & {
  readonly pageCount: number;
  readonly sources: readonly { readonly name: string; readonly pageCount: number; readonly byteLength: number }[];
  readonly sourcePageCount: number;
  readonly verifiedOutputPageCount: number;
  readonly sourceBytes: number;
  readonly verifiedOutputBytes: number;
};
