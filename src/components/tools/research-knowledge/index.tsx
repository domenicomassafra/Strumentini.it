import { ResearchKnowledgeTool, type ResearchKnowledgeToolConfig, type ResearchToolField } from "./ResearchKnowledgeTool";

function field(name: string, label: string, options: Partial<ResearchToolField> = {}): ResearchToolField {
  return { name, label, ...options };
}

function makeConfig(toolId: string, title: string, description: string, submitLabel: string, fields: readonly ResearchToolField[]): ResearchKnowledgeToolConfig {
  return { toolId, title, description, submitLabel, resultLabel: `${title} result`, fields };
}

const doiConfig = makeConfig("doi-normalizer", "DOI Normalizer", "Normalize only the declared DOI syntax; no resolver or metadata request is made.", "Normalize DOI", [field("value", "DOI", { placeholder: "doi:10.1000/182" })]);
const linkConfig = makeConfig("doi-link-builder", "DOI Link Builder", "Builds a resolver URL locally and does not open or resolve the DOI.", "Build link", [field("value", "DOI", { placeholder: "10.1000/182" })]);
const isbnConfig = makeConfig("isbn-validator-converter", "ISBN Validator / Converter", "Validates check digits and converts valid ISBN-10 values without a metadata lookup.", "Validate ISBN", [field("value", "ISBN", { placeholder: "978-0-306-40615-7" })]);
const citationDedupeConfig = makeConfig("citation-deduplicator", "Citation Deduplicator", "Stable first occurrence wins under the selected explicit identity rule.", "Deduplicate citations", [field("records", "Citation records (JSON array or one object per line)", { kind: "textarea", rows: 10, placeholder: '[{"title":"A paper","doi":"10.1000/182"}]' }), field("mode", "Identity rule", { kind: "select", options: ["identifier", "title-author-year", "exact"], defaultValue: "identifier" })]);
const bibtexFormatConfig = makeConfig("bibtex-formatter", "BibTeX Formatter", "Parses the supplied entries and writes canonical field order and whitespace.", "Format BibTeX", [field("text", "BibTeX", { kind: "textarea", rows: 14, placeholder: "@article{key, title={A title}, year={2026}}" })]);
const bibtexDedupeConfig = makeConfig("bibtex-deduplicator", "BibTeX Deduplicator", "Uses DOI identity first and a normalized title-author-year fallback.", "Deduplicate BibTeX", [field("text", "BibTeX", { kind: "textarea", rows: 14 })]);
const converterConfig = makeConfig("ris-bibtex-converter", "RIS / BibTeX Converter", "Converts the supplied text locally; unknown fields are reported rather than fetched.", "Convert references", [field("text", "RIS or BibTeX", { kind: "textarea", rows: 14 }), field("direction", "Direction", { kind: "select", options: ["ris-to-bibtex", "bibtex-to-ris"], defaultValue: "ris-to-bibtex" })]);
const keyConfig = makeConfig("citation-key-generator", "Citation Key Generator", "Uses the first author, four-digit year, and first title word with stable collision suffixes.", "Generate keys", [field("records", "Citation records (JSON array or one object per line)", { kind: "textarea", rows: 10 })]);
const referenceSortConfig = makeConfig("reference-list-sorter", "Reference List Sorter", "Sorts supplied records with a stable tie-breaker and leaves source records unchanged.", "Sort references", [field("records", "Reference records (JSON array or one object per line)", { kind: "textarea", rows: 10 }), field("order", "Sort by", { kind: "select", options: ["author", "year", "title"], defaultValue: "author" })]);
const pdfConfig = makeConfig("pdf-page-citation-helper", "PDF Page Citation Helper", "Formats supplied page metadata; it does not parse or upload a PDF file.", "Format citation", [field("author", "Author", { placeholder: "A. Researcher" }), field("title", "Document title", { placeholder: "A study" }), field("year", "Year", { defaultValue: "2026" }), field("pages", "Pages", { placeholder: "12-15" }), field("style", "Style", { kind: "select", options: ["apa", "mla", "chicago"], defaultValue: "apa" })]);
const quoteConfig = makeConfig("quote-counter", "Quote Word / Character Counter", "Counts Unicode code points and words locally; no text leaves the device.", "Count quote", [field("text", "Quote or passage", { kind: "textarea", rows: 10 })]);
const timelineConfig = makeConfig("timeline-sorter", "Timeline Sorter", "Sorts recognized dates and keeps invalid records visible in a separate list.", "Sort timeline", [field("records", "Timeline records (JSON array or one object per line)", { kind: "textarea", rows: 10 }), field("direction", "Direction", { kind: "select", options: ["ascending", "descending"], defaultValue: "ascending" })]);
const dateConfig = makeConfig("date-source-normalizer", "Date Source Normalizer", "Normalizes only supported source formats and preserves the declared precision.", "Normalize date", [field("value", "Date", { placeholder: "2026-09-24 or 24 September 2026" }), field("dayFirst", "Day-first numeric dates", { kind: "select", options: ["false", "true"], defaultValue: "false" })]);
const urlConfig = makeConfig("research-url-cleaner", "Research URL Cleaner", "Removes common tracking keys and sorts remaining query keys without fetching the URL.", "Clean URL", [field("url", "Research URL", { placeholder: "https://example.org/paper?utm_source=note" })]);
const domainConfig = makeConfig("domain-frequency-counter", "Domain / Source Frequency Counter", "Normalizes each source locally and reports deterministic domain counts.", "Count domains", [field("urls", "URLs (one per line)", { kind: "textarea", rows: 10, placeholder: "https://example.org/a\nhttps://example.org/b" })]);
const evidenceConfig = makeConfig("evidence-table-builder", "Evidence Table Builder", "Writes a fixed-column CSV with RFC-style quoting from supplied records.", "Build evidence table", [field("records", "Evidence records (JSON array or one object per line)", { kind: "textarea", rows: 10 })]);
const notesConfig = makeConfig("notes-deduplicator", "Notes Deduplicator", "Normalizes whitespace and case for identity while keeping the first note.", "Deduplicate notes", [field("notes", "Notes (JSON array or one per line)", { kind: "textarea", rows: 10 })]);
const vocabularyConfig = makeConfig("vocabulary-frequency-analyzer", "Vocabulary / Frequency Analyzer", "Counts normalized terms with a small fixed stop-word policy and deterministic ordering.", "Analyze vocabulary", [field("text", "Text", { kind: "textarea", rows: 10 }), field("minLength", "Minimum term length", { defaultValue: "1" }), field("limit", "Maximum terms", { defaultValue: "50" })]);
const readingConfig = makeConfig("reading-list-deduplicator", "Reading List Deduplicator", "Uses DOI, ISBN, URL, then normalized title-author-year identity.", "Deduplicate reading list", [field("records", "Reading-list records (JSON array or one object per line)", { kind: "textarea", rows: 10 })]);
const packConfig = makeConfig("research-pack-manifest", "Research Pack Manifest", "Sorts and checksums a named local tool list; it does not resolve catalog entries.", "Create manifest", [field("name", "Pack name", { defaultValue: "Research basics" }), field("tools", "Tool IDs (one per line)", { kind: "textarea", rows: 7, defaultValue: "doi-normalizer\nquote-counter" })]);

export function DoiNormalizerTool() { return <ResearchKnowledgeTool config={doiConfig} />; }
export function DoiLinkBuilderTool() { return <ResearchKnowledgeTool config={linkConfig} />; }
export function IsbnValidatorConverterTool() { return <ResearchKnowledgeTool config={isbnConfig} />; }
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
