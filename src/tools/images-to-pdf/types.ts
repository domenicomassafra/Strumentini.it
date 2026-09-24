import type { PdfFilesInput, PdfArtifactOutput } from "../pdf/contracts";
export type ImagesToPdfInput = PdfFilesInput;
export type ImagesToPdfOutput = PdfArtifactOutput & { readonly pageCount: number };
