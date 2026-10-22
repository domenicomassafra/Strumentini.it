import { PDFDict, PDFDocument, PDFHexString, PDFName, PDFString } from "pdf-lib";
import { PDF_LIMITS, type PdfArtifact } from "./types";
import { auditPdfFormAnnotations } from "./form-annotation-audit";
import { dictionaryOrNull, nameValue, parsePdf } from "./parser";

export type PdfAnnotationKind134 = "highlight" | "rectangle" | "note";
export interface PdfAnnotation134 {
  readonly page: number;
  readonly kind: PdfAnnotationKind134;
  /** Unrotated PDF user-space coordinates, not CSS pixels. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly comment?: string;
}

const MAX_MARKS = 100;
const MAX_COMMENT = 1000;
function cancel(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Annotazione annullata", "AbortError");
}

/** Writes real PDF annotation dictionaries and vector /AP streams, retaining source page content. */
export async function createPdfAnnotations134(
  source: Uint8Array, marks: readonly PdfAnnotation134[], filename: string, signal?: AbortSignal,
): Promise<PdfArtifact> {
  cancel(signal);
  if (!(source instanceof Uint8Array) || source.byteLength < 8 || source.byteLength > PDF_LIMITS.maxBytes) {
    throw new Error("PDF_LIMIT: File PDF fuori limite (25 MiB)");
  }
  if (!Array.isArray(marks) || marks.length === 0 || marks.length > MAX_MARKS) {
    throw new Error("PDF_ANNOTATIONS: Aggiungi da 1 a 100 annotazioni");
  }
  const parsed = parsePdf(source);
  const root = parsed.root === null ? null : dictionaryOrNull(parsed, parsed.root);
  const audit = auditPdfFormAnnotations(parsed);
  const signed = [...parsed.objects.values()].some((obj) =>
    obj.value.kind === "dict" && (obj.value.entries.has("ByteRange")
      || nameValue(obj.value.entries.get("Type")) === "Sig"));
  // pdf-lib rewrites xref tables: never pretend existing signatures remain valid.
  // AcroForms may rely on appearance generators; refuse instead of silently flattening.
  if (parsed.encrypted || signed || root?.entries.has("Perms") ||
      root?.entries.has("AcroForm") || audit.widgetCount > 0) {
    throw new Error("PDF_FORM_UNSUPPORTED: firme, permessi e moduli interattivi non modificabili; originale conservato");
  }
  cancel(signal);
  const document = await PDFDocument.load(source.slice(), { ignoreEncryption: false, updateMetadata: false });
  const pages = document.getPages();
  if (pages.length === 0 || pages.length > PDF_LIMITS.maxPages) throw new Error("PDF_LIMIT: Numero pagine non supportato");
  const previousCount = audit.annotationCount;
  // /NM must be unique among annotations on each page, including ones saved in
  // earlier exports. Read the existing dictionaries before assigning new names.
  const namesByPage = pages.map((page) => {
    const names = new Set<string>();
    const existing = page.node.Annots();
    if (existing) for (let i = 0; i < existing.size(); i++) {
      const dictionary = document.context.lookupMaybe(existing.get(i), PDFDict);
      const name = dictionary?.lookupMaybe(PDFName.of("NM"), PDFString, PDFHexString);
      if (name) names.add(name.decodeText());
    }
    return names;
  });
  for (const mark of marks) {
    cancel(signal);
    if (!mark || !["highlight", "rectangle", "note"].includes(mark.kind) ||
        !Number.isInteger(mark.page) || mark.page < 1 || mark.page > pages.length) {
      throw new Error("PDF_ANNOTATIONS: Pagina o tipo annotazione non valido");
    }
    const page = pages[mark.page - 1]!;
    const names = namesByPage[mark.page - 1]!;
    let suffix = 1;
    while (names.has("STR134-" + suffix)) suffix++;
    const name = "STR134-" + suffix;
    names.add(name);
    const crop = page.getCropBox();
    const nums = [mark.x, mark.y, mark.width, mark.height];
    if (nums.some((n) => !Number.isFinite(n)) || mark.width < 2 || mark.height < 2 ||
        mark.x < crop.x - 0.02 || mark.y < crop.y - 0.02 ||
        mark.x + mark.width > crop.x + crop.width + 0.02 ||
        mark.y + mark.height > crop.y + crop.height + 0.02) {
      throw new Error("PDF_COORDINATE_BOUNDS: Coordinate fuori dalla pagina selezionata");
    }
    const comment = mark.comment?.trim() ?? "";
    if (comment.length > MAX_COMMENT || (mark.kind === "note" && !comment)) {
      throw new Error("PDF_COMMENT: Una nota richiede un commento fino a 1000 caratteri");
    }
    const { x, y, width: w, height: h } = mark;
    const highlight = mark.kind === "highlight";
    const note = mark.kind === "note";
    const content = highlight
      ? "q /GS1 gs 1 0.82 0 rg 0 0 " + w + " " + h + " re f Q"
      : note
        ? "q 1 0.85 0.22 rg 0 0 " + w + " " + h + " re f 0.45 0.3 0 RG 1 w 0.5 0.5 " + (w - 1) + " " + (h - 1) + " re S Q"
        : "q 0.1 0.43 0.84 RG 2 w 1 1 " + (w - 2) + " " + (h - 2) + " re S Q";
    const appearance = document.context.flateStream(content, {
      Type: "XObject", Subtype: "Form", BBox: [0, 0, w, h],
      Resources: highlight ? { ExtGState: { GS1: { Type: "ExtGState", ca: 0.36, CA: 0.36, BM: "Multiply" } } } : {},
    });
    const appearanceRef = document.context.register(appearance);
    const annotation = document.context.obj({
      Type: "Annot", Subtype: note ? "Text" : highlight ? "Highlight" : "Square",
      Rect: [x, y, x + w, y + h],
      F: 4, P: page.ref, AP: { N: appearanceRef },
      Contents: PDFHexString.fromText(comment),
      T: PDFHexString.fromText("Strumentini.it"),
      NM: PDFHexString.fromText(name),
      M: PDFHexString.fromText(new Date().toISOString()),
      C: note ? [1, 0.85, 0.22] : highlight ? [1, 0.82, 0] : [0.1, 0.43, 0.84],
      ...(note ? { Name: PDFName.of("Comment") } :
        highlight ? { QuadPoints: [x, y + h, x + w, y + h, x, y, x + w, y] } :
          { BS: { W: 2, S: "S" } }),
    });
    page.node.addAnnot(document.context.register(annotation));
  }
  cancel(signal);
  const bytes = await document.save({ useObjectStreams: false, addDefaultPage: false });
  if (bytes.byteLength > PDF_LIMITS.maxOutputBytes) throw new Error("PDF_LIMIT: PDF di uscita oltre 50 MiB");
  const reopened = await PDFDocument.load(bytes.slice(), { ignoreEncryption: false, updateMetadata: false });
  if (reopened.getPageCount() !== pages.length) throw new Error("PDF_VERIFY: Numero pagine alterato");
  for (let i = 0; i < pages.length; i++) {
    const a = pages[i]!, b = reopened.getPage(i);
    if (a.getWidth() !== b.getWidth() || a.getHeight() !== b.getHeight() ||
        a.getRotation().angle !== b.getRotation().angle) throw new Error("PDF_VERIFY: Geometria cambiata");
  }
  const verified = auditPdfFormAnnotations(parsePdf(bytes));
  if (verified.annotationCount !== previousCount + marks.length) {
    throw new Error("PDF_VERIFY: Annotazioni mancanti nella riapertura");
  }
  cancel(signal);
  const name = filename.replace(/\.pdf$/iu, "").slice(0, 115).replaceAll(/[\\/]/gu, "_") || "documento";
  return {
    bytes, blob: new Blob([Uint8Array.from(bytes)], { type: "application/pdf" }),
    filename: name + ".annotato.pdf", mime: "application/pdf", pageCount: pages.length,
  };
}
