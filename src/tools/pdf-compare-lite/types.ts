import type { PdfCompareOutput as ContractCompareOutput } from "../pdf/contracts";
export type PdfCompareInput = { readonly first: Blob; readonly second: Blob };
export type PdfCompareOutput = ContractCompareOutput;
