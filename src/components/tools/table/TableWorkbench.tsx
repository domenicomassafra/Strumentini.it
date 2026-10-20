import { useEffect, useMemo, useState } from "preact/hooks";
import { readBlobText } from "../../../engines/table/csv";
import { readTableBlobBytes } from "../../../engines/table/operations";
import { handoffCatalog } from "../../../generated/handoff-catalog";
import { compatibleHandoffTargets, openHandoffTarget, receiveHandoffFromOpener } from "../../../runtime/handoff";
import { resolveResultActions } from "../../../runtime/result-actions";
import { toolRuntime } from "../../../runtime/tool-runtime";
import type { ToolSummary } from "../../../catalog/manifest";
import type { FactoryToolManifest } from "../../../tool-factory/manifest";
import { TOOL_COPY_IT } from "../../../i18n/it/tool-copy";
import {
  BoundedTableResultPreview,
  InlineError,
  ResultActions,
  ResultBreakdown,
  ResultInterpretation,
  ResultPrimaryAnswer,
  ToolActions,
  ToolCancelButton,
  ToolFormCard,
  ToolOperation,
  ToolResetButton,
  ToolResultPanel,
  ToolSubmitButton,
  gutterStateFor,
  useToolOperation,
} from "../shared";
import { CONTROL, it } from "../shared/controlLabels";
import { TableTransformDiff388 } from "./TableTransformDiff388";
import { resultSummary } from "./TableSummary388";
import {
  acceptsCsvTable,
  buildTableResultV2Model,
  emitsCsvTable,
  type TableWorkbenchMode,
} from "./table-result-v2";

export type { TableWorkbenchMode } from "./table-result-v2";
export interface TableWorkbenchProps {
  toolId: string;
  title: string;
  description: string;
  mode: TableWorkbenchMode;
  manifest: ToolSummary | FactoryToolManifest;
  inputLabel?: string;
  secondaryLabel?: string;
  defaultText?: string;
}

interface WorkbenchResult {
  [key: string]: unknown;
  output?: string;
  json?: string;
  svg?: string;
  points?: Array<{ label: string; value: number }>;
  headers?: string[];
  previewRows?: string[][];
  sqlPreview?: string;
  sqlPreviewTruncated?: boolean;
  chunks?: Array<{ index: number; filename: string; content: string; rowCount: number; bytes: number }>;
  changedCells?: Array<{ key: string[]; leftRow: number; rightRow: number; leftColumnName: string; rightColumnName: string; leftValue: string; rightValue: string }>;
  ambiguousKeys?: Array<{ key: string[]; leftRows: number[]; rightRows: number[] }>;
}

type OptionValue = string | boolean;

const OPERATORS = ["equals", "not-equals", "contains", "not-contains", "starts-with", "ends-with", "regex", "empty", "not-empty"] as const;
const COMPARATORS = ["lexical", "numeric", "date"] as const;
const AGGREGATES = ["count", "sum", "min", "max"] as const;
const JOIN_TYPES = ["inner", "left", "right", "full"] as const;

const OPERATOR_LABELS: Readonly<Record<string, string>> = {
  equals: "Uguale a",
  "not-equals": "Diverso da",
  contains: "Contiene",
  "not-contains": "Non contiene",
  "starts-with": "Inizia con",
  "ends-with": "Finisce con",
  regex: "Espressione regolare",
  empty: "Vuoto",
  "not-empty": "Non vuoto",
};

const COMPARATOR_LABELS: Readonly<Record<string, string>> = {
  lexical: "Testuale",
  numeric: "Numerico",
  date: "Data",
};

const AGGREGATE_LABELS: Readonly<Record<string, string>> = {
  count: "Conteggio",
  sum: "Somma",
  min: "Minimo",
  max: "Massimo",
};

const JOIN_LABELS: Readonly<Record<string, string>> = {
  inner: "Solo corrispondenze",
  left: "Tutte le righe di sinistra",
  right: "Tutte le righe di destra",
  full: "Tutte le righe",
};

function defaultOptions(mode: TableWorkbenchMode): Record<string, OptionValue> {
  switch (mode) {
    case "selector": return { columns: "0" };
    case "filter": return { column: "0", operator: "contains", value: "", caseSensitive: false, nullTokens: "NULL", emptyAsNull: true };
    case "sort": return { column: "0", direction: "asc", comparator: "lexical", nulls: "last", caseSensitive: true, nullTokens: "NULL", emptyAsNull: true };
    case "group-count": return { groupColumns: "0", countColumn: "", aggregate: "count", caseSensitive: true, nullTokens: "NULL", emptyAsNull: true };
    case "join": return { leftKeyColumns: "0", rightKeyColumns: "0", joinType: "inner", caseSensitive: true, suffix: "_right", nullTokens: "NULL", emptyAsNull: true, nullKeyPolicy: "never-match" };
    case "pivot": return { groupColumns: "0", valueColumn: "", valueHeaderColumn: "", aggregateColumn: "", aggregate: "count", caseSensitive: true, nullTokens: "NULL", emptyAsNull: true };
    case "to-json": return { headerPolicy: "unique", pretty: false };
    case "from-json": return { headerMode: "first" };
    case "encoding": return { encoding: "" };
    case "duplicate-profile": return { keyColumns: "", maxExamples: "100" };
    case "chart": return { labelColumn: "0", valueColumn: "", aggregate: "count", maxBars: "30" };
    case "sql": return { dialect: "postgresql", tableName: "imported_data", typeOverrides: "", nullTokens: "NULL", emptyAsNull: false, includeCreateTable: true };
    case "split": return { splitMode: "rows", rowsPerChunk: "10000", targetKilobytes: "2048" };
    case "compare": return { leftKeyColumns: "0", rightKeyColumns: "0", leftCompareColumns: "1", rightCompareColumns: "1", caseSensitive: true, nullTokens: "NULL", emptyAsNull: true };
    default: return {};
  }
}

