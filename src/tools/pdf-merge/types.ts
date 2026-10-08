import type { PdfFilesInput, PdfArtifactOutput } from "../pdf/contracts";
import type { PdfMergePageRef } from "../../engines/pdf";
export type PdfMergeInput = PdfFilesInput & { readonly pagePlan?: readonly PdfMergePageRef[] };
export type PdfMergeOutput = PdfArtifactOutput & {
  readonly pageCount: number;
  readonly sources: readonly { readonly name: string; readonly pageCount: number; readonly byteLength: number }[];
  readonly sourcePageCount: number;
  readonly verifiedOutputPageCount: number;
  readonly sourceBytes: number;
  readonly verifiedOutputBytes: number;
  readonly pagePlan?: readonly PdfMergePageRef[];
  readonly removedPages?: number;
};
