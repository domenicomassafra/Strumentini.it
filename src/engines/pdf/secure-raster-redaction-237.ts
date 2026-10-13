import { parsePdf, pdfArray, pdfDict, pdfName, pdfNumber, type PdfValue } from "./parser";
import { PdfBuilder } from "./writer";
import type { PdfArtifact } from "./types";

/**
 * #237 BOUNDED redaction, never an overlay. Renders EVERY source page to fresh
 * RGB bytes; fills the requested pixel regions with literal zeroes; creates a
 * NEW document with only new Flate-compressed pixels, with NO cloned PDF objects.
 * No original annotations, links, search text, vector art, metadata or
 * attachments survive. A bad/unsupported source is refused, not sanitized by
 * pretending that a visual overlay removed hidden data.
 */
export interface RedactionRegion237 {
  readonly page: number;
  /** Normalized within the displayed PDF.js page, origin top-left, 0–1. */
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}
export interface RedactionPage237 {
  readonly page: number;
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly regions: readonly RedactionRegion237[];
}
export interface RedactionProof237 {
  readonly policy: "new-raster-only-lossless-flate-no-source-objects";
  readonly pageCount: number;
  readonly verifiedBlackPixels: number;
  readonly pages: readonly RedactionPage237[];
  readonly fidelity: "whole-page-rasterized-no-search-text-vectors-links-or-original-metadata";
}

const MAX_PAGES = 4;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_PIXELS_PER_PAGE = 1_600_000;
const MAX_PIXEL_EDGE = 2200;
const MAX_OUTPUT_BYTES = 24 * 1024 * 1024;
const MAX_REGIONS = 12;
const FORBIDDEN = new Set([
  "Encrypt", "Annots", "AcroForm", "XFA", "Names", "OpenAction", "AA",
  "A", "JS", "JavaScript", "EmbeddedFiles", "Filespec", "AF", "RichMedia",
  "Launch", "URI", "OCProperties", "OC", "Collection", "Metadata", "3D",
  // Cryptographic/certification dictionaries can exist outside /AcroForm.
  // Never rasterize an already signed source or silently discard signatures.
  "Perms", "DocMDP", "FieldMDP", "ByteRange", "SigFlags", "FT", "DSS", "VRI",
  "TransformMethod", "Reference", "Prop_Build",
]);

function refuse(reason: string): never { throw new Error(`REDACTION_REFUSED: ${reason}`); }
function check(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Redazione PDF annullata", "AbortError");
}
function exactKeys(actual: ReadonlyMap<string, PdfValue>, expected: readonly string[]): boolean {
  return actual.size === expected.length && expected.every((key) => actual.has(key));
}
function numberFrom(value: PdfValue | undefined): number {
  return value?.kind === "literal" ? Number(value.value) : NaN;
}
function regionsFor(page: number, all: readonly RedactionRegion237[]): RedactionRegion237[] {
  return all.filter((region) => region.page === page);
}
export function validateRedactionPlan237(count: number, regions: readonly RedactionRegion237[]): void {
  if (!Number.isInteger(count) || count < 1 || count > MAX_PAGES) refuse("Solo PDF da 1 a 4 pagine.");
  if (!Array.isArray(regions) || regions.length < 1 || regions.length > MAX_REGIONS) refuse("Seleziona da 1 a 12 aree nere.");
  for (const region of regions) {
    if (!Number.isInteger(region.page) || region.page < 1 || region.page > count) refuse("Numero pagina non valido.");
    if (![region.left, region.top, region.width, region.height].every(Number.isFinite)
      || region.left < 0 || region.top < 0 || region.width <= 0 || region.height <= 0
      || region.left + region.width > 1 || region.top + region.height > 1) {
      refuse("Coordinate non valide: usa rettangoli normalizzati dentro la pagina (0–1).");
    }
  }
}