function numberOption(value: OptionValue | undefined, fallback: number): number {
  if (typeof value !== "string" || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error("Inserisci un numero valido.");
  return parsed;
}

function optionalNumberOption(value: OptionValue | undefined): number | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error("Inserisci un numero valido.");
  return parsed;
}

function parseIndexes(value: OptionValue | undefined): number[] | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const indexes = value.split(",").map((item) => item.trim()).filter((item) => item !== "").map(Number);
  if (indexes.length === 0 || indexes.some((item) => !Number.isInteger(item) || item < 0)) throw new Error("Le posizioni delle colonne devono essere numeri interi maggiori o uguali a zero.");
  return indexes;
}

function requiredIndexes(value: OptionValue | undefined): number[] {
  const indexes = parseIndexes(value);
  if (indexes === undefined) throw new Error("Inserisci almeno una posizione di colonna.");
  return indexes;
}

function stringList(value: OptionValue | undefined, fallback: readonly string[]): string[] {
  if (typeof value !== "string" || value.trim() === "") return [...fallback];
  return value.split(",").map((item) => item.trim());
}

function sqlTypeOverrides(value: OptionValue | undefined): Record<number, string> | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const output: Record<number, string> = {};
  for (const entry of value.split(",")) {
    const [rawIndex, rawType, ...extra] = entry.split(":").map((item) => item.trim());
    const index = Number(rawIndex);
    if (extra.length > 0 || rawType === undefined || !Number.isInteger(index) || index < 0 || !["text", "integer", "real", "boolean", "date"].includes(rawType)) {
      throw new Error("Usa il formato colonna:tipo, per esempio 0:text,2:date.");
    }
    output[index] = rawType;
  }
  return output;
}

function inputFor(mode: TableWorkbenchMode, text: string, secondaryText: string, bytes: Uint8Array | null, sourceBlob: Blob | null, options: Record<string, OptionValue>): Record<string, unknown> {
  switch (mode) {
    case "encoding": return { bytes: bytes ?? new TextEncoder().encode(text), ...(typeof options.encoding === "string" && options.encoding !== "" ? { encoding: options.encoding } : {}) };
    case "selector": return { text, columns: requiredIndexes(options.columns) };
    case "filter": return { text, column: numberOption(options.column, 0), operator: options.operator, value: options.value, caseSensitive: options.caseSensitive === true, nullTokens: stringList(options.nullTokens, ["NULL"]), emptyAsNull: options.emptyAsNull === true };
    case "sort": return { text, column: numberOption(options.column, 0), direction: options.direction, comparator: options.comparator, nulls: options.nulls, caseSensitive: options.caseSensitive === true, nullTokens: stringList(options.nullTokens, ["NULL"]), emptyAsNull: options.emptyAsNull === true };
    case "group-count": {
      const countColumn = optionalNumberOption(options.countColumn);
      return { text, groupColumns: requiredIndexes(options.groupColumns), ...(countColumn === undefined ? {} : { countColumn }), aggregate: options.aggregate, caseSensitive: options.caseSensitive === true, nullTokens: stringList(options.nullTokens, ["NULL"]), emptyAsNull: options.emptyAsNull === true };
    }
    case "join": return { leftText: text, rightText: secondaryText, leftKeyColumns: requiredIndexes(options.leftKeyColumns), rightKeyColumns: requiredIndexes(options.rightKeyColumns), joinType: options.joinType, caseSensitive: options.caseSensitive === true, suffix: options.suffix, nullTokens: stringList(options.nullTokens, ["NULL"]), emptyAsNull: options.emptyAsNull === true, nullKeyPolicy: options.nullKeyPolicy };
    case "compare": return { leftText: text, rightText: secondaryText, leftKeyColumns: requiredIndexes(options.leftKeyColumns), rightKeyColumns: requiredIndexes(options.rightKeyColumns), leftCompareColumns: requiredIndexes(options.leftCompareColumns), rightCompareColumns: requiredIndexes(options.rightCompareColumns), caseSensitive: options.caseSensitive === true, nullTokens: stringList(options.nullTokens, ["NULL"]), emptyAsNull: options.emptyAsNull === true };
    case "sql": {
      const overrides = sqlTypeOverrides(options.typeOverrides);
      return { text, dialect: options.dialect, tableName: options.tableName, ...(overrides === undefined ? {} : { typeOverrides: overrides }), nullTokens: stringList(options.nullTokens, ["NULL"]), emptyAsNull: options.emptyAsNull === true, includeCreateTable: options.includeCreateTable === true };
    }
    case "split": return { ...(sourceBlob === null ? { text } : { file: sourceBlob }), mode: options.splitMode, rowsPerChunk: numberOption(options.rowsPerChunk, 10_000), targetBytes: Math.round(numberOption(options.targetKilobytes, 2048) * 1024) };
    case "pivot": {
      const valueColumn = optionalNumberOption(options.valueColumn);
      const valueHeaderColumn = optionalNumberOption(options.valueHeaderColumn);
      const aggregateColumn = optionalNumberOption(options.aggregateColumn);
      return { text, groupColumns: requiredIndexes(options.groupColumns), ...(valueColumn === undefined ? {} : { valueColumn }), ...(valueHeaderColumn === undefined ? {} : { valueHeaderColumn }), ...(aggregateColumn === undefined ? {} : { aggregateColumn }), aggregate: options.aggregate, caseSensitive: options.caseSensitive === true, nullTokens: stringList(options.nullTokens, ["NULL"]), emptyAsNull: options.emptyAsNull === true };
    }
    case "to-json": return { text, headerPolicy: options.headerPolicy, pretty: options.pretty === true };
    case "from-json": return { json: text, headerMode: options.headerMode };
    case "duplicate-profile": {
      const keyColumns = parseIndexes(options.keyColumns);
      return { text, ...(keyColumns === undefined ? {} : { keyColumns }), maxExamples: numberOption(options.maxExamples, 100) };
    }
    case "chart": {
      const valueColumn = optionalNumberOption(options.valueColumn);
      return { text, labelColumn: numberOption(options.labelColumn, 0), ...(valueColumn === undefined ? {} : { valueColumn }), aggregate: options.aggregate, maxBars: numberOption(options.maxBars, 30) };
    }
    default: return { text };
  }
}


