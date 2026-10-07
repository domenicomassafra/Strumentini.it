import type { PdfFileInput, PdfArtifactOutput } from "../pdf/contracts";
export type PdfToImagesInput = PdfFileInput;
export type PdfToImagesOutput = PdfArtifactOutput & {
  readonly pageCount: number;
  readonly selectedPages: readonly number[];
  readonly mime: "image/jpeg" | "image/png" | "image/webp";
  readonly scale: number;
  readonly effectiveDpi: number;
  readonly quality: number | null;
  readonly renderer: "pdfjs-local-lazy";
  readonly renderedImageCount: number;
  readonly zipIncluded: boolean;
  readonly zipEntries: number;
  readonly failures: readonly { readonly page: number; readonly message: string }[];
};
