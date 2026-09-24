import {
  PDF_LIMITS,
  type PdfCapability,
  type PdfCapabilityReport,
  type PdfCompareResult,
  type PdfDocumentManifest,
  type PdfFormField,
  type PdfImageInfo,
  type PdfInspection,
  type PdfLink,
  type PdfMetadata,
  type PdfMutationOptions,
  type PdfPageSummary,
  type PdfTextPage,
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
} from "./writer";
import { inflatePdfStream } from "./inflate";

export * from "./types";
export { buildPdfFromJpegs, buildPdfFromPages, createSimplePdf, parseJpeg };
export { inflatePdfStream } from "./inflate";
export type { EmbeddedJpeg, PdfBuildPage };

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

async function readInput(input: PdfInput, signal?: AbortSignal): Promise<Uint8Array> {
  abortIfNeeded(signal);
  try {
    if (input instanceof Uint8Array) return input.slice();
    if (input instanceof ArrayBuffer) return new Uint8Array(input.slice(0));
    if (typeof Blob !== "undefined" && input instanceof Blob) return new Uint8Array(await input.arrayBuffer());
    if (typeof input === "object" && input !== null) {
      const object = input as PdfBlobInput;
      if (object.bytes !== undefined) return object.bytes.slice();
      if (object.buffer !== undefined) return new Uint8Array(object.buffer.slice(0));
      if (object.blob !== undefined) return new Uint8Array(await object.blob.arrayBuffer());
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
    if (text !== null) custom[key] = text;
  }
  const hasXmp = [...document.objects.values()].some((object) => object.value.kind === "stream" && nameValue(object.value.dictionary.entries.get("Type")) === "Metadata");
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
    custom: Object.fromEntries(Object.entries(custom).filter(([key]) => !known.has(key))),
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
    const uri = valueToText(resolveReference(document, uriValue));
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
  const images = [...document.objects.values()].map((object) => imageInfo(document, object)).filter((image): image is PdfImageInfo => image !== null);
  const warnings: string[] = [];
  if (document.pages.length === 0) warnings.push("No page tree was found; page-specific operations are unavailable.");
  if (document.encrypted) warnings.push("Encryption was detected. Inspection is local; password cracking is intentionally unavailable.");
  if (images.length > PDF_LIMITS.maxImages) warnings.push("Image count exceeds the local inspection limit.");
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

export async function extractPdfText(input: PdfInput, signal?: AbortSignal): Promise<PdfTextPage[]> {
  const document = parseDocument(await readInput(input, signal));
  const capability = capabilityReport(document, "extract-text");
  if (!capability.available) throw new PdfError("UNSUPPORTED_CAPABILITY", capability.reason ?? "Text extraction is unavailable.");
  const output: PdfTextPage[] = [];
  let total = 0;
  for (let index = 0; index < document.pages.length; index += 1) {
    abortIfNeeded(signal);
    const page = document.pages[index];
    if (page === undefined) continue;
    const values: string[] = [];
    for (const stream of contentStreams(document, page)) {
      const bytes = await inflateStream(stream, signal);
      values.push(...stringsInContent(bytes));
    }
    let text = values.join(" ").replaceAll(/\s+/gu, " ").trim();
    const truncated = total + text.length > PDF_LIMITS.maxTextBytes;
    if (truncated) text = text.slice(0, Math.max(0, PDF_LIMITS.maxTextBytes - total));
    total += text.length;
    output.push({ page: index + 1, text, truncated });
    if (total >= PDF_LIMITS.maxTextBytes) break;
  }
  return output;
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
  const flatten = request.flatten ?? request.kind === "flatten";
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
  if (inputs.length < 2) throw new PdfError("INVALID_INPUT", "Choose at least two PDF files to merge.");
  if (inputs.length > PDF_LIMITS.maxFiles) throw new PdfError("PDF_LIMIT", "Too many files were selected.");
  const pages: PdfBuildPage[] = [];
  for (const input of inputs) {
    abortIfNeeded(signal);
    const document = parseDocument(await readInput(input, signal));
    const capability = capabilityReport(document, "mutate-pages");
    if (!capability.available) throw new PdfError("UNSUPPORTED_CAPABILITY", capability.reason ?? "PDF mutation is unavailable.");
    pages.push(...document.pages.map((page) => ({ document, page })));
  }
  if (pages.length > PDF_LIMITS.maxPages) throw new PdfError("PDF_LIMIT", "Merged document exceeds the local page limit.");
  const bytes = buildPdfFromPages(pages, { stripMetadata: true });
  return outputArtifact(bytes, "merged.pdf", pages.length);
}

function imageFiles(inputs: readonly PdfInput[], signal?: AbortSignal): Promise<Uint8Array[]> {
  return Promise.all(inputs.map(async (input) => {
    abortIfNeeded(signal);
    return readInput(input, signal);
  }));
}

export async function imagesToPdf(inputs: readonly PdfInput[], signal?: AbortSignal): Promise<PdfArtifact> {
  if (inputs.length === 0 || inputs.length > PDF_LIMITS.maxFiles) throw new PdfError("INVALID_INPUT", "Choose between one and fifty images.");
  const bytes = await imageFiles(inputs, signal);
  const total = bytes.reduce((sum, value) => sum + value.byteLength, 0);
  if (total > PDF_LIMITS.maxTotalImageBytes) throw new PdfError("PDF_LIMIT", "Selected images exceed the local total byte limit.");
  const images: EmbeddedJpeg[] = [];
  for (const value of bytes) {
    if (value.byteLength > PDF_LIMITS.maxImageBytes) throw new PdfError("PDF_LIMIT", "An image exceeds the local byte limit.");
    const image = parseJpeg(value);
    if (image === null) throw new PdfError("UNSUPPORTED_CAPABILITY", "Images to PDF currently accepts JPEG images only; no server conversion is used.");
    images.push(image);
  }
  return outputArtifact(buildPdfFromJpegs(images), "images.pdf", images.length);
}

export async function extractPdfImages(input: PdfInput, signal?: AbortSignal): Promise<PdfArtifact[]> {
  const document = parseDocument(await readInput(input, signal));
  const capability = capabilityReport(document, "extract-images");
  if (!capability.available) throw new PdfError("UNSUPPORTED_CAPABILITY", capability.reason ?? "Image extraction is unavailable.");
  const artifacts: PdfArtifact[] = [];
  for (const object of document.objects.values()) {
    abortIfNeeded(signal);
    if (object.value.kind !== "stream" || nameValue(object.value.dictionary.entries.get("Subtype")) !== "Image") continue;
    const filters = filterNames(document, object.value.dictionary.entries.get("Filter"));
    if (!filters.includes("DCTDecode")) continue;
    artifacts.push({ bytes: object.value.bytes.slice(), blob: new Blob([ownedArrayBuffer(object.value.bytes)], { type: "image/jpeg" }), filename: `image-${artifacts.length + 1}.jpg`, mime: "image/jpeg" });
  }
  if (artifacts.length === 0) throw new PdfError("UNSUPPORTED_CAPABILITY", "No directly extractable JPEG image streams were found; vector/raster rendering is not silently substituted.");
  if (artifacts.reduce((total, artifact) => total + artifact.bytes.byteLength, 0) > PDF_LIMITS.maxOutputBytes) throw new PdfError("PDF_LIMIT", "Extracted images exceed the local output byte limit.");
  return artifacts;
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
  const textChangedPages = leftText.filter((page, index) => page.text !== rightText[index]?.text).map((page) => page.page);
  const summary = left.pageCount === right.pageCount && samePageGeometry && textChangedPages.length === 0
    ? "The bounded page geometry and extracted text match."
    : `Compared ${left.pageCount} and ${right.pageCount} pages; ${changedPages.length} geometry and ${textChangedPages.length} text differences found.`;
  return { first: left, second: right, samePageCount: left.pageCount === right.pageCount, samePageGeometry, changedPages, textChangedPages, summary };
}

export async function checkPdfPassword(input: PdfInput, signal?: AbortSignal): Promise<{ encrypted: boolean; inspected: PdfInspection }> {
  const inspected = await inspectPdf(input, signal);
  return { encrypted: inspected.encrypted, inspected };
}

export async function removePdfPassword(input: PdfInput, signal?: AbortSignal): Promise<PdfArtifact> {
  const document = parseDocument(await readInput(input, signal));
  if (document.encrypted) throw new PdfError("UNSUPPORTED_CAPABILITY", "Encrypted PDFs are not brute-forced or bypassed. Open a permitted copy in an authorized viewer first.");
  const bytes = buildPdfFromPages(document.pages.map((page) => ({ document, page })), { stripMetadata: true });
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
  for (const input of inputs) {
    abortIfNeeded(signal);
    const bytes = await readInput(input, signal);
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
  const json = JSON.stringify({ schema: "utilityos-document-manifest-v1", generatedAt, files }, null, 2);
  return { generatedAt, files, json };
}

export function pdfErrorFrom(error: unknown): PdfError {
  if (error instanceof PdfError) return error;
  const message = error instanceof Error ? error.message : "PDF operation failed.";
  const code: PdfErrorCode = message.startsWith("INVALID_") ? "INVALID_INPUT" : message.startsWith("PDF_LIMIT") ? "PDF_LIMIT" : message.startsWith("UNSUPPORTED_") ? "UNSUPPORTED_CAPABILITY" : "MALFORMED_PDF";
  return new PdfError(code, message);
}

export { parseDocument, readInput, contentStreams, stringsInContent, decodePdfString };
