import type { PdfFileInput } from "../pdf/contracts";
import type { PdfPageSummary } from "../../engines/pdf";
export type PdfPageSizeInspectorInput = PdfFileInput;
export interface PdfPageSizeInspectorOutput { readonly pages: readonly PdfPageSummary[]; readonly pageCount: number; readonly warnings: readonly string[] }
