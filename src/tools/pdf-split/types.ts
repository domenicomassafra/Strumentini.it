import type { PdfMutationInput, PdfArtifactOutput } from "../pdf/contracts";
export type PdfSplitInput = PdfMutationInput;
export type PdfSplitOutput = PdfArtifactOutput & {
  readonly operation: "split";
  readonly groups: readonly (readonly number[])[];
  readonly verified: readonly { readonly filename: string; readonly pages: readonly number[]; readonly pageCount: number; readonly byteLength: number }[];
  readonly sourcePageCount: number;
  readonly zipIncluded: boolean;
  readonly zipEntries: number;
};
