import {
  PDF_LIMITS,
  PDF_TEXT_WORKFLOW_LIMITS,
  type PdfCapability,
  type PdfCapabilityReport,
  type PdfCompareResult,
  type PdfDocumentManifest,
  type PdfFormField,
  type PdfImageInfo,
  type PdfInspection,
  type PdfLink,
  type PdfMetadata,
  type PdfMetadataRemovalVerification,
  type PdfMutationOptions,
  type PdfPageSummary,
  type PdfExtractedImageProvenance,
  type PdfImageExtractionOptions,
  type PdfImageExtractionResult,
  type PdfUnsupportedImageFilter,
  type PdfTextPage,
  type PdfTextExtractionMode,
  type PdfTextExtractionOptions,
  type PdfTextExtractionResult,
  type PdfMultiSearchResult,
  type PdfOcrHandoff,
  type PdfSearchFileResult,
  type PdfSearchMatch,
  type PdfToMarkdownResult,
  type PdfArtifact,
} from "./types";
import {
  arrayOrNull,
  dictionaryOrNull,
  nameValue,
  numberValue,
  parsePdf,
  pdfNumber,
  pdfReference,
  resolveReference,
  streamOrNull,
  valueToText,
  type PdfDocumentModel,
  type PdfObject,
  type PdfPageNode,
  type PdfStream,
  type PdfValue,
} from "./parser";
import {
  buildPdfFromJpegs,
  buildPdfFromPages,
  createSimplePdf,
  parseJpeg,
  type EmbeddedJpeg,
  type PdfBuildPage,
  type PdfImagePageLayoutOptions,
} from "./writer";
import { inflatePdfStream } from "./inflate";
import { redactUrl, redactUrlCredentials } from "../url-marketing";
import { validatePdfMergePagePlan, type PdfMergePageRef } from "./merge-page-plan";
import { alignPdfEvidence } from "./compare-alignment";

export * from "./types";
export { buildPdfFromJpegs, buildPdfFromPages, createSimplePdf, parseJpeg };
export { inflatePdfStream } from "./inflate";
export type { EmbeddedJpeg, PdfBuildPage, PdfImagePageLayoutOptions };
export type { PdfMergePageRef } from "./merge-page-plan";

export type PdfErrorCode =
  | "INVALID_INPUT"
  | "INVALID_PDF_SIGNATURE"
  | "MALFORMED_PDF"
  | "PDF_LIMIT"
  | "UNSUPPORTED_CAPABILITY"
  | "CANCELLED"
  | "READ_FAILURE"
  | "WRITE_FAILURE";

export class PdfError extends Error {
  constructor(readonly code: PdfErrorCode, message: string) {
    super(message);
    this.name = "PdfError";
  }
}

export interface PdfBlobInput {
  readonly blob?: Blob;
  readonly bytes?: Uint8Array;
  readonly buffer?: ArrayBuffer;
  readonly filename?: string;
}

export type PdfInput = Blob | Uint8Array | ArrayBuffer | PdfBlobInput;

function abortIfNeeded(signal?: AbortSignal): void {
  if (signal?.aborted) throw new PdfError("CANCELLED", "Operation cancelled");
}

function assertPdfSize(size: number): void {
  if (!Number.isSafeInteger(size) || size < 0 || size > PDF_LIMITS.maxBytes) throw new PdfError("PDF_LIMIT", "PDF exceeds the local byte limit.");
}

async function readInput(input: PdfInput, signal?: AbortSignal): Promise<Uint8Array> {
  abortIfNeeded(signal);
  try {
    if (input instanceof Uint8Array) {
      assertPdfSize(input.byteLength);
      return input.slice();
    }
    if (input instanceof ArrayBuffer) {
      assertPdfSize(input.byteLength);
      return new Uint8Array(input.slice(0));
    }
    if (typeof Blob !== "undefined" && input instanceof Blob) {
      assertPdfSize(input.size);
      return new Uint8Array(await input.arrayBuffer());
    }
    if (typeof input === "object" && input !== null) {
      const object = input as PdfBlobInput;
      if (object.bytes !== undefined) {
        assertPdfSize(object.bytes.byteLength);
        return object.bytes.slice();
      }
      if (object.buffer !== undefined) {
        assertPdfSize(object.buffer.byteLength);
        return new Uint8Array(object.buffer.slice(0));
      }
      if (object.blob !== undefined) {
        assertPdfSize(object.blob.size);
        return new Uint8Array(await object.blob.arrayBuffer());
      }
    }
  } catch (error) {
    if (error instanceof PdfError) throw error;
    throw new PdfError("READ_FAILURE", error instanceof Error ? `Could not read PDF input: ${error.message}` : "Could not read PDF input.");
  }
  throw new PdfError("INVALID_INPUT", "Choose a PDF file or provide PDF bytes.");
}

function ownedArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function parseDocument(bytes: Uint8Array): PdfDocumentModel {
  try {
    return parsePdf(bytes);
  } catch (error) {
    if (error instanceof PdfError) throw error;
    const message = error instanceof Error ? error.message : "The PDF could not be parsed.";
    const code: PdfErrorCode = message.startsWith("INVALID_PDF_SIGNATURE")
      ? "INVALID_PDF_SIGNATURE"
      : message.startsWith("INVALID_")
        ? "INVALID_INPUT"
        : message.startsWith("PDF_LIMIT")
          ? "PDF_LIMIT"
          : message.startsWith("UNSUPPORTED_")
            ? "UNSUPPORTED_CAPABILITY"
            : "MALFORMED_PDF";
    throw new PdfError(code, message);
  }
}

function capabilityReport(document: PdfDocumentModel, capability: PdfCapability): PdfCapabilityReport {
  if (capability === "mutate-pages" && document.encrypted) {
    return { capability, available: false, reason: "Encrypted PDFs are inspectable but are not mutated or password-cracked." };
  }
  if (capability === "extract-text" && document.pages.length === 0) {
    return { capability, available: false, reason: "The document has no readable page tree." };
  }
  if (capability === "extract-images" && document.pages.length === 0) {
    return { capability, available: false, reason: "The document has no readable page tree." };
  }
  return { capability, available: true };
}

export function preflightPdf(document: PdfDocumentModel, capability?: PdfCapability): PdfCapabilityReport[] {
  const capabilities: PdfCapability[] = capability === undefined
    ? ["inspect", "mutate-pages", "extract-text", "inspect-metadata", "inspect-links", "inspect-forms", "extract-images", "flatten"]
    : [capability];
  return capabilities.map((item) => capabilityReport(document, item));
}

function pageDimensions(document: PdfDocumentModel, page: PdfPageNode): { width: number; height: number } {
  const ownMediaBox = page.object.value.kind === "dict" ? page.object.value.entries.get("MediaBox") : undefined;
  const values = ownMediaBox ?? page.inherited.MediaBox;
  const array = arrayOrNull(document, values);
  if (values !== undefined && array === null) throw new PdfError("MALFORMED_PDF", "Page MediaBox is not an array.");
  const numbers = array?.items.map(numberValue) ?? [];
  if (values === undefined) return { width: 612, height: 792 };
  if (numbers.length < 4 || numbers.some((value) => value === null)) throw new PdfError("MALFORMED_PDF", "Page MediaBox must contain four numbers.");
  const width = Math.abs((numbers[2] ?? 0) - (numbers[0] ?? 0));
  const height = Math.abs((numbers[3] ?? 0) - (numbers[1] ?? 0));
  if (width <= 0 || height <= 0 || width > PDF_LIMITS.maxPageDimension || height > PDF_LIMITS.maxPageDimension) {
    throw new PdfError("PDF_LIMIT", "Page dimensions are outside the local safety limit.");
  }
  return { width, height };
}

