import { PDF_LIMITS } from "./types";
import {
  dictionaryWith,
  encodeLiteralString,
  nameValue,
  numberValue,
  pdfArray,
  pdfDict,
  pdfName,
  pdfNumber,
  pdfReference,
  pdfString,
  type PdfDictionary,
  type PdfDocumentModel,
  type PdfObject,
  type PdfPageNode,
  type PdfStream,
  type PdfValue,
} from "./parser";

export interface PdfBuildPage {
  readonly document: PdfDocumentModel;
  readonly page: PdfPageNode;
}

export interface PdfBuildOptions {
  readonly stripMetadata?: boolean;
  readonly flatten?: boolean;
  readonly compress?: boolean;
  readonly preserveInfo?: boolean;
  /** Original indirect Image XObject id -> verified replacement DCT/JPEG bytes. */
  readonly jpegReplacements?: ReadonlyMap<number, Uint8Array>;
}

interface CloneState {
  readonly source: PdfDocumentModel;
  readonly mapped: Map<number, ReturnType<typeof pdfReference>>;
  readonly skip: Set<number>;
  readonly options: PdfBuildOptions;
  readonly active: Set<number>;
  readonly pending: Map<number, PdfObject>;
  readonly allocate: () => ReturnType<typeof pdfReference>;
}

function isDictionary(value: PdfValue): value is PdfDictionary {
  return value.kind === "dict";
}

const INTERACTIVE_PDF_KEYS = new Set(["A", "AA", "AcroForm", "Annots", "EmbeddedFiles", "JavaScript", "JS", "Launch", "Names", "OpenAction", "URI"]);

function isMetadataObject(value: PdfValue): boolean {
  if (isDictionary(value)) return nameValue(value.entries.get("Type")) === "Metadata";
  return value.kind === "stream" && nameValue(value.dictionary.entries.get("Type")) === "Metadata";
}

function isObjectToSkip(value: PdfValue, flatten: boolean): boolean {
  if (isMetadataObject(value)) return true;
  if (!flatten) return false;
  if (isDictionary(value)) return [...value.entries.keys()].some((key) => INTERACTIVE_PDF_KEYS.has(key));
  return value.kind === "stream" && [...value.dictionary.entries.keys()].some((key) => INTERACTIVE_PDF_KEYS.has(key));
}

function omitNullEntries(entries: ReadonlyMap<string, PdfValue | null>): PdfDictionary {
  const result = new Map<string, PdfValue>();
  for (const [key, value] of entries) if (value !== null) result.set(key, value);
  return { kind: "dict", entries: result };
}

function normalizeStreamBytes(value: PdfStream): PdfStream {
  if (value.dictionary.entries.has("Filter")) return value;
  const source = new TextDecoder("latin1").decode(value.bytes);
  const normalized = source.replaceAll(/[\r\n\t]+/gu, " ").replaceAll(/ {2,}/gu, " ");
  return { kind: "stream", dictionary: value.dictionary, bytes: new TextEncoder().encode(normalized) };
}

function cloneSourceValue(value: PdfValue, state: CloneState, depth = 0): PdfValue | null {
  if (depth > 128) throw new Error("MALFORMED_PDF: object graph exceeds the local nesting limit");
  if (value.kind === "name" || value.kind === "literal") return value;
  if (value.kind === "string") return { ...value, bytes: value.bytes.slice() };
  if (value.kind === "ref") return cloneSourceReference(value, state, depth);
  if (value.kind === "array") {
    const items = value.items.map((item) => cloneSourceValue(item, state, depth + 1));
    if (items.some((item) => item === null)) return null;
    return { kind: "array", items: items as PdfValue[] };
  }
  if (value.kind === "dict") {
    const entries = new Map<string, PdfValue | null>();
    for (const [key, entry] of value.entries) {
      if (state.options.flatten !== false && INTERACTIVE_PDF_KEYS.has(key)) continue;
      entries.set(key, cloneSourceValue(entry, state, depth + 1));
    }
    return omitNullEntries(entries);
  }
  if (state.options.compress === true && nameValue(value.dictionary.entries.get("Subtype")) !== "Image") return normalizeStreamBytes(value);
  return { kind: "stream", dictionary: cloneSourceValue(value.dictionary, state, depth + 1) as PdfDictionary, bytes: value.bytes.slice() };
}

