import type { PdfFileInput, PdfArtifactOutput } from "../pdf/contracts";
export type PdfFlattenInput = PdfFileInput;
export type PdfFlattenOutput = PdfArtifactOutput & { readonly policy: string };