function pageRotation(page: PdfPageNode): 0 | 90 | 180 | 270 {
  const value = page.object.value.kind === "dict" ? page.object.value.entries.get("Rotate") ?? page.inherited.Rotate : page.inherited.Rotate;
  const number = numberValue(value);
  if (number === null) return 0;
  const normalized = ((Math.round(number / 90) * 90) % 360 + 360) % 360;
  return normalized as 0 | 90 | 180 | 270;
}

function contentStreams(document: PdfDocumentModel, page: PdfPageNode): PdfStream[] {
  const dictionary = page.object.value;
  if (dictionary.kind !== "dict") return [];
  const contents = dictionary.entries.get("Contents");
  const resolved = resolveReference(document, contents);
  if (resolved?.kind === "stream") return [resolved];
  if (resolved?.kind === "array") {
    return resolved.items.map((item) => streamOrNull(document, item)).filter((stream): stream is PdfStream => stream !== null);
  }
  return [];
}

function pageTextBytes(document: PdfDocumentModel, page: PdfPageNode): number {
  return contentStreams(document, page).reduce((total, stream) => total + stream.bytes.byteLength, 0);
}

function pageAnnotationCount(document: PdfDocumentModel, page: PdfPageNode): number {
  const dictionary = page.object.value;
  if (dictionary.kind !== "dict") return 0;
  const annotations = arrayOrNull(document, dictionary.entries.get("Annots"));
  return annotations?.items.length ?? 0;
}

function pageImageCount(document: PdfDocumentModel, page: PdfPageNode): number {
  const resources = dictionaryOrNull(document, page.inherited.Resources ?? (page.object.value.kind === "dict" ? page.object.value.entries.get("Resources") : undefined));
  const xobjects = dictionaryOrNull(document, resources?.entries.get("XObject"));
  if (xobjects === null) return 0;
  let count = 0;
  for (const value of xobjects.entries.values()) {
    const stream = streamOrNull(document, value);
    if (stream !== null && nameValue(stream.dictionary.entries.get("Subtype")) === "Image") count += 1;
  }
  return count;
}

function pageHasWidget(document: PdfDocumentModel, page: PdfPageNode): boolean {
  const dictionary = page.object.value;
  if (dictionary.kind !== "dict") return false;
  const annotations = arrayOrNull(document, dictionary.entries.get("Annots"));
  return (annotations?.items ?? []).some((item) => {
    const annotation = dictionaryOrNull(document, item);
    return nameValue(annotation?.entries.get("Subtype")) === "Widget";
  });
}

function decodePdfString(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("latin1").decode(bytes);
  }
}

function stringsInContent(bytes: Uint8Array): string[] {
  const text = new TextDecoder("latin1").decode(bytes);
  const values: string[] = [];
  let index = 0;
  while (index < text.length) {
    if (text[index] === "<" && text[index + 1] !== "<") {
      const close = text.indexOf(">", index + 1);
      if (close < 0) break;
      const hex = text.slice(index + 1, close).replaceAll(/\s+/gu, "");
      if (hex.length % 2 === 0 && /^[0-9a-f]+$/iu.test(hex)) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let byteIndex = 0; byteIndex < bytes.length; byteIndex += 1) bytes[byteIndex] = Number.parseInt(hex.slice(byteIndex * 2, byteIndex * 2 + 2), 16);
        values.push(decodePdfString(bytes));
      }
      index = close + 1;
      continue;
    }
    if (text[index] !== "(") {
      index += 1;
      continue;
    }
    const result: number[] = [];
    let depth = 1;
    index += 1;
    while (index < text.length && depth > 0) {
      const code = text.charCodeAt(index);
      if (code === 92) {
        const next = text[index + 1];
        if (next === undefined) break;
        const escapes: Record<string, string> = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" };
        if (next in escapes) {
          result.push(escapes[next]?.charCodeAt(0) ?? 32);
          index += 2;
          continue;
        }
        if (next === "\n" || next === "\r") {
          index += 2;
          continue;
        }
        if (/^[0-7]$/u.test(next)) {
          const octal = text.slice(index + 1, index + 4).match(/^[0-7]{1,3}/u)?.[0] ?? next;
          result.push(Number.parseInt(octal, 8));
          index += 1 + octal.length;
          continue;
        }
        result.push(text.charCodeAt(index + 1));
        index += 2;
        continue;
      }
      if (code === 40) depth += 1;
      if (code === 41) {
        depth -= 1;
        if (depth === 0) {
          index += 1;
          break;
        }
      }
      result.push(code & 0xff);
      index += 1;
    }
    values.push(decodePdfString(Uint8Array.from(result)));
  }
  return values;
}

function metadataFromDocument(document: PdfDocumentModel): PdfMetadata {
  const info = dictionaryOrNull(document, document.info === null ? undefined : pdfReference(document.info.id, document.info.generation));
  const custom: Record<string, string> = {};
  const known = new Set(["Title", "Author", "Subject", "Keywords", "Creator", "Producer", "CreationDate", "ModDate"]);
  for (const [key, value] of info?.entries ?? []) {
    const text = valueToText(resolveReference(document, value));
    if (text !== null) Object.defineProperty(custom, key, { configurable: true, enumerable: true, value: text, writable: true });
  }
  const recognizedInfo = Object.fromEntries(Object.entries(custom).filter(([key]) => known.has(key)));
  const unknownInfo = Object.fromEntries(Object.entries(custom).filter(([key]) => !known.has(key)));
  const entries = Object.entries(custom).map(([key, value]) => ({ key, value, recognized: known.has(key), source: "document-info" as const }));
  const xmpObjectIds = [...document.objects.values()]
    .filter((object) => object.value.kind === "stream" && nameValue(object.value.dictionary.entries.get("Type")) === "Metadata")
    .map((object) => object.id)
    .toSorted((left, right) => left - right);
  const hasXmp = xmpObjectIds.length > 0;
  return {
    title: custom.Title ?? null,
    author: custom.Author ?? null,
    subject: custom.Subject ?? null,
    keywords: custom.Keywords ?? null,
    creator: custom.Creator ?? null,
    producer: custom.Producer ?? null,
    creationDate: custom.CreationDate ?? null,
    modificationDate: custom.ModDate ?? null,
    hasXmp,
    recognizedInfo,
    unknownInfo,
    entries,
    xmpObjectIds,
    custom: unknownInfo,
  };
}

function filterNames(document: PdfDocumentModel, value: PdfValue | undefined): string[] {
  if (value?.kind === "name") return [value.value];
  if (value?.kind !== "array") return [];
  return value.items.map((item) => nameValue(resolveReference(document, item))).filter((name): name is string => name !== null);
}

