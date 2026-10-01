import { useEffect, useMemo, useState } from "preact/hooks";
import { readBlobText } from "../../../engines/table/csv";
import { readTableBlobBytes } from "../../../engines/table/operations";
import { receiveHandoffFromOpener } from "../../../runtime/handoff";
import { toolRuntime } from "../../../runtime/tool-runtime";
import type { ToolSummary } from "../../../catalog/manifest";
import type { FactoryToolManifest } from "../../../tool-factory/manifest";
import { TOOL_COPY_IT } from "../../../i18n/it/tool-copy";
import {
  InlineError,
  ToolActions,
  ToolFormCard,
  ToolOperation,
  ToolResetButton,
  ToolResultPanel,
  ToolSubmitButton,
  gutterStateFor,
  useToolOperation,
} from "../shared";
import { CONTROL, it } from "../shared/controlLabels";

export type TableWorkbenchMode =
  | "viewer"
  | "delimiter"
  | "encoding"
  | "selector"
  | "filter"
  | "sort"
  | "group-count"
  | "join"
  | "pivot"
  | "to-json"
  | "from-json"
  | "tsv"
  | "transpose"
  | "missing-profile"
  | "type-profile"
  | "duplicate-profile"
  | "chart";

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
    case "filter": return { column: "0", operator: "contains", value: "", caseSensitive: false };
    case "sort": return { column: "0", direction: "asc", comparator: "lexical", nulls: "last", caseSensitive: true };
    case "group-count": return { groupColumns: "0", countColumn: "", aggregate: "count" };
    case "join": return { leftKeyColumns: "0", rightKeyColumns: "0", joinType: "inner", caseSensitive: true, suffix: "_right" };
    case "pivot": return { groupColumns: "0", valueColumn: "", valueHeaderColumn: "", aggregateColumn: "", aggregate: "count" };
    case "to-json": return { headerPolicy: "unique", pretty: false };
    case "from-json": return { headerMode: "first" };
    case "encoding": return { encoding: "" };
    case "duplicate-profile": return { keyColumns: "", maxExamples: "100" };
    case "chart": return { labelColumn: "0", valueColumn: "", aggregate: "count", maxBars: "30" };
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