/** Source policy: unsupported active/interactive/optional content is refused. */
export function assertSupportedSource237(source: Uint8Array): number {
  if (source.length < 8 || source.length > MAX_SOURCE_BYTES) refuse("Dimensione file fuori limite (8 MiB).");
  if (new TextDecoder("ascii").decode(source.subarray(0, 5)) !== "%PDF-") refuse("Firma PDF assente.");
  // A trailing comment can include a decoy 'trailer <<...>>', masking /Prev
  // from the in-house parser's last-trailer lookup while PDF.js and independent
  // viewers still follow the real multi-revision cross-reference chain.
  // This redaction profile admits one complete PDF revision only, so refuse
  // ambiguous multiple xref/EOF sections BEFORE trusting any trailer model.
  const sourceText = new TextDecoder("latin1").decode(source);
  // Count complete startxref <offset> %%EOF footers, not bare words. Both
  // tokens may occur as ordinary visible text in a content stream or comment.
  // All six PDF whitespace bytes are eligible between footer tokens, including
  // CR-only and same-line TAB/space declarations read by independent viewers.
  // Also require exactly one classic xref table: a second real revision must
  // be refused even when its earlier footer uses unusual lexical separators.
  // Stop at two matches, never materialize a list from attacker-controlled input.
  const footers = /(?:^|[\x00\t\n\f\r ])startxref[\x00\t\n\f\r ]+(\d+)[\x00\t\n\f\r ]+%%EOF(?=[\x00\t\n\f\r ]|$)/gu;
  const tables = /(?:^|[\x00\t\n\f\r ])[ \t]*xref[\x00\t\n\f\r ]+\d+[\x00\t\n\f\r ]+\d+(?=[\x00\t\n\f\r ])/gu;
  const finalFooter = footers.exec(sourceText);
  if (!finalFooter || footers.exec(sourceText) ||
    !tables.exec(sourceText) || tables.exec(sourceText)) {
    refuse("Revisioni incrementali o terminatori PDF ambigui non supportati.");
  }
  // The shared lightweight parser scans for the *last text occurrence* of
  // "trailer", including PDF comments. A real single-revision hybrid xref
  // table can therefore hide its effective /XRefStm behind a comment decoy
  // without adding another startxref/EOF. Anchor this restricted admission
  // profile to the actual classic xref offset and its only trailer line.
  // Only the startxref belonging to the sole COMPLETE footer can select the
  // active xref. An earlier incomplete %%EOF may still leave a real classic
  // table while the final footer points to a new /Type /XRef stream. Scanning
  // for the first standalone declaration would silently select the old table.
  const marker = (finalFooter.index ?? 0) + finalFooter[0].indexOf("startxref");
  const declaration = /startxref[ \t]*(?:\r\n|[\r\n\f])[ \t]*(\d+)[ \t]*(?=\r\n|[\r\n\f])/yu;
  declaration.lastIndex = marker;
  const actualDeclaration = declaration.exec(sourceText);
  if (!actualDeclaration || actualDeclaration[1] !== finalFooter[1]) {
    refuse("Puntatore startxref ambiguo o non supportato.");
  }
  const offset = Number(actualDeclaration[1]);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset >= marker || sourceText.slice(offset, offset + 4) !== "xref") {
    refuse("Revisioni incrementali, xref ibridi o puntatori xref non supportati.");
  }
  const footer = sourceText.slice(offset, marker);
  const trailerLines = /(?:^|[\x00\t\n\f\r ])[ \t]*trailer(?=[\x00\t\n\f\r %<])/gu;
  const trailer = trailerLines.exec(footer);
  if (!trailer || trailerLines.exec(footer) ||
    sourceText.lastIndexOf("trailer") !== offset + trailer.index + trailer[0].lastIndexOf("trailer")) {
    refuse("Trailer PDF ambiguo: riferimenti incrociati non verificabili.");
  }
  // There can be no footer markers inside a classic xref table *before* its
  // trailer. This also refuses a flood of malformed marker candidates there,
  // without rejecting normal content-stream text or a benign trailer comment.
  const priorStartxref = footer.indexOf("startxref");
  const priorEof = footer.indexOf("%%EOF");
  if ((priorStartxref >= 0 && priorStartxref < trailer.index)
    || (priorEof >= 0 && priorEof < trailer.index)) {
    refuse("Sezione xref con terminatori PDF ambigui non supportata.");
  }
  // PDF trivia between 'trailer' and its dictionary can include form-feed,
  // comments, and CR/LF. The shared parser already recognizes all of these;
  // require the SAME actual keyword to lead to a dictionary, not a decoy.
  let cursor = trailer.index + trailer[0].length;
  while (cursor < footer.length) {
    const code = footer.charCodeAt(cursor);
    if (code === 0 || code === 9 || code === 10 || code === 12 || code === 13 || code === 32) {
      cursor += 1;
    } else if (code === 37) {
      while (cursor < footer.length && footer[cursor] !== "\n" && footer[cursor] !== "\r") cursor += 1;
    } else {
      break;
    }
  }
  if (footer.slice(cursor, cursor + 2) !== "<<") {
    refuse("Trailer PDF non seguito da un dizionario verificabile.");
  }
  const model = parsePdf(source);
  if (model.encrypted) refuse("PDF cifrato non supportato.");
  // This security-sensitive path must not interpret one revision while PDF.js
  // displays another. Classic incremental/hybrid xrefs and linearized sources
  // need separate independent corpus review before admission.
  if (model.linearized || model.trailer.entries.has("Prev") || model.trailer.entries.has("XRefStm")) {
    refuse("Revisioni incrementali, xref ibridi o PDF linearizzati non supportati.");
  }
  if (model.pages.length < 1 || model.pages.length > MAX_PAGES) refuse("Numero pagine fuori limite (1–4).");
  if (model.root === null || model.objects.size > 1000) refuse("Modello PDF non supportato.");
  // A small compressed image stream can expand to enormous memory BEFORE the
  // bounded output canvas exists. Reject extreme declared raster dimensions.
  let declaredImagePixels = 0;
  const inspectNested = (value: PdfValue, depth = 0): void => {
    if (depth > 32) refuse("Gerarchia PDF troppo profonda per valutare i contenuti interattivi.");
    if (value.kind === "array") {
      for (const part of value.items) inspectNested(part, depth + 1);
      return;
    }
    const dictionary = value.kind === "dict" ? value : value.kind === "stream" ? value.dictionary : null;
    if (dictionary === null) return;
    for (const nameKey of ["Type", "Subtype", "FT"]) {
      const name = dictionary.entries.get(nameKey);
      if (name?.kind === "name" && (name.value === "Sig" || name.value === "DocTimeStamp")) {
        refuse("Sorgente firmata o certificata non supportata.");
      }
    }
    const subtype = dictionary.entries.get("Subtype");
    if (subtype?.kind === "name" && subtype.value === "Image") {
      const width = numberFrom(dictionary.entries.get("Width"));
      const height = numberFrom(dictionary.entries.get("Height"));
      if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)
        || width < 1 || height < 1 || width * height > 16_000_000) {
        refuse("Raster sorgente con dimensioni troppo elevate o ambigue.");
      }
      declaredImagePixels += width * height;
      if (declaredImagePixels > 24_000_000) refuse("Troppe immagini sorgente da decodificare.");
    }
    for (const [key, nested] of dictionary.entries) {
      if (FORBIDDEN.has(key)) refuse(`Contenuto interattivo/privato non supportato: ${key}.`);
      inspectNested(nested, depth + 1);
    }
  };
  for (const { value } of model.objects.values()) {
    inspectNested(value);
  }
  return model.pages.length;
}

