import { measureSimpleImageDpi218 } from "./placement-dpi-218";
import { dictionaryOrNull, nameValue, numberValue, parsePdf, type PdfDocumentModel } from "./parser";
import { PDF_LIMITS } from "./types";

/** Positive text/vector attribution only for provably simple, uncompressed
 * page streams that paint with an actual font resource and no image-capable
 * XObject, inline BI image, external graphics state or nested Form. This is a
 * *candidate* description, not a proof that every page has visible glyphs.
 */
function hasSimpleTextVectorOnly265(model: PdfDocumentModel): boolean {
  if (model.pages.length === 0) return false;
  for (const page of model.pages) {
    if (page.object.value.kind !== "dict") return false;
    const resources = dictionaryOrNull(model,
      page.object.value.entries.get("Resources") ?? page.inherited.Resources);
    if (!resources || ["XObject", "Pattern", "Shading", "ExtGState", "Properties"]
      .some((key) => resources.entries.has(key))) return false;
    const fonts = dictionaryOrNull(model, resources.entries.get("Font"));
    if (!fonts || fonts.entries.size === 0) return false;
    const contents = page.object.value.entries.get("Contents");
    if (!contents || contents.kind !== "ref") return false;
    const stream = model.objects.get(contents.id)?.value;
    if (!stream || stream.kind !== "stream" || stream.dictionary.entries.has("Filter") ||
      stream.bytes.length > 1024 * 1024 || stream.bytes.some((byte) => byte > 127 || (byte < 32 && ![9, 10, 13].includes(byte)))) return false;
    const text = new TextDecoder().decode(stream.bytes);
    if (!/(?:^|\s)BT(?:\s|$)/u.test(text) || !/(?:^|\s)(?:Tj|TJ)(?:\s|$)/u.test(text) ||
      /(?:^|\s)(?:BI|Do|sh|gs)(?:\s|$)/u.test(text)) return false;
  }
  return true;
}

/** Read-only, measured PDF stream payload breakdown for #265. Never a savings estimate. */
export function inspectPdfSize265(bytes: Uint8Array, signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("PDF size inspection cancelled", "AbortError");
  if (bytes.length < 8 || bytes.length > PDF_LIMITS.maxBytes) throw new Error("PDF_265_INPUT_LIMIT");
  const model = parsePdf(bytes);
  if (model.encrypted) throw new Error("PDF_265_ENCRYPTED_UNSUPPORTED");
  const streams = [...model.objects.values()].filter((object) => object.value.kind === "stream")
    .map((object) => {
      if (object.value.kind !== "stream") throw new Error("PDF_265_STREAM_MISMATCH");
      const dictionary = object.value.dictionary;
      const subtype = nameValue(dictionary.entries.get("Subtype"));
      const type = nameValue(dictionary.entries.get("Type"));
      const kind = subtype === "Image" ? "image" : type === "Metadata" ? "metadata" :
        type === "ObjStm" ? "object-stream" : "other-stream";
      return { objectId: object.id, kind, encodedBytes: object.value.bytes.byteLength,
        width: kind === "image" ? numberValue(dictionary.entries.get("Width")) : null,
        height: kind === "image" ? numberValue(dictionary.entries.get("Height")) : null };
    });
  const encodedStreamBytes = streams.reduce((sum, stream) => sum + stream.encodedBytes, 0);
  // Some noncanonical PDFs or expanded object streams do not admit a disjoint
  // payload budget; refuse rather than report a fictitious negative overhead.
  if (encodedStreamBytes > bytes.length) throw new Error("PDF_265_UNVERIFIABLE_STREAM_BUDGET");
  const imageStreamBytes = streams.filter((stream) => stream.kind === "image")
    .reduce((sum, stream) => sum + stream.encodedBytes, 0);
  const placement = measureSimpleImageDpi218(model, signal);
  const allPagesCoveredBySingleImage = placement.coverage !== "unknown" &&
    model.pages.every((page, index) => {
      if (page.object.value.kind !== "dict") return false;
      const media = page.object.value.entries.get("MediaBox") ?? page.inherited.MediaBox;
      if (media?.kind !== "array" || media.items.length !== 4) return false;
      const [x0, y0, x1, y1] = media.items.map(numberValue);
      if ([x0, y0, x1, y1].some((value) => value === null)) return false;
      const area = (x1! - x0!) * (y1! - y0!);
      const paints = placement.placements.filter((entry) => entry.pageNumber === index + 1);
      return area > 0 && paints.length === 1 &&
        paints[0]!.paintedWidthPt * paints[0]!.paintedHeightPt >= area * 0.75;
    });
  const classification = allPagesCoveredBySingleImage && imageStreamBytes > 0
    ? "image-only-page-candidate" as const : imageStreamBytes === 0 && hasSimpleTextVectorOnly265(model)
      ? "text-vector-only-candidate" as const : "unknown" as const;
  if (signal?.aborted) throw new DOMException("PDF size inspection cancelled", "AbortError");
  return {
    pageCount: model.pages.length,
    objectCount: model.objects.size,
    encodedStreamBytes,
    structuralRemainderBytes: bytes.length - encodedStreamBytes,
    imageStreamBytes,
    imageStreamCount: streams.filter((stream) => stream.kind === "image").length,
    metadataStreamBytes: streams.filter((stream) => stream.kind === "metadata").reduce((sum, stream) => sum + stream.encodedBytes, 0),
    largestStreams: streams.sort((a, b) => b.encodedBytes - a.encodedBytes || a.objectId - b.objectId).slice(0, 10),
    classification,
    imagePlacementCoverage: placement.coverage,
    classificationNote: classification === "unknown"
      ? "Composizione non determinabile con certezza: non si deduce che il PDF sia una scansione o testo/vettoriale."
      : classification === "text-vector-only-candidate"
        ? "Candidato testo/vettori: solo pagine con contenuti testuali semplici, font presenti e nessun XObject o immagine inline. Non è una garanzia di fedeltà."
        : "Candidato a pagine composte soltanto da immagini: contenuto pagina verificato limitatamente a paint semplici, non codec o fedeltà.",
    accounting: "Only actual encoded PDF stream payload byte lengths. Structural remainder includes dictionaries, xref, whitespace and other data; not exact per-object disk footprints. Reused streams counted once.",
    coverage: "bounded-parser-streams-and-strict-image-or-text-paints; inline images, complex pages, incremental revisions and arbitrary embedded assets NOT certified",
  };
}
