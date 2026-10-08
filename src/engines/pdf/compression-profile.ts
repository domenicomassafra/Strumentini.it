import type { PdfImageInfo, PdfInspection } from "./types";

/**
 * Describes a *structural-only* PDF pass. No scan/image profile is authorized.
 * Images are discovered as PDF image XObjects, not all page painting or inline
 * images, and object stream support is limited to the existing parser.
 */
export interface PdfStructuralCompressionAnalysis {
  readonly profile: "structural-only";
  readonly sourceBytes: number;
  readonly outputBytes: number;
  readonly deltaBytes: number;
  readonly savedBytes: number;
  readonly recommendOriginal: boolean;
  readonly images: {
    readonly discovered: number;
    readonly touched: 0;
    readonly skipped: number;
    readonly inventory: readonly {
      readonly object: number;
      readonly width: number | null;
      readonly height: number | null;
      readonly encodedBytes: number;
      readonly filter: string | null;
      readonly estimatedDpi: null;
      readonly action: "unchanged";
    }[];
    readonly coverage: "bounded-xobjects-only";
    readonly downsampleApplied: false;
    readonly recompressionApplied: false;
    readonly grayscaleApplied: false;
  };
  readonly verification: {
    readonly pageCountUnchanged: true;
    readonly pageGeometryUnchanged: true;
    readonly textBytesPerPageUnchanged: boolean;
    readonly imageXobjectMetadataUnchanged: boolean;
    readonly pixelVisualParity: "not-verified";
    readonly extractedTextParity: "not-verified";
  };
  readonly warnings: readonly string[];
}

function imageSignature(image: PdfImageInfo): string {
  return JSON.stringify([image.width, image.height, image.byteLength, image.filter, image.bitsPerComponent, image.colorSpace]);
}

export function describePdfStructuralCompression(
  before: PdfInspection,
  after: PdfInspection,
): PdfStructuralCompressionAnalysis {
  if (before.encrypted || after.encrypted) throw new Error("UNSUPPORTED_CAPABILITY: No PDF decryption or encryption operation is supported.");
  const pageCountUnchanged = before.pageCount === after.pageCount;
  const pageGeometryUnchanged = pageCountUnchanged && before.pages.every((page, index) => {
    const output = after.pages[index];
    return output !== undefined && output.width === page.width && output.height === page.height && output.rotation === page.rotation;
  });
  if (!pageCountUnchanged || !pageGeometryUnchanged) throw new Error("PDF_OUTPUT_MISMATCH: Structural output changed page count or geometry.");
  const beforeImages = before.images.map(imageSignature).sort();
  const afterImages = after.images.map(imageSignature).sort();
  const imageXobjectMetadataUnchanged = beforeImages.length === afterImages.length && beforeImages.every((signature, index) => signature === afterImages[index]);
  const textBytesPerPageUnchanged = before.pages.every((page, index) => page.textBytes === after.pages[index]?.textBytes);
  const deltaBytes = after.byteLength - before.byteLength;
  const warnings = [
    "Solo pulizia strutturale: nessuna immagine è stata downsampled, ricompressa o convertita in scala di grigi.",
    "L'inventario include solo Image XObject riconosciuti dal parser PDF locale: immagini inline, maschere e DPI di visualizzazione non sono certificati.",
    "Equivalenza di testo estratto e resa visiva non dimostrata; questa analisi non certifica la conservazione di tutti i contenuti.",
  ];
  if (!textBytesPerPageUnchanged) warnings.push("Conteggio dei byte di testo per pagina variato: controlla il risultato prima di usarlo.");
  if (!imageXobjectMetadataUnchanged) warnings.push("Proprietà degli Image XObject diverse prima/dopo: non assumere identità delle immagini.");
  if (deltaBytes >= 0) warnings.push("Il risultato non è più piccolo dell'originale: si consiglia di conservare il file originale.");
  return {
    profile: "structural-only",
    sourceBytes: before.byteLength,
    outputBytes: after.byteLength,
    deltaBytes,
    savedBytes: Math.max(0, -deltaBytes),
    recommendOriginal: deltaBytes >= 0,
    images: {
      discovered: before.images.length,
      touched: 0,
      skipped: before.images.length,
      inventory: before.images.map((image) => ({
        object: image.object,
        width: image.width,
        height: image.height,
        encodedBytes: image.byteLength,
        filter: image.filter,
        estimatedDpi: null,
        action: "unchanged" as const,
      })),
      coverage: "bounded-xobjects-only",
      downsampleApplied: false,
      recompressionApplied: false,
      grayscaleApplied: false,
    },
    verification: {
      pageCountUnchanged: true,
      pageGeometryUnchanged: true,
      textBytesPerPageUnchanged,
      imageXobjectMetadataUnchanged,
      pixelVisualParity: "not-verified",
      extractedTextParity: "not-verified",
    },
    warnings,
  };
}
