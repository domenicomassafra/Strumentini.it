import { unzipSync } from "fflate";
import { extractDocxSemantics, inspectOfficeStructure } from "../ooxml/office-semantics";

/** Bounded DOCX semantic-to-print path. This cannot reproduce Word layout. */
export async function simpleDocxToPrintableText56(input: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < 1 || bytes.length > 512 * 1024) {
    throw new Error("PDF56_DOCX_LIMIT: documento Word semplice massimo 512 KiB");
  }
  const structure = await inspectOfficeStructure(bytes);
  if (structure.kind !== "docx" || structure.mediaParts.length !== 0 || structure.fontParts.length !== 0 ||
    structure.externalRelationshipCount !== 0 || structure.unsupportedConstructs.length !== 0) {
    throw new Error("PDF56_DOCX_UNSUPPORTED: documento con media, allegati o contenuto strutturale non stampabile in modo sicuro");
  }
  const archive = unzipSync(bytes);
  const documentBytes = archive["word/document.xml"];
  if (!documentBytes) throw new Error("PDF56_DOCX_UNSUPPORTED: corpo DOCX mancante");
  const xml = new TextDecoder("utf-8", { fatal: true }).decode(documentBytes);
  // Fail closed for any content whose semantics or visual presence our local
  // text-only PDF renderer cannot account for, including hyperlinks and tables.
  if (/<(?:w:(?:tbl|hyperlink|drawing|pict|object|fldChar|instrText|altChunk|sdt|ins|del|footnoteReference|endnoteReference|commentReference)|wp:|a:blip)\b/iu.test(xml)) {
    throw new Error("PDF56_DOCX_UNSUPPORTED: tabelle, immagini, campi, link o sezioni complesse richiedono un renderer Office completo");
  }
  const extracted = await extractDocxSemantics(bytes);
  if (extracted.unsupportedConstructs.length !== 0 || extracted.assets.length !== 0 ||
    extracted.blocks.some((block) => block.type === "table" || block.links.length !== 0)) {
    throw new Error("PDF56_DOCX_UNSUPPORTED: contenuto DOCX non incluso nella stampa semantica");
  }
  const text = extracted.blocks.map((block) => block.type === "table" ? "" : block.text).filter(Boolean).join("\n\n");
  if (!text.trim() || !text.trim().length) throw new Error("PDF56_DOCX_EMPTY: il documento non contiene testo stampabile");
  return text;
}
