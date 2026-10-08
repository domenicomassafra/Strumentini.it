import type { PdfFileInput, PdfArtifactOutput } from "../pdf/contracts";
import type { PdfFlattenVerification } from "../../engines/pdf";
export type PdfFlattenInput = PdfFileInput;
export type PdfFlattenOutput = PdfArtifactOutput & { readonly policy: string; readonly verification: PdfFlattenVerification };
