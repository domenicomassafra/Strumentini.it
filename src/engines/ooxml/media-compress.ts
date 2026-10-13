import { analyzeOoxmlPackage, OOXML_PACKAGE_LIMITS, OoxmlPackageError, type OoxmlPackageAnalysis } from "./package";
import { inspectImageHeader } from "../image/format";
import { compareOoxmlZipGroups, summarizeOoxmlZipGroups, type OoxmlZipGroupBreakdown, type OoxmlZipGroupDifference } from "./compression-groups";
import type { Zippable } from "fflate";

/**
 * #264: intentionally bounded, conservative OOXML media-only transform.
 * The original Office XML, relationships, content-types, member names and
 * editable structure remain byte-identical. JPEG requantization and *any*
 * resizing are explicitly opt-in; PNG no-resize is verified pixel-for-pixel.
 */
export interface OoxmlMediaCompressionOptions {
  readonly profile?: OoxmlCompressionProfile;
  readonly approveLossyJpeg?: boolean;
  readonly approveLossyWebp?: boolean;
  readonly jpegQuality?: number;
  readonly approveResize?: boolean;
  readonly maxDimension?: number;
  readonly maxMedia?: number;
  readonly signal?: AbortSignal;
}
export type OoxmlCompressionProfile = "conservative" | "balanced" | "compact";
export const OOXML_COMPRESSION_PROFILE_DEFAULT_JPEG_QUALITY: Readonly<Record<OoxmlCompressionProfile, number>> = {
  conservative: 0.85,
  balanced: 0.72,
  compact: 0.55,
};
export type OoxmlMediaSkipReason =
  | "unsupported-media" | "unrecognized-content-type" | "codec-unavailable"
  | "lossy-approval-required" | "webp-approval-required" | "pixel-limit" | "not-smaller"
  | "package-not-smaller" | "max-media-budget";
export interface OoxmlMediaPartResult {
  readonly path: string;
  readonly type: "png" | "jpeg" | "webp" | "unsupported";
  readonly status: "changed" | "skipped";
  readonly beforeBytes: number;
  readonly afterBytes: number;
  readonly savedBytes: number;
  readonly originalDimensions?: { readonly width: number; readonly height: number };
  readonly outputDimensions?: { readonly width: number; readonly height: number };
  readonly fidelity: "decoded-rgba-identical" | "approved-lossy-recode-or-resize" | "untouched";
  readonly skipReason?: OoxmlMediaSkipReason;
}
export interface OoxmlMediaCompressionResult {
  readonly bytes: ArrayBuffer;
  readonly filenameSuffix: "-media-compressed";
  readonly input: OoxmlPackageAnalysis;
  readonly output: OoxmlPackageAnalysis;
  readonly profile: OoxmlCompressionProfile;
  readonly zipGroupsBefore: OoxmlZipGroupBreakdown;
  readonly zipGroupsAfter: OoxmlZipGroupBreakdown;
  readonly zipGroupsDifference: readonly OoxmlZipGroupDifference[];
  readonly changedCount: number;
  readonly skippedCount: number;
  readonly mediaCount: number;
  readonly inputByteLength: number;
  readonly byteLength: number;
  readonly savedBytes: number;
  readonly mediaSavedBytes: number;
  readonly outcome: "optimized" | "unchanged";
  readonly parts: readonly OoxmlMediaPartResult[];
  readonly fidelityWarning: string;
  readonly verification: {
    readonly samePartNames: true;
    readonly allNonMediaBytesIdentical: true;
    readonly relationshipBytesIdentical: true;
    readonly contentTypesBytesIdentical: true;
    readonly structuralCountsIdentical: true;
    readonly changedMediaOriginalMimePreserved: true;
    readonly pngDecodedPixelsIdenticalUnlessResizeApproved: true | "not-proven-custom-codec";
    readonly independentUnzipReopen: true;
  };
}
export interface OoxmlMediaCodec {
  (source: Uint8Array, mime: "image/png" | "image/jpeg" | "image/webp",
   options: { readonly targetWidth: number; readonly targetHeight: number; readonly jpegQuality: number; readonly verifyLosslessPng: boolean; readonly signal?: AbortSignal }): Promise<Uint8Array | null>;
}