function inputFor(mode: TableWorkbenchMode, text: string, secondaryText: string, bytes: Uint8Array | null, options: Record<string, OptionValue>): Record<string, unknown> {
  switch (mode) {
    case "encoding": return { bytes: bytes ?? new TextEncoder().encode(text), ...(typeof options.encoding === "string" && options.encoding !== "" ? { encoding: options.encoding } : {}) };
    case "selector": return { text, columns: requiredIndexes(options.columns) };
    case "filter": return { text, column: numberOption(options.column, 0), operator: options.operator, value: options.value, caseSensitive: options.caseSensitive === true };
    case "sort": return { text, column: numberOption(options.column, 0), direction: options.direction, comparator: options.comparator, nulls: options.nulls, caseSensitive: options.caseSensitive === true };
    case "group-count": {
      const countColumn = optionalNumberOption(options.countColumn);
      return { text, groupColumns: requiredIndexes(options.groupColumns), ...(countColumn === undefined ? {} : { countColumn }), aggregate: options.aggregate };
    }
    case "join": return { leftText: text, rightText: secondaryText, leftKeyColumns: requiredIndexes(options.leftKeyColumns), rightKeyColumns: requiredIndexes(options.rightKeyColumns), joinType: options.joinType, caseSensitive: options.caseSensitive === true, suffix: options.suffix };
    case "pivot": {
      const valueColumn = optionalNumberOption(options.valueColumn);
      const valueHeaderColumn = optionalNumberOption(options.valueHeaderColumn);
      const aggregateColumn = optionalNumberOption(options.aggregateColumn);
      return { text, groupColumns: requiredIndexes(options.groupColumns), ...(valueColumn === undefined ? {} : { valueColumn }), ...(valueHeaderColumn === undefined ? {} : { valueHeaderColumn }), ...(aggregateColumn === undefined ? {} : { aggregateColumn }), aggregate: options.aggregate };
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

function resultText(result: WorkbenchResult | null): string {
  if (result === null) return "";
  const output = result.output ?? result.json;
  if (typeof output === "string") return output.length > 8000 ? `${output.slice(0, 8000)}\n…` : output;
  const keys: Readonly<Record<string, string>> = {
    rowCount: "numero_righe",
    columnCount: "numero_colonne",
    groups: "gruppi",
    matchedRows: "righe_corrispondenti",
    rejectedRows: "righe_escluse",
    duplicateRows: "righe_duplicate",
    totalMissing: "valori_mancanti",
    delimiter: "delimitatore",
    detectedEncoding: "codifica_rilevata",
    confidence: "affidabilità",
    headers: "intestazioni",
    previewRows: "righe_anteprima",
    points: "punti",
    warnings: "avvisi",
    warning: "avviso",
  };
  const localize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(localize);
    if (value === null || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [keys[key] ?? key, localize(item)]));
  };
  return JSON.stringify(localize(result), null, 2).slice(0, 8000);
}

function resultSummary(result: WorkbenchResult | null): string {
  if (result === null) return "";
  const parts: string[] = [];
  const add = (label: string, value: unknown) => { if (value !== undefined && value !== null) parts.push(`${label}: ${String(value)}`); };
  add("righe", result.rowCount);
  add("colonne", result.columnCount);
  add("gruppi", result.groups);
  add("righe corrispondenti", result.matchedRows);
  add("righe escluse", result.rejectedRows);
  add("righe duplicate", result.duplicateRows);
  add("valori mancanti", result.totalMissing);
  add("delimitatore", result.delimiter);
  add("codifica rilevata", result.detectedEncoding);
  add("affidabilità", result.confidence);
  return parts.join(" · ");
}

function isPoints(value: unknown): value is Array<{ label: string; value: number }> {
  return Array.isArray(value) && value.every((point) => typeof point === "object" && point !== null && typeof (point as { label?: unknown }).label === "string" && typeof (point as { value?: unknown }).value === "number");
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
  const [secondaryText, setSecondaryText] = useState("");
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const [options, setOptions] = useState<Record<string, OptionValue>>(() => defaultOptions(mode));
  const initialOptions = useMemo(() => defaultOptions(mode), [mode]);
  const operation = useToolOperation<WorkbenchResult>((signal) => toolRuntime.run(toolId, inputFor(mode, text, secondaryText, bytes, options), {}, signal));

  useEffect(() => {
    setOptions(initialOptions);
  }, [initialOptions]);

  useEffect(() => receiveHandoffFromOpener(manifest as unknown as ToolSummary, (envelope) => {
    setText(envelope.payload);
    setSecondaryText("");
    setBytes(null);
    setFileName(`Tabella ricevuta · ${envelope.descriptor.rowCount} righe`);
    operation.reset();
  }), [manifest, operation]);

  function setOption(key: string, value: OptionValue) {
    setOptions((current) => ({ ...current, [key]: value }));
  }

  async function loadFile(file: File | undefined) {
    if (file === undefined) return;
    setFileError("");
    operation.reset();
    try {
      if (mode === "encoding") {
        setBytes(await readTableBlobBytes(file));
        setText("");
      } else {
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
    setSecondaryText("");
    setBytes(null);
    setFileName("");
    setFileError("");
    setOptions(initialOptions);
    operation.reset();
  }

  function submit(event: Event) {
    event.preventDefault();
    void operation.run();
  }

  function download() {
    const result = operation.result;
    if (result === null) return;
    const payload = typeof result.output === "string" ? result.output : typeof result.json === "string" ? result.json : typeof result.svg === "string" ? result.svg : "";
    if (payload === "") return;
    const extension = mode === "to-json" ? "json" : mode === "chart" ? "svg" : mode === "encoding" ? "txt" : "csv";
    const url = URL.createObjectURL(new Blob([payload], { type: extension === "json" ? "application/json" : extension === "svg" ? "image/svg+xml" : "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${toolId}.${extension}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const result = operation.result;
  const summary = resultSummary(result);
  const outputText = resultText(result);
  const points = result !== null && isPoints(result.points) ? result.points : [];
  const profileColumns = result !== null && isProfileColumns(result.columns) ? result.columns : [];
  const duplicateGroups = result !== null && isDuplicateGroups(result.groups) ? result.groups : [];
  const maxPoint = Math.max(1, ...points.map((point) => Math.abs(point.value)));
  const publicTitle = TOOL_COPY_IT[toolId]?.name ?? toolId;
  const publicDescription = TOOL_COPY_IT[toolId]?.summary ?? "";
  const primaryInputLabel = mode === "from-json" ? "JSON" : mode === "encoding" ? "Testo o file da ricodificare" : mode === "join" ? "Prima tabella CSV" : "CSV o testo tabellare";
  const publicError = operation.error;

  return <ToolOperation className="table-workbench" busy={operation.isRunning}>
    <ToolFormCard>
      <form onSubmit={submit}>
        <p class="file-note">{publicDescription}</p>
        <label class="field"><span>{primaryInputLabel}</span><textarea rows={8} value={text} onInput={(event) => { setText(event.currentTarget.value); setBytes(null); }} placeholder="Incolla un testo tabellare oppure scegli un file." /></label>
        {mode === "join" && <label class="field"><span>Seconda tabella CSV</span><textarea rows={8} value={secondaryText} onInput={(event) => setSecondaryText(event.currentTarget.value)} placeholder="Incolla la seconda tabella CSV." /></label>}
        <label class="field"><span>File · facoltativo</span><input type="file" accept={mode === "encoding" ? ".csv,.txt,.tsv,text/plain" : mode === "from-json" ? ".json,application/json" : ".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain,application/json"} onChange={(event) => void loadFile(event.currentTarget.files?.[0])} /></label>
        {fileName && <p class="file-note" role="status">{fileName}</p>}
        {mode === "selector" && <label class="field"><span>Posizioni colonne (da zero, separate da virgola)</span><input value={String(options.columns ?? "")} onInput={(event) => setOption("columns", event.currentTarget.value)} /></label>}
        {mode === "filter" && <div class="table-control-grid"><label class="field"><span>Posizione colonna</span><input type="number" min="0" value={String(options.column ?? "0")} onInput={(event) => setOption("column", event.currentTarget.value)} /></label><label class="field"><span>Operatore</span><select value={String(options.operator ?? "contains")} onChange={(event) => setOption("operator", event.currentTarget.value)}>{OPERATORS.map((operator) => <option value={operator}>{OPERATOR_LABELS[operator]}</option>)}</select></label><label class="field"><span>Valore</span><input value={String(options.value ?? "")} onInput={(event) => setOption("value", event.currentTarget.value)} /></label><label class="choice-line"><input type="checkbox" checked={options.caseSensitive === true} onChange={(event) => setOption("caseSensitive", event.currentTarget.checked)} /> Distingui maiuscole e minuscole</label></div>}
        {mode === "sort" && <div class="table-control-grid"><label class="field"><span>Posizione colonna</span><input type="number" min="0" value={String(options.column ?? "0")} onInput={(event) => setOption("column", event.currentTarget.value)} /></label><label class="field"><span>Direzione</span><select value={String(options.direction ?? "asc")} onChange={(event) => setOption("direction", event.currentTarget.value)}><option value="asc">Crescente</option><option value="desc">Decrescente</option></select></label><label class="field"><span>Confronto</span><select value={String(options.comparator ?? "lexical")} onChange={(event) => setOption("comparator", event.currentTarget.value)}>{COMPARATORS.map((comparator) => <option value={comparator}>{COMPARATOR_LABELS[comparator]}</option>)}</select></label><label class="field"><span>Valori vuoti</span><select value={String(options.nulls ?? "last")} onChange={(event) => setOption("nulls", event.currentTarget.value)}><option value="first">Prima</option><option value="last">Dopo</option></select></label><label class="choice-line"><input type="checkbox" checked={options.caseSensitive === true} onChange={(event) => setOption("caseSensitive", event.currentTarget.checked)} /> Distingui maiuscole e minuscole</label></div>}
        {mode === "group-count" && <div class="table-control-grid"><label class="field"><span>Colonne di raggruppamento</span><input value={String(options.groupColumns ?? "0")} onInput={(event) => setOption("groupColumns", event.currentTarget.value)} /></label><label class="field"><span>Colonna da contare o aggregare · facoltativa</span><input type="number" min="0" value={String(options.countColumn ?? "")} onInput={(event) => setOption("countColumn", event.currentTarget.value)} /></label><label class="field"><span>Aggregazione</span><select value={String(options.aggregate ?? "count")} onChange={(event) => setOption("aggregate", event.currentTarget.value)}>{AGGREGATES.map((aggregate) => <option value={aggregate}>{AGGREGATE_LABELS[aggregate]}</option>)}</select></label></div>}
        {mode === "join" && <div class="table-control-grid"><label class="field"><span>Colonne chiave di sinistra</span><input value={String(options.leftKeyColumns ?? "0")} onInput={(event) => setOption("leftKeyColumns", event.currentTarget.value)} /></label><label class="field"><span>Colonne chiave di destra</span><input value={String(options.rightKeyColumns ?? "0")} onInput={(event) => setOption("rightKeyColumns", event.currentTarget.value)} /></label><label class="field"><span>Tipo di unione</span><select value={String(options.joinType ?? "inner")} onChange={(event) => setOption("joinType", event.currentTarget.value)}>{JOIN_TYPES.map((joinType) => <option value={joinType}>{JOIN_LABELS[joinType]}</option>)}</select></label><label class="field"><span>Suffisso intestazioni di destra</span><input value={String(options.suffix ?? "_right")} onInput={(event) => setOption("suffix", event.currentTarget.value)} /></label><label class="choice-line"><input type="checkbox" checked={options.caseSensitive === true} onChange={(event) => setOption("caseSensitive", event.currentTarget.checked)} /> Chiavi sensibili a maiuscole e minuscole</label></div>}
        {mode === "pivot" && <div class="table-control-grid"><label class="field"><span>Colonne di raggruppamento</span><input value={String(options.groupColumns ?? "0")} onInput={(event) => setOption("groupColumns", event.currentTarget.value)} /></label><label class="field"><span>Colonna intestazioni valori · facoltativa</span><input type="number" min="0" value={String(options.valueHeaderColumn ?? "")} onInput={(event) => setOption("valueHeaderColumn", event.currentTarget.value)} /></label><label class="field"><span>Colonna valori da aggregare · facoltativa per il conteggio</span><input type="number" min="0" value={String(options.aggregateColumn ?? "")} onInput={(event) => setOption("aggregateColumn", event.currentTarget.value)} /></label><label class="field"><span>Colonna valore precedente</span><input type="number" min="0" value={String(options.valueColumn ?? "")} onInput={(event) => setOption("valueColumn", event.currentTarget.value)} /></label><label class="field"><span>Aggregazione</span><select value={String(options.aggregate ?? "sum")} onChange={(event) => setOption("aggregate", event.currentTarget.value)}>{AGGREGATES.map((aggregate) => <option value={aggregate}>{AGGREGATE_LABELS[aggregate]}</option>)}</select></label></div>}
        {mode === "to-json" && <div class="table-control-grid"><label class="field"><span>Gestione intestazioni</span><select value={String(options.headerPolicy ?? "unique")} onChange={(event) => setOption("headerPolicy", event.currentTarget.value)}><option value="unique">Rendi univoche le intestazioni</option><option value="preserve">Mantieni il testo delle intestazioni</option></select></label><label class="choice-line"><input type="checkbox" checked={options.pretty === true} onChange={(event) => setOption("pretty", event.currentTarget.checked)} /> JSON formattato</label></div>}
        {mode === "from-json" && <label class="field"><span>Schema delle intestazioni</span><select value={String(options.headerMode ?? "first")} onChange={(event) => setOption("headerMode", event.currentTarget.value)}><option value="first">Chiavi del primo record</option><option value="union">Unione delle chiavi di tutti i record</option></select></label>}
        {mode === "encoding" && <label class="field"><span>Codifica sorgente · rilevamento automatico se vuota</span><select value={String(options.encoding ?? "")} onChange={(event) => setOption("encoding", event.currentTarget.value)}><option value="">Rileva automaticamente</option><option value="utf-8">UTF-8</option><option value="utf-16le">UTF-16 LE</option><option value="utf-16be">UTF-16 BE</option><option value="windows-1252">Windows-1252</option></select></label>}
        {mode === "duplicate-profile" && <div class="table-control-grid"><label class="field"><span>Colonne chiave · facoltative</span><input value={String(options.keyColumns ?? "")} onInput={(event) => setOption("keyColumns", event.currentTarget.value)} /></label><label class="field"><span>Numero massimo di esempi</span><input type="number" min="0" max="1000" value={String(options.maxExamples ?? "100")} onInput={(event) => setOption("maxExamples", event.currentTarget.value)} /></label></div>}
        {mode === "chart" && <div class="table-control-grid"><label class="field"><span>Colonna etichette</span><input type="number" min="0" value={String(options.labelColumn ?? "0")} onInput={(event) => setOption("labelColumn", event.currentTarget.value)} /></label><label class="field"><span>Colonna valori · facoltativa per il conteggio</span><input type="number" min="0" value={String(options.valueColumn ?? "")} onInput={(event) => setOption("valueColumn", event.currentTarget.value)} /></label><label class="field"><span>Aggregazione</span><select value={String(options.aggregate ?? "count")} onChange={(event) => setOption("aggregate", event.currentTarget.value)}>{AGGREGATES.map((aggregate) => <option value={aggregate}>{AGGREGATE_LABELS[aggregate]}</option>)}</select></label><label class="field"><span>Numero massimo di barre</span><input type="number" min="1" max="100" value={String(options.maxBars ?? "30")} onInput={(event) => setOption("maxBars", event.currentTarget.value)} /></label></div>}
        <InlineError message={fileError || publicError} />
        <ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>{publicTitle}</ToolSubmitButton><ToolResetButton onClick={reset} disabled={operation.isRunning} /></ToolActions>
      </form>
    </ToolFormCard>
    <ToolResultPanel eyebrow="Risultato" placeholder="Avvia lo strumento per vedere il risultato locale." busy={operation.isRunning} state={gutterStateFor(operation.status)}>
      {result !== null && <>
        {summary && <p class="file-note" role="status">{summary}</p>}
        {mode === "missing-profile" && profileColumns.length > 0 && <div class="table-preview-scroll"><table class="table-preview"><caption>Valori mancanti per colonna</caption><thead><tr><th scope="col">Colonna</th><th scope="col">Mancanti</th><th scope="col">Presenti</th><th scope="col">Percentuale mancante</th></tr></thead><tbody>{profileColumns.map((column) => <tr key={column.name}><th scope="row">{column.name}</th><td>{String(column.missing ?? 0)}</td><td>{String(column.present ?? 0)}</td><td>{typeof column.missingRate === "number" ? `${(column.missingRate * 100).toFixed(1)}%` : "—"}</td></tr>)}</tbody></table></div>}
        {mode === "type-profile" && profileColumns.length > 0 && <div class="table-preview-scroll"><table class="table-preview"><caption>Tipi rilevati per colonna</caption><thead><tr><th scope="col">Colonna</th><th scope="col">Tipo</th><th scope="col">Numeri</th><th scope="col">Booleani</th><th scope="col">Date</th><th scope="col">Testo</th><th scope="col">Vuoti</th></tr></thead><tbody>{profileColumns.map((column) => <tr key={column.name}><th scope="row">{column.name}</th><td>{TYPE_LABELS[String(column.dominantType ?? "")] ?? String(column.dominantType ?? "—")}</td><td>{String(column.number ?? 0)}</td><td>{String(column.boolean ?? 0)}</td><td>{String(column.date ?? 0)}</td><td>{String(column.string ?? 0)}</td><td>{String(column.empty ?? 0)}</td></tr>)}</tbody></table></div>}
        {mode === "duplicate-profile" && duplicateGroups.length > 0 && <div class="table-preview-scroll"><table class="table-preview"><caption>Gruppi duplicati</caption><thead><tr><th scope="col">Prima riga</th><th scope="col">Occorrenze</th><th scope="col">Valori</th></tr></thead><tbody>{duplicateGroups.map((group, index) => <tr key={`${group.rowNumber ?? index}-${group.values.join("|")}`}><td>{group.rowNumber ?? "—"}</td><td>{group.count}</td><td>{group.values.join(" · ")}</td></tr>)}</tbody></table></div>}
        {points.length > 0 && <div class="table-chart" role="img" aria-label={`Grafico: ${publicTitle}`}>{points.map((point) => <div class="table-chart-row" key={point.label}><span>{point.label}</span><div class="table-chart-track"><div class="table-chart-bar" style={{ width: `${Math.max(1, Math.round(Math.abs(point.value) / maxPoint * 100))}%` }} /></div><strong>{point.value}</strong></div>)}</div>}
        {result.previewRows !== undefined && result.headers !== undefined && <div class="table-preview-scroll"><table class="table-preview"><caption>{publicTitle}: anteprima</caption><thead><tr>{result.headers.map((header, index) => <th scope="col" key={`${index}-${header}`}>{header || "(intestazione vuota)"}</th>)}</tr></thead><tbody>{result.previewRows.map((row, rowIndex) => <tr key={rowIndex}>{result.headers?.map((_header, index) => <td key={index}>{row[index] ?? ""}</td>)}</tr>)}</tbody></table></div>}
        {outputText && <pre class="table-output">{outputText}</pre>}
        {(typeof result.output === "string" || typeof result.json === "string" || typeof result.svg === "string") && <ToolActions><button type="button" onClick={download}>Scarica risultato</button></ToolActions>}
      </>}
    </ToolResultPanel>
  </ToolOperation>;
}
