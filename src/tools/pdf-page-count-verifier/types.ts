import type { PdfFileInput } from "../pdf/contracts";
export type PdfPageCountVerifierInput = PdfFileInput;
export interface PdfPageCountVerifierOutput { readonly pageCount: number; readonly declaredPageCount: number | null; readonly objectCount: number; readonly encrypted: boolean; readonly validSignature: boolean }
