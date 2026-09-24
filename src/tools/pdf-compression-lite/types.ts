import type { PdfFileInput, PdfArtifactOutput } from "../pdf/contracts";
export type PdfCompressionInput = PdfFileInput;
export type PdfCompressionOutput = PdfArtifactOutput & { readonly policy: string };
