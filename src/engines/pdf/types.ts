export const PDF_LIMITS = {
  maxBytes: 25 * 1024 * 1024,
  maxOutputBytes: 50 * 1024 * 1024,
  maxPages: 200,
  maxObjects: 50_000,
  maxPageDimension: 20_000,
  maxStreams: 4_000,
  maxTextBytes: 2 * 1024 * 1024,
  maxImages: 256,
  maxImageBytes: 12 * 1024 * 1024,
  maxFiles: 50,
  maxTotalImageBytes: 40 * 1024 * 1024,
} as const;

export type PdfCapability =
  | "inspect"
  | "mutate-pages"
  | "extract-text"
  | "inspect-metadata"
  | "inspect-links"
  | "inspect-forms"
  | "extract-images"
  | "create-from-jpeg"
  | "flatten";

export interface PdfCapabilityReport {
  readonly capability: PdfCapability;
  readonly available: boolean;
  readonly reason?: string;
}

export interface PdfMetadata {
  readonly title: string | null;
  readonly author: string | null;
  readonly subject: string | null;
  readonly keywords: string | null;
  readonly creator: string | null;
  readonly producer: string | null;
  readonly creationDate: string | null;
  readonly modificationDate: string | null;
  readonly hasXmp: boolean;
  readonly custom: Readonly<Record<string, string>>;
}

export interface PdfPageSummary {
  readonly page: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: 0 | 90 | 180 | 270;
  readonly textBytes: number;
  readonly imageCount: number;
  readonly annotationCount: number;
  readonly hasWidget: boolean;
}

export interface PdfInspection {
  readonly version: string;
  readonly byteLength: number;
  readonly objectCount: number;
  readonly pageCount: number;
  readonly declaredPageCount: number | null;
  readonly encrypted: boolean;
  readonly linearized: boolean;
  readonly metadata: PdfMetadata;
  readonly pages: readonly PdfPageSummary[];
  readonly links: readonly PdfLink[];
  readonly forms: readonly PdfFormField[];
  readonly images: readonly PdfImageInfo[];
  readonly capabilities: readonly PdfCapabilityReport[];
  readonly warnings: readonly string[];
}

export interface PdfLink {
  readonly page: number | null;
  readonly uri: string;
  readonly source: "annotation" | "catalog" | "page";
}

export interface PdfFormField {
  readonly name: string;
  readonly fieldType: string;
  readonly value: string | null;
  readonly flags: number | null;
  readonly readOnly: boolean;
}

export interface PdfImageInfo {
  readonly object: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly colorSpace: string | null;
  readonly bitsPerComponent: number | null;
  readonly filter: string | null;
  readonly byteLength: number;
  readonly mime: string | null;
}

export interface PdfTextPage {
  readonly page: number;
  readonly text: string;
  readonly truncated: boolean;
}

export interface PdfArtifact {
  readonly blob: Blob;
  readonly bytes: Uint8Array;
  readonly filename: string;
  readonly mime: "application/pdf" | "image/jpeg" | "application/json" | "text/plain";
  readonly pageCount?: number;
}

export interface PdfPageSelection {
  readonly pages?: readonly number[];
  readonly order?: readonly number[];
  readonly rotations?: Readonly<Record<number, 90 | 180 | 270>>;
}

export interface PdfMutationOptions extends PdfPageSelection {
  readonly stripMetadata?: boolean;
  readonly flatten?: boolean;
  readonly compress?: boolean;
}

export interface PdfCompareResult {
  readonly first: PdfInspection;
  readonly second: PdfInspection;
  readonly samePageCount: boolean;
  readonly samePageGeometry: boolean;
  readonly changedPages: readonly number[];
  readonly textChangedPages: readonly number[];
  readonly summary: string;
}

export interface PdfManifestEntry {
  readonly name: string;
  readonly byteLength: number;
  readonly mime: string;
  readonly signature: "pdf" | "unknown";
  readonly pageCount: number | null;
  readonly encrypted: boolean | null;
  readonly sha256: string;
}

export interface PdfDocumentManifest {
  readonly generatedAt: string;
  readonly files: readonly PdfManifestEntry[];
  readonly json: string;
}