function imageInfo(document: PdfDocumentModel, object: PdfObject): PdfImageInfo | null {
  if (object.value.kind !== "stream" || nameValue(object.value.dictionary.entries.get("Subtype")) !== "Image") return null;
  const width = numberValue(object.value.dictionary.entries.get("Width"));
  const height = numberValue(object.value.dictionary.entries.get("Height"));
  const colorSpace = object.value.dictionary.entries.get("ColorSpace");
  const filters = filterNames(document, object.value.dictionary.entries.get("Filter"));
  const filterName = filters.length === 0 ? null : filters.join(",");
  const mime = filters.includes("DCTDecode") ? "image/jpeg" : null;
  return {
    object: object.id,
    width,
    height,
    colorSpace: colorSpace?.kind === "name" ? colorSpace.value : null,
    bitsPerComponent: numberValue(object.value.dictionary.entries.get("BitsPerComponent")),
    filter: filterName,
    byteLength: object.value.bytes.byteLength,
    mime,
  };
}

function redactPdfUri(value: string): string {
  try {
    return redactUrl(new URL(value));
  } catch {
    return redactUrlCredentials(value);
  }
}

function collectLinks(document: PdfDocumentModel): PdfLink[] {
  const links: PdfLink[] = [];
  const seen = new Set<string>();
  const pageByObject = new Map<number, number>();
  document.pages.forEach((page, index) => pageByObject.set(page.object.id, index + 1));
  for (const object of document.objects.values()) {
    if (object.value.kind !== "dict") continue;
    const page = pageByObject.get(object.id) ?? null;
    const direct = object.value.entries.get("URI");
    const action = dictionaryOrNull(document, object.value.entries.get("A"));
    const uriValue = direct ?? action?.entries.get("URI");
    const rawUri = valueToText(resolveReference(document, uriValue));
    const uri = rawUri === null ? null : redactPdfUri(rawUri);
    if (uri === null || uri.length === 0 || seen.has(uri)) continue;
    seen.add(uri);
    const source = object.value.entries.has("Subtype") && nameValue(object.value.entries.get("Subtype")) === "Link" ? "annotation" : page === null ? "catalog" : "page";
    links.push({ page, uri, source });
  }
  return links;
}

function collectForms(document: PdfDocumentModel): PdfFormField[] {
  const root = document.root === null ? undefined : dictionaryOrNull(document, pdfReference(document.root.id, document.root.generation));
  const acro = dictionaryOrNull(document, root?.entries.get("AcroForm"));
  const fields = arrayOrNull(document, acro?.entries.get("Fields"));
  if (fields === null) return [];
  const output: PdfFormField[] = [];
  const visit = (value: PdfValue, prefix: string, depth: number): void => {
    if (depth > 32) return;
    const dictionary = dictionaryOrNull(document, value);
    if (dictionary === null) return;
    const partial = valueToText(resolveReference(document, dictionary.entries.get("T")));
    const name = [prefix, partial].filter((part): part is string => typeof part === "string" && part.length > 0).join(".");
    const kids = arrayOrNull(document, dictionary.entries.get("Kids"));
    if (kids !== null && kids.items.length > 0) {
      for (const kid of kids.items) visit(kid, name, depth + 1);
      return;
    }
    const fieldType = nameValue(dictionary.entries.get("FT")) ?? "unknown";
    const fieldValue = valueToText(resolveReference(document, dictionary.entries.get("V")));
    const flags = numberValue(dictionary.entries.get("Ff"));
    output.push({ name: name || "(unnamed)", fieldType, value: fieldValue, flags, readOnly: flags !== null && (flags & 1) === 1 });
  };
  for (const field of fields.items) visit(field, "", 0);
  return output;
}

function declaredPageCount(document: PdfDocumentModel): number | null {
  const root = document.root === null ? undefined : dictionaryOrNull(document, pdfReference(document.root.id, document.root.generation));
  const pages = dictionaryOrNull(document, root?.entries.get("Pages"));
  const count = numberValue(pages?.entries.get("Count"));
  return count !== null && Number.isInteger(count) && count >= 0 ? count : null;
}

function pageSummaries(document: PdfDocumentModel): PdfPageSummary[] {
  return document.pages.map((page, index) => {
    const dimensions = pageDimensions(document, page);
    return {
      page: index + 1,
      ...dimensions,
      rotation: pageRotation(page),
      textBytes: pageTextBytes(document, page),
      imageCount: pageImageCount(document, page),
      annotationCount: pageAnnotationCount(document, page),
      hasWidget: pageHasWidget(document, page),
    };
  });
}

export function inspectPdfBytes(bytes: Uint8Array): PdfInspection {
  const document = parseDocument(bytes);
  const allImages = [...document.objects.values()].map((object) => imageInfo(document, object)).filter((image): image is PdfImageInfo => image !== null);
  const images = allImages.slice(0, PDF_LIMITS.maxImages);
  const warnings: string[] = [];
  if (document.pages.length === 0) warnings.push("No page tree was found; page-specific operations are unavailable.");
  if (document.encrypted) warnings.push("Encryption was detected. Inspection is local; password cracking is intentionally unavailable.");
  if (allImages.length > PDF_LIMITS.maxImages) warnings.push("Image count exceeds the local inspection limit; the image list was truncated.");
  return {
    version: document.version,
    byteLength: bytes.byteLength,
    objectCount: document.objects.size,
    pageCount: document.pages.length,
    declaredPageCount: declaredPageCount(document),
    encrypted: document.encrypted,
    linearized: document.linearized,
    metadata: metadataFromDocument(document),
    pages: pageSummaries(document),
    links: collectLinks(document),
    forms: collectForms(document),
    images,
    capabilities: preflightPdf(document),
    warnings,
  };
}

export async function inspectPdf(input: PdfInput, signal?: AbortSignal): Promise<PdfInspection> {
  abortIfNeeded(signal);
  return inspectPdfBytes(await readInput(input, signal));
}

export async function preflightPdfInput(input: PdfInput, capability?: PdfCapability, signal?: AbortSignal): Promise<PdfCapabilityReport[]> {
  const document = parseDocument(await readInput(input, signal));
  return preflightPdf(document, capability);
}

async function inflateStream(stream: PdfStream, signal?: AbortSignal): Promise<Uint8Array> {
  abortIfNeeded(signal);
  const filter = stream.dictionary.entries.get("Filter");
  const filterName = filter?.kind === "name"
    ? filter.value
    : filter?.kind === "array"
      ? filter.items.map((item) => item.kind === "name" ? item.value : null).find((name): name is string => name !== null) ?? null
      : null;
  if (filterName === null || filterName === undefined) return stream.bytes;
  if (filterName !== "FlateDecode") throw new PdfError("UNSUPPORTED_CAPABILITY", `PDF stream filter ${filterName} is not supported by the bounded text engine.`);
  try {
    const output = inflatePdfStream(stream.bytes);
    abortIfNeeded(signal);
    return output;
  } catch (error) {
    if (error instanceof PdfError) throw error;
    throw new PdfError("MALFORMED_PDF", error instanceof Error ? error.message : "A compressed PDF stream could not be decoded.");
  }
}

function selectedPageNumbers(document: PdfDocumentModel, pages?: readonly number[]): number[] {
  const allPages = document.pages.map((_, index) => index + 1);
  if (pages === undefined) return allPages;
  const unique = [...new Set(pages)];
  if (unique.length === 0 || unique.some((page) => !Number.isInteger(page) || page < 1 || page > document.pages.length)) {
    throw new PdfError("INVALID_INPUT", "Page numbers must be within the document page range.");
  }
  return unique;
}

function normalizeTextMode(mode: PdfTextExtractionMode | undefined): PdfTextExtractionMode {
  if (mode === undefined || mode === "content-order") return "content-order";
  if (mode === "operator-lines") return mode;
  throw new PdfError("INVALID_INPUT", "Text extraction mode must be content-order or operator-lines.");
}