function isPoints(value: unknown): value is Array<{ label: string; value: number }> {
  return Array.isArray(value) && value.every((point) => typeof point === "object" && point !== null && typeof (point as { label?: unknown }).label === "string" && typeof (point as { value?: unknown }).value === "number");
}

/** A role=img hides its descendants from the accessibility tree: name the data, not only the chart. */
export function TableAccessibleChart({
  publicTitle, points, maxPoint,
}: {
  readonly publicTitle: string;
  readonly points: readonly { readonly label: string; readonly value: number }[];
  readonly maxPoint: number;
}) {
  const series = points.map((point) => `${point.label}: ${point.value}`).join("; ");
  return <div class="table-chart" role="img" aria-label={`Grafico: ${publicTitle}${points.length > 0 ? `. ${series}` : ""}`}>
    {points.map((point) => <div class="table-chart-row" key={point.label}>
      <span>{point.label}</span>
      <div class="table-chart-track"><div class="table-chart-bar" style={{ width: `${Math.max(1, Math.round(Math.abs(point.value) / maxPoint * 100))}%` }} /></div>
      <strong>{point.value}</strong>
    </div>)}
  </div>;
}

type ProfileColumn = Record<string, unknown> & { name: string };
type DuplicateGroup = { rowNumber?: number; count: number; values: string[] };

function isProfileColumns(value: unknown): value is ProfileColumn[] {
  return Array.isArray(value) && value.every((column) => typeof column === "object" && column !== null && typeof (column as { name?: unknown }).name === "string");
}

function isDuplicateGroups(value: unknown): value is DuplicateGroup[] {
  return Array.isArray(value) && value.every((group) => typeof group === "object" && group !== null && typeof (group as { count?: unknown }).count === "number" && Array.isArray((group as { values?: unknown }).values));
}

const TYPE_LABELS: Readonly<Record<string, string>> = {
  empty: "Vuoto",
  string: "Testo",
  number: "Numero",
  boolean: "Booleano",
  date: "Data",
  mixed: "Misto",
};