const MEDIA_BUDGET = {
  maxMediaCount: 16,
  maxImageBytes: 8 * 1024 * 1024,
  maxDecodePixels: 12_000_000,
  maxDimension: 4096,
} as const;
const utf8 = new TextDecoder("utf-8", { fatal: true });
// A borrowed Uint8Array/ArrayBuffer can change after the synchronous ZIP
// integrity preflight and before the awaited codec import; never share it.
const normalize = (input: ArrayBuffer | Uint8Array) =>
  input instanceof Uint8Array ? input.slice() : new Uint8Array(input.slice(0));
const same = (a: Uint8Array, b: Uint8Array) => a.byteLength === b.byteLength && a.every((value, index) => value === b[index]);
const exactBuffer = (bytes: Uint8Array): ArrayBuffer => Uint8Array.from(bytes).buffer;
const error = (message: string): never => { throw new OoxmlPackageError("REBUILD_VERIFICATION_FAILED", message); };
const abort = (signal?: AbortSignal): void => { if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError"); };

/** Canvas only preserves one image frame. Reject animated PNG/WebP instead of
 * silently flattening embedded Office media or claiming a faithful recompress. */
function isAnimatedRaster(bytes: Uint8Array, mime: "image/png" | "image/jpeg" | "image/webp"): boolean {
  if (mime === "image/webp") {
    return bytes.byteLength >= 30
      && String.fromCharCode(...bytes.subarray(12, 16)) === "VP8X"
      && (bytes[20]! & 0x02) !== 0;
  }
  if (mime !== "image/png") return false;
  let cursor = 8;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  while (cursor + 12 <= bytes.byteLength) {
    const size = view.getUint32(cursor, false);
    if (size > bytes.byteLength - cursor - 12) return true;
    const chunk = String.fromCharCode(...bytes.subarray(cursor + 4, cursor + 8));
    if (chunk === "acTL") return true;
    if (chunk === "IDAT" || chunk === "IEND") break;
    cursor += 12 + size;
  }
  return false;
}

function contentTypeMap(bytes: Uint8Array): { extensions: Map<string, string>; overrides: Map<string, string> } {
  const xml = utf8.decode(bytes);
  if (xml.length > 2_000_000 || /<!|<\?/u.test(xml.replace(/^\s*<\?xml\s+version=(?:"1\.0"|'1\.0')(?:\s+encoding=(?:"UTF-8"|'UTF-8'))?(?:\s+standalone=(?:"yes"|'yes'|"no"|'no'))?\s*\?>/u, ""))) {
    error("Unsafe or unsupported Content_Types XML form.");
  }
  if (!/<(?:\w+:)?Types\b/u.test(xml) || !/http:\/\/schemas\.openxmlformats\.org\/package\/2006\/content-types/u.test(xml)) error("Package content types are not recognized.");
  const extensions = new Map<string, string>();
  const overrides = new Map<string, string>();
  for (const match of xml.matchAll(/<(?:\w+:)?(Default|Override)\s+([^<>]*?)\/\s*>/gu)) {
    const attrs = new Map<string, string>();
    for (const attr of match[2]!.matchAll(/([A-Za-z]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gu)) {
      if (attrs.has(attr[1]!)) error("Duplicate Office content-type attribute.");
      attrs.set(attr[1]!, attr[2] ?? attr[3]!);
    }
    const kind = match[1]!;
    const key = attrs.get(kind === "Default" ? "Extension" : "PartName");
    const value = attrs.get("ContentType");
    if (key === undefined || value === undefined || value.includes("&")) error("Ambiguous Office content-type declaration.");
    const map = kind === "Default" ? extensions : overrides;
    const normalized = kind === "Default" ? key!.toLowerCase() : key!;
    if (map.has(normalized)) error("Duplicate Office content-type definition.");
    map.set(normalized, value!);
  }
  return { extensions, overrides };
}

function kindAndMime(path: string, types: ReturnType<typeof contentTypeMap>): { type: "png" | "jpeg" | "webp"; mime: "image/png" | "image/jpeg" | "image/webp" } | null {
  if (!/^(?:word|ppt|xl)\/media\/[^/]+\.(?:png|jpe?g|webp)$/iu.test(path)) return null;
  const extension = path.split(".").at(-1)!.toLowerCase();
  const mime = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
  const claimed = types.overrides.get("/" + path) ?? types.extensions.get(extension);
  if (claimed !== mime) return null;
  return { type: extension === "png" ? "png" : extension === "webp" ? "webp" : "jpeg", mime };
}

function validatedOptions(options: OoxmlMediaCompressionOptions) {
  const profile = options.profile ?? "balanced";
  if (!Object.hasOwn(OOXML_COMPRESSION_PROFILE_DEFAULT_JPEG_QUALITY, profile)) error("Unknown Office compression profile.");
  const quality = options.jpegQuality ?? OOXML_COMPRESSION_PROFILE_DEFAULT_JPEG_QUALITY[profile];
  if (!Number.isFinite(quality) || quality < 0.35 || quality > 0.9) error("JPEG quality must be finite and between 0.35 and 0.90.");
  if (options.approveResize === true && (!Number.isInteger(options.maxDimension) || (options.maxDimension ?? 0) < 32 || (options.maxDimension ?? 0) > MEDIA_BUDGET.maxDimension)) {
    error("Approved resizing requires an explicit maximum dimension between 32 and 4096.");
  }
  if (options.maxMedia !== undefined && (!Number.isInteger(options.maxMedia) || options.maxMedia < 1 || options.maxMedia > MEDIA_BUDGET.maxMediaCount)) error("maxMedia must be between 1 and 16.");
  return { profile, quality, maxMedia: options.maxMedia ?? MEDIA_BUDGET.maxMediaCount };
}

/**
 * Browser codec: no external resources. For PNG without resize compare all
 * decoded RGBA bytes from original and encoded output. Never silently switch
 * to a different MIME if the browser cannot encode a requested format.
 */
export const browserOoxmlMediaCodec: OoxmlMediaCodec = async (source, mime, options) => {
  abort(options.signal);
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") return null;
  const before = await createImageBitmap(new Blob([Uint8Array.from(source)], { type: mime }));
  try {
    abort(options.signal);
    const canvas = document.createElement("canvas");
    canvas.width = options.targetWidth;
    canvas.height = options.targetHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    if (mime === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(before, 0, 0, canvas.width, canvas.height);
    const sourceRgba = options.verifyLosslessPng
      ? ctx.getImageData(0, 0, canvas.width, canvas.height).data.slice()
      : undefined;
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, mime, options.jpegQuality));
    abort(options.signal);
    if (blob === null || blob.type !== mime) return null;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (sourceRgba) {
      const decoded = await createImageBitmap(blob);
      try {
        const verifyCanvas = document.createElement("canvas");
        verifyCanvas.width = canvas.width;
        verifyCanvas.height = canvas.height;
        const verifyCtx = verifyCanvas.getContext("2d", { willReadFrequently: true });
        if (!verifyCtx) return null;
        verifyCtx.drawImage(decoded, 0, 0);
        const actualRgba = verifyCtx.getImageData(0, 0, canvas.width, canvas.height).data;
        if (!same(Uint8Array.from(sourceRgba), Uint8Array.from(actualRgba))) return null;
      } finally {
        decoded.close();
      }
    }
    return bytes;
  } finally {
    before.close();
  }
};

function outputVerification(
  original: Readonly<Record<string, Uint8Array>>,
  reopened: Readonly<Record<string, Uint8Array>>,
  input: OoxmlPackageAnalysis,
  output: OoxmlPackageAnalysis,
  expectedChanged: ReadonlyMap<string, { bytes: Uint8Array; mime: string; width: number; height: number }>,
): void {
  const paths = Object.keys(original);
  if (paths.length !== Object.keys(reopened).length || paths.some((path) => reopened[path] === undefined)) error("Member paths changed after package rebuild.");
  for (const path of paths) {
    const current = reopened[path]!;
    const previous = original[path]!;
    const changed = expectedChanged.get(path);
    if (changed) {
      if (!same(current, changed.bytes)) error(`Changed media bytes mismatch: ${path}`);
      const head = inspectImageHeader(current);
      if (head.mime !== changed.mime || head.width !== changed.width || head.height !== changed.height) error(`Media MIME or dimensions changed unexpectedly: ${path}`);
    } else if (!same(current, previous)) {
      error(`OOXML non-target bytes changed: ${path}`);
    }
  }
  if (!same(original["[Content_Types].xml"]!, reopened["[Content_Types].xml"]!)) error("Content types changed.");
  if (paths.some((path) => /\.rels$/iu.test(path) && !same(original[path]!, reopened[path]!))) error("Relationship bytes changed.");
  if (input.kind !== output.kind || input.entryCount !== output.entryCount || input.documentCount !== output.documentCount || input.slideCount !== output.slideCount || input.sheetCount !== output.sheetCount || input.relationshipPartCount !== output.relationshipPartCount) error("Office editable structure counts changed.");
}

export async function compressOoxmlEmbeddedMedia(
  input: ArrayBuffer | Uint8Array,
  options: OoxmlMediaCompressionOptions = {},
  codec: OoxmlMediaCodec = browserOoxmlMediaCodec,
): Promise<OoxmlMediaCompressionResult> {
  const source = normalize(input);
  abort(options.signal);
  const analysis = analyzeOoxmlPackage(source); // hard preflight before unzip
  const { profile, quality, maxMedia } = validatedOptions(options);
  const { unzipSync, zipSync } = await import("fflate");
  const members: Record<string, Uint8Array> = (() => {
    try { return unzipSync(source); } catch { return error("OOXML preflight passed but members could not be expanded."); }
  })();
  if (Object.keys(members).length !== analysis.entryCount) error("Decoded member count differs from preflight.");
  for (const entry of analysis.entries) if (members[entry.path]?.byteLength !== entry.uncompressedSize) error("Decoded member size differs from ZIP declaration.");
  const types = contentTypeMap(members["[Content_Types].xml"]!);
  const encoded = { ...members };
  const changed = new Map<string, { bytes: Uint8Array; mime: string; width: number; height: number }>();
  const parts: OoxmlMediaPartResult[] = [];
  let remainingPixels = MEDIA_BUDGET.maxDecodePixels;
  let attempted = 0;
  const mediaPaths = analysis.entries.filter((entry) => entry.classification === "media").map((entry) => entry.path);
  for (const path of mediaPaths) {
    abort(options.signal);
    const before = members[path]!;
    const declared = kindAndMime(path, types);
    const type = declared?.type ?? "unsupported";
    const base: Pick<OoxmlMediaPartResult, "path" | "type" | "beforeBytes"> = { path, type, beforeBytes: before.byteLength };
    const skip = (reason: OoxmlMediaSkipReason, dimensions?: { width: number; height: number }): void => {
      parts.push({ ...base, status: "skipped", afterBytes: before.byteLength, savedBytes: 0, fidelity: "untouched", skipReason: reason, ...(dimensions ? { originalDimensions: dimensions, outputDimensions: dimensions } : {}) });
    };
    if (!declared) { skip(/\.(?:png|jpe?g|webp)$/iu.test(path) ? "unrecognized-content-type" : "unsupported-media"); continue; }
    if (++attempted > maxMedia) { skip("max-media-budget"); continue; }
    if (before.byteLength > MEDIA_BUDGET.maxImageBytes) { skip("pixel-limit"); continue; }
    let header: ReturnType<typeof inspectImageHeader>;
    try { header = inspectImageHeader(before); } catch { skip("unsupported-media"); continue; }
    if (isAnimatedRaster(before, declared.mime)) { skip("unsupported-media", header); continue; }
    if (header.mime !== declared.mime || header.width > MEDIA_BUDGET.maxDimension || header.height > MEDIA_BUDGET.maxDimension || header.width * header.height > remainingPixels) {
      skip("pixel-limit"); continue;
    }
    remainingPixels -= header.width * header.height;
    if (declared.type === "jpeg" && options.approveLossyJpeg !== true) { skip("lossy-approval-required", header); continue; }
    if (declared.type === "webp" && options.approveLossyWebp !== true) { skip("webp-approval-required", header); continue; }
    const ratio = options.approveResize === true && options.maxDimension !== undefined
      ? Math.min(1, options.maxDimension / Math.max(header.width, header.height))
      : 1;
    const width = Math.max(1, Math.round(header.width * ratio));
    const height = Math.max(1, Math.round(header.height * ratio));
    const resized = width !== header.width || height !== header.height;
    let replacement: Uint8Array | null = null;
    try {
      replacement = await codec(before, declared.mime, {
        targetWidth: width, targetHeight: height, jpegQuality: quality,
        verifyLosslessPng: declared.type === "png" && !resized,
        ...(options.signal ? { signal: options.signal } : {}),
      });
    } catch (cause) {
      abort(options.signal);
      if (cause instanceof OoxmlPackageError) throw cause;
      // Unknown codec failures must not corrupt output: skip only that media.
      skip("codec-unavailable", header);
      continue;
    }
    abort(options.signal);
    if (!replacement) { skip("codec-unavailable", header); continue; }
    const replacementHeader: ReturnType<typeof inspectImageHeader> = (() => {
      try { return inspectImageHeader(replacement); } catch { return error(`Codec returned corrupt media for ${path}`); }
    })();
    if (replacementHeader.mime !== declared.mime || replacementHeader.width !== width || replacementHeader.height !== height) error(`Media codec violated MIME or dimension contract: ${path}`);
    if (replacement.byteLength >= before.byteLength) { skip("not-smaller", header); continue; }
    encoded[path] = replacement;
    changed.set(path, { bytes: replacement, mime: declared.mime, width, height });
    parts.push({
      ...base, status: "changed", afterBytes: replacement.byteLength, savedBytes: before.byteLength - replacement.byteLength,
      originalDimensions: header, outputDimensions: { width, height },
      fidelity: declared.type === "png" && !resized ? "decoded-rgba-identical" : "approved-lossy-recode-or-resize",
    });
  }
  const buildResult = (out: Uint8Array, finalParts: readonly OoxmlMediaPartResult[], finalChanged: typeof changed): OoxmlMediaCompressionResult => {
    const output = analyzeOoxmlPackage(out);
    const reopened = unzipSync(out);
    outputVerification(members, reopened, analysis, output, finalChanged);
    const savings = source.byteLength - out.byteLength;
    const zipGroupsBefore = summarizeOoxmlZipGroups(analysis, source.byteLength);
    const zipGroupsAfter = summarizeOoxmlZipGroups(output, out.byteLength);
    const zipGroupsDifference = compareOoxmlZipGroups(zipGroupsBefore, zipGroupsAfter);
    return {
      bytes: exactBuffer(out), filenameSuffix: "-media-compressed", input: analysis, output,
      profile, zipGroupsBefore, zipGroupsAfter, zipGroupsDifference,
      changedCount: finalParts.filter((part) => part.status === "changed").length,
      skippedCount: finalParts.filter((part) => part.status === "skipped").length,
      mediaCount: mediaPaths.length, inputByteLength: source.byteLength, byteLength: out.byteLength,
      savedBytes: savings, mediaSavedBytes: finalParts.reduce((sum, part) => sum + part.savedBytes, 0),
      outcome: finalChanged.size ? "optimized" : "unchanged", parts: finalParts,
      fidelityWarning: finalParts.some((part) => part.fidelity === "approved-lossy-recode-or-resize")
        ? "APPROVED LOSSY: JPEG recompression or image resizing changes image pixels; editable Office XML and relationship targets are preserved, but visual fidelity is not guaranteed."
        : "PNG-only changes: browser-decoded RGBA pixels verified equal without resizing; metadata, color profiles and encoded bytes may differ. Editable Office XML/relationships are unchanged.",
      verification: {
        samePartNames: true, allNonMediaBytesIdentical: true, relationshipBytesIdentical: true,
        contentTypesBytesIdentical: true, structuralCountsIdentical: true,
        changedMediaOriginalMimePreserved: true,
        pngDecodedPixelsIdenticalUnlessResizeApproved: codec === browserOoxmlMediaCodec ? true : "not-proven-custom-codec",
        independentUnzipReopen: true,
      },
    };
  };
  if (changed.size === 0) return buildResult(source, parts, changed);
  const zippable: Zippable = {};
  for (const [path, bytes] of Object.entries(encoded)) zippable[path] = [bytes, { level: 9 }];
  const outputBytes: Uint8Array = (() => {
    try { return zipSync(zippable, { level: 9 }); } catch { return error("OOXML media ZIP rebuild failed."); }
  })();
  if (outputBytes.byteLength > OOXML_PACKAGE_LIMITS.maxInputBytes) throw new OoxmlPackageError("OUTPUT_TOO_LARGE", "Media-compressed OOXML package exceeds the output limit.");
  if (outputBytes.byteLength >= source.byteLength) {
    const rolledBack = parts.map((part) => part.status === "changed"
      ? { ...part, status: "skipped" as const, afterBytes: part.beforeBytes, savedBytes: 0, skipReason: "package-not-smaller" as const, fidelity: "untouched" as const,
          ...(part.originalDimensions ? { outputDimensions: part.originalDimensions } : {}) }
      : part);
    return buildResult(source, rolledBack, new Map());
  }
  return buildResult(outputBytes, parts, changed);
}