interface Bounds { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number }

function pixelBounds(region: RedactionRegion237, width: number, height: number): Bounds {
  return {
    x0: Math.floor(region.left * width), y0: Math.floor(region.top * height),
    x1: Math.ceil((region.left + region.width) * width),
    y1: Math.ceil((region.top + region.height) * height),
  };
}

/** In-memory pixel transformation, testable without any PDF document renderer. */
export function blackenPixels237(
  rgba: Uint8ClampedArray, width: number, height: number, regions: readonly RedactionRegion237[],
): Uint8Array {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1
    || width > MAX_PIXEL_EDGE || height > MAX_PIXEL_EDGE || width * height > MAX_PIXELS_PER_PAGE
    || rgba.length !== width * height * 4) refuse("Raster sorgente fuori limite.");
  const limits = regions.map((region) => pixelBounds(region, width, height));
  const rgb = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      const dest = pixel * 3;
      if (limits.some((box) => x >= box.x0 && x < box.x1 && y >= box.y0 && y < box.y1)) {
        rgb[dest] = 0; rgb[dest + 1] = 0; rgb[dest + 2] = 0;
      } else {
        rgb[dest] = rgba[pixel * 4]!;
        rgb[dest + 1] = rgba[pixel * 4 + 1]!;
        rgb[dest + 2] = rgba[pixel * 4 + 2]!;
      }
    }
  }
  return rgb;
}