function cloneSourceReference(reference: PdfValue & { kind: "ref" }, state: CloneState, depth: number): PdfValue | null {
  const mapped = state.mapped.get(reference.id);
  if (mapped !== undefined) return mapped;
  const sourceObject = state.source.objects.get(reference.id);
  if (sourceObject === undefined) throw new Error("MALFORMED_PDF: referenced object is missing");
  if (state.skip.has(reference.id) || isObjectToSkip(sourceObject.value, state.options.flatten !== false)) return null;
  if (state.active.has(reference.id)) return reference;
  state.active.add(reference.id);
  const targetReference = state.allocate();
  state.mapped.set(reference.id, targetReference);
  const cloned = cloneSourceValue(sourceObject.value, state, depth + 1);
  state.active.delete(reference.id);
  if (cloned === null) {
    state.mapped.delete(reference.id);
    return null;
  }
  const jpegBytes = state.options.jpegReplacements?.get(reference.id);
  if (jpegBytes !== undefined && (cloned.kind !== "stream" || nameValue(cloned.dictionary.entries.get("Subtype")) !== "Image")) {
    throw new Error("PDF_OUTPUT_MISMATCH: JPEG replacement target is not an image stream");
  }
  state.pending.set(targetReference.id, { id: targetReference.id, generation: 0,
    value: jpegBytes === undefined ? cloned : { ...cloned as PdfStream, bytes: jpegBytes.slice() } });
  return targetReference;
}

function createState(
  source: PdfDocumentModel,
  options: PdfBuildOptions,
  skip: Set<number>,
  allocate: () => ReturnType<typeof pdfReference>,
): CloneState {
  return { source, options, skip, mapped: new Map(), active: new Set(), pending: new Map(), allocate };
}

function pageValue(page: PdfPageNode, state: CloneState): PdfDictionary {
  const original = page.object.value;
  if (!isDictionary(original)) throw new Error("MALFORMED_PDF: page object is not a dictionary");
  const entries = new Map<string, PdfValue | null>();
  for (const [key, value] of original.entries) {
    if (key === "Parent" || (state.options.stripMetadata === true && key === "Metadata")) {
      entries.set(key, null);
      continue;
    }
    if (state.options.flatten !== false && ["Annots", "AA", "OpenAction", "AcroForm", "Names", "StructParents", "Tabs"].includes(key)) {
      entries.set(key, null);
      continue;
    }
    entries.set(key, cloneSourceValue(value, state));
  }
  for (const key of ["Resources", "MediaBox", "CropBox", "Rotate"]) {
    if (original.entries.has(key)) continue;
    const inherited = page.inherited[key];
    if (inherited !== undefined) entries.set(key, cloneSourceValue(inherited, state));
  }
  const rotation = numberValue(original.entries.get("Rotate") ?? page.inherited.Rotate);
  if (rotation !== null && Number.isFinite(rotation)) entries.set("Rotate", pdfNumber(normalizeRotation(rotation)));
  return omitNullEntries(entries);
}

function normalizeRotation(value: number): number {
  const normalized = ((Math.round(value / 90) * 90) % 360 + 360) % 360;
  return normalized;
}

function serializeName(value: string): string {
  const escaped = value.replaceAll("#", "#23").replaceAll(/[()<>\[\]{}/%]/gu, (character) => `#${character.charCodeAt(0).toString(16).padStart(2, "0")}`);
  return `/${escaped}`;
}

function serializeValue(value: PdfValue): string {
  if (value.kind === "name") return serializeName(value.value);
  if (value.kind === "literal") return value.value;
  if (value.kind === "string") return value.hex ? `<${Array.from(value.bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}>` : encodeLiteralString(value.bytes);
  if (value.kind === "ref") return `${value.id} ${value.generation} R`;
  if (value.kind === "array") return `[${value.items.map(serializeValue).join(" ")}]`;
  if (value.kind === "dict") return `<<${[...value.entries].map(([key, entry]) => `${serializeName(key)} ${serializeValue(entry)}`).join(" ")}>>`;
  return "null";
}

function serializeObject(object: PdfObject): { dictionary: string; stream: Uint8Array | null } {
  if (object.value.kind !== "stream") return { dictionary: serializeValue(object.value), stream: null };
  const length = object.value.bytes.byteLength;
  const dictionary = dictionaryWith(object.value.dictionary, "Length", pdfNumber(length));
  return { dictionary: serializeValue(dictionary), stream: object.value.bytes };
}

