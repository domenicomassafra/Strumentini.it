import { TOOL_COPY_IT } from "../../../i18n/it/tool-copy";
import { ResearchKnowledgeTool, type ResearchKnowledgeToolConfig, type ResearchToolField } from "./ResearchKnowledgeTool";

function field(name: string, label: string, options: Partial<ResearchToolField> = {}): ResearchToolField {
  return { name, label, ...options };
}

function makeConfig(toolId: string, submitLabel: string, fields: readonly ResearchToolField[]): ResearchKnowledgeToolConfig {
  const copy = TOOL_COPY_IT[toolId];
  return {
    toolId,
    title: copy?.name ?? toolId,
    description: copy?.summary ?? "",
    submitLabel,
    resultLabel: "Risultato",
    fields,
  };
}

const doiConfig = makeConfig("doi-normalizer", "Normalizza DOI", [field("value", "DOI", { placeholder: "doi:10.1000/182" })]);
const linkConfig = makeConfig("doi-link-builder", "Crea link DOI", [field("value", "DOI", { placeholder: "10.1000/182" })]);
const isbnConfig = makeConfig("isbn-validator-converter", "Valida ISBN", [field("value", "ISBN", { placeholder: "978-0-306-40615-7" })]);
const ibanConfig = makeConfig("iban-validator", "Verifica IBAN", [field("value", "IBAN", { placeholder: "IT60 X054 2811 1010 0000 0123 456" })]);
const partitaIvaConfig = makeConfig("partita-iva-validator", "Verifica Partita IVA", [field("value", "Partita IVA italiana o UE", { placeholder: "IT 12345678903 oppure BE 0411905847" })]);
const citationDedupeConfig = makeConfig("citation-deduplicator", "Rimuovi citazioni duplicate", [field("records", "Citazioni (array JSON oppure un oggetto per riga)", { kind: "textarea", rows: 10, placeholder: '[{"title":"Uno studio","doi":"10.1000/182"}]' }), field("mode", "Regola di identità", { kind: "select", options: ["identifier", "title-author-year", "exact"], defaultValue: "identifier" })]);
const bibtexFormatConfig = makeConfig("bibtex-formatter", "Formatta BibTeX", [field("text", "BibTeX", { kind: "textarea", rows: 14, placeholder: "@article{chiave, title={Un titolo}, year={2026}}" })]);
const bibtexDedupeConfig = makeConfig("bibtex-deduplicator", "Rimuovi duplicati BibTeX", [field("text", "BibTeX", { kind: "textarea", rows: 14 })]);
const converterConfig = makeConfig("ris-bibtex-converter", "Converti riferimenti", [field("text", "RIS o BibTeX", { kind: "textarea", rows: 14 }), field("direction", "Direzione", { kind: "select", options: ["ris-to-bibtex", "bibtex-to-ris"], defaultValue: "ris-to-bibtex" })]);
const keyConfig = makeConfig("citation-key-generator", "Genera chiavi", [field("records", "Citazioni (array JSON oppure un oggetto per riga)", { kind: "textarea", rows: 10 })]);
const referenceSortConfig = makeConfig("reference-list-sorter", "Ordina riferimenti", [field("records", "Riferimenti (array JSON oppure un oggetto per riga)", { kind: "textarea", rows: 10 }), field("order", "Ordina per", { kind: "select", options: ["author", "year", "title"], defaultValue: "author" })]);
const pdfConfig = makeConfig("pdf-page-citation-helper", "Formatta citazione", [field("author", "Autore", { placeholder: "A. Ricercatore" }), field("title", "Titolo del documento", { placeholder: "Uno studio" }), field("year", "Anno", { defaultValue: "2026" }), field("pages", "Pagine", { placeholder: "12-15" }), field("style", "Stile", { kind: "select", options: ["apa", "mla", "chicago"], defaultValue: "apa" })]);
const quoteConfig = makeConfig("quote-counter", "Conta testo", [field("text", "Citazione o brano", { kind: "textarea", rows: 10 })]);
const timelineConfig = makeConfig("timeline-sorter", "Ordina cronologia", [field("records", "Eventi (array JSON oppure un oggetto per riga)", { kind: "textarea", rows: 10 }), field("direction", "Direzione", { kind: "select", options: ["ascending", "descending"], defaultValue: "ascending" })]);
const dateConfig = makeConfig("date-source-normalizer", "Normalizza data", [field("value", "Data", { placeholder: "2026-09-24 oppure 24 settembre 2026" }), field("dayFirst", "Date numeriche con giorno iniziale", { kind: "select", options: ["false", "true"], defaultValue: "false" })]);
const urlConfig = makeConfig("research-url-cleaner", "Pulisci URL", [field("url", "URL di ricerca", { placeholder: "https://example.org/studio?utm_source=nota" })]);
const domainConfig = makeConfig("domain-frequency-counter", "Conta domini", [field("urls", "URL (uno per riga)", { kind: "textarea", rows: 10, placeholder: "https://example.org/a\nhttps://example.org/b" })]);
const evidenceConfig = makeConfig("evidence-table-builder", "Crea tabella delle evidenze", [field("records", "Evidenze (array JSON oppure un oggetto per riga)", { kind: "textarea", rows: 10 })]);
const notesConfig = makeConfig("notes-deduplicator", "Rimuovi note duplicate", [field("notes", "Note (array JSON oppure una per riga)", { kind: "textarea", rows: 10 })]);
const vocabularyConfig = makeConfig("vocabulary-frequency-analyzer", "Analizza vocabolario", [field("text", "Testo", { kind: "textarea", rows: 10 }), field("minLength", "Lunghezza minima del termine", { defaultValue: "1" }), field("limit", "Numero massimo di termini", { defaultValue: "50" })]);
const readingConfig = makeConfig("reading-list-deduplicator", "Rimuovi duplicati dalla lista di lettura", [field("records", "Elementi della lista (array JSON oppure un oggetto per riga)", { kind: "textarea", rows: 10 })]);
const packConfig = makeConfig("research-pack-manifest", "Crea manifest", [field("name", "Nome del pacchetto", { defaultValue: "Ricerca di base" }), field("tools", "ID strumenti (uno per riga)", { kind: "textarea", rows: 7, defaultValue: "doi-normalizer\nquote-counter" })]);

