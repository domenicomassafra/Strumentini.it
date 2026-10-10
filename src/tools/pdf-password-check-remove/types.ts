import type { PdfFileInput, PdfArtifactOutput } from "../pdf/contracts";
import type { PdfInspection } from "../../engines/pdf";
export type PdfPasswordCheckInput = PdfFileInput & { readonly mode?: "check" | "remove"; readonly password?: string };
export type PdfPasswordCheckOutput = { readonly mode: "check"; readonly encrypted: boolean; readonly inspected: PdfInspection; readonly policy: string } | { readonly mode: "remove"; readonly encrypted: false; readonly artifact: PdfArtifactOutput; readonly policy: string };