function concatBytes(chunks: readonly Uint8Array[], total: number): Uint8Array {
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function skipIdsFor(document: PdfDocumentModel, options: PdfBuildOptions): Set<number> {
  const skip = new Set<number>();
  if (options.stripMetadata === true) {
    if (document.info !== null) skip.add(document.info.id);
    for (const object of document.objects.values()) if (isObjectToSkip(object.value, false)) skip.add(object.id);
  }
  if (options.flatten !== false) {
    for (const object of document.objects.values()) {
      if (isObjectToSkip(object.value, true)) skip.add(object.id);
    }
  }
  return skip;
}

export class PdfBuilder {
  private readonly objects = new Map<number, PdfObject>();
  private nextId = 1;

  reserve(): ReturnType<typeof pdfReference> {
    const id = this.nextId;
    this.nextId += 1;
    this.objects.set(id, { id, generation: 0, value: pdfDict({}) });
    return pdfReference(id, 0);
  }

  put(reference: ReturnType<typeof pdfReference>, value: PdfValue): void {
    this.objects.set(reference.id, { id: reference.id, generation: 0, value });
  }

  putAuto(value: PdfValue): ReturnType<typeof pdfReference> {
    const reference = this.reserve();
    this.put(reference, value);
    return reference;
  }

  build(root: ReturnType<typeof pdfReference>, info: ReturnType<typeof pdfReference> | null): Uint8Array {
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [encoder.encode("%PDF-1.7\n%\xE2\xE3\xCF\xD3\n")];
    let total = chunks[0]?.byteLength ?? 0;
    const offsets = new Map<number, number>();
    const ids = [...this.objects.keys()].sort((left, right) => left - right);
    for (const id of ids) {
      const object = this.objects.get(id);
      if (object === undefined) continue;
      offsets.set(id, total);
      const serialized = serializeObject(object);
      const prefix = encoder.encode(`${id} 0 obj\n${serialized.dictionary}\n`);
      chunks.push(prefix);
      total += prefix.byteLength;
      if (serialized.stream !== null) {
        const streamPrefix = encoder.encode("stream\n");
        chunks.push(streamPrefix, serialized.stream, encoder.encode("\nendstream\n"));
        total += streamPrefix.byteLength + serialized.stream.byteLength + "\nendstream\n".length;
      }
      const suffix = encoder.encode("endobj\n");
      chunks.push(suffix);
      total += suffix.byteLength;
    }
    const xrefOffset = total;
    const maxId = ids.at(-1) ?? 0;
    const xrefLines = [`xref\n0 ${maxId + 1}\n`, "0000000000 65535 f \n"];
    for (let id = 1; id <= maxId; id += 1) {
      const offset = offsets.get(id);
      xrefLines.push(offset === undefined ? "0000000000 65535 f \n" : `${offset.toString().padStart(10, "0")} 00000 n \n`);
    }
    const trailer = pdfDict({
      Size: pdfNumber(maxId + 1),
      Root: root,
      ...(info === null ? {} : { Info: info }),
    });
    xrefLines.push(`trailer\n${serializeValue(trailer)}\nstartxref\n${xrefOffset}\n%%EOF\n`);
    const tail = encoder.encode(xrefLines.join(""));
    chunks.push(tail);
    total += tail.byteLength;
    if (total > PDF_LIMITS.maxOutputBytes) throw new Error("PDF_LIMIT: generated PDF exceeds the local output limit");
    return concatBytes(chunks, total);
  }
}

function addClonedObjects(builder: PdfBuilder, state: CloneState): void {
  for (const object of state.pending.values()) builder.put(pdfReference(object.id), object.value);
  state.pending.clear();
}

function clonePage(builder: PdfBuilder, page: PdfBuildPage, options: PdfBuildOptions): ReturnType<typeof pdfReference> {
  const sourceReference = pdfReference(page.page.object.id, page.page.object.generation);
  const state = createState(page.document, options, skipIdsFor(page.document, options), () => builder.reserve());
  const targetReference = builder.reserve();
  state.mapped.set(sourceReference.id, targetReference);
  const value = pageValue(page.page, state);
  state.pending.set(targetReference.id, { id: targetReference.id, generation: 0, value });
  addClonedObjects(builder, state);
  return targetReference;
}

function cloneInfo(builder: PdfBuilder, document: PdfDocumentModel, options: PdfBuildOptions): ReturnType<typeof pdfReference> | null {
  if (options.stripMetadata === true || document.info === null) return null;
  const state = createState(document, options, new Set(), () => builder.reserve());
  const value = cloneSourceValue(document.objects.get(document.info.id)?.value ?? pdfDict({}), state);
  if (value === null) return null;
  const reference = builder.reserve();
  state.pending.set(reference.id, { id: reference.id, generation: 0, value });
  addClonedObjects(builder, state);
  return reference;
}

function catalogValue(
  builder: PdfBuilder,
  pages: ReturnType<typeof pdfReference>,
  source: PdfDocumentModel | null,
  options: PdfBuildOptions,
): PdfDictionary {
  if (source === null || source.root === null) return pdfDict({ Type: pdfName("Catalog"), Pages: pages });
  const rootObject = source.objects.get(source.root.id)?.value;
  if (rootObject?.kind !== "dict") return pdfDict({ Type: pdfName("Catalog"), Pages: pages });
  const state = createState(source, options, skipIdsFor(source, options), () => builder.reserve());
  const entries = new Map<string, PdfValue | null>([["Type", pdfName("Catalog")], ["Pages", pages]]);
  for (const [key, value] of rootObject.entries) {
    if (key === "Type" || key === "Pages") continue;
    if (options.stripMetadata === true && (key === "Metadata" || key === "Info")) continue;
    if (options.flatten !== false && INTERACTIVE_PDF_KEYS.has(key)) continue;
    entries.set(key, cloneSourceValue(value, state));
  }
  addClonedObjects(builder, state);
  return omitNullEntries(entries);
}

function buildFromPages(pagesToBuild: readonly PdfBuildPage[], options: PdfBuildOptions = {}): { bytes: Uint8Array; pageCount: number } {
  if (pagesToBuild.length === 0) throw new Error("INVALID_INPUT: at least one page is required");
  const builder = new PdfBuilder();
  const pagesReference = builder.reserve();
  const pageReferences = pagesToBuild.map((page) => clonePage(builder, page, options));
  builder.put(pagesReference, pdfDict({ Type: pdfName("Pages"), Kids: pdfArray(pageReferences), Count: pdfNumber(pageReferences.length) }));
  const rootReference = builder.reserve();
  const source = pagesToBuild[0]?.document ?? null;
  builder.put(rootReference, catalogValue(builder, pagesReference, source, options));
  const info = source === null ? null : cloneInfo(builder, source, options);
  return { bytes: builder.build(rootReference, info), pageCount: pageReferences.length };
}

export function buildPdfFromPages(pages: readonly PdfBuildPage[], options: PdfBuildOptions = {}): Uint8Array {
  return buildFromPages(pages, options).bytes;
}

export function createSimplePdf(pageTexts: readonly string[], options: { readonly width?: number; readonly height?: number; readonly metadata?: Readonly<Record<string, string>> } = {}): Uint8Array {
  if (pageTexts.length > PDF_LIMITS.maxPages) throw new Error("PDF_LIMIT: page count exceeds the local safety limit");
  const width = options.width ?? 612;
  const height = options.height ?? 792;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width > PDF_LIMITS.maxPageDimension || height > PDF_LIMITS.maxPageDimension) throw new Error("PDF_LIMIT: page dimensions exceed the local safety limit");
  if (pageTexts.some((text) => typeof text !== "string" || text.length > PDF_LIMITS.maxTextBytes)) throw new Error("PDF_LIMIT: page text exceeds the local safety limit");
  if (Object.values(options.metadata ?? {}).some((value) => typeof value !== "string" || value.length > PDF_LIMITS.maxTextBytes)) throw new Error("PDF_LIMIT: PDF metadata exceeds the local safety limit");
  const objects: PdfObject[] = [];
  const pageIds = pageTexts.map((_, index) => 4 + index * 2);
  const contentIds = pageIds.map((id) => id + 1);
  const fontId = 3;
  const catalogId = 1;
  const pagesId = 2;
  const infoId = 4 + pageTexts.length * 2;
  objects.push({ id: catalogId, generation: 0, value: pdfDict({ Type: pdfName("Catalog"), Pages: pdfReference(pagesId) }) });
  objects.push({ id: pagesId, generation: 0, value: pdfDict({ Type: pdfName("Pages"), Kids: pdfArray(pageIds.map((id) => pdfReference(id))), Count: pdfNumber(pageTexts.length) }) });
  objects.push({ id: fontId, generation: 0, value: pdfDict({ Type: pdfName("Font"), Subtype: pdfName("Type1"), BaseFont: pdfName("Helvetica") }) });
  pageTexts.forEach((text, index) => {
    const pageId = pageIds[index] ?? 0;
    const contentId = contentIds[index] ?? 0;
    const escaped = text.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
    const streamText = `BT /F1 18 Tf 72 ${Math.max(72, height - 96)} Td (${escaped}) Tj ET`;
    objects.push({ id: pageId, generation: 0, value: pdfDict({ Type: pdfName("Page"), Parent: pdfReference(pagesId), MediaBox: pdfArray([pdfNumber(0), pdfNumber(0), pdfNumber(width), pdfNumber(height)]), Resources: pdfDict({ Font: pdfDict({ F1: pdfReference(fontId) }) }), Contents: pdfReference(contentId) }) });
    objects.push({ id: contentId, generation: 0, value: { kind: "stream", dictionary: pdfDict({}), bytes: new TextEncoder().encode(streamText) } });
  });
  const metadata = options.metadata ?? {};
  const infoEntries: Record<string, PdfValue> = {};
  const keyMap: Record<string, string> = { title: "Title", author: "Author", subject: "Subject", keywords: "Keywords", creator: "Creator", producer: "Producer" };
  for (const [key, pdfKey] of Object.entries(keyMap)) if (metadata[key] !== undefined) infoEntries[pdfKey] = pdfString(metadata[key]);
  if (Object.keys(infoEntries).length > 0) objects.push({ id: infoId, generation: 0, value: pdfDict(infoEntries) });
  const builder = new PdfBuilder();
  for (const object of objects) builder.put(pdfReference(object.id), object.value);
  const root = pdfReference(catalogId);
  return builder.build(root, Object.keys(infoEntries).length > 0 ? pdfReference(infoId) : null);
}