async function compressDeflate(bytes: Uint8Array, signal?: AbortSignal): Promise<Uint8Array> {
  if (typeof CompressionStream === "undefined") refuse("CompressionStream locale non disponibile.");
  check(signal);
  const buffer = await new Response(new Blob([Uint8Array.from(bytes)]).stream().pipeThrough(new CompressionStream("deflate"))).arrayBuffer();
  check(signal);
  if (buffer.byteLength < 8 || buffer.byteLength > MAX_OUTPUT_BYTES) refuse("Raster compresso fuori limite.");
  return new Uint8Array(buffer);
}

function buildRasterOnly237(pages: readonly { readonly bytes: Uint8Array; readonly geometry: RedactionPage237 }[]): Uint8Array {
  const writer = new PdfBuilder(); // deliberately empty: NO input document is ever passed to it
  const pagesRef = writer.reserve();
  const references = pages.map(({ bytes, geometry }) => {
    const image = writer.putAuto({
      kind: "stream",
      dictionary: pdfDict({
        Type: pdfName("XObject"), Subtype: pdfName("Image"),
        Width: pdfNumber(geometry.pixelWidth), Height: pdfNumber(geometry.pixelHeight),
        ColorSpace: pdfName("DeviceRGB"), BitsPerComponent: pdfNumber(8), Filter: pdfName("FlateDecode"),
      }),
      bytes,
    });
    const stream = writer.putAuto({ kind: "stream", dictionary: pdfDict({}), bytes: new TextEncoder().encode(
      `q\n${geometry.pageWidth} 0 0 ${geometry.pageHeight} 0 0 cm\n/Im0 Do\nQ\n`,
    ) });
    return writer.putAuto(pdfDict({
      Type: pdfName("Page"),
      Parent: pagesRef,
      MediaBox: pdfArray([pdfNumber(0), pdfNumber(0), pdfNumber(geometry.pageWidth), pdfNumber(geometry.pageHeight)]),
      Resources: pdfDict({ XObject: pdfDict({ Im0: image }) }),
      Contents: stream,
    }));
  });
  writer.put(pagesRef, pdfDict({ Type: pdfName("Pages"), Kids: pdfArray(references), Count: pdfNumber(references.length) }));
  const root = writer.putAuto(pdfDict({ Type: pdfName("Catalog"), Pages: pagesRef }));
  return writer.build(root, null);
}

