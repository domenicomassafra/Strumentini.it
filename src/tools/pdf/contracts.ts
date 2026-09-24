import type {
  PdfArtifact,
  PdfCompareResult,
  PdfDocumentManifest,
  PdfInspection,
  PdfTextPage,
} from "../../engines/pdf";

export interface PdfFileInput {
  readonly file: Blob;
}

export interface PdfFilesInput {
  readonly files: readonly Blob[];
}

export interface PdfMutationInput extends PdfFileInput {
  readonly pages?: readonly number[] | string;
  readonly order?: readonly number[] | string;
  readonly groups?: readonly ((number[] | string)[])[] | string;
  readonly rotations?: Readonly<Record<number, 90 | 180 | 270>>;
}

export interface PdfArtifactOutput {
  readonly artifacts: readonly PdfArtifact[];
  readonly artifactCount: number;
  readonly totalBytes: number;
}

export interface PdfInspectionOutput {
  readonly inspection: PdfInspection;
  readonly pageCount: number;
  readonly byteLength: number;
  readonly encrypted: boolean;
}

export interface PdfTextOutput {
  readonly pages: readonly PdfTextPage[];
  readonly text: string;
  readonly truncated: boolean;
}

export interface PdfCompareOutput {
  readonly comparison: PdfCompareResult;
  readonly summary: string;
}

export interface PdfManifestOutput {
  readonly manifest: PdfDocumentManifest;
  readonly json: string;
}