export async function extractPdfTextScoped(input: PdfInput, options: PdfTextExtractionOptions = {}, signal?: AbortSignal): Promise<PdfTextExtractionResult> {
  const document = parseDocument(await readInput(input, signal));
  const capability = capabilityReport(document, "extract-text");
  if (!capability.available) throw new PdfError("UNSUPPORTED_CAPABILITY", capability.reason ?? "Text extraction is unavailable.");
  const selectedPages = selectedPageNumbers(document, options.pages);
  const mode = normalizeTextMode(options.mode);
  const output: PdfTextPage[] = [];
  let total = 0;
  for (const pageNumber of selectedPages) {
    abortIfNeeded(signal);
    const page = document.pages[pageNumber - 1];
    if (page === undefined) continue;
    const values: string[] = [];
    for (const stream of contentStreams(document, page)) {
      const bytes = await inflateStream(stream, signal);
      values.push(...stringsInContent(bytes));
    }
    let text = mode === "operator-lines"
      ? values.map((value) => value.replaceAll(/[\t ]+/gu, " ").trim()).filter(Boolean).join("\n")
      : values.join(" ").replaceAll(/\s+/gu, " ").trim();
    const truncated = total + text.length > PDF_LIMITS.maxTextBytes;
    if (truncated) text = text.slice(0, Math.max(0, PDF_LIMITS.maxTextBytes - total));
    total += text.length;
    output.push({ page: pageNumber, text, truncated });
    if (total >= PDF_LIMITS.maxTextBytes) break;
  }
  const pageSeparator = "\n\n===== PAGINA {page} =====\n\n";
  const text = output.map((page) => `===== PAGINA ${page.page} =====\n\n${page.text}`).join("\n\n");
  return { pages: output, text, mode, pageSeparator, selectedPages, truncated: output.some((page) => page.truncated) };
}

export async function extractPdfText(input: PdfInput, signal?: AbortSignal): Promise<PdfTextPage[]> {
  return [...(await extractPdfTextScoped(input, {}, signal)).pages];
}

const OCR_HANDOFF_UNAVAILABLE: PdfOcrHandoff = {
  available: false,
  status: "not-available",
  backlogTicket: 247,
  reason: "Questo file non contiene testo estraibile con il motore PDF locale. Il percorso OCR è previsto dal ticket 247 ma non è disponibile in questa build, quindi non viene simulato.",
};

function assertSearchOptions(queryInput: string, contextCharacters: number, maxResults: number): string {
  const query = queryInput.trim();
  if (query === "" || [...query].length > PDF_TEXT_WORKFLOW_LIMITS.maxQueryCharacters || query.includes("\0")) {
    throw new PdfError("INVALID_INPUT", "Search query must contain 1-" + PDF_TEXT_WORKFLOW_LIMITS.maxQueryCharacters + " characters.");
  }
  if (!Number.isInteger(contextCharacters) || contextCharacters < 0 || contextCharacters > PDF_TEXT_WORKFLOW_LIMITS.maxContextCharacters) {
    throw new PdfError("INVALID_INPUT", "Context must be between 0 and " + PDF_TEXT_WORKFLOW_LIMITS.maxContextCharacters + " characters.");
  }
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > PDF_TEXT_WORKFLOW_LIMITS.maxResults) {
    throw new PdfError("INVALID_INPUT", "Maximum results must be between 1 and " + PDF_TEXT_WORKFLOW_LIMITS.maxResults + ".");
  }
  return query;
}

function literalSearchRegex(query: string, caseSensitive: boolean): RegExp {
  const escaped = query.replace(/[.*+?^$()|[\]\\{}]/gu, "\\$&");
  return new RegExp(escaped, caseSensitive ? "gu" : "giu");
}

function searchPageText(
  filename: string,
  fileIndex: number,
  page: number,
  text: string,
  query: string,
  caseSensitive: boolean,
  contextCharacters: number,
): PdfSearchMatch[] {
  const matches: PdfSearchMatch[] = [];
  const regex = literalSearchRegex(query, caseSensitive);
  let matchIndex = 0;
  for (const match of text.matchAll(regex)) {
    const start = match.index ?? 0;
    const matched = match[0] ?? "";
    const end = start + matched.length;
    const contextStart = Math.max(0, start - contextCharacters);
    const contextEnd = Math.min(text.length, end + contextCharacters);
    matches.push({
      fileIndex,
      filename,
      page,
      matchIndex,
      start,
      end,
      context: text.slice(contextStart, contextEnd),
    });
    matchIndex += 1;
  }
  return matches;
}

export async function searchPdfTextAcrossFiles(
  inputs: readonly { readonly filename: string; readonly input: PdfInput }[],
  options: {
    readonly query: string;
    readonly caseSensitive?: boolean;
    readonly contextCharacters?: number;
    readonly maxResults?: number;
  },
  signal?: AbortSignal,
): Promise<PdfMultiSearchResult> {
  if (inputs.length === 0 || inputs.length > PDF_LIMITS.maxFiles) {
    throw new PdfError("INVALID_INPUT", "Choose between 1 and " + PDF_LIMITS.maxFiles + " PDF files.");
  }
  const caseSensitive = options.caseSensitive ?? false;
  const contextCharacters = options.contextCharacters ?? PDF_TEXT_WORKFLOW_LIMITS.defaultContextCharacters;
  const maxResults = options.maxResults ?? PDF_TEXT_WORKFLOW_LIMITS.defaultMaxResults;
  const query = assertSearchOptions(options.query, contextCharacters, maxResults);
  const files: PdfSearchFileResult[] = [];
  const returned: PdfSearchMatch[] = [];
  let totalMatches = 0;

  for (const [fileIndex, item] of inputs.entries()) {
    abortIfNeeded(signal);
    let inspection: PdfInspection;
    try {
      inspection = await inspectPdf(item.input, signal);
    } catch (error) {
      files.push({
        fileIndex,
        filename: item.filename,
        status: "unreadable",
        pageCount: null,
        matchCount: 0,
        matches: [],
        truncated: false,
        errorCode: error instanceof PdfError ? error.code : "READ_FAILURE",
        errorMessage: error instanceof Error ? error.message : "The PDF could not be read.",
      });
      continue;
    }

    if (inspection.encrypted) {
      files.push({
        fileIndex,
        filename: item.filename,
        status: "encrypted",
        pageCount: inspection.pageCount,
        matchCount: 0,
        matches: [],
        truncated: false,
        errorCode: "ENCRYPTED_PDF",
        errorMessage: "Il PDF dichiara cifratura; la ricerca non tenta password, bypass o brute force.",
      });
      continue;
    }

    let extracted: PdfTextExtractionResult;
    try {
      extracted = await extractPdfTextScoped(item.input, { mode: "content-order" }, signal);
    } catch (error) {
      files.push({
        fileIndex,
        filename: item.filename,
        status: "unreadable",
        pageCount: inspection.pageCount,
        matchCount: 0,
        matches: [],
        truncated: false,
        errorCode: error instanceof PdfError ? error.code : "READ_FAILURE",
        errorMessage: error instanceof Error ? error.message : "Text extraction failed.",
      });
      continue;
    }

    if (!extracted.pages.some((page) => page.text.trim() !== "")) {
      files.push({
        fileIndex,
        filename: item.filename,
        status: "no-text",
        pageCount: inspection.pageCount,
        matchCount: 0,
        matches: [],
        truncated: extracted.truncated,
        ocrHandoff: OCR_HANDOFF_UNAVAILABLE,
      });
      continue;
    }

    const fileMatches: PdfSearchMatch[] = [];
    let matchCount = 0;
    for (const page of extracted.pages) {
      const pageMatches = searchPageText(item.filename, fileIndex, page.page, page.text, query, caseSensitive, contextCharacters);
      matchCount += pageMatches.length;
      totalMatches += pageMatches.length;
      const room = Math.max(0, maxResults - returned.length);
      if (room > 0) {
        const accepted = pageMatches.slice(0, room);
        fileMatches.push(...accepted);
        returned.push(...accepted);
      }
    }
    files.push({
      fileIndex,
      filename: item.filename,
      status: matchCount > 0 ? "matches" : "no-match",
      pageCount: inspection.pageCount,
      matchCount,
      matches: fileMatches,
      truncated: extracted.truncated || fileMatches.length < matchCount,
    });
  }

  return {
    query,
    caseSensitive,
    contextCharacters,
    maxResults,
    files,
    matches: returned,
    totalMatches,
    returnedMatches: returned.length,
    truncated: returned.length < totalMatches || files.some((file) => file.truncated),
    provenanceConvention: "fileIndex+filename+page+matchIndex",
    limits: PDF_TEXT_WORKFLOW_LIMITS,
  };
}

