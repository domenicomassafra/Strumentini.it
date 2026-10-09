import { measureSimpleImageDpi218 } from "./placement-dpi-218";
import { nameValue, numberValue, parsePdf } from "./parser";
import { PDF_LIMITS } from "./types";

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
    ? "image-only-page-candidate" as const : "unknown" as const;
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
      : "Candidato a pagine composte soltanto da immagini: contenuto pagina verificato limitatamente a paint semplici, non codec o fedeltà.",
    accounting: "Only actual encoded PDF stream payload byte lengths. Structural remainder includes dictionaries, xref, whitespace and other data; not exact per-object disk footprints. Reused streams counted once.",
    coverage: "bounded-parser-streams-and-strict-image-only-paints; inline images, complex pages, incremental revisions and arbitrary embedded assets NOT certified",
  };
}