export interface EmbeddedJpeg {
  readonly bytes: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly name: string;
}

export type PdfImagePageSize = "original" | "a4" | "letter";
export type PdfImageFit = "contain" | "cover";
export type PdfImageOrientation = "auto" | "portrait" | "landscape";

export interface PdfImagePageLayoutOptions {
  readonly pageSize?: PdfImagePageSize;
  readonly fit?: PdfImageFit;
  readonly orientation?: PdfImageOrientation;
  readonly marginPoints?: number;
  readonly rotations?: Readonly<Record<number, 0 | 90 | 180 | 270>>;
}

function jpegDimension(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const length = (bytes[offset + 2] ?? 0) * 256 + (bytes[offset + 3] ?? 0);
    if (length < 2 || offset + length + 2 > bytes.length) return null;
    if (marker >= 0xc0 && marker <= 0xc3) {
      const height = (bytes[offset + 5] ?? 0) * 256 + (bytes[offset + 6] ?? 0);
      const width = (bytes[offset + 7] ?? 0) * 256 + (bytes[offset + 8] ?? 0);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    offset += length + 2;
  }
  return null;
}

export function parseJpeg(bytes: Uint8Array, name = "image.jpg"): EmbeddedJpeg | null {
  const dimensions = jpegDimension(bytes);
  return dimensions === null ? null : { bytes: bytes.slice(), ...dimensions, name };
}