const PDF_MARKDOWN_LOSSES = [
  "Nessuna gerarchia semantica di titoli, elenchi o paragrafi viene ricostruita dal layout.",
  "Tabelle e colonne multiple restano testo nell'ordine degli operatori supportati; struttura e ordine visuale possono andare persi.",
  "Immagini, grafica vettoriale e posizione sulla pagina non vengono esportate nel Markdown.",
  "Font, stile, dimensioni, colori e altri attributi tipografici non vengono recuperati.",
] as const;

function markdownPlainText(text: string): string {
  return text.replaceAll("\\", "\\\\").replaceAll(/([#*_\[\]<>])/gu, "\\$1").replaceAll(String.fromCharCode(96), "\\" + String.fromCharCode(96));
}

export async function pdfToMarkdown(
  filename: string,
  input: PdfInput,
  signal?: AbortSignal,
): Promise<PdfToMarkdownResult> {
  const inspection = await inspectPdf(input, signal);
  if (inspection.encrypted) {
    return {
      filename,
      pageCount: inspection.pageCount,
      status: "encrypted",
      markdown: "",
      pages: [],
      provenanceConvention: "html-comment:file-uri-encoded+page",
      extractionMode: "content-order",
      truncated: false,
      losses: PDF_MARKDOWN_LOSSES,
    };
  }
  const extracted = await extractPdfTextScoped(input, { mode: "content-order" }, signal);
  if (!extracted.pages.some((page) => page.text.trim() !== "")) {
    return {
      filename,
      pageCount: inspection.pageCount,
      status: "no-text",
      markdown: "",
      pages: [],
      provenanceConvention: "html-comment:file-uri-encoded+page",
      extractionMode: "content-order",
      truncated: extracted.truncated,
      losses: PDF_MARKDOWN_LOSSES,
      ocrHandoff: OCR_HANDOFF_UNAVAILABLE,
    };
  }
  const encodedFilename = encodeURIComponent(filename);
  const pages = extracted.pages.map((page) => {
    const provenance = "<!-- strumentini-pdf-page file=\"" + encodedFilename + "\" page=\"" + page.page + "\" -->";
    const markdown = provenance + "\n\n" + markdownPlainText(page.text);
    return { page: page.page, text: page.text, markdown, provenance, truncated: page.truncated };
  });
  return {
    filename,
    pageCount: inspection.pageCount,
    status: "converted",
    markdown: pages.map((page) => page.markdown).join("\n\n"),
    pages,
    provenanceConvention: "html-comment:file-uri-encoded+page",
    extractionMode: "content-order",
    truncated: extracted.truncated,
    losses: PDF_MARKDOWN_LOSSES,
  };
}

function pageInputs(document: PdfDocumentModel, pages: readonly number[]): PdfBuildPage[] {
  const unique = [...new Set(pages)];
  if (unique.length === 0 || unique.some((page) => !Number.isInteger(page) || page < 1 || page > document.pages.length)) {
    throw new PdfError("INVALID_INPUT", "Page numbers must be within the document page range.");
  }
  return unique.map((page) => {
    const node = document.pages[page - 1];
    if (node === undefined) throw new PdfError("INVALID_INPUT", "Page does not exist.");
    return { document, page: node };
  });
}

function outputArtifact(bytes: Uint8Array, filename: string, pageCount?: number): PdfArtifact {
  if (bytes.byteLength > PDF_LIMITS.maxOutputBytes) throw new PdfError("PDF_LIMIT", "The generated PDF exceeds the local output byte limit.");
  return { bytes, blob: new Blob([ownedArrayBuffer(bytes)], { type: "application/pdf" }), filename, mime: "application/pdf", ...(pageCount === undefined ? {} : { pageCount }) };
}

function safeStem(value: string | undefined, fallback: string): string {
  const base = (value ?? fallback).replaceAll(/[\\/:*?"<>|]+/gu, "-").replaceAll(/\s+/gu, " ").trim();
  return base.length === 0 ? fallback : base.slice(0, 120);
}

function inputFilename(input: PdfInput): string | undefined {
  if (typeof Blob !== "undefined" && input instanceof Blob) {
    const name = (input as File).name;
    return typeof name === "string" ? name : undefined;
  }
  if (typeof input === "object" && input !== null && !(input instanceof Uint8Array) && !(input instanceof ArrayBuffer)) {
    return (input as PdfBlobInput).filename;
  }
  return undefined;
}

export type PdfMutationKind = "split" | "reorder" | "rotate" | "delete" | "extract" | "metadata-remove" | "flatten" | "compress";

export interface PdfMutationRequest extends PdfMutationOptions {
  readonly kind: PdfMutationKind;
  readonly groups?: readonly (readonly number[])[];
  readonly filename?: string;
}

export async function mutatePdf(input: PdfInput, request: PdfMutationRequest, signal?: AbortSignal): Promise<PdfArtifact[]> {
  const document = parseDocument(await readInput(input, signal));
  const capability = capabilityReport(document, "mutate-pages");
  if (!capability.available) throw new PdfError("UNSUPPORTED_CAPABILITY", capability.reason ?? "PDF mutation is unavailable.");
  abortIfNeeded(signal);
  const allPages = document.pages.map((_, index) => index + 1);
  const selected = request.pages ?? allPages;
  const stripMetadata = request.stripMetadata ?? request.kind === "metadata-remove";
  if (request.flatten === false && request.kind !== "metadata-remove") throw new PdfError("UNSUPPORTED_CAPABILITY", "This mutation mode does not support preserving interactive page hooks.");
  const flatten = request.flatten ?? true;
  const compress = request.compress ?? request.kind === "compress";
  const buildOptions = {
    ...(stripMetadata === undefined ? {} : { stripMetadata }),
    ...(flatten === undefined ? {} : { flatten }),
    ...(compress === undefined ? {} : { compress }),
  };
  const build = (pages: readonly number[], suffix: string): PdfArtifact => {
    abortIfNeeded(signal);
    const built = buildPdfFromPages(pageInputs(document, pages), buildOptions);
    return outputArtifact(built, `${safeStem(request.filename, "document")}-${suffix}.pdf`, pages.length);
  };
  switch (request.kind) {
    case "split": {
      const groups = request.groups?.map((group) => [...group]) ?? [selected];
      if (groups.length === 0) throw new PdfError("INVALID_INPUT", "Provide at least one split range.");
      return groups.map((group, index) => build(group, `part-${String(index + 1).padStart(2, "0")}`));
    }
    case "reorder": {
      if (request.order === undefined || request.order.length !== allPages.length || new Set(request.order).size !== allPages.length || request.order.some((page) => page < 1 || page > allPages.length)) {
        throw new PdfError("INVALID_INPUT", "Reorder requires every page exactly once.");
      }
      return [build(request.order, "reordered")];
    }
    case "rotate": {
      if (request.rotations === undefined || Object.keys(request.rotations).length === 0) throw new PdfError("INVALID_INPUT", "Choose at least one page rotation.");
      const rotated = pageInputs(document, selected).map(({ page }) => {
        const index = document.pages.indexOf(page) + 1;
        const rotation = request.rotations?.[index];
        if (rotation === undefined) return { document, page };
        const dictionary = page.object.value;
        if (dictionary.kind !== "dict") throw new PdfError("MALFORMED_PDF", "Page is not a dictionary.");
        const nextPage = { object: { ...page.object, value: { ...dictionary, entries: new Map([...dictionary.entries, ["Rotate", pdfNumber(rotation)]]) } }, inherited: page.inherited };
        return { document, page: nextPage };
      });
      const bytes = buildPdfFromPages(rotated, buildOptions);
      return [outputArtifact(bytes, `${safeStem(request.filename, "document")}-rotated.pdf`, rotated.length)];
    }
    case "delete": {
      if (request.pages === undefined || request.pages.length === 0) throw new PdfError("INVALID_INPUT", "Choose at least one page to delete.");
      const remove = new Set(selected);
      const remaining = allPages.filter((page) => !remove.has(page));
      if (remaining.length === 0) throw new PdfError("INVALID_INPUT", "Deleting every page would create an empty PDF.");
      return [build(remaining, "pages-removed")];
    }
    case "extract":
      return [build(selected, "extracted")];
    case "metadata-remove":
      return [build(allPages, "metadata-removed")];
    case "flatten":
      return [build(allPages, "flattened")];
    case "compress":
      return [build(allPages, "compressed")];
  }
}

export async function mergePdfs(inputs: readonly PdfInput[], signal?: AbortSignal): Promise<PdfArtifact> {
  return mergePdfsWithPagePlan(inputs, undefined, signal);
}

export async function mergePdfsWithPagePlan(inputs: readonly PdfInput[], pagePlan?: readonly PdfMergePageRef[], signal?: AbortSignal): Promise<PdfArtifact> {
  if (inputs.length < 2) throw new PdfError("INVALID_INPUT", "Choose at least two PDF files to merge.");
  if (inputs.length > PDF_LIMITS.maxFiles) throw new PdfError("PDF_LIMIT", "Too many files were selected.");
  const documents: PdfDocumentModel[] = [];
  let totalInputBytes = 0;
  for (const input of inputs) {
    abortIfNeeded(signal);
    const bytes = await readInput(input, signal);
    totalInputBytes += bytes.byteLength;
    if (totalInputBytes > PDF_LIMITS.maxTotalInputBytes) throw new PdfError("PDF_LIMIT", "Selected PDFs exceed the local total byte limit.");
    const document = parseDocument(bytes);
    const capability = capabilityReport(document, "mutate-pages");
    if (!capability.available) throw new PdfError("UNSUPPORTED_CAPABILITY", capability.reason ?? "PDF mutation is unavailable.");
    documents.push(document);
  }
  const counts = documents.map((document) => document.pages.length);
  const totalPages = counts.reduce((sum, count) => sum + count, 0);
  if (totalPages > PDF_LIMITS.maxPages) throw new PdfError("PDF_LIMIT", "Merged document exceeds the local page limit.");
  if (counts.some((count) => count < 1)) throw new PdfError("INVALID_INPUT", "Cannot merge a PDF without pages.");
  const refs = pagePlan === undefined ? undefined : validatePdfMergePagePlan(counts, pagePlan);
  const pages: PdfBuildPage[] = [];
  if (refs === undefined) {
    for (const document of documents) pages.push(...document.pages.map((page) => ({ document, page })));
  } else {
    for (const ref of refs) {
      abortIfNeeded(signal);
      const document = documents[ref.fileIndex]!;
      const page = document.pages[ref.page - 1]!;
      if (ref.rotation === undefined || ref.rotation === 0) {
        pages.push({ document, page });
        continue;
      }
      if (page.object.value.kind !== "dict") throw new PdfError("MALFORMED_PDF", "Page is not a dictionary.");
      const originalRotation = pageRotation(page);
      const absoluteRotation = (originalRotation + ref.rotation) % 360;
      const entries = new Map(page.object.value.entries);
      entries.set("Rotate", pdfNumber(absoluteRotation));
      pages.push({
        document,
        page: { ...page, object: { ...page.object, value: { ...page.object.value, entries } } },
      });
    }
  }
  const bytes = buildPdfFromPages(pages, { stripMetadata: true, flatten: true });
  return outputArtifact(bytes, "merged.pdf", pages.length);
}

export async function imagesToPdf(inputs: readonly PdfInput[], layout: PdfImagePageLayoutOptions = {}, signal?: AbortSignal): Promise<PdfArtifact> {
  if (inputs.length === 0 || inputs.length > PDF_LIMITS.maxFiles) throw new PdfError("INVALID_INPUT", "Choose between one and fifty images.");
  const images: EmbeddedJpeg[] = [];
  let total = 0;
  for (const input of inputs) {
    abortIfNeeded(signal);
    const value = await readInput(input, signal);
    total += value.byteLength;
    if (total > PDF_LIMITS.maxTotalImageBytes) throw new PdfError("PDF_LIMIT", "Selected images exceed the local total byte limit.");
    if (value.byteLength > PDF_LIMITS.maxImageBytes) throw new PdfError("PDF_LIMIT", "An image exceeds the local byte limit.");
    const image = parseJpeg(value);
    if (image === null) throw new PdfError("UNSUPPORTED_CAPABILITY", "Images to PDF currently accepts JPEG images only; no server conversion is used.");
    images.push(image);
  }
  return outputArtifact(buildPdfFromJpegs(images, layout), "images.pdf", images.length);
}

export async function extractPdfImages(input: PdfInput, signal?: AbortSignal): Promise<PdfArtifact[]> {
  return [...(await extractPdfImagesScoped(input, {}, signal)).artifacts];
}

export async function extractPdfImagesScoped(input: PdfInput, options: PdfImageExtractionOptions = {}, signal?: AbortSignal): Promise<PdfImageExtractionResult> {
  const document = parseDocument(await readInput(input, signal));
  const capability = capabilityReport(document, "extract-images");
  if (!capability.available) throw new PdfError("UNSUPPORTED_CAPABILITY", capability.reason ?? "Image extraction is unavailable.");
  const selectedPages = selectedPageNumbers(document, options.pages);
  const deduplicated = options.dedupe === true;
  const artifacts: PdfArtifact[] = [];
  const provenance: PdfExtractedImageProvenance[] = [];
  const unsupported: PdfUnsupportedImageFilter[] = [];
  const artifactByObject = new Map<number, number>();
  let totalOutputBytes = 0;
  for (const pageNumber of selectedPages) {
    abortIfNeeded(signal);
    const page = document.pages[pageNumber - 1];
    if (page === undefined) continue;
    const resources = dictionaryOrNull(document, page.inherited.Resources ?? (page.object.value.kind === "dict" ? page.object.value.entries.get("Resources") : undefined));
    const xobjects = dictionaryOrNull(document, resources?.entries.get("XObject"));
    if (xobjects === null) continue;
    for (const [resourceName, sourceValue] of xobjects.entries) {
      abortIfNeeded(signal);
      const stream = streamOrNull(document, sourceValue);
      if (stream === null || nameValue(stream.dictionary.entries.get("Subtype")) !== "Image") continue;
      const object = sourceValue.kind === "ref" ? sourceValue.id : null;
      const filters = filterNames(document, stream.dictionary.entries.get("Filter"));
      if (filters.length !== 1 || filters[0] !== "DCTDecode") {
        unsupported.push({
          page: pageNumber,
          resourceName,
          object,
          filters,
          reason: filters.length === 0
            ? "Raw/unfiltered image samples are not exported because the original stream is not a standalone image file."
            : `Original compressed bytes are only exported for a single DCTDecode filter; found ${filters.join(" → ")}.`,
        });
        continue;
      }
      const width = numberValue(stream.dictionary.entries.get("Width"));
      const height = numberValue(stream.dictionary.entries.get("Height"));
      if (width === null || height === null || width < 1 || height < 1 || width > PDF_LIMITS.maxPageDimension || height > PDF_LIMITS.maxPageDimension || width * height > PDF_LIMITS.maxImagePixels) {
        throw new PdfError("PDF_LIMIT", "Extracted image dimensions exceed the local safety limit.");
      }
      if (stream.bytes.byteLength > PDF_LIMITS.maxImageBytes) throw new PdfError("PDF_LIMIT", "Extracted image exceeds the local byte limit.");
      if (parseJpeg(stream.bytes) === null) throw new PdfError("MALFORMED_PDF", `Page ${pageNumber} image ${resourceName} declares DCTDecode but does not contain a valid JPEG stream.`);
      const occurrence = { page: pageNumber, resourceName, object };
      if (deduplicated && object !== null && artifactByObject.has(object)) {
        const provenanceIndex = artifactByObject.get(object);
        if (provenanceIndex !== undefined) {
          const current = provenance[provenanceIndex];
          if (current !== undefined) provenance[provenanceIndex] = { ...current, occurrences: [...current.occurrences, occurrence] };
        }
        continue;
      }
      if (artifacts.length >= PDF_LIMITS.maxImages) throw new PdfError("PDF_LIMIT", "Extracted image count exceeds the local safety limit.");
      totalOutputBytes += stream.bytes.byteLength;
      if (totalOutputBytes > PDF_LIMITS.maxOutputBytes) throw new PdfError("PDF_LIMIT", "Extracted images exceed the local output byte limit.");
      const ordinal = artifacts.length + 1;
      const objectSuffix = object === null ? "direct" : `obj-${object}`;
      const filename = `page-${String(pageNumber).padStart(3, "0")}-${resourceName}-${objectSuffix}-${ordinal}.jpg`;
      const bytes = stream.bytes.slice();
      artifacts.push({ bytes, blob: new Blob([ownedArrayBuffer(bytes)], { type: "image/jpeg" }), filename, mime: "image/jpeg" });
      provenance.push({ filename, object, occurrences: [occurrence], byteLength: bytes.byteLength, filter: "DCTDecode" });
      if (deduplicated && object !== null) artifactByObject.set(object, provenance.length - 1);
    }
  }
  if (artifacts.length === 0 && unsupported.length === 0) {
    throw new PdfError("UNSUPPORTED_CAPABILITY", "No page-scoped embedded image XObjects were found; page rasterization is not silently substituted.");
  }
  return { artifacts, provenance, unsupported, selectedPages, deduplicated, mode: "embedded-original-compressed-bytes" };
}

function metadataIsEmpty(metadata: PdfMetadata): boolean {
  return Object.keys(metadata.recognizedInfo).length === 0
    && Object.keys(metadata.unknownInfo).length === 0
    && metadata.xmpObjectIds.length === 0
    && !metadata.hasXmp;
}

async function textBaselineFor(bytes: Uint8Array, signal?: AbortSignal): Promise<{ status: "verified"; pages: PdfTextPage[] } | { status: "unavailable"; reason: string }> {
  try {
    return { status: "verified", pages: await extractPdfText(bytes, signal) };
  } catch (error) {
    if (error instanceof PdfError && error.code === "UNSUPPORTED_CAPABILITY") return { status: "unavailable", reason: error.message };
    throw error;
  }
}

export async function removePdfMetadataVerified(
  input: PdfInput,
  filename: string | undefined,
  signal?: AbortSignal,
): Promise<{ artifact: PdfArtifact; before: PdfInspection; after: PdfInspection; verification: PdfMetadataRemovalVerification }> {
  const sourceBytes = await readInput(input, signal);
  const before = inspectPdfBytes(sourceBytes);
  const beforeText = await textBaselineFor(sourceBytes, signal);
  const artifacts = await mutatePdf(sourceBytes, { kind: "metadata-remove", ...(filename === undefined ? {} : { filename }), flatten: false, stripMetadata: true }, signal);
  const artifact = artifacts[0];
  if (artifact === undefined) throw new PdfError("WRITE_FAILURE", "Metadata removal did not produce an output PDF.");
  abortIfNeeded(signal);
  const after = inspectPdfBytes(artifact.bytes);
  const metadataRemoved = metadataIsEmpty(after.metadata);
  if (!metadataRemoved) throw new PdfError("WRITE_FAILURE", "Produced PDF still exposes metadata through a recognized Info entry, unknown Info entry, or XMP metadata stream.");
  const pageStable = before.pageCount === after.pageCount;
  if (!pageStable) throw new PdfError("WRITE_FAILURE", `Metadata removal changed page count from ${before.pageCount} to ${after.pageCount}.`);
  let textBaseline: PdfMetadataRemovalVerification["textBaseline"];
  if (beforeText.status === "unavailable") {
    textBaseline = { status: "unavailable", stable: null, changedPages: [], reason: beforeText.reason };
  } else {
    const afterText = await textBaselineFor(artifact.bytes, signal);
    if (afterText.status === "unavailable") throw new PdfError("WRITE_FAILURE", "Produced PDF no longer supports the source document's bounded text baseline extraction.");
    const changedPages = beforeText.pages
      .filter((page, index) => page.text !== afterText.pages[index]?.text)
      .map((page) => page.page);
    if (beforeText.pages.length !== afterText.pages.length) {
      for (let page = Math.min(beforeText.pages.length, afterText.pages.length) + 1; page <= Math.max(beforeText.pages.length, afterText.pages.length); page += 1) changedPages.push(page);
    }
    const stable = changedPages.length === 0;
    if (!stable) throw new PdfError("WRITE_FAILURE", `Metadata removal changed the bounded extracted-text baseline on pages ${changedPages.join(", ")}.`);
    textBaseline = { status: "verified", stable: true, changedPages: [] };
  }
  return {
    artifact,
    before,
    after,
    verification: {
      reparsed: true,
      metadataRemoved,
      pageCount: { before: before.pageCount, after: after.pageCount, stable: true },
      textBaseline,
    },
  };
}

export async function comparePdfs(first: PdfInput, second: PdfInput, signal?: AbortSignal): Promise<PdfCompareResult> {
  const left = inspectPdfBytes(await readInput(first, signal));
  const right = inspectPdfBytes(await readInput(second, signal));
  const geometry = (inspection: PdfInspection): string => inspection.pages.map((page) => `${page.width}x${page.height}@${page.rotation}`).join("|");
  const samePageGeometry = geometry(left) === geometry(right);
  const changedPages: number[] = [];
  for (let index = 0; index < Math.max(left.pages.length, right.pages.length); index += 1) {
    const a = left.pages[index];
    const b = right.pages[index];
    if (a === undefined || b === undefined || a.width !== b.width || a.height !== b.height || a.rotation !== b.rotation) changedPages.push(index + 1);
  }
  const leftText = await extractPdfText(first, signal);
  const rightText = await extractPdfText(second, signal);
  abortIfNeeded(signal);
  const evidence = (inspection: PdfInspection, extracted: typeof leftText) => inspection.pages.map((page, index) => ({
    page: index + 1, text: extracted[index]?.text ?? "", truncated: extracted[index]?.truncated ?? true,
    width: page.width, height: page.height, rotation: page.rotation,
    imageCount: page.imageCount, annotationCount: page.annotationCount,
  }));
  const alignment = alignPdfEvidence(evidence(left, leftText), evidence(right, rightText));
  const matched = alignment.entries.filter((entry) => entry.firstPage !== null && entry.secondPage !== null);
  const structureChanged = matched.filter((entry) => entry.geometryChanged || entry.resourceCountChanged)
    .map((entry) => ({ firstPage: entry.firstPage!, secondPage: entry.secondPage! }));
  const textChanged = matched.filter((entry) => entry.textChanged)
    .map((entry) => ({ firstPage: entry.firstPage!, secondPage: entry.secondPage! }));
  const partial = alignment.ambiguousEmptyText;
  const differences = alignment.addedPages.length + alignment.removedPages.length
    + alignment.reorderedPairs.length + alignment.modifiedPairs.length;
  const textChangedPages = textChanged.map((item) => item.firstPage);
  const summary = differences === 0
    ? `Compared ${left.pageCount} and ${right.pageCount} pages: bounded geometry and extracted text match. Visual appearance NOT checked.`
    : `Compared ${left.pageCount} and ${right.pageCount} pages; ${differences} page alignment/content differences found (added ${alignment.addedPages.length}, removed ${alignment.removedPages.length}, reordered ${alignment.reorderedPairs.length}, modified ${alignment.modifiedPairs.length}). Visual appearance NOT checked.`;
  return {
    first: left, second: right, samePageCount: left.pageCount === right.pageCount,
    samePageGeometry, changedPages, textChangedPages, summary,
    alignment,
    structure: { status: structureChanged.length > 0 || alignment.addedPages.length > 0 || alignment.removedPages.length > 0
      ? "changed" : partial ? "partial" : "bounded-counts-match",
      changedPairs: structureChanged, scope: "page-geometry-rotation-image-and-annotation-counts-only" },
    text: { status: textChanged.length > 0 || alignment.addedPages.length > 0 || alignment.removedPages.length > 0
      ? "changed" : partial ? "partial" : "extracted-match",
      changedPairs: textChanged, truncatedOrTextlessPages: partial, scope: "extractable-text-not-reading-order-or-ocr" },
    visual: { status: "not-rendered", confidence: "unknown",
      note: "L'uguaglianza di testo e geometria NON prova uguaglianza visiva. Avvia esplicitamente il confronto locale delle miniature." },
  };
}

export async function checkPdfPassword(input: PdfInput, signal?: AbortSignal): Promise<{ encrypted: boolean; inspected: PdfInspection }> {
  const inspected = await inspectPdf(input, signal);
  return { encrypted: inspected.encrypted, inspected };
}

export async function removePdfPassword(input: PdfInput, signal?: AbortSignal): Promise<PdfArtifact> {
  const document = parseDocument(await readInput(input, signal));
  if (document.encrypted) throw new PdfError("UNSUPPORTED_CAPABILITY", "Encrypted PDFs are not brute-forced or bypassed. Open a permitted copy in an authorized viewer first.");
  const bytes = buildPdfFromPages(document.pages.map((page) => ({ document, page })), { stripMetadata: true, flatten: true });
  return outputArtifact(bytes, "password-checked.pdf", document.pages.length);
}

async function sha256(bytes: Uint8Array, signal?: AbortSignal): Promise<string> {
  abortIfNeeded(signal);
  if (typeof crypto === "undefined" || typeof crypto.subtle?.digest !== "function") throw new PdfError("UNSUPPORTED_CAPABILITY", "This environment does not provide Web Crypto for a local checksum.");
  const digest = await crypto.subtle.digest("SHA-256", ownedArrayBuffer(bytes));
  abortIfNeeded(signal);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createDocumentManifest(inputs: readonly PdfInput[], signal?: AbortSignal): Promise<PdfDocumentManifest> {
  if (inputs.length === 0 || inputs.length > PDF_LIMITS.maxFiles) throw new PdfError("INVALID_INPUT", "Choose between one and fifty files for the manifest.");
  const files: Array<{ name: string; byteLength: number; mime: string; signature: "pdf" | "unknown"; pageCount: number | null; encrypted: boolean | null; sha256: string }> = [];
  let totalInputBytes = 0;
  for (const input of inputs) {
    abortIfNeeded(signal);
    const bytes = await readInput(input, signal);
    totalInputBytes += bytes.byteLength;
    if (totalInputBytes > PDF_LIMITS.maxTotalInputBytes) throw new PdfError("PDF_LIMIT", "Selected files exceed the local total byte limit.");
    const name = inputFilename(input) ?? "document";
    const isPdf = new TextDecoder("latin1").decode(bytes.slice(0, 5)) === "%PDF-";
    let inspection: PdfInspection | null = null;
    if (isPdf) {
      try {
        inspection = inspectPdfBytes(bytes);
      } catch {
        inspection = null;
      }
    }
    files.push({ name: safeStem(name, "document"), byteLength: bytes.byteLength, mime: isPdf ? "application/pdf" : "application/octet-stream", signature: isPdf ? "pdf" : "unknown", pageCount: inspection?.pageCount ?? null, encrypted: inspection?.encrypted ?? null, sha256: await sha256(bytes, signal) });
  }
  const generatedAt = new Date().toISOString();
  const json = JSON.stringify({ schema: "local-document-manifest-v1", generatedAt, files }, null, 2);
  return { generatedAt, files, json };
}

export function pdfErrorFrom(error: unknown): PdfError {
  if (error instanceof PdfError) return error;
  const message = error instanceof Error ? error.message : "PDF operation failed.";
  const code: PdfErrorCode = message.startsWith("INVALID_") ? "INVALID_INPUT" : message.startsWith("PDF_LIMIT") ? "PDF_LIMIT" : message.startsWith("UNSUPPORTED_") ? "UNSUPPORTED_CAPABILITY" : "MALFORMED_PDF";
  return new PdfError(code, message);
}

export { parseDocument, readInput, contentStreams, stringsInContent, decodePdfString };
