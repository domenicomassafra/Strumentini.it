import { dictionaryOrNull, nameValue, numberValue, parsePdf, streamOrNull, type PdfDocumentModel } from "./parser";

/**
 * Narrow, source-backed effective-DPI evidence, NOT a general PDF content
 * interpreter and NOT an automatic image-downsampling policy.
 *
 * Only accepts a complete, uncompressed page content stream consisting of
 * independent `q a b c d e f cm /ImageName Do Q` image paints. Any other
 * operator, incomplete stream, inline image, inherited CTM or unknown XObject
 * makes the *whole* document's coverage unknown: no partial DPI is advertised.
 * Rotation is supported because the lengths of the CTM basis vectors are
 * invariant under rotation; skew and nonorthogonal axes are refused.
 */
export interface VerifiedImagePlacement218 {
  readonly pageNumber: number;
  readonly objectId: number;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly paintedWidthPt: number;
  readonly paintedHeightPt: number;
  readonly xDpi: number;
  readonly yDpi: number;
}

export type ImagePlacementDpi218 =
  | { readonly coverage: "verified-simple-uncompressed-paints"; readonly placements: readonly VerifiedImagePlacement218[] }
  | { readonly coverage: "unknown"; readonly reason: string; readonly placements: readonly [] };

const PDF_NUMBER = String.raw`[-+]?(?:\d+(?:\.\d*)?|\.\d+)`;
const IMAGE_PAINT = new RegExp(
  String.raw`^q\s+(${PDF_NUMBER})\s+(${PDF_NUMBER})\s+(${PDF_NUMBER})\s+(${PDF_NUMBER})\s+(${PDF_NUMBER})\s+(${PDF_NUMBER})\s+cm\s+\/([A-Za-z0-9_.-]+)\s+Do\s+Q(?=\s|$)`,
  "u",
);
const MAX_CONTENT_BYTES = 128 * 1024;
const MAX_PAINTS = 256;

const unknown = (reason: string): ImagePlacementDpi218 => ({ coverage: "unknown", reason, placements: [] });

export function measureSimpleImageDpi218(model: PdfDocumentModel, signal?: AbortSignal): ImagePlacementDpi218 {
  if (model.encrypted || model.pages.length < 1) return unknown("encrypted-or-pageless-document");
  const placements: VerifiedImagePlacement218[] = [];
  for (const [index, page] of model.pages.entries()) {
    if (signal?.aborted) throw new DOMException("PDF placement inspection cancelled", "AbortError");
    const dictionary = page.object.value;
    if (dictionary.kind !== "dict") return unknown("unsupported-page-dictionary");
    // Annotation appearance streams may paint additional images that are not
    // present in /Contents. We cannot make a whole-page inventory claim.
    if (dictionary.entries.has("Annots") || dictionary.entries.has("Group") || dictionary.entries.has("AA")) {
      return unknown("annotation-or-compositing-page-unsupported");
    }
    // UserUnit is specified on the page; the implicit default is 1/72 inch.
    const unit = dictionary.entries.has("UserUnit") ? numberValue(dictionary.entries.get("UserUnit")) : 1;
    if (unit === null || !(unit > 0) || unit > 75000) return unknown("unsupported-page-userunit");
    const contents = dictionary.entries.get("Contents");
    if (contents === undefined) continue;
    const stream = streamOrNull(model, contents);
    if (stream === null) return unknown("content-array-or-unsupported-stream");
    if (stream.dictionary.entries.has("Filter") || stream.dictionary.entries.has("DecodeParms") ||
        stream.bytes.byteLength > MAX_CONTENT_BYTES) return unknown("compressed-or-large-page-content");
    // A PDF content program is byte-oriented. Latin-1 decoding preserves
    // ASCII operator identities; every other token is rejected by the grammar.
    const program = new TextDecoder("latin1").decode(stream.bytes);
    const resources = dictionaryOrNull(model, dictionary.entries.get("Resources") ?? page.inherited.Resources);
    const xobjects = dictionaryOrNull(model, resources?.entries.get("XObject"));
    let cursor = 0;
    while (cursor < program.length) {
      if (signal?.aborted) throw new DOMException("PDF placement inspection cancelled", "AbortError");
      while (cursor < program.length && /\s/u.test(program[cursor]!)) cursor += 1;
      if (cursor === program.length) break;
      const match = IMAGE_PAINT.exec(program.slice(cursor));
      if (match === null) return unknown("complex-page-content-operators");
      if (placements.length >= MAX_PAINTS) return unknown("image-paint-budget-exceeded");
      const [a, b, c, d, e, f] = match.slice(1, 7).map(Number);
      if (![a, b, c, d, e, f].every(Number.isFinite) ||
          Math.max(...[a, b, c, d, e, f].map((value) => Math.abs(value ?? Number.NaN))) > 1e7) {
        return unknown("invalid-image-ctm");
      }
      const widthPoints = Math.hypot(a!, b!) * unit;
      const heightPoints = Math.hypot(c!, d!) * unit;
      const dot = a! * c! + b! * d!;
      // A shear creates an ambiguous effective per-axis sampling density;
      // do not reduce it to misleading horizontal/vertical DPI numbers.
      if (!(widthPoints > 0 && heightPoints > 0) ||
          Math.abs(dot) > 1e-8 * Math.hypot(a!, b!) * Math.hypot(c!, d!)) return unknown("degenerate-or-skewed-image-ctm");
      const resource = xobjects?.entries.get(match[7]!);
      if (resource?.kind !== "ref") return unknown("unknown-or-nondirect-image-resource");
      const image = model.objects.get(resource.id)?.value;
      if (image?.kind !== "stream" || nameValue(image.dictionary.entries.get("Subtype")) !== "Image") {
        return unknown("form-or-unsupported-image-resource");
      }
      const width = numberValue(image.dictionary.entries.get("Width"));
      const height = numberValue(image.dictionary.entries.get("Height"));
      if (width === null || height === null || !Number.isInteger(width) || !Number.isInteger(height) ||
          width < 1 || height < 1 || width * height > 8_000_000) return unknown("unverified-image-dimensions");
      const xDpi = width * 72 / widthPoints;
      const yDpi = height * 72 / heightPoints;
      if (![xDpi, yDpi].every((dpi) => Number.isFinite(dpi) && dpi >= 0.01 && dpi <= 100_000)) {
        return unknown("implausible-image-placement-dpi");
      }
      placements.push({ pageNumber: index + 1, objectId: resource.id, pixelWidth: width, pixelHeight: height,
        paintedWidthPt: widthPoints, paintedHeightPt: heightPoints, xDpi, yDpi });
      cursor += match[0].length;
    }
  }
  return { coverage: "verified-simple-uncompressed-paints", placements };
}

/** Used only when a caller already has a parsed, verified PDF model. */
export function inspectSimplePdfImageDpi218(bytes: Uint8Array, signal?: AbortSignal): ImagePlacementDpi218 {
  if (signal?.aborted) throw new DOMException("PDF placement inspection cancelled", "AbortError");
  return measureSimpleImageDpi218(parsePdf(bytes), signal);
}
