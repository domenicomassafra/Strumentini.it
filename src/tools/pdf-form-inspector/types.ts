import type { PdfFileInput } from "../pdf/contracts";
import type { PdfFormField, PdfFormAnnotationAudit } from "../../engines/pdf";
export type PdfFormInspectorInput = PdfFileInput;
export interface PdfFormInspectorOutput {
  readonly forms: readonly PdfFormField[];
  readonly pageCount: number;
  readonly encrypted: boolean;
  readonly audit: PdfFormAnnotationAudit;
}
