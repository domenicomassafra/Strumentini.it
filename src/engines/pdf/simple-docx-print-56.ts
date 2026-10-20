import { unzipSync } from "fflate";
import { extractDocxSemantics, inspectOfficeStructure } from "../ooxml/office-semantics";

const NOTE_INVENTORY = "Footnotes/endnotes are not merged into the primary semantic reading order.";

/** docx's empty separator-only note parts do not contain document content. */
function hasOnlyNoteSeparators(archive: Record<string, Uint8Array>): boolean {
  for (const name of ["footnotes", "endnotes"] as const) {
    const bytes = archive[`word/${name}.xml`];
    if (bytes === undefined) continue;
    const xml = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const singular = name === "footnotes" ? "footnote" : "endnote";
    const entries = [...xml.matchAll(new RegExp(`<w:${singular}\\b([^>]*)>`, "gu"))];
    if (entries.length !== 2 || !entries.every(([, attrs]) =>
      /w:type="(?:separator|continuationSeparator)"/u.test(attrs ?? "")) ||
      /<w:(?:t|hyperlink|drawing|pict|object|instrText|footnoteReference|endnoteReference)\b/iu.test(xml)) return false;
  }
  return true;
}

/** Bounded DOCX semantic-to-print path. This cannot reproduce Word layout. */
export async function simpleDocxToPrintableText56(input: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < 1 || bytes.length > 512 * 1024) {
    throw new Error("PDF56_DOCX_LIMIT: documento Word semplice massimo 512 KiB");
  }
  const structure = await inspectOfficeStructure(bytes);
  const archive = unzipSync(bytes);
  const noteSeparatorsOnly = hasOnlyNoteSeparators(archive);
  const unsupported = structure.unsupportedConstructs.filter((entry) => entry !== NOTE_INVENTORY || !noteSeparatorsOnly);
  if (structure.kind !== "docx" || structure.mediaParts.length !== 0 || structure.fontParts.length !== 0 ||
    structure.externalRelationshipCount !== 0 || unsupported.length !== 0) {
    throw new Error("PDF56_DOCX_UNSUPPORTED: documento con media, allegati o contenuto strutturale non stampabile in modo sicuro");
  }
  const documentBytes = archive["word/document.xml"];
  if (!documentBytes) throw new Error("PDF56_DOCX_UNSUPPORTED: corpo DOCX mancante");
  const xml = new TextDecoder("utf-8", { fatal: true }).decode(documentBytes);
  // Fail closed for any content whose semantics or visual presence our local
  // text-only PDF renderer cannot account for, including hyperlinks and tables.
  if (/<(?:w:(?:tbl|hyperlink|drawing|pict|object|fldChar|instrText|altChunk|sdt|ins|del|footnoteReference|endnoteReference|commentReference)|wp:|a:blip)\b/iu.test(xml)) {
    throw new Error("PDF56_DOCX_UNSUPPORTED: tabelle, immagini, campi, link o sezioni complesse richiedono un renderer Office completo");
  }
  const extracted = await extractDocxSemantics(bytes);
  if (extracted.unsupportedConstructs.some((entry) => entry !== NOTE_INVENTORY || !noteSeparatorsOnly) || extracted.assets.length !== 0 ||
    extracted.blocks.some((block) => block.type === "table" || block.links.length !== 0)) {
    throw new Error("PDF56_DOCX_UNSUPPORTED: contenuto DOCX non incluso nella stampa semantica");
  }
  const text = extracted.blocks.map((block) => block.type === "table" ? "" : block.text).filter(Boolean).join("\n\n");
  if (!text.trim() || !text.trim().length) throw new Error("PDF56_DOCX_EMPTY: il documento non contiene testo stampabile");
  return text;
}