export function TableWorkbench({ toolId, title: _title, description: _description, mode, manifest, inputLabel: _inputLabel, secondaryLabel: _secondaryLabel, defaultText = "" }: TableWorkbenchProps) {
  const [text, setText] = useState(defaultText);
  const [submittedText, setSubmittedText] = useState(defaultText);
  const [secondaryText, setSecondaryText] = useState("");
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [sourceBlob, setSourceBlob] = useState<Blob | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const [undoText388, setUndoText388] = useState<string | null>(null);
  const [options, setOptions] = useState<Record<string, OptionValue>>(() => defaultOptions(mode));
  const initialOptions = useMemo(() => defaultOptions(mode), [mode]);
  const operation = useToolOperation<WorkbenchResult>((signal) => toolRuntime.run(toolId, inputFor(mode, text, secondaryText, bytes, sourceBlob, options), {}, signal));
  function invalidate() { operation.reset(); setActionStatus(""); }

  useEffect(() => {
    setOptions(initialOptions);
  }, [initialOptions]);

  useEffect(() => receiveHandoffFromOpener(manifest as unknown as ToolSummary, (envelope) => {
    setText(envelope.payload);
    setSubmittedText(envelope.payload);
    setSecondaryText("");
    setBytes(null);
    setSourceBlob(null);
    setFileName(`Tabella ricevuta · ${envelope.descriptor.rowCount} righe`);
    setUndoText388(null);
    invalidate();
  }), [manifest, operation]);

  function setOption(key: string, value: OptionValue) {
    setOptions((current) => ({ ...current, [key]: value }));
    setUndoText388(null);
    invalidate();
  }

  async function loadFile(file: File | undefined) {
    if (file === undefined) return;
    setFileError("");
    setUndoText388(null);
    invalidate();
    try {
      if (mode === "split") {
        setSourceBlob(file);
        setBytes(null);
        setText("");
      } else if (mode === "encoding") {
        setSourceBlob(null);
        setBytes(await readTableBlobBytes(file));
        setText("");
      } else {
        setSourceBlob(null);
        setText(await readBlobText(file));
        setBytes(null);
      }
      setFileName(`${file.name} · ${(file.size / 1024).toFixed(1)} KiB`);
    } catch (caught) {
      setFileName("");
      setFileError("Impossibile leggere il file selezionato.");
      operation.reset();
    }
  }

  function reset() {
    setText(defaultText);
    setSubmittedText(defaultText);
    setSecondaryText("");
    setBytes(null);
    setSourceBlob(null);
    setFileName("");
    setFileError("");
    setUndoText388(null);
    invalidate();
    setOptions(initialOptions);
  }

  function submit(event: Event) {
    event.preventDefault();
    setSubmittedText(text);
    setActionStatus("");
    void operation.run();
  }

  const result = operation.result;
  const summary = resultSummary(result);
  const points = result !== null && isPoints(result.points) ? result.points : [];
  const profileColumns = result !== null && isProfileColumns(result.columns) ? result.columns : [];
  const duplicateGroups = result !== null && isDuplicateGroups(result.groups) ? result.groups : [];
  const splitChunks = result?.chunks ?? [];
  const changedCells = result?.changedCells ?? [];
  const ambiguousKeys = result?.ambiguousKeys ?? [];
  const maxPoint = Math.max(1, ...points.map((point) => Math.abs(point.value)));
  const publicTitle = TOOL_COPY_IT[toolId]?.name ?? toolId;
  const publicDescription = TOOL_COPY_IT[toolId]?.summary ?? "";
  const primaryInputLabel = mode === "from-json" ? "JSON" : mode === "encoding" ? "Testo o file da ricodificare" : mode === "join" || mode === "compare" ? "Prima tabella CSV" : "CSV o testo tabellare";
  const publicError = operation.error;
  const declaration = manifest.result;
  if (declaration === undefined || declaration.class !== "table") {
    throw new Error(`${toolId}: TableWorkbench richiede result.class=table.`);
  }
  const resultModel = useMemo(
    () => result === null ? null : buildTableResultV2Model(toolId, mode, result, submittedText),
    [mode, result, submittedText, toolId],
  );
  const canEmitCsv = emitsCsvTable(manifest.handoff);
  const canAcceptCsv = acceptsCsvTable(manifest.handoff);
  const handoffTargets = useMemo(
    () => resultModel === null || !canEmitCsv
      ? []
      : compatibleHandoffTargets(resultModel.handoff, handoffCatalog.filter((target) => target.id !== toolId)),
    [canEmitCsv, resultModel, toolId],
  );
  const preferredHandoffTargets = useMemo(
    () => handoffTargets.toSorted((left, right) => {
      const conversionPriority = (id: string) => /(?:json|sql|xlsx)/u.test(id) ? 0 : 1;
      return conversionPriority(left.target.id) - conversionPriority(right.target.id)
        || left.target.name.localeCompare(right.target.name, "it-IT");
    }),
    [handoffTargets],
  );
  const resultActions = resultModel === null
    ? []
    : resolveResultActions({
        declaration,
        primary: "download",
        hasCopyPayload: resultModel.exportPayload !== "",
        artifact: resultModel.exportArtifact,
        reuseReady: canEmitCsv && canAcceptCsv && resultModel.reusePayload !== null,
        resetReady: true,
        ...(canEmitCsv ? { handoff: { type: "table" as const, format: "csv" as const, compatibleTargets: handoffTargets.length } } : {}),
      });

  async function copyResult() {
    if (resultModel === null || resultModel.exportPayload === "" || navigator.clipboard === undefined) {
      setActionStatus("Gli appunti non sono disponibili; usa il download completo oppure seleziona l'anteprima.");
      return;
    }
    try {
      await navigator.clipboard.writeText(resultModel.exportPayload);
      setActionStatus("Risultato completo copiato.");
    } catch {
      setActionStatus("Il browser ha bloccato gli appunti; usa il download completo oppure seleziona l'anteprima.");
    }
  }

  function downloadResult() {
    if (resultModel === null || !resultModel.exportArtifact.download.ready) return;
    const artifact = resultModel.exportArtifact;
    const url = URL.createObjectURL(new Blob([artifact.bytes.slice().buffer], { type: artifact.mime }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = artifact.name;
    anchor.click();
    URL.revokeObjectURL(url);
    setActionStatus(`Scaricato il risultato completo: ${artifact.name}.`);
  }

  function downloadSplitChunk(chunk: { filename: string; content: string }) {
    const url = URL.createObjectURL(new Blob([chunk.content], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = chunk.filename;
    anchor.click();
    URL.revokeObjectURL(url);
    setActionStatus(`Scaricata ${chunk.filename}.`);
  }

  function reuseResult() {
    if (resultModel?.reusePayload === null || resultModel === null) return;
    if (mode === "sort" || mode === "filter") setUndoText388(text);
    setText(resultModel.reusePayload);
    setSubmittedText(resultModel.reusePayload);
    setSecondaryText("");
    setBytes(null);
    setSourceBlob(null);
    invalidate();
    setFileName("Risultato completo riutilizzato come nuovo input locale.");
  }

  function undo388() {
    if (undoText388 === null) return;
    setText(undoText388);
    setSubmittedText(undoText388);
    setUndoText388(null);
    invalidate();
    setFileName("Ripristinato il CSV originale, senza perdita dei valori.");
  }

  function handoffResult(proposal = preferredHandoffTargets[0]) {
    if (resultModel === null) return;
    if (proposal === undefined) {
      setActionStatus("Nessuno strumento compatibile è disponibile per questa tabella.");
      return;
    }
    const opened = openHandoffTarget(proposal, resultModel.handoff, { sourceToolId: toolId });
    setActionStatus(opened
      ? `Aperto ${proposal.target.name}; il payload completo resta solo nella memoria delle due finestre.`
      : "Il browser ha bloccato la nuova finestra. Consenti i popup e riprova.");
  }

  return <ToolOperation className="table-workbench" busy={operation.isRunning}>
    <ToolFormCard>
      <form onSubmit={submit}>
        <p class="file-note">{publicDescription}</p>
        <label class="field"><span>{primaryInputLabel}</span><textarea rows={8} value={text} onInput={(e) => { setText(e.currentTarget.value); setBytes(null); setSourceBlob(null); setUndoText388(null); invalidate(); }} placeholder="Incolla un testo tabellare oppure scegli un file." /></label>
        {(mode === "join" || mode === "compare") && <label class="field"><span>Seconda tabella CSV</span><textarea rows={8} value={secondaryText} onInput={(e) => { setSecondaryText(e.currentTarget.value); invalidate(); }} placeholder="Incolla la seconda tabella CSV." /></label>}
        <label class="field"><span>File · facoltativo</span><input type="file" accept={mode === "encoding" ? ".csv,.txt,.tsv,text/plain" : mode === "from-json" ? ".json,application/json" : ".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain,application/json"} onChange={(event) => void loadFile(event.currentTarget.files?.[0])} /></label>
        {fileName && <p class="file-note" role="status">{fileName}</p>}
        {(mode === "sort" || mode === "filter") && undoText388 !== null && <button type="button" data-str388-undo onClick={undo388}>Annulla ultima applicazione</button>}
        {mode === "selector" && <label class="field"><span>Posizioni colonne (da zero, separate da virgola)</span><input value={String(options.columns ?? "")} onInput={(event) => setOption("columns", event.currentTarget.value)} /></label>}
        {mode === "filter" && <div class="table-control-grid"><label class="field"><span>Posizione colonna</span><input type="number" min="0" value={String(options.column ?? "0")} onInput={(event) => setOption("column", event.currentTarget.value)} /></label><label class="field"><span>Operatore</span><select value={String(options.operator ?? "contains")} onChange={(event) => setOption("operator", event.currentTarget.value)}>{OPERATORS.map((operator) => <option value={operator}>{OPERATOR_LABELS[operator]}</option>)}</select></label><label class="field"><span>Valore</span><input value={String(options.value ?? "")} onInput={(event) => setOption("value", event.currentTarget.value)} /></label><label class="field"><span>Token NULL · separati da virgola</span><input value={String(options.nullTokens ?? "NULL")} onInput={(event) => setOption("nullTokens", event.currentTarget.value)} /></label><label class="choice-line"><input type="checkbox" checked={options.emptyAsNull === true} onChange={(event) => setOption("emptyAsNull", event.currentTarget.checked)} /> Celle vuote trattate come NULL</label><label class="choice-line"><input type="checkbox" checked={options.caseSensitive === true} onChange={(event) => setOption("caseSensitive", event.currentTarget.checked)} /> Distingui maiuscole e minuscole</label></div>}
        {mode === "sort" && <div class="table-control-grid"><label class="field"><span>Posizione colonna</span><input type="number" min="0" value={String(options.column ?? "0")} onInput={(event) => setOption("column", event.currentTarget.value)} /></label><label class="field"><span>Direzione</span><select value={String(options.direction ?? "asc")} onChange={(event) => setOption("direction", event.currentTarget.value)}><option value="asc">Crescente</option><option value="desc">Decrescente</option></select></label><label class="field"><span>Confronto / tipo</span><select value={String(options.comparator ?? "lexical")} onChange={(event) => setOption("comparator", event.currentTarget.value)}>{COMPARATORS.map((comparator) => <option value={comparator}>{COMPARATOR_LABELS[comparator]}</option>)}</select></label><label class="field"><span>NULL e valori non validi</span><select value={String(options.nulls ?? "last")} onChange={(event) => setOption("nulls", event.currentTarget.value)}><option value="first">Prima</option><option value="last">Dopo</option></select></label><label class="field"><span>Token NULL · separati da virgola</span><input value={String(options.nullTokens ?? "NULL")} onInput={(event) => setOption("nullTokens", event.currentTarget.value)} /></label><label class="choice-line"><input type="checkbox" checked={options.emptyAsNull === true} onChange={(event) => setOption("emptyAsNull", event.currentTarget.checked)} /> Celle vuote trattate come NULL</label><label class="choice-line"><input type="checkbox" checked={options.caseSensitive === true} onChange={(event) => setOption("caseSensitive", event.currentTarget.checked)} /> Distingui maiuscole e minuscole</label></div>}
        {mode === "group-count" && <div class="table-control-grid"><label class="field"><span>Colonne chiave di raggruppamento</span><input value={String(options.groupColumns ?? "0")} onInput={(event) => setOption("groupColumns", event.currentTarget.value)} /></label><label class="field"><span>Colonna da contare o aggregare · facoltativa</span><input type="number" min="0" value={String(options.countColumn ?? "")} onInput={(event) => setOption("countColumn", event.currentTarget.value)} /></label><label class="field"><span>Aggregazione / tipo</span><select value={String(options.aggregate ?? "count")} onChange={(event) => setOption("aggregate", event.currentTarget.value)}>{AGGREGATES.map((aggregate) => <option value={aggregate}>{AGGREGATE_LABELS[aggregate]}</option>)}</select></label><label class="field"><span>Token NULL · separati da virgola</span><input value={String(options.nullTokens ?? "NULL")} onInput={(event) => setOption("nullTokens", event.currentTarget.value)} /></label><label class="choice-line"><input type="checkbox" checked={options.emptyAsNull === true} onChange={(event) => setOption("emptyAsNull", event.currentTarget.checked)} /> Celle vuote trattate come NULL</label><label class="choice-line"><input type="checkbox" checked={options.caseSensitive === true} onChange={(event) => setOption("caseSensitive", event.currentTarget.checked)} /> Chiavi sensibili a maiuscole e minuscole</label></div>}
        {mode === "join" && <div class="table-control-grid"><label class="field"><span>Colonne chiave di sinistra</span><input value={String(options.leftKeyColumns ?? "0")} onInput={(event) => setOption("leftKeyColumns", event.currentTarget.value)} /></label><label class="field"><span>Colonne chiave di destra</span><input value={String(options.rightKeyColumns ?? "0")} onInput={(event) => setOption("rightKeyColumns", event.currentTarget.value)} /></label><label class="field"><span>Tipo di unione</span><select value={String(options.joinType ?? "inner")} onChange={(event) => setOption("joinType", event.currentTarget.value)}>{JOIN_TYPES.map((joinType) => <option value={joinType}>{JOIN_LABELS[joinType]}</option>)}</select></label><label class="field"><span>Chiavi NULL</span><select value={String(options.nullKeyPolicy ?? "never-match")} onChange={(event) => setOption("nullKeyPolicy", event.currentTarget.value)}><option value="never-match">Non corrispondono mai</option><option value="match">Possono corrispondere</option></select></label><label class="field"><span>Token NULL · separati da virgola</span><input value={String(options.nullTokens ?? "NULL")} onInput={(event) => setOption("nullTokens", event.currentTarget.value)} /></label><label class="field"><span>Suffisso intestazioni di destra</span><input value={String(options.suffix ?? "_right")} onInput={(event) => setOption("suffix", event.currentTarget.value)} /></label><label class="choice-line"><input type="checkbox" checked={options.emptyAsNull === true} onChange={(event) => setOption("emptyAsNull", event.currentTarget.checked)} /> Celle vuote trattate come NULL</label><label class="choice-line"><input type="checkbox" checked={options.caseSensitive === true} onChange={(event) => setOption("caseSensitive", event.currentTarget.checked)} /> Chiavi sensibili a maiuscole e minuscole</label></div>}
        {mode === "pivot" && <div class="table-control-grid"><label class="field"><span>Colonne chiave di raggruppamento</span><input value={String(options.groupColumns ?? "0")} onInput={(event) => setOption("groupColumns", event.currentTarget.value)} /></label><label class="field"><span>Colonna intestazioni valori · facoltativa</span><input type="number" min="0" value={String(options.valueHeaderColumn ?? "")} onInput={(event) => setOption("valueHeaderColumn", event.currentTarget.value)} /></label><label class="field"><span>Colonna valori da aggregare · facoltativa per il conteggio</span><input type="number" min="0" value={String(options.aggregateColumn ?? "")} onInput={(event) => setOption("aggregateColumn", event.currentTarget.value)} /></label><label class="field"><span>Colonna valore precedente</span><input type="number" min="0" value={String(options.valueColumn ?? "")} onInput={(event) => setOption("valueColumn", event.currentTarget.value)} /></label><label class="field"><span>Aggregazione / tipo</span><select value={String(options.aggregate ?? "sum")} onChange={(event) => setOption("aggregate", event.currentTarget.value)}>{AGGREGATES.map((aggregate) => <option value={aggregate}>{AGGREGATE_LABELS[aggregate]}</option>)}</select></label><label class="field"><span>Token NULL · separati da virgola</span><input value={String(options.nullTokens ?? "NULL")} onInput={(event) => setOption("nullTokens", event.currentTarget.value)} /></label><label class="choice-line"><input type="checkbox" checked={options.emptyAsNull === true} onChange={(event) => setOption("emptyAsNull", event.currentTarget.checked)} /> Celle vuote trattate come NULL</label><label class="choice-line"><input type="checkbox" checked={options.caseSensitive === true} onChange={(event) => setOption("caseSensitive", event.currentTarget.checked)} /> Chiavi/intestazioni sensibili a maiuscole e minuscole</label></div>}
        {mode === "to-json" && <div class="table-control-grid"><label class="field"><span>Gestione intestazioni</span><select value={String(options.headerPolicy ?? "unique")} onChange={(event) => setOption("headerPolicy", event.currentTarget.value)}><option value="unique">Rendi univoche le intestazioni</option><option value="preserve">Mantieni il testo delle intestazioni</option></select></label><label class="choice-line"><input type="checkbox" checked={options.pretty === true} onChange={(event) => setOption("pretty", event.currentTarget.checked)} /> JSON formattato</label></div>}
        {mode === "from-json" && <label class="field"><span>Schema delle intestazioni</span><select value={String(options.headerMode ?? "first")} onChange={(event) => setOption("headerMode", event.currentTarget.value)}><option value="first">Chiavi del primo record</option><option value="union">Unione delle chiavi di tutti i record</option></select></label>}
        {mode === "encoding" && <label class="field"><span>Codifica sorgente · rilevamento automatico se vuota</span><select value={String(options.encoding ?? "")} onChange={(event) => setOption("encoding", event.currentTarget.value)}><option value="">Rileva automaticamente</option><option value="utf-8">UTF-8</option><option value="utf-16le">UTF-16 LE</option><option value="utf-16be">UTF-16 BE</option><option value="windows-1252">Windows-1252</option></select></label>}
        {mode === "duplicate-profile" && <div class="table-control-grid"><label class="field"><span>Colonne chiave · facoltative</span><input value={String(options.keyColumns ?? "")} onInput={(event) => setOption("keyColumns", event.currentTarget.value)} /></label><label class="field"><span>Numero massimo di esempi</span><input type="number" min="0" max="1000" value={String(options.maxExamples ?? "100")} onInput={(event) => setOption("maxExamples", event.currentTarget.value)} /></label></div>}
        {mode === "chart" && <div class="table-control-grid"><label class="field"><span>Colonna etichette</span><input type="number" min="0" value={String(options.labelColumn ?? "0")} onInput={(event) => setOption("labelColumn", event.currentTarget.value)} /></label><label class="field"><span>Colonna valori · facoltativa per il conteggio</span><input type="number" min="0" value={String(options.valueColumn ?? "")} onInput={(event) => setOption("valueColumn", event.currentTarget.value)} /></label><label class="field"><span>Aggregazione</span><select value={String(options.aggregate ?? "count")} onChange={(event) => setOption("aggregate", event.currentTarget.value)}>{AGGREGATES.map((aggregate) => <option value={aggregate}>{AGGREGATE_LABELS[aggregate]}</option>)}</select></label><label class="field"><span>Numero massimo di barre</span><input type="number" min="1" max="100" value={String(options.maxBars ?? "30")} onInput={(event) => setOption("maxBars", event.currentTarget.value)} /></label></div>}
        {mode === "sql" && <div class="table-control-grid"><label class="field"><span>Dialetto SQL</span><select value={String(options.dialect ?? "postgresql")} onChange={(event) => setOption("dialect", event.currentTarget.value)}><option value="postgresql">PostgreSQL</option><option value="mysql">MySQL</option><option value="sqlite">SQLite</option></select></label><label class="field"><span>Nome tabella</span><input value={String(options.tableName ?? "imported_data")} onInput={(event) => setOption("tableName", event.currentTarget.value)} /></label><label class="field"><span>Tipi forzati · colonna:tipo</span><input value={String(options.typeOverrides ?? "")} onInput={(event) => setOption("typeOverrides", event.currentTarget.value)} placeholder="0:text,2:date" /></label><label class="field"><span>Token NULL · separati da virgola</span><input value={String(options.nullTokens ?? "NULL")} onInput={(event) => setOption("nullTokens", event.currentTarget.value)} /></label><label class="choice-line"><input type="checkbox" checked={options.emptyAsNull === true} onChange={(event) => setOption("emptyAsNull", event.currentTarget.checked)} /> Tratta la cella vuota come NULL</label><label class="choice-line"><input type="checkbox" checked={options.includeCreateTable === true} onChange={(event) => setOption("includeCreateTable", event.currentTarget.checked)} /> Includi CREATE TABLE</label><p class="file-note">I tipi sono inferiti in modo conservativo: valori numerici con zero iniziale restano testo. Il risultato è solo testo SQL locale e non viene eseguito.</p></div>}
        {mode === "split" && <div class="table-control-grid"><label class="field"><span>Dividi per</span><select value={String(options.splitMode ?? "rows")} onChange={(event) => setOption("splitMode", event.currentTarget.value)}><option value="rows">Numero di righe</option><option value="bytes">Dimensione approssimativa</option></select></label><label class="field"><span>Righe per parte</span><input type="number" min="1" max="50000" value={String(options.rowsPerChunk ?? "10000")} onInput={(event) => setOption("rowsPerChunk", event.currentTarget.value)} /></label><label class="field"><span>Dimensione obiettivo · KiB</span><input type="number" min="1" max="8192" value={String(options.targetKilobytes ?? "2048")} onInput={(event) => setOption("targetKilobytes", event.currentTarget.value)} /></label><p class="file-note">Con un file locale la lettura avviene a blocchi; l'intestazione viene ripetuta una volta in ogni parte.</p></div>}
        {mode === "compare" && <div class="table-control-grid"><label class="field"><span>Chiavi sinistra</span><input value={String(options.leftKeyColumns ?? "0")} onInput={(event) => setOption("leftKeyColumns", event.currentTarget.value)} /></label><label class="field"><span>Chiavi destra</span><input value={String(options.rightKeyColumns ?? "0")} onInput={(event) => setOption("rightKeyColumns", event.currentTarget.value)} /></label><label class="field"><span>Colonne confronto sinistra</span><input value={String(options.leftCompareColumns ?? "1")} onInput={(event) => setOption("leftCompareColumns", event.currentTarget.value)} /></label><label class="field"><span>Colonne confronto destra</span><input value={String(options.rightCompareColumns ?? "1")} onInput={(event) => setOption("rightCompareColumns", event.currentTarget.value)} /></label><label class="field"><span>Token NULL · separati da virgola</span><input value={String(options.nullTokens ?? "NULL")} onInput={(event) => setOption("nullTokens", event.currentTarget.value)} /></label><label class="choice-line"><input type="checkbox" checked={options.emptyAsNull === true} onChange={(event) => setOption("emptyAsNull", event.currentTarget.checked)} /> Vuoto equivalente a NULL</label><label class="choice-line"><input type="checkbox" checked={options.caseSensitive === true} onChange={(event) => setOption("caseSensitive", event.currentTarget.checked)} /> Distingui maiuscole e minuscole</label></div>}
        <InlineError message={fileError || publicError} />
        <ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>{publicTitle}</ToolSubmitButton>{operation.isRunning && <ToolCancelButton onCancel={operation.cancel} />}<ToolResetButton onClick={reset} disabled={operation.isRunning} /></ToolActions>
      </form>
    </ToolFormCard>
    <ToolResultPanel eyebrow="Risultato" placeholder="Avvia lo strumento per vedere il risultato locale." busy={operation.isRunning} state={gutterStateFor(operation.status)}>
      {result !== null && resultModel !== null && <div data-result-class="table">
        <div data-result-slot="summary">
          <ResultPrimaryAnswer label={mode === "split" ? "Suddivisione" : "Tabella"}>{mode === "split" ? `${String(result.rowCount ?? resultModel.rows)} righe · ${splitChunks.length} parti` : `${resultModel.rows} righe · ${resultModel.columns} colonne`}</ResultPrimaryAnswer>
          {summary !== "" && <ResultInterpretation state={resultModel.warnings.length > 0 ? "warning" : "info"}>{summary}</ResultInterpretation>}
        </div>
        <div data-result-slot="issue-counts">
          <ResultBreakdown
            label="Qualità tabella"
            rows={[
              { label: "Avvisi", value: String(resultModel.warnings.length) },
              { label: "Righe con avviso", value: String(resultModel.rowWarningCount) },
              { label: "Intestazioni duplicate", value: String(resultModel.duplicateHeaderWarningCount) },
              { label: "Errori", value: "0" },
            ]}
          />
          {resultModel.warnings.length > 0 && <ul class="file-note" aria-label="Avvisi della tabella">
            {resultModel.warnings.slice(0, 8).map((warning, index) => <li key={`${warning.row ?? "x"}-${warning.column ?? "x"}-${warning.message}-${index}`}>
              {warning.row !== undefined
                ? `Riga ${warning.row}: ${warning.message}`
                : warning.column !== undefined
                  ? `Colonna ${warning.column}: ${warning.message}`
                  : warning.message}
            </li>)}
          </ul>}
        </div>
        <div data-result-slot="table-preview"><BoundedTableResultPreview preview={resultModel.preview} /></div>
        {(mode === "sort" || mode === "filter") && <><TableTransformDiff388 source={submittedText} output={resultModel.exportPayload} delimiter={(result?.table as { delimiter?: string } | undefined)?.delimiter ?? ","} summary={summary} /><button type="button" data-str388-apply onClick={reuseResult}>Applica alla tabella (annullabile)</button></>}
        <div data-result-secondary-raw>
          {mode === "missing-profile" && profileColumns.length > 0 && <div class="table-preview-scroll"><table class="table-preview"><caption>Valori mancanti per colonna</caption><thead><tr><th scope="col">Colonna</th><th scope="col">Mancanti</th><th scope="col">Presenti</th><th scope="col">Percentuale mancante</th></tr></thead><tbody>{profileColumns.map((column) => <tr key={column.name}><th scope="row">{column.name}</th><td>{String(column.missing ?? 0)}</td><td>{String(column.present ?? 0)}</td><td>{typeof column.missingRate === "number" ? `${(column.missingRate * 100).toFixed(1)}%` : "—"}</td></tr>)}</tbody></table></div>}
          {mode === "type-profile" && profileColumns.length > 0 && <div class="table-preview-scroll"><table class="table-preview"><caption>Tipi rilevati per colonna</caption><thead><tr><th scope="col">Colonna</th><th scope="col">Tipo</th><th scope="col">Numeri</th><th scope="col">Booleani</th><th scope="col">Date</th><th scope="col">Testo</th><th scope="col">Vuoti</th></tr></thead><tbody>{profileColumns.map((column) => <tr key={column.name}><th scope="row">{column.name}</th><td>{TYPE_LABELS[String(column.dominantType ?? "")] ?? String(column.dominantType ?? "—")}</td><td>{String(column.number ?? 0)}</td><td>{String(column.boolean ?? 0)}</td><td>{String(column.date ?? 0)}</td><td>{String(column.string ?? 0)}</td><td>{String(column.empty ?? 0)}</td></tr>)}</tbody></table></div>}
          {mode === "duplicate-profile" && duplicateGroups.length > 0 && <div class="table-preview-scroll"><table class="table-preview"><caption>Gruppi duplicati</caption><thead><tr><th scope="col">Prima riga</th><th scope="col">Occorrenze</th><th scope="col">Valori</th></tr></thead><tbody>{duplicateGroups.map((group, index) => <tr key={`${group.rowNumber ?? index}-${group.values.join("|")}`}><td>{group.rowNumber ?? "—"}</td><td>{group.count}</td><td>{group.values.join(" · ")}</td></tr>)}</tbody></table></div>}
          {mode === "sql" && typeof result.sqlPreview === "string" && <div><p class="file-note">Anteprima SQL{result.sqlPreviewTruncated === true ? " · troncata; il download contiene tutto" : ""}</p><pre class="table-output"><code>{result.sqlPreview}</code></pre></div>}
          {mode === "split" && splitChunks.length > 0 && <div class="table-preview-scroll"><table class="table-preview"><caption>Parti CSV generate</caption><thead><tr><th scope="col">File</th><th scope="col">Righe dati</th><th scope="col">Byte</th><th scope="col">Download</th></tr></thead><tbody>{splitChunks.map((chunk) => <tr key={chunk.filename}><th scope="row">{chunk.filename}</th><td>{chunk.rowCount}</td><td>{chunk.bytes}</td><td><button type="button" onClick={() => downloadSplitChunk(chunk)}>Scarica</button></td></tr>)}</tbody></table></div>}
          {mode === "compare" && changedCells.length > 0 && <div class="table-preview-scroll"><table class="table-preview"><caption>Celle cambiate · prime 30</caption><thead><tr><th scope="col">Chiave</th><th scope="col">Riga sinistra</th><th scope="col">Riga destra</th><th scope="col">Colonna</th><th scope="col">Prima</th><th scope="col">Dopo</th></tr></thead><tbody>{changedCells.slice(0, 30).map((cell, index) => <tr key={`${cell.leftRow}-${cell.rightRow}-${cell.leftColumnName}-${index}`}><td>{cell.key.join(" · ")}</td><td>{cell.leftRow}</td><td>{cell.rightRow}</td><td>{cell.leftColumnName === cell.rightColumnName ? cell.leftColumnName : `${cell.leftColumnName} ↔ ${cell.rightColumnName}`}</td><td>{cell.leftValue}</td><td>{cell.rightValue}</td></tr>)}</tbody></table></div>}
          {mode === "compare" && ambiguousKeys.length > 0 && <p class="file-note">Chiavi duplicate ambigue: {ambiguousKeys.slice(0, 8).map((entry) => `${entry.key.join(" · ")} (S ${entry.leftRows.join("/") || "—"}; D ${entry.rightRows.join("/") || "—"})`).join(" · ")}{ambiguousKeys.length > 8 ? " · …" : ""}</p>}
          {preferredHandoffTargets.length > 0 && <div><p class="file-note">Continua con un formato/strumento compatibile:</p><div class="actions">{preferredHandoffTargets.slice(0, 12).map((proposal) => <button type="button" key={proposal.target.id} onClick={() => handoffResult(proposal)}>{proposal.target.name}</button>)}</div></div>}
          {points.length > 0 && <TableAccessibleChart publicTitle={publicTitle} points={points} maxPoint={maxPoint} />}
        </div>
        <ResultActions
          actions={resultActions}
          onAction={{
            copy: copyResult,
            download: downloadResult,
            reuse: reuseResult,
            handoff: () => handoffResult(),
            reset,
          }}
        />
        {actionStatus !== "" && <p class="success" role="status" aria-live="polite">{actionStatus}</p>}
      </div>}
    </ToolResultPanel>
  </ToolOperation>;
}