export function buildPdfFromJpegs(images: readonly EmbeddedJpeg[], options: PdfImagePageLayoutOptions = {}): Uint8Array {
  if (images.length === 0) throw new Error("INVALID_INPUT: choose at least one JPEG image");
  if (images.length > PDF_LIMITS.maxFiles) throw new Error("PDF_LIMIT: too many images");
  let totalBytes = 0;
  for (const image of images) {
    if (!Number.isInteger(image.width) || !Number.isInteger(image.height) || image.width < 1 || image.height < 1 || image.width > PDF_LIMITS.maxPageDimension || image.height > PDF_LIMITS.maxPageDimension || image.width * image.height > PDF_LIMITS.maxImagePixels) throw new Error("PDF_LIMIT: image dimensions exceed the local safety limit");
    if (image.bytes.byteLength > PDF_LIMITS.maxImageBytes) throw new Error("PDF_LIMIT: image exceeds the local byte limit");
    totalBytes += image.bytes.byteLength;
    if (totalBytes > PDF_LIMITS.maxTotalImageBytes) throw new Error("PDF_LIMIT: images exceed the local total byte limit");
  }
  const builder = new PdfBuilder();
  const pagesReference = builder.reserve();
  const pageReferences: ReturnType<typeof pdfReference>[] = [];
  const pageSize = options.pageSize ?? "original";
  const fit = options.fit ?? "contain";
  const orientation = options.orientation ?? "auto";
  const margin = options.marginPoints ?? 0;
  if (!Number.isFinite(margin) || margin < 0 || margin > 288) throw new Error("INVALID_INPUT: PDF image margin must be between 0 and 288 points");
  const fixedPage = pageSize === "a4" ? { width: 595.28, height: 841.89 } : pageSize === "letter" ? { width: 612, height: 792 } : null;
  for (let index = 0; index < images.length; index += 1) {
    const image = images[index]!;
    const rotation = options.rotations?.[index + 1] ?? 0;
    if (![0, 90, 180, 270].includes(rotation)) throw new Error("INVALID_INPUT: Image rotation must be 0, 90, 180, or 270 degrees");
    const rotatedSourceWidth = rotation === 90 || rotation === 270 ? image.height : image.width;
    const rotatedSourceHeight = rotation === 90 || rotation === 270 ? image.width : image.height;
    let pageWidth: number;
    let pageHeight: number;
    if (fixedPage === null) {
      pageWidth = rotatedSourceWidth + margin * 2;
      pageHeight = rotatedSourceHeight + margin * 2;
    } else {
      const landscape = orientation === "landscape" || (orientation === "auto" && rotatedSourceWidth > rotatedSourceHeight);
      pageWidth = landscape ? fixedPage.height : fixedPage.width;
      pageHeight = landscape ? fixedPage.width : fixedPage.height;
    }
    const availableWidth = pageWidth - margin * 2;
    const availableHeight = pageHeight - margin * 2;
    if (availableWidth <= 0 || availableHeight <= 0) throw new Error("INVALID_INPUT: PDF margin leaves no printable page area");
    const scale = fit === "cover"
      ? Math.max(availableWidth / rotatedSourceWidth, availableHeight / rotatedSourceHeight)
      : Math.min(availableWidth / rotatedSourceWidth, availableHeight / rotatedSourceHeight);
    const targetWidth = rotatedSourceWidth * scale;
    const targetHeight = rotatedSourceHeight * scale;
    const x = margin + (availableWidth - targetWidth) / 2;
    const y = margin + (availableHeight - targetHeight) / 2;
    const transform = rotation === 90
      ? `0 ${-targetHeight} ${targetWidth} 0 ${x} ${y + targetHeight}`
      : rotation === 180
        ? `${-targetWidth} 0 0 ${-targetHeight} ${x + targetWidth} ${y + targetHeight}`
        : rotation === 270
          ? `0 ${targetHeight} ${-targetWidth} 0 ${x + targetWidth} ${y}`
          : `${targetWidth} 0 0 ${targetHeight} ${x} ${y}`;
    const imageReference = builder.putAuto({ kind: "stream", dictionary: pdfDict({ Type: pdfName("XObject"), Subtype: pdfName("Image"), Width: pdfNumber(image.width), Height: pdfNumber(image.height), ColorSpace: pdfName("DeviceRGB"), BitsPerComponent: pdfNumber(8), Filter: pdfName("DCTDecode") }), bytes: image.bytes.slice() });
    const clip = fit === "cover" ? `${margin} ${margin} ${availableWidth} ${availableHeight} re W n\n` : "";
    const contentText = `q\n${clip}${transform} cm\n/Im0 Do\nQ\n`;
    const contentReference = builder.putAuto({ kind: "stream", dictionary: pdfDict({}), bytes: new TextEncoder().encode(contentText) });
    const pageReference = builder.putAuto(pdfDict({ Type: pdfName("Page"), MediaBox: pdfArray([pdfNumber(0), pdfNumber(0), pdfNumber(pageWidth), pdfNumber(pageHeight)]), Resources: pdfDict({ XObject: pdfDict({ Im0: imageReference }) }), Contents: contentReference }));
    pageReferences.push(pageReference);
  }
  builder.put(pagesReference, pdfDict({ Type: pdfName("Pages"), Kids: pdfArray(pageReferences), Count: pdfNumber(pageReferences.length) }));
  const rootReference = builder.reserve();
  builder.put(rootReference, pdfDict({ Type: pdfName("Catalog"), Pages: pagesReference }));
  return builder.build(rootReference, null);
}

export { jpegDimension, normalizeStreamBytes, serializeValue };