export function DoiNormalizerTool() { return <ResearchKnowledgeTool config={doiConfig} />; }
export function DoiLinkBuilderTool() { return <ResearchKnowledgeTool config={linkConfig} />; }
export function IsbnValidatorConverterTool() { return <ResearchKnowledgeTool config={isbnConfig} />; }
export function IbanValidatorTool() { return <ResearchKnowledgeTool config={ibanConfig} />; }
export function PartitaIvaValidatorTool() { return <ResearchKnowledgeTool config={partitaIvaConfig} />; }
export function CitationDeduplicatorTool() { return <ResearchKnowledgeTool config={citationDedupeConfig} />; }
export function BibtexFormatterTool() { return <ResearchKnowledgeTool config={bibtexFormatConfig} />; }
export function BibtexDeduplicatorTool() { return <ResearchKnowledgeTool config={bibtexDedupeConfig} />; }
export function RisBibtexConverterTool() { return <ResearchKnowledgeTool config={converterConfig} />; }
export function CitationKeyGeneratorTool() { return <ResearchKnowledgeTool config={keyConfig} />; }
export function ReferenceListSorterTool() { return <ResearchKnowledgeTool config={referenceSortConfig} />; }
export function PdfPageCitationHelperTool() { return <ResearchKnowledgeTool config={pdfConfig} />; }
export function QuoteCounterTool() { return <ResearchKnowledgeTool config={quoteConfig} />; }
export function TimelineSorterTool() { return <ResearchKnowledgeTool config={timelineConfig} />; }
export function DateSourceNormalizerTool() { return <ResearchKnowledgeTool config={dateConfig} />; }
export function ResearchUrlCleanerTool() { return <ResearchKnowledgeTool config={urlConfig} />; }
export function DomainFrequencyCounterTool() { return <ResearchKnowledgeTool config={domainConfig} />; }
export function EvidenceTableBuilderTool() { return <ResearchKnowledgeTool config={evidenceConfig} />; }
export function NotesDeduplicatorTool() { return <ResearchKnowledgeTool config={notesConfig} />; }
export function VocabularyFrequencyAnalyzerTool() { return <ResearchKnowledgeTool config={vocabularyConfig} />; }
export function ReadingListDeduplicatorTool() { return <ResearchKnowledgeTool config={readingConfig} />; }
export function ResearchPackManifestTool() { return <ResearchKnowledgeTool config={packConfig} />; }
