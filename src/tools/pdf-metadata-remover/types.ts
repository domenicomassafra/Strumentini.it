import type { PdfFileInput, PdfArtifactOutput } from "../pdf/contracts";
export type PdfMetadataRemoverInput = PdfFileInput;
export type PdfMetadataRemoverOutput = PdfArtifactOutput & { readonly policy: string };
