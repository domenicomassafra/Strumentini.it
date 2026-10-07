import type { PdfFilesInput, PdfArtifactOutput } from "../pdf/contracts";
export type ImagesToPdfInput = PdfFilesInput;
export type ImagesToPdfOutput = PdfArtifactOutput & {
  readonly pageCount: number;
  readonly background: string;
  readonly quality: number;
  readonly order: readonly number[];
  readonly rotations: Readonly<Record<number, 0 | 90 | 180 | 270>>;
  readonly pageSize: "original" | "a4" | "letter";
  readonly orientation: "auto" | "portrait" | "landscape";
  readonly fit: "contain" | "cover";
  readonly marginMm: number;
  readonly compositionMode: "pages" | "contact-sheet";
  readonly contactSheetColumns: number;
  readonly contactSheet: { readonly width: number; readonly height: number; readonly columns: number; readonly sourceCount: number } | null;
  readonly conversions: readonly {
    readonly name: string;
    readonly inputMime: string;
    readonly embeddedAs: "original-jpeg" | "jpeg-reencode";
    readonly alphaPolicy: string;
    readonly background: string | null;
    readonly framePolicy: string;
    readonly decoder: string;
  }[];
};
