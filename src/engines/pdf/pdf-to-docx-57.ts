/** Ticket #057: bounded PDF text -> editable Word paragraphs, no layout reconstruction. */
import { pdfToMarkdown } from "./index";

export interface PdfDocx57Result {
  readonly bytes: Uint8Array;
  readonly filename: string;
  readonly pageCount: number;
  readonly sourceSha256: string;
  readonly textByPage: readonly { page: number; text: string }[];
  readonly losses: readonly string[];
  readonly policy: "page-labelled-text-only-no-layout-reconstruction";
}

export const PDF_DOCX_57_LIMITS = { maxInputBytes: 8 * 1024 * 1024, maxPages: 12, maxOutputBytes: 4 * 1024 * 1024 } as const;

const xml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
const encoder = new TextEncoder();
const paragraph = (value: string) => `<w:p><w:r><w:t xml:space="preserve">${xml(value)}</w:t></w:r></w:p>`;
const hex = (bytes: Uint8Array) => [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
const losses = [
  "Solo testo PDF selezionabile: titoli, elenchi e tabelle non vengono riconosciuti come struttura Word.",
  "Colonne multiple, ordine visivo, posizioni, font, stili, immagini e grafica non sono ricostruiti.",
  "Ogni pagina e identificata da un paragrafo di provenienza; le interruzioni reali di pagina non sono riprodotte.",
] as const;

export async function pdfToDocx57(file: File, signal?: AbortSignal): Promise<PdfDocx57Result> {
  if (!(file instanceof File) || !/\.pdf$/iu.test(file.name) || file.size < 8 || file.size > PDF_DOCX_57_LIMITS.maxInputBytes) {
    throw new Error("PDF57_INPUT: Seleziona un PDF locale valido fino a 8 MiB.");
  }
  const stop = () => { if (signal?.aborted) throw new DOMException("Conversione PDF annullata", "AbortError"); };
  stop();
  const source = new Uint8Array(await file.arrayBuffer());
  stop();
  const converted = await pdfToMarkdown(file.name, source, signal);
  stop();
  if (converted.status === "encrypted") throw new Error("PDF57_ENCRYPTED: Il PDF cifrato non e convertibile senza un processo autorizzato di sblocco.");
  if (converted.status !== "converted" || converted.pages.length === 0) {
    throw new Error("PDF57_OCR_REQUIRED: Il PDF non contiene testo selezionabile. Esegui l'OCR locale prima della conversione DOCX.");
  }
  if (converted.truncated || converted.pageCount > PDF_DOCX_57_LIMITS.maxPages ||
      converted.pages.length !== converted.pageCount) throw new Error("PDF57_LIMIT: Massimo 12 pagine, senza testo troncato.");
  if (converted.pages.some(({ text, truncated }) => truncated || text.trim() === "")) {
    throw new Error("PDF57_OCR_REQUIRED: Almeno una pagina non contiene testo completo: esegui l'OCR anche per le pagine scansite.");
  }
  const sourceSha256 = hex(new Uint8Array(await crypto.subtle.digest("SHA-256", source)));
  const textByPage = converted.pages.map(({ page, text }) => ({ page, text: text.replace(/\r\n?/gu, "\n") }));
  const sections = [
    `PDF originale: ${file.name}`, `SHA-256 PDF: ${sourceSha256}`,
    "AVVERTENZE: ricostruzione modificabile del solo testo selezionabile, non del layout.",
    ...losses,
    ...textByPage.flatMap(({ page, text }) => [
      `Pagina PDF ${page} di ${converted.pageCount} · ${file.name}`,
      ...text.split("\n"),
    ]),
  ];
  // This subset deliberately writes the literal original PDF text directly to
  // WordprocessingML runs: markdown and HTML interpreters alter punctuation.
  const documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    sections.map(paragraph).join("") +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>';
  const entries = {
    "[Content_Types].xml": encoder.encode('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    "_rels/.rels": encoder.encode('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    "word/document.xml": encoder.encode(documentXml),
  };
  const [{ zipSync }, { analyzeOoxmlPackage }, { extractDocxSemantics }] = await Promise.all([
    import("fflate"), import("../ooxml/package"), import("../ooxml/office-semantics"),
  ]);
  stop();
  const bytes = zipSync(entries, { level: 9 });
  if (bytes.length < 100 || bytes.length > PDF_DOCX_57_LIMITS.maxOutputBytes) throw new Error("PDF57_LIMIT: DOCX generato troppo grande o vuoto.");
  const analysis = analyzeOoxmlPackage(bytes);
  if (analysis.kind !== "docx") throw new Error("PDF57_VERIFY: Pacchetto Word non valido.");
  const reopened = await extractDocxSemantics(bytes);
  stop();
  // Independent parser reopens WordprocessingML; compare all nonblank original
  // lines in strict order, including provenance and plain punctuation.
  const expected = sections.filter((line) => line !== "");
  const actual = reopened.blocks.filter((block) => block.type === "paragraph").map((block) => block.text);
  if (reopened.blocks.length !== expected.length || actual.length !== expected.length ||
      expected.some((line, index) => actual[index] !== line)) {
    throw new Error("PDF57_VERIFY: La rilettura Word ha cambiato testo o provenienza; esportazione rifiutata.");
  }
  return {
    bytes, filename: file.name.replace(/\.pdf$/iu, "").replaceAll(/[\\/:*?"<>|]/gu, "-").slice(0, 100) + ".docx",
    pageCount: converted.pageCount, sourceSha256, textByPage, losses,
    policy: "page-labelled-text-only-no-layout-reconstruction",
  };
}
