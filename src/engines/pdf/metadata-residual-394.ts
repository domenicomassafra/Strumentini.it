/** #394: inspect the actual PDF object streams after an export, not the source labels.
 *
 * PDF /Info and /Metadata are handled by the existing PDF inspection. JPEG
 * streams are another independent metadata carrier: the PDF writer preserves
 * their compressed bytes, including Exif and nested thumbnail markers.
 * Unknown raster encodings remain explicitly unverified.
 */
import { scanImageMetadata, type MetadataSegment } from "../image/metadata";
import { nameValue, resolveReference, type PdfDocumentModel, type PdfValue } from "./parser";
import type { PdfMetadata } from "./types";

export const PDF_NESTED_METADATA_RESIDUAL_ERROR = "Il PDF esportato contiene ancora metadati nei JPEG incorporati. La bonifica PDF non ricodifica queste immagini: nessun file viene consegnato come ripulito.";

export function metadataIsEmpty(metadata: PdfMetadata): boolean {
  return Object.keys(metadata.recognizedInfo).length === 0
    && Object.keys(metadata.unknownInfo).length === 0
    && metadata.xmpObjectIds.length === 0
    && !metadata.hasXmp;
}

export interface PdfEmbeddedMetadataFinding {
  readonly objectId: number;
  readonly segments: readonly MetadataSegment[];
}

export interface PdfEmbeddedMetadataAudit {
  readonly jpegChecked: number;
  readonly privacyFindings: readonly PdfEmbeddedMetadataFinding[];
  /** A damaged JPEG is never a certified clean carrier, even if its markers
   * are only partially readable by the forensic scanner. */
  readonly incompleteJpegObjectIds: readonly number[];
  readonly unsupported: readonly string[];
  /** Other PDF stream content and visible/hidden page content are out of scope. */
  readonly limitation: string;
}

function filters(document: PdfDocumentModel, value: PdfValue | undefined): readonly string[] | null {
  const resolved = resolveReference(document, value);
  if (resolved?.kind === "name") return [resolved.value];
  if (resolved?.kind !== "array") return null;
  const values = resolved.items.map((item) => nameValue(resolveReference(document, item)));
  return values.every((item): item is string => item !== null) ? values : null;
}

export function auditPdfEmbeddedImageMetadata(document: PdfDocumentModel): PdfEmbeddedMetadataAudit {
  const privacyFindings: PdfEmbeddedMetadataFinding[] = [];
  const incompleteJpegObjectIds: number[] = [];
  const unsupported: string[] = [];
  let jpegChecked = 0;
  for (const object of document.objects.values()) {
    if (object.value.kind !== "stream") continue;
    const dict = object.value.dictionary.entries;
    const subtype = nameValue(resolveReference(document, dict.get("Subtype")));
    // Indirect /Subtype and /Filter are legal PDF; ignoring them silently
    // skips private EXIF in the exact output we claim to inspect.
    const possibleImage = nameValue(resolveReference(document, dict.get("Type"))) === "XObject"
      && dict.has("Width") && dict.has("Height");
    if (subtype !== "Image" && !possibleImage) continue;
    const filter = filters(document, dict.get("Filter"));
    if (filter?.length !== 1 || filter[0] !== "DCTDecode") {
      unsupported.push(`Immagine PDF oggetto ${object.id}: codec ${filter?.join("+") || "senza filtro"} non ispezionabile per i metadati interni.`);
      continue;
    }
    const inventory = scanImageMetadata(object.value.bytes);
    if (inventory.format !== "jpeg" || !inventory.complete) {
      unsupported.push(`Immagine JPEG PDF oggetto ${object.id}: contenitore troncato o ispezione incompleta.`);
      incompleteJpegObjectIds.push(object.id);
      // Do not drop positive Exif/XMP findings merely because later bytes
      // are malformed. The caller refuses incomplete JPEGs regardless.
      if (inventory.segments.length > 0) privacyFindings.push({ objectId: object.id, segments: inventory.segments });
      continue;
    }
    jpegChecked += 1;
    // A dangling Huffman/quantization table can carry arbitrary recoverable
    // bytes, but the scanner has not established that it is actual personal
    // metadata. Disclose the exact unsupported residual without treating it
    // as proven Exif/XMP or silently declaring the whole PDF clean.
    const opaqueTables = inventory.segments.filter((entry) =>
      ["JPEG DHT unused", "JPEG DQT unreferenced", "JPEG DQT redefined"].includes(entry.segment));
    for (const entry of opaqueTables) {
      unsupported.push(`Immagine JPEG PDF oggetto ${object.id}: ${entry.segment} (${entry.bytes} byte non verificati).`);
    }
    const metadata = inventory.segments.filter((entry) => !opaqueTables.includes(entry));
    if (metadata.length > 0) privacyFindings.push({ objectId: object.id, segments: metadata });
  }
  return {
    jpegChecked,
    privacyFindings,
    incompleteJpegObjectIds,
    unsupported,
    limitation: "Verificati /Info, stream PDF /Metadata e marker dei JPEG DCT incorporati. Altri codec, allegati, commenti nel contenuto, annotazioni, testo, font, immagini visibili, metadati steganografici e stream arbitrari non sono bonificati né certificati.",
  };
}

/** Damaged JPEGs cannot qualify as safe, even when no marker was decoded. */
export function unsafeJpeg394(evidence: PdfEmbeddedMetadataAudit): boolean {
  return evidence.privacyFindings.length > 0 || evidence.incompleteJpegObjectIds.length > 0;
}