async function inflateExact237(compressed: Uint8Array, expected: number, signal?: AbortSignal): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") refuse("DecompressionStream di verifica non disponibile.");
  let used = 0;
  const chunks: Uint8Array[] = [];
  const reader = new Blob([Uint8Array.from(compressed)]).stream().pipeThrough(new DecompressionStream("deflate")).getReader();
  try {
    while (true) {
      check(signal);
      const next = await reader.read();
      if (next.done) break;
      used += next.value.length;
      if (used > expected) refuse("Immagine esportata decompressa oltre il limite atteso.");
      chunks.push(next.value);
    }
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  if (used !== expected) refuse("Dimensioni raster esportato incoerenti.");
  const bytes = new Uint8Array(expected);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

/**
 * Independent post-export parser, fixed-object whitelist and full decoded
 * image-pixel black check. It does not trust the writer's in-memory canvases.
 */
export async function verifySecureRedaction237(
  output: Uint8Array, pages: readonly RedactionPage237[], signal?: AbortSignal,
): Promise<RedactionProof237> {
  if (output.length < 100 || output.length > MAX_OUTPUT_BYTES) refuse("PDF finale fuori limite.");
  if (!new TextDecoder("ascii").decode(output.subarray(-6)).endsWith("%%EOF\n")) refuse("Byte finali dopo EOF.");
  const model = parsePdf(output);
  if (model.info !== null || model.encrypted || model.root === null || model.pages.length !== pages.length
    || model.objects.size !== 2 + pages.length * 3 || model.trailer.entries.has("Prev")) {
    refuse("Struttura PDF esportata diversa dallo schema consentito.");
  }
  const root = model.objects.get(model.root.id)?.value;
  if (root?.kind !== "dict" || !exactKeys(root.entries, ["Type", "Pages"])) refuse("Catalogo con contenuto extra.");
  const catalogType = root.entries.get("Type");
  if (catalogType?.kind !== "name" || catalogType.value !== "Catalog") refuse("Catalogo inatteso.");
  const pagesTreeRef = root.entries.get("Pages");
  if (pagesTreeRef?.kind !== "ref") refuse("Albero pagine inatteso.");
  const tree = model.objects.get(pagesTreeRef.id)?.value;
  if (tree?.kind !== "dict" || !exactKeys(tree.entries, ["Type", "Kids", "Count"])) refuse("Oggetti pagine extra.");
  const count = tree.entries.get("Count");
  if (numberFrom(count) !== pages.length) refuse("Conteggio pagine errato.");
  const pageReferences = tree.entries.get("Kids");
  if (pageReferences?.kind !== "array" || pageReferences.items.length !== pages.length) refuse("Kids pagina non validi.");
  const treeType = tree.entries.get("Type");
  if (treeType?.kind !== "name" || treeType.value !== "Pages") refuse("Tipo albero non valido.");
  const usedObjectIds = new Set([model.root.id, pagesTreeRef.id]);
  const canonicalPages: { bytes: Uint8Array; geometry: RedactionPage237 }[] = [];
  let verifiedBlackPixels = 0;
  for (let index = 0; index < pages.length; index += 1) {
    check(signal);
    const page = model.pages[index]?.object.value;
    const spec = pages[index]!;
    if (page?.kind !== "dict" || !exactKeys(page.entries, ["Type", "Parent", "MediaBox", "Resources", "Contents"])) refuse("Pagina con oggetti nascosti.");
    const pageType = page.entries.get("Type");
    const parent = page.entries.get("Parent");
    if (parent?.kind !== "ref" || parent.id !== pagesTreeRef.id) refuse("Pagina priva di riferimento Parent valido.");
    const declaredPageRef = pageReferences.items[index];
    if (pageType?.kind !== "name" || pageType.value !== "Page" || declaredPageRef?.kind !== "ref"
      || declaredPageRef.id !== model.pages[index]?.object.id) refuse("Riferimento pagina non valido.");
    usedObjectIds.add(declaredPageRef.id);
    const size = page.entries.get("MediaBox");
    if (size?.kind !== "array" || size.items.length !== 4
      || JSON.stringify(size.items.map(numberFrom)) !== JSON.stringify([0, 0, spec.pageWidth, spec.pageHeight])) {
      refuse("MediaBox del PDF esportato non corrisponde al render.");
    }
    const contentRef = page.entries.get("Contents");
    if (contentRef?.kind !== "ref") refuse("Contents non permesso.");
    usedObjectIds.add(contentRef.id);
    const content = model.objects.get(contentRef.id)?.value;
    const expectedContent = `q\n${spec.pageWidth} 0 0 ${spec.pageHeight} 0 0 cm\n/Im0 Do\nQ\n`;
    if (content?.kind !== "stream" || !exactKeys(content.dictionary.entries, ["Length"])
      || new TextDecoder().decode(content.bytes) !== expectedContent) refuse("Contenuto pagina diverso dall'unico raster.");
    const resources = page.entries.get("Resources");
    const xobjects = resources?.kind === "dict" ? resources.entries.get("XObject") : undefined;
    const imageRef = xobjects?.kind === "dict" ? xobjects.entries.get("Im0") : undefined;
    if (resources?.kind !== "dict" || !exactKeys(resources.entries, ["XObject"])
      || xobjects?.kind !== "dict" || !exactKeys(xobjects.entries, ["Im0"]) || imageRef?.kind !== "ref") {
      refuse("Risorse pagina diverse da un'immagine.");
    }
    usedObjectIds.add(imageRef.id);
    const image = model.objects.get(imageRef.id)?.value;
    const imgDict = image?.kind === "stream" ? image.dictionary.entries : null;
    const imageType = imgDict?.get("Type");
    const filter = imgDict?.get("Filter");
    const subtype = imgDict?.get("Subtype");
    const colorSpace = imgDict?.get("ColorSpace");
    if (image?.kind !== "stream" || imgDict === null
      || !exactKeys(imgDict, ["Type", "Subtype", "Width", "Height", "ColorSpace", "BitsPerComponent", "Filter", "Length"])
      || imageType?.kind !== "name" || imageType.value !== "XObject"
      || filter?.kind !== "name" || filter.value !== "FlateDecode"
      || subtype?.kind !== "name" || subtype.value !== "Image"
      || colorSpace?.kind !== "name" || colorSpace.value !== "DeviceRGB"
      || numberFrom(imgDict.get("BitsPerComponent")) !== 8
      || numberFrom(imgDict.get("Width")) !== spec.pixelWidth || numberFrom(imgDict.get("Height")) !== spec.pixelHeight) {
      refuse("Stream immagine diverso da raster RGB puro.");
    }
    const rgb = await inflateExact237(image.bytes, spec.pixelWidth * spec.pixelHeight * 3, signal);
    canonicalPages.push({ bytes: image.bytes, geometry: spec });
    const occupied = new Uint8Array(spec.pixelWidth * spec.pixelHeight);
    for (const region of spec.regions) {
      const b = pixelBounds(region, spec.pixelWidth, spec.pixelHeight);
      for (let y = b.y0; y < b.y1; y += 1) {
        for (let x = b.x0; x < b.x1; x += 1) {
          const pixel = y * spec.pixelWidth + x;
          if (!occupied[pixel]) { occupied[pixel] = 1; verifiedBlackPixels += 1; }
          if (rgb[pixel * 3] !== 0 || rgb[pixel * 3 + 1] !== 0 || rgb[pixel * 3 + 2] !== 0) {
            refuse("Un pixel oscurato risulta recuperabile nel PDF esportato.");
          }
        }
      }
    }
  }
  if (usedObjectIds.size !== model.objects.size) refuse("Oggetti orfani o duplicati nel PDF esportato.");
  if (verifiedBlackPixels < 1) refuse("Nessun pixel oscurato.");
  // The parsed object tree alone does not prove the absence of recoverable
  // bytes: PDF readers tolerate comments/unknown text between startxref and
  // %%EOF, where a source secret could remain even after all pixel checks.
  // Require the ENTIRE exported byte stream to match the canonical fresh
  // image-only serializer, including xref, whitespace and EOF placement.
  const canonical = buildRasterOnly237(canonicalPages);
  if (canonical.length !== output.length || canonical.some((byte, index) => byte !== output[index])) {
    refuse("Byte estranei recuperabili nel PDF esportato.");
  }
  return {
    policy: "new-raster-only-lossless-flate-no-source-objects", pageCount: pages.length, pages,
    verifiedBlackPixels, fidelity: "whole-page-rasterized-no-search-text-vectors-links-or-original-metadata",
  };
}

export async function redactPdfRaster237(
  file: File, regions: readonly RedactionRegion237[], signal?: AbortSignal,
): Promise<{ readonly artifact: PdfArtifact; readonly proof: RedactionProof237 }> {
  if (!(file instanceof File) || file.size > MAX_SOURCE_BYTES) refuse("PDF locale <=8MiB richiesto.");
  check(signal);
  const source = new Uint8Array(await file.arrayBuffer());
  check(signal);
  const sourceCount = assertSupportedSource237(source);
  validateRedactionPlan237(sourceCount, regions);
  const [pdfjs, workerUrl] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.mjs?url")]);
  check(signal);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.default;
  const loader = pdfjs.getDocument({ data: source.slice(), useSystemFonts: false });
  const stop = () => { void loader.destroy(); };
  signal?.addEventListener("abort", stop, { once: true });
  try {
    const documentPdf = await loader.promise;
    if (documentPdf.numPages !== sourceCount) refuse("PDF.js differisce dal parser sulla numerazione pagine.");
    const pages: { bytes: Uint8Array; geometry: RedactionPage237 }[] = [];
    for (let index = 1; index <= sourceCount; index += 1) {
      check(signal);
      const pdfPage = await documentPdf.getPage(index);
      let canvas: HTMLCanvasElement | null = null;
      try {
        if ((await pdfPage.getAnnotations({ intent: "display" })).length !== 0) refuse("Pagina con annotazioni non supportata.");
        const base = pdfPage.getViewport({ scale: 1 });
        if (base.width < 1 || base.height < 1 || base.width > 1200 || base.height > 1200) refuse("Dimensioni pagina non supportate.");
        const scale = Math.min(1.5, Math.sqrt(MAX_PIXELS_PER_PAGE / (base.width * base.height)));
        const viewport = pdfPage.getViewport({ scale });
        const width = Math.ceil(viewport.width), height = Math.ceil(viewport.height);
        if (width > MAX_PIXEL_EDGE || height > MAX_PIXEL_EDGE || width * height > MAX_PIXELS_PER_PAGE) refuse("Raster fuori limite.");
        canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
        if (!ctx) refuse("Canvas locale non disponibile.");
        const task = pdfPage.render({ canvas, canvasContext: ctx, viewport, background: "rgb(255,255,255)" });
        const cancel = () => task.cancel();
        signal?.addEventListener("abort", cancel, { once: true });
        try { await task.promise; }
        finally { signal?.removeEventListener("abort", cancel); }
        check(signal);
        const imageData = ctx.getImageData(0, 0, width, height);
        const selected = regionsFor(index, regions);
        const rgb = blackenPixels237(imageData.data, width, height, selected);
        const encoded = await compressDeflate(rgb, signal);
        pages.push({ bytes: encoded, geometry: {
          page: index, pageWidth: base.width, pageHeight: base.height,
          pixelWidth: width, pixelHeight: height, regions: selected,
        } });
      } finally {
        if (canvas) { canvas.width = 0; canvas.height = 0; }
        pdfPage.cleanup();
      }
    }
    check(signal);
    const output = buildRasterOnly237(pages);
    const proof = await verifySecureRedaction237(output, pages.map((page) => page.geometry), signal);
    check(signal);
    const bytes = output.slice();
    return {
      artifact: {
        bytes, blob: new Blob([bytes], { type: "application/pdf" }), mime: "application/pdf",
        filename: "pdf-redatto-raster-senza-oggetti-sorgente.pdf", pageCount: sourceCount,
      },
      proof,
    };
  } finally {
    signal?.removeEventListener("abort", stop);
    await loader.destroy().catch(() => undefined);
  }
}
