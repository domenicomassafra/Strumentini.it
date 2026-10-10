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
  maxImagePixels: 16_000_000,
  maxFiles: 50,
  maxTotalInputBytes: 100 * 1024 * 1024,
  maxTotalImageBytes: 40 * 1024 * 1024,
} as const;

export const PDF_TEXT_WORKFLOW_LIMITS = {
  maxQueryCharacters: 256,
  maxContextCharacters: 1_000,
  defaultContextCharacters: 120,
  maxResults: 500,
  defaultMaxResults: 100,
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
  readonly infoObjectId: number | null;
  readonly title: string | null;
  readonly author: string | null;
  readonly subject: string | null;
  readonly keywords: string | null;
  readonly creator: string | null;
  readonly producer: string | null;
  readonly creationDate: string | null;
  readonly modificationDate: string | null;
  readonly hasXmp: boolean;
  readonly recognizedInfo: Readonly<Record<string, string>>;
  readonly unknownInfo: Readonly<Record<string, string>>;
  readonly entries: readonly PdfMetadataEntry[];
  readonly xmpObjectIds: readonly number[];
  readonly custom: Readonly<Record<string, string>>;
}

export interface PdfMetadataEntry {
  readonly key: string;
  readonly value: string;
  readonly recognized: boolean;
  readonly source: "document-info";
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
  readonly objectId: number;
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

export type PdfTextExtractionMode = "content-order" | "operator-lines";

export interface PdfTextExtractionOptions {
  readonly pages?: readonly number[];
  readonly mode?: PdfTextExtractionMode;
}

export interface PdfTextExtractionResult {
  readonly pages: readonly PdfTextPage[];
  readonly text: string;
  readonly mode: PdfTextExtractionMode;
  readonly pageSeparator: string;
  readonly selectedPages: readonly number[];
  readonly truncated: boolean;
}

export interface PdfOcrHandoff {
  readonly available: false;
  readonly status: "not-available";
  readonly backlogTicket: 247;
  readonly reason: string;
}

export type PdfSearchFileStatus = "matches" | "no-match" | "no-text" | "encrypted" | "unreadable";

export interface PdfSearchMatch {
  readonly fileIndex: number;
  readonly filename: string;
  readonly page: number;
  readonly matchIndex: number;
  readonly start: number;
  readonly end: number;
  readonly context: string;
}

export interface PdfSearchFileResult {
  readonly fileIndex: number;
  readonly filename: string;
  readonly status: PdfSearchFileStatus;
  readonly pageCount: number | null;
  readonly matchCount: number;
  readonly matches: readonly PdfSearchMatch[];
  readonly truncated: boolean;
  readonly errorCode?: string;
  readonly errorMessage?: string;
  readonly ocrHandoff?: PdfOcrHandoff;
}

export interface PdfMultiSearchResult {
  readonly query: string;
  readonly caseSensitive: boolean;
  readonly contextCharacters: number;
  readonly maxResults: number;
  readonly files: readonly PdfSearchFileResult[];
  readonly matches: readonly PdfSearchMatch[];
  readonly totalMatches: number;
  readonly returnedMatches: number;
  readonly truncated: boolean;
  readonly provenanceConvention: "fileIndex+filename+page+matchIndex";
  readonly limits: typeof PDF_TEXT_WORKFLOW_LIMITS;
}

export interface PdfMarkdownPage {
  readonly page: number;
  readonly text: string;
  readonly markdown: string;
  readonly provenance: string;
  readonly truncated: boolean;
}

export interface PdfToMarkdownResult {
  readonly filename: string;
  readonly pageCount: number;
  readonly status: "converted" | "no-text" | "encrypted";
  readonly markdown: string;
  readonly pages: readonly PdfMarkdownPage[];
  readonly provenanceConvention: "html-comment:file-uri-encoded+page";
  readonly extractionMode: "content-order";
  readonly truncated: boolean;
  readonly losses: readonly string[];
  readonly ocrHandoff?: PdfOcrHandoff;
}

export interface PdfImageOccurrence {
  readonly page: number;
  readonly resourceName: string;
  readonly object: number | null;
}

export interface PdfExtractedImageProvenance {
  readonly filename: string;
  readonly object: number | null;
  readonly occurrences: readonly PdfImageOccurrence[];
  readonly byteLength: number;
  readonly filter: "DCTDecode";
}

export interface PdfUnsupportedImageFilter {
  readonly page: number;
  readonly resourceName: string;
  readonly object: number | null;
  readonly filters: readonly string[];
  readonly reason: string;
}

export interface PdfImageExtractionOptions {
  readonly pages?: readonly number[];
  readonly dedupe?: boolean;
}

export interface PdfImageExtractionResult {
  readonly artifacts: readonly PdfArtifact[];
  readonly provenance: readonly PdfExtractedImageProvenance[];
  readonly unsupported: readonly PdfUnsupportedImageFilter[];
  readonly selectedPages: readonly number[];
  readonly deduplicated: boolean;
  readonly mode: "embedded-original-compressed-bytes";
}

export interface PdfMetadataRemovalVerification {
  readonly reparsed: true;
  readonly metadataRemoved: boolean;
  readonly pageCount: {
    readonly before: number;
    readonly after: number;
    readonly stable: boolean;
  };
  readonly textBaseline: {
    readonly status: "verified" | "unavailable";
    readonly stable: boolean | null;
    readonly changedPages: readonly number[];
    readonly reason?: string;
  };
}

export interface PdfArtifact {
  readonly blob: Blob;
  readonly bytes: Uint8Array;
  readonly filename: string;
  readonly mime: "application/pdf" | "image/jpeg" | "image/png" | "image/webp" | "application/zip" | "application/json" | "text/plain";
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
  readonly alignment: import("./compare-alignment").PdfAlignmentSummary;
  readonly structure: {
    readonly status: "bounded-counts-match" | "changed" | "partial";
    readonly changedPairs: readonly { firstPage: number; secondPage: number }[];
    readonly scope: "page-geometry-rotation-image-and-annotation-counts-only";
  };
  readonly text: {
    readonly status: "extracted-match" | "changed" | "partial";
    readonly changedPairs: readonly { firstPage: number; secondPage: number }[];
    readonly truncatedOrTextlessPages: boolean;
    readonly scope: "extractable-text-not-reading-order-or-ocr";
  };
  readonly visual: {
    readonly status: "not-rendered";
    readonly confidence: "unknown";
    readonly note: string;
  };
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
