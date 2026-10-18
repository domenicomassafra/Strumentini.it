/** #394: inspect the actual PDF object streams after an export, not the source labels.
 *
 * PDF /Info and /Metadata are handled by the existing PDF inspection. JPEG
 * streams are another independent metadata carrier: the PDF writer preserves
 * their compressed bytes, including Exif and nested thumbnail markers.
 * Unknown raster encodings remain explicitly unverified.
 */
import { scanImageMetadata, type MetadataSegment } from "../image/metadata";
import { nameValue, type PdfDocumentModel, type PdfValue } from "./parser";
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
  readonly unsupported: readonly string[];
  /** Other PDF stream content and visible/hidden page content are out of scope. */
  readonly limitation: string;
}

function filters(value: PdfValue | undefined): readonly string[] | null {
  if (value?.kind === "name") return [value.value];
  if (value?.kind !== "array") return null;
  const values = value.items.map((item) => nameValue(item));
  return values.every((item): item is string => item !== null) ? values : null;
}

export function auditPdfEmbeddedImageMetadata(document: PdfDocumentModel): PdfEmbeddedMetadataAudit {
  const privacyFindings: PdfEmbeddedMetadataFinding[] = [];
  const unsupported: string[] = [];
  let jpegChecked = 0;
  for (const object of document.objects.values()) {
    if (object.value.kind !== "stream" || nameValue(object.value.dictionary.entries.get("Subtype")) !== "Image") continue;
    const filter = filters(object.value.dictionary.entries.get("Filter"));
    if (filter?.length !== 1 || filter[0] !== "DCTDecode") {
      unsupported.push(`Immagine PDF oggetto ${object.id}: codec ${filter?.join("+") || "senza filtro"} non ispezionabile per i metadati interni.`);
      continue;
    }
    const inventory = scanImageMetadata(object.value.bytes);
    if (inventory.format !== "jpeg" || !inventory.complete) {
      unsupported.push(`Immagine JPEG PDF oggetto ${object.id}: contenitore troncato o ispezione incompleta.`);
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
    unsupported,
    limitation: "Verificati /Info, stream PDF /Metadata e marker dei JPEG DCT incorporati. Altri codec, allegati, commenti nel contenuto, annotazioni, testo, font, immagini visibili, metadati steganografici e stream arbitrari non sono bonificati né certificati.",
  };
}
