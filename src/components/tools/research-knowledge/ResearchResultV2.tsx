import { useEffect, useMemo, useState } from "preact/hooks";
import { createBoundedTablePreview, createBoundedTextPreview } from "../../../runtime/bounded-preview";
import { compatibleHandoffTargets, openHandoffTarget, type TableHandoffEnvelope } from "../../../runtime/handoff";
import { createOutputArtifactDescriptor, type OutputArtifactDescriptor } from "../../../runtime/output-artifact";
import { resolveResultActions } from "../../../runtime/result-actions";
import { handoffCatalog } from "../../../generated/handoff-catalog";
import { partitaIvaResultRows } from "./partita-iva-rows";
import {
  researchResultV2Definition,
  type ResearchResultV2ToolId,
} from "../../../tools/research-result-v2";
import {
  BoundedTableResultPreview,
  BoundedTextResultPreview,
  ResultActions,
  ResultBreakdown,
  ResultInterpretation,
  ResultPrimaryAnswer,
  ResultProvenance,
} from "../shared";

interface ResearchResultRow {
  readonly label: string;
  readonly value: string;
}

interface ResearchResultTable {
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

const RESEARCH_TABLE_HANDOFF_IDS = new Set<ResearchResultV2ToolId>([
  "citation-deduplicator",
  "citation-key-generator",
  "evidence-table-builder",
  "reading-list-deduplicator",
  "reference-list-sorter",
]);

function csvCell(value: string): string {
  const safe = /^[\u0000-\u0020]*[=+\-@]/u.test(value) ? `'${value}` : value;
  return /[",\n\r]/u.test(safe) ? `"${safe.replace(/"/gu, '""')}"` : safe;
}

function csvFromTable(table: ResearchResultTable): string {
  return [
    table.headers.map(csvCell).join(","),
    ...table.rows.map((row) => table.headers.map((_header, index) => csvCell(row[index] ?? "")).join(",")),
  ].join("\n");
}

function tableHandoff(table: ResearchResultTable, payload: string): TableHandoffEnvelope {
  return {
    descriptor: {
      type: "table",
      format: "csv",
      version: 1,
      encoding: "utf-8",
      bytes: new TextEncoder().encode(payload).byteLength,
      rowCount: table.rows.length,
      columnCount: table.headers.length,
      columns: [...table.headers],
      duplicateHeaders: new Set(table.headers).size !== table.headers.length,
      raggedRows: table.rows.some((row) => row.length !== table.headers.length),
    },
    payload,
  };
}

interface PositionedWarning {
  readonly message: string;
  readonly record?: number;
}

export interface ResearchResultPresentation {
  readonly fullText: string;
  readonly filename: string;
  readonly mime: string;
  readonly headline: string;
  readonly interpretation: string;
  readonly interpretationState: "success" | "warning" | "error" | "info";
  readonly summaryRows: readonly ResearchResultRow[];
  readonly warnings: readonly PositionedWarning[];
  readonly table: ResearchResultTable | null;
  readonly reuseText: string | null;
  readonly valid: boolean | null;
}

function recordOf(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringField(record: Record<string, unknown>, key: string): string | null {
  return typeof record[key] === "string" ? record[key] as string : null;
}

function numberField(record: Record<string, unknown>, key: string): number | null {
  return typeof record[key] === "number" && Number.isFinite(record[key]) ? record[key] as number : null;
}

function booleanField(record: Record<string, unknown>, key: string): boolean | null {
  return typeof record[key] === "boolean" ? record[key] as boolean : null;
}

function arrayOfRecords(value: unknown): readonly Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null && !Array.isArray(entry));
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string") ? value : [];
}

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2) ?? "";
}

function compactRows(rows: readonly (ResearchResultRow | null)[]): readonly ResearchResultRow[] {
  return rows.filter((entry): entry is ResearchResultRow => entry !== null);
}

function row(label: string, value: unknown): ResearchResultRow | null {
  if (typeof value === "number" && Number.isFinite(value)) return { label, value: String(value) };
  if (typeof value === "string" && value !== "") return { label, value };
  if (typeof value === "boolean") return { label, value: value ? "Sì" : "No" };
  return null;
}

function warningsOf(result: Record<string, unknown>): readonly PositionedWarning[] {
  const warnings = result.warnings;
  if (!Array.isArray(warnings)) return [];
  return warnings.flatMap((entry): PositionedWarning[] => {
    if (typeof entry === "string") return entry.trim() === "" ? [] : [{ message: entry.trim() }];
    const item = recordOf(entry);
    const message = stringField(item, "message");
    if (message === null || message.trim() === "") return [];
    const record = numberField(item, "record");
    return [{ message: message.trim(), ...(record !== null && Number.isInteger(record) && record > 0 ? { record } : {}) }];
  });
}

function citationAuthor(record: Record<string, unknown>): string {
  const authors = record.authors;
  if (Array.isArray(authors)) return authors.filter((entry): entry is string => typeof entry === "string").join("; ");
  return stringField(record, "author") ?? (typeof authors === "string" ? authors : "");
}

function citationRows(records: readonly Record<string, unknown>[]): readonly (readonly string[])[] {
  return records.map((record) => [
    stringField(record, "title") ?? "",
    citationAuthor(record),
    String(record.year ?? ""),
    stringField(record, "doi") ?? "",
    stringField(record, "isbn") ?? "",
    stringField(record, "url") ?? "",
  ]);
}

function tablePresentation(tool: ResearchResultV2ToolId, result: Record<string, unknown>): ResearchResultTable | null {
  if (tool === "evidence-table-builder") {
    const headers = stringArray(result.headers);
    const rows = arrayOfRecords(result.rows).map((item) => headers.map((header) => String(item[header] ?? "")));
    return { headers, rows };
  }
  if (tool === "domain-frequency-counter") {
    return {
      headers: ["Dominio", "Occorrenze", "URL univoci"],
      rows: arrayOfRecords(result.domains).map((item) => [
        stringField(item, "domain") ?? "",
        String(numberField(item, "count") ?? 0),
        String(numberField(item, "uniqueUrls") ?? 0),
      ]),
    };
  }
  if (tool === "vocabulary-frequency-analyzer") {
    return {
      headers: ["Termine", "Occorrenze"],
      rows: arrayOfRecords(result.terms).map((item) => [
        stringField(item, "term") ?? "",
        String(numberField(item, "count") ?? 0),
      ]),
    };
  }
  if (tool === "citation-key-generator") {
    const records = arrayOfRecords(result.records);
    const keys = stringArray(result.keys);
    return {
      headers: ["Chiave", "Titolo", "Autore", "Anno"],
      rows: records.map((item, index) => [
        keys[index] ?? "",
        stringField(item, "title") ?? "",
        citationAuthor(item),
        String(item.year ?? ""),
      ]),
    };
  }
  if (tool === "timeline-sorter") {
    const records = arrayOfRecords(result.sorted);
    return {
      headers: ["Titolo", "Data", "Record"],
      rows: records.map((item) => [
        stringField(item, "title") ?? stringField(item, "name") ?? "",
        stringField(item, "date") ?? stringField(item, "when") ?? stringField(item, "timestamp") ?? "",
        JSON.stringify(item),
      ]),
    };
  }
  if (tool === "citation-deduplicator" || tool === "reading-list-deduplicator") {
    const unique = arrayOfRecords(result.unique);
    return { headers: ["Titolo", "Autore", "Anno", "DOI", "ISBN", "URL"], rows: citationRows(unique) };
  }
  if (tool === "reference-list-sorter") {
    const records = arrayOfRecords(result.records);
    return { headers: ["Titolo", "Autore", "Anno", "DOI", "ISBN", "URL"], rows: citationRows(records) };
  }
  return null;
}

function notesText(result: Record<string, unknown>): string {
  const values = Array.isArray(result.unique) ? result.unique : [];
  return values.map((entry) => typeof entry === "string" ? entry : JSON.stringify(entry)).join("\n");
}

function canonicalValidatorReuse(tool: ResearchResultV2ToolId, result: Record<string, unknown>): string | null {
  if (booleanField(result, "valid") === false) return null;
  if (tool === "date-source-normalizer") return stringField(result, "iso");
  if (tool === "research-url-cleaner" || tool === "doi-link-builder") return stringField(result, "url");
  if (tool === "doi-normalizer") return stringField(result, "normalized");
  if (tool === "iban-validator") return stringField(result, "normalized");
  if (tool === "partita-iva-validator") return stringField(result, "normalized");
  if (tool === "isbn-validator-converter" || tool === "doi-isbn-normalizer") {
    return stringField(result, "isbn13") ?? stringField(result, "normalized") ?? stringField(result, "digits");
  }
  return null;
}

function artifactPayload(tool: ResearchResultV2ToolId, result: Record<string, unknown>, table: ResearchResultTable | null): { fullText: string; filename: string; mime: string } {
  if (tool === "bibtex-deduplicator" || tool === "bibtex-formatter") {
    return { fullText: stringField(result, "bibtex") ?? "", filename: `${tool}.bib`, mime: "text/plain" };
  }
  if (tool === "ris-bibtex-converter") {
    const bibtex = stringField(result, "bibtex");
    if (bibtex !== null) return { fullText: bibtex, filename: "bibliografia-convertita.bib", mime: "text/plain" };
    return { fullText: stringField(result, "ris") ?? "", filename: "bibliografia-convertita.ris", mime: "text/plain" };
  }
  if (tool === "evidence-table-builder") {
    return { fullText: stringField(result, "csv") ?? "", filename: "tabella-evidenze.csv", mime: "text/csv" };
  }
  if (table !== null && RESEARCH_TABLE_HANDOFF_IDS.has(tool)) {
    return { fullText: csvFromTable(table), filename: `${tool}.csv`, mime: "text/csv" };
  }
  if (tool === "pdf-page-citation-helper") {
    return { fullText: stringField(result, "citation") ?? "", filename: "citazione.txt", mime: "text/plain" };
  }
  if (tool === "quote-counter") {
    return { fullText: stringField(result, "normalized") ?? "", filename: "testo-normalizzato.txt", mime: "text/plain" };
  }
  if (tool === "notes-deduplicator") {
    return { fullText: notesText(result), filename: "note-uniche.txt", mime: "text/plain" };
  }
  return { fullText: prettyJson(result), filename: `${tool}-risultato.json`, mime: "application/json" };
}

function summaryRowsFor(tool: ResearchResultV2ToolId, result: Record<string, unknown>, table: ResearchResultTable | null): readonly ResearchResultRow[] {
  const rules = stringArray(result.rules);
  const generic = compactRows([
    row("Input", result.inputCount),
    row("Output", result.outputCount),
    row("Rimossi", result.removed),
    row("Collisioni", result.collisions),
    row("Record", result.entryCount ?? result.rowCount ?? table?.rows.length),
    row("Totale", result.total),
    row("Unici", result.unique),
    row("Non validi", result.invalidCount),
    row("Pagine", result.pageCount),
    row("Parole", result.words),
    row("Caratteri", result.characters),
    row("Righe", result.lines),
    row("Termini unici", tool === "vocabulary-frequency-analyzer" ? result.unique : undefined),
    row("Strumenti", result.count),
    row("Direzione", result.direction),
    row("Formato", result.kind),
    row("Confronto", result.comparator ?? result.comparison),
    row("Algoritmo checksum", result.checksumAlgorithm),
    row("Profilo stopword", result.stopwordProfile),
    rules.length === 0 ? null : row("Regole", rules.join(", ")),
  ]);
  if (tool === "domain-frequency-counter") return [...generic, ...compactRows([row("Domini", result.unique)])];
  if (tool === "evidence-table-builder") return [...generic, ...compactRows([row("Righe vuote", result.emptyRowCount)])];
  if (tool === "iban-validator") {
    const coordinates = recordOf(result.italianCoordinates);
    return [...generic, ...compactRows([
      row("IBAN normalizzato", result.normalized),
      row("Paese", result.countryCode),
      row("Lunghezza attesa", result.expectedLength),
      row("Regola non superata", result.failureRule),
      row("Resto MOD-97", result.mod97Remainder),
      row("CIN strutturale", coordinates.cin),
      row("ABI strutturale", coordinates.abi),
      row("CAB strutturale", coordinates.cab),
      row("Conto strutturale", coordinates.account),
      row("Esistenza conto verificata", result.accountVerified),
    ])];
  }
  if (tool === "partita-iva-validator") {
    return [...generic, ...compactRows(partitaIvaResultRows(result).map(([label, value]) => row(label, value)))];
  }
  return generic;
}

function headlineFor(tool: ResearchResultV2ToolId, result: Record<string, unknown>, table: ResearchResultTable | null): string {
  const definition = researchResultV2Definition(tool);
  if (definition.declaration.class === "validator") return booleanField(result, "valid") === false ? "Non valido" : "Valido";
  if (definition.declaration.class === "table") return `${table?.rows.length ?? 0} righe`;
  if (tool === "bibtex-formatter") return `${numberField(result, "entryCount") ?? arrayOfRecords(result.entries).length} voci BibTeX`;
  if (tool === "bibtex-deduplicator") return `${numberField(result, "outputCount") ?? 0} voci BibTeX uniche`;
  if (tool === "ris-bibtex-converter") return stringField(result, "direction") === "bibtex-to-ris" ? "RIS pronto" : "BibTeX pronto";
  if (tool === "pdf-page-citation-helper") return "Citazione pronta";
  if (tool === "quote-counter") return `${numberField(result, "words") ?? 0} parole`;
  if (tool === "notes-deduplicator") return `${numberField(result, "outputCount") ?? 0} note uniche`;
  return "Risultato pronto";
}

export function buildResearchResultPresentation(tool: ResearchResultV2ToolId, value: unknown): ResearchResultPresentation {
  const result = recordOf(value);
  const definition = researchResultV2Definition(tool);
  const table = tablePresentation(tool, result);
  const warnings = warningsOf(result);
  const artifact = artifactPayload(tool, result, table);
  const valid = definition.declaration.class === "validator" ? booleanField(result, "valid") : null;
  const canonicalReuse = canonicalValidatorReuse(tool, result);
  const reusableText = definition.reuseField === undefined
    ? null
    : canonicalReuse ?? (tool === "notes-deduplicator" || tool === "quote-counter" || tool === "bibtex-deduplicator" || tool === "bibtex-formatter" || tool === "ris-bibtex-converter"
      ? artifact.fullText
      : null);
  const hasWarnings = warnings.length > 0 || valid === false;
  return {
    ...artifact,
    headline: headlineFor(tool, result, table),
    interpretation: definition.declaration.class === "validator"
      ? valid === false
        ? "Il controllo formale locale non è superato. Nessun lookup o controllo remoto è stato eseguito."
        : "Il controllo formale locale è superato. Questo risultato non verifica metadati o registri remoti."
      : warnings.length > 0
        ? "Il risultato è completo, ma contiene avvisi di parsing o conversione da controllare."
        : "Elaborazione locale completata; copy e download usano l'output completo, non l'anteprima limitata.",
    interpretationState: hasWarnings ? "warning" : "success",
    summaryRows: summaryRowsFor(tool, result, table),
    warnings,
    table,
    reuseText: reusableText,
    valid,
  };
}

export function createResearchResultArtifact(presentation: ResearchResultPresentation): OutputArtifactDescriptor {
  const structured = presentation.mime === "application/json" || presentation.mime === "text/csv";
  return createOutputArtifactDescriptor({
    kind: structured ? "structured" : "text",
    name: presentation.filename,
    mime: presentation.mime,
    bytes: new TextEncoder().encode(presentation.fullText),
    verification: {
      state: "verified",
      verifiedMime: presentation.mime,
      method: "Serializzazione UTF-8 del risultato completo prodotto dal motore locale di ricerca",
    },
    fidelity: "lossless",
    fidelityNote: "Copy e download usano l'output completo. L'anteprima Result v2 è limitata soltanto per la visualizzazione.",
  });
}

export function researchResultProvenance(tool: ResearchResultV2ToolId): string {
  const definition = researchResultV2Definition(tool);
  return `Motore ${definition.engine} locale · rete vietata · binding oracle ${definition.oracleEntryId}. L'identità della fonte di prova viene dal manifest del tool, non dal contenuto inserito.`;
}

function downloadArtifact(artifact: OutputArtifactDescriptor): void {
  if (!artifact.download.ready) return;
  const url = URL.createObjectURL(new Blob([artifact.bytes.slice().buffer], { type: artifact.mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = artifact.download.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export interface ResearchResultV2Props {
  readonly tool: ResearchResultV2ToolId;
  readonly value: unknown;
  readonly onReuse?: ((field: string, text: string) => void) | undefined;
  readonly onRetry?: (() => void) | undefined;
  readonly onReset: () => void;
}

export function ResearchResultV2({ tool, value, onReuse, onRetry, onReset }: ResearchResultV2Props) {
  const [actionStatus, setActionStatus] = useState("");
  const definition = researchResultV2Definition(tool);
  const declaration = definition.declaration;
  const presentation = useMemo(() => buildResearchResultPresentation(tool, value), [tool, value]);
  const artifact = useMemo(() => createResearchResultArtifact(presentation), [presentation]);
  const handoff = useMemo(
    () => presentation.table !== null && presentation.mime === "text/csv" && RESEARCH_TABLE_HANDOFF_IDS.has(tool)
      ? tableHandoff(presentation.table, presentation.fullText)
      : null,
    [presentation, tool],
  );
  const handoffTargets = useMemo(
    () => handoff === null ? [] : compatibleHandoffTargets(handoff, handoffCatalog),
    [handoff],
  );
  const textPreview = useMemo(
    () => declaration.class === "text-code" || declaration.class === "validator"
      ? createBoundedTextPreview(artifact, 80, presentation.mime === "application/json" ? "code" : "text")
      : null,
    [artifact, declaration.class, presentation.mime],
  );
  const tablePreview = useMemo(
    () => declaration.class === "table" && presentation.table !== null
      ? createBoundedTablePreview(artifact, presentation.table.headers, presentation.table.rows, 50)
      : null,
    [artifact, declaration.class, presentation.table],
  );
  const actions = useMemo(() => resolveResultActions({
    declaration,
    primary: declaration.class === "table" ? "download" : presentation.fullText === "" ? null : "copy",
    hasCopyPayload: presentation.fullText !== "",
    artifact,
    reuseReady: presentation.reuseText !== null && definition.reuseField !== undefined && onReuse !== undefined,
    retryReady: declaration.class === "validator" && onRetry !== undefined,
    resetReady: true,
    ...(handoff === null ? {} : { handoff: { type: "table" as const, format: "csv" as const, compatibleTargets: handoffTargets.length } }),
  }), [artifact, declaration, definition.reuseField, handoff, handoffTargets.length, onRetry, onReuse, presentation.fullText, presentation.reuseText]);

  useEffect(() => setActionStatus(""), [value]);

  async function copyResult(): Promise<void> {
    if (navigator.clipboard === undefined) {
      setActionStatus("Gli appunti non sono disponibili; usa il download completo oppure seleziona l'anteprima.");
      return;
    }
    try {
      await navigator.clipboard.writeText(presentation.fullText);
      setActionStatus("Risultato completo copiato.");
    } catch {
      setActionStatus("Il browser ha bloccato gli appunti; usa il download completo oppure seleziona l'anteprima.");
    }
  }

  function reuseResult(): void {
    if (presentation.reuseText === null || definition.reuseField === undefined || onReuse === undefined) return;
    onReuse(definition.reuseField, presentation.reuseText);
    setActionStatus("Risultato riutilizzato come input locale.");
  }

  function handoffResult(): void {
    if (handoff === null) return;
    const proposal = handoffTargets[0];
    if (proposal === undefined) {
      setActionStatus("Nessuno strumento tabellare compatibile è disponibile.");
      return;
    }
    const opened = openHandoffTarget(proposal, handoff, { sourceToolId: tool });
    setActionStatus(opened
      ? `Aperto ${proposal.target.name}; il CSV completo resta nella memoria delle due finestre.`
      : "Il browser ha bloccato la nuova finestra. Consenti i popup e riprova.");
  }

  const provenance = researchResultProvenance(tool);

  return (
    <div data-result-class={declaration.class} data-research-result-tool={tool}>
      {declaration.class === "validator" && (
        <>
          <div data-result-slot="primary"><ResultPrimaryAnswer label="Esito">{presentation.headline}</ResultPrimaryAnswer></div>
          <div data-result-slot="interpretation"><ResultInterpretation state={presentation.valid === false ? "warning" : "success"}>{presentation.interpretation}</ResultInterpretation></div>
          <div data-result-slot="checks">
            <ResultBreakdown rows={[
              ...presentation.summaryRows,
              { label: "Avvisi", value: String(presentation.warnings.length) },
              { label: "Rete", value: "Non usata" },
            ]} />
          </div>
          <div data-result-slot="provenance" data-oracle-entry={definition.oracleEntryId}><ResultProvenance>{provenance}</ResultProvenance></div>
          {textPreview !== null && <BoundedTextResultPreview preview={textPreview} />}
        </>
      )}

      {declaration.class === "text-code" && (
        <>
          <ResultPrimaryAnswer>{presentation.headline}</ResultPrimaryAnswer>
          {presentation.warnings.length > 0 && <ResultInterpretation state="warning">{presentation.interpretation}</ResultInterpretation>}
          <div data-result-slot="selectable-output">{textPreview !== null && <BoundedTextResultPreview preview={textPreview} />}</div>
          <div data-result-slot="counts"><ResultBreakdown rows={[
            ...presentation.summaryRows,
            { label: "Avvisi", value: String(presentation.warnings.length) },
            { label: "Byte output completo", value: String(artifact.byteLength) },
          ]} /></div>
          <div data-oracle-entry={definition.oracleEntryId}><ResultProvenance>{provenance}</ResultProvenance></div>
        </>
      )}

      {declaration.class === "table" && (
        <>
          <div data-result-slot="summary"><ResultPrimaryAnswer label="Tabella">{presentation.headline}</ResultPrimaryAnswer></div>
          <div data-result-slot="issue-counts"><ResultBreakdown rows={[
            ...presentation.summaryRows,
            { label: "Avvisi", value: String(presentation.warnings.length) },
            { label: "Errori", value: "0" },
          ]} /></div>
          <div data-result-slot="table-preview">{tablePreview !== null && <BoundedTableResultPreview preview={tablePreview} />}</div>
          <div data-oracle-entry={definition.oracleEntryId}><ResultProvenance>{provenance}</ResultProvenance></div>
        </>
      )}

      {presentation.warnings.length > 0 && <ul class="file-note" aria-label="Avvisi del risultato">
        {presentation.warnings.slice(0, 10).map((warning, index) => (
          <li key={`${warning.record ?? "x"}-${warning.message}-${index}`}>{warning.record === undefined ? warning.message : `Record ${warning.record}: ${warning.message}`}</li>
        ))}
      </ul>}

      <ResultActions
        actions={actions}
        onAction={{
          copy: copyResult,
          download: () => downloadArtifact(artifact),
          reuse: reuseResult,
          handoff: handoffResult,
          ...(onRetry === undefined ? {} : { retry: onRetry }),
          reset: onReset,
        }}
      />
      {actionStatus !== "" && <p class="success" role="status" aria-live="polite">{actionStatus}</p>}
    </div>
  );
}
