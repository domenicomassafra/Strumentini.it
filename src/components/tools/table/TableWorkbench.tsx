import { useEffect, useMemo, useState } from "preact/hooks";
import { readBlobText } from "../../../engines/table/csv";
import { readTableBlobBytes } from "../../../engines/table/operations";
import { receiveHandoffFromOpener } from "../../../runtime/handoff";
import { toolRuntime } from "../../../runtime/tool-runtime";
import type { ToolSummary } from "../../../catalog/manifest";
import type { FactoryToolManifest } from "../../../tool-factory/manifest";
import {
  InlineError,
  ToolActions,
  ToolFormCard,
  ToolOperation,
  ToolResetButton,
  ToolResultPanel,
  ToolSubmitButton,
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
  if (!Number.isFinite(parsed)) throw new Error("Enter a valid number.");
  return parsed;
}

function optionalNumberOption(value: OptionValue | undefined): number | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error("Enter a valid number.");
  return parsed;
}

function parseIndexes(value: OptionValue | undefined): number[] | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const indexes = value.split(",").map((item) => item.trim()).filter((item) => item !== "").map(Number);
  if (indexes.length === 0 || indexes.some((item) => !Number.isInteger(item) || item < 0)) throw new Error("Column positions must be non-negative whole numbers.");
  return indexes;
}

function requiredIndexes(value: OptionValue | undefined): number[] {
  const indexes = parseIndexes(value);
  if (indexes === undefined) throw new Error("Enter at least one column position.");
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
  return JSON.stringify(result, null, 2).slice(0, 8000);
}

function resultSummary(result: WorkbenchResult | null): string {
  if (result === null) return "";
  const parts: string[] = [];
  const add = (label: string, value: unknown) => { if (value !== undefined && value !== null) parts.push(`${label}: ${String(value)}`); };
  add("rows", result.rowCount);
  add("columns", result.columnCount);
  add("groups", result.groups);
  add("matched rows", result.matchedRows);
  add("rejected rows", result.rejectedRows);
  add("duplicate rows", result.duplicateRows);
  add("missing values", result.totalMissing);
  add("delimiter", result.delimiter);
  add("detected encoding", result.detectedEncoding);
  add("confidence", result.confidence);
  return parts.join(" · ");
}

function isPoints(value: unknown): value is Array<{ label: string; value: number }> {
  return Array.isArray(value) && value.every((point) => typeof point === "object" && point !== null && typeof (point as { label?: unknown }).label === "string" && typeof (point as { value?: unknown }).value === "number");
}

export function TableWorkbench({ toolId, title, description, mode, manifest, inputLabel = "CSV or table text", secondaryLabel = "Second table", defaultText = "" }: TableWorkbenchProps) {
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
    setFileName(`Received table · ${envelope.descriptor.rowCount} rows`);
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
      setFileError(caught instanceof Error ? caught.message : "Could not read the file.");
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
  const maxPoint = Math.max(1, ...points.map((point) => Math.abs(point.value)));

  return <ToolOperation className="table-workbench" busy={operation.isRunning}>
    <ToolFormCard>
      <form onSubmit={submit}>
        <p class="file-note">{description}</p>
        <label class="field"><span>{inputLabel}</span><textarea rows={8} value={text} onInput={(event) => { setText(event.currentTarget.value); setBytes(null); }} placeholder="Paste bounded table text or choose a file." /></label>
        {mode === "join" && <label class="field"><span>{secondaryLabel}</span><textarea rows={8} value={secondaryText} onInput={(event) => setSecondaryText(event.currentTarget.value)} placeholder="Paste the second CSV table." /></label>}
        <label class="field"><span>File (optional)</span><input type="file" accept={mode === "encoding" ? ".csv,.txt,.tsv,text/plain" : mode === "from-json" ? ".json,application/json" : ".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain,application/json"} onChange={(event) => void loadFile(event.currentTarget.files?.[0])} /></label>
        {fileName && <p class="file-note" role="status">{fileName}</p>}
        {mode === "selector" && <label class="field"><span>Column positions (zero-based, comma-separated)</span><input value={String(options.columns ?? "")} onInput={(event) => setOption("columns", event.currentTarget.value)} /></label>}
        {mode === "filter" && <div class="table-control-grid"><label class="field"><span>Column position</span><input type="number" min="0" value={String(options.column ?? "0")} onInput={(event) => setOption("column", event.currentTarget.value)} /></label><label class="field"><span>Operator</span><select value={String(options.operator ?? "contains")} onChange={(event) => setOption("operator", event.currentTarget.value)}>{OPERATORS.map((operator) => <option value={operator}>{operator}</option>)}</select></label><label class="field"><span>Value</span><input value={String(options.value ?? "")} onInput={(event) => setOption("value", event.currentTarget.value)} /></label><label class="choice-line"><input type="checkbox" checked={options.caseSensitive === true} onChange={(event) => setOption("caseSensitive", event.currentTarget.checked)} /> Case-sensitive</label></div>}
        {mode === "sort" && <div class="table-control-grid"><label class="field"><span>Column position</span><input type="number" min="0" value={String(options.column ?? "0")} onInput={(event) => setOption("column", event.currentTarget.value)} /></label><label class="field"><span>Direction</span><select value={String(options.direction ?? "asc")} onChange={(event) => setOption("direction", event.currentTarget.value)}><option value="asc">Ascending</option><option value="desc">Descending</option></select></label><label class="field"><span>Comparator</span><select value={String(options.comparator ?? "lexical")} onChange={(event) => setOption("comparator", event.currentTarget.value)}>{COMPARATORS.map((comparator) => <option value={comparator}>{comparator}</option>)}</select></label><label class="field"><span>Empty values</span><select value={String(options.nulls ?? "last")} onChange={(event) => setOption("nulls", event.currentTarget.value)}><option value="first">First</option><option value="last">Last</option></select></label><label class="choice-line"><input type="checkbox" checked={options.caseSensitive === true} onChange={(event) => setOption("caseSensitive", event.currentTarget.checked)} /> Case-sensitive</label></div>}
        {mode === "group-count" && <div class="table-control-grid"><label class="field"><span>Group columns</span><input value={String(options.groupColumns ?? "0")} onInput={(event) => setOption("groupColumns", event.currentTarget.value)} /></label><label class="field"><span>Count/value column (optional)</span><input type="number" min="0" value={String(options.countColumn ?? "")} onInput={(event) => setOption("countColumn", event.currentTarget.value)} /></label><label class="field"><span>Aggregate</span><select value={String(options.aggregate ?? "count")} onChange={(event) => setOption("aggregate", event.currentTarget.value)}>{AGGREGATES.map((aggregate) => <option value={aggregate}>{aggregate}</option>)}</select></label></div>}
        {mode === "join" && <div class="table-control-grid"><label class="field"><span>Left key columns</span><input value={String(options.leftKeyColumns ?? "0")} onInput={(event) => setOption("leftKeyColumns", event.currentTarget.value)} /></label><label class="field"><span>Right key columns</span><input value={String(options.rightKeyColumns ?? "0")} onInput={(event) => setOption("rightKeyColumns", event.currentTarget.value)} /></label><label class="field"><span>Join type</span><select value={String(options.joinType ?? "inner")} onChange={(event) => setOption("joinType", event.currentTarget.value)}>{JOIN_TYPES.map((joinType) => <option value={joinType}>{joinType}</option>)}</select></label><label class="field"><span>Right-header suffix</span><input value={String(options.suffix ?? "_right")} onInput={(event) => setOption("suffix", event.currentTarget.value)} /></label><label class="choice-line"><input type="checkbox" checked={options.caseSensitive === true} onChange={(event) => setOption("caseSensitive", event.currentTarget.checked)} /> Case-sensitive keys</label></div>}
        {mode === "pivot" && <div class="table-control-grid"><label class="field"><span>Group columns</span><input value={String(options.groupColumns ?? "0")} onInput={(event) => setOption("groupColumns", event.currentTarget.value)} /></label><label class="field"><span>Value-header column (optional)</span><input type="number" min="0" value={String(options.valueHeaderColumn ?? "")} onInput={(event) => setOption("valueHeaderColumn", event.currentTarget.value)} /></label><label class="field"><span>Aggregate-value column (optional for count)</span><input type="number" min="0" value={String(options.aggregateColumn ?? "")} onInput={(event) => setOption("aggregateColumn", event.currentTarget.value)} /></label><label class="field"><span>Legacy value column</span><input type="number" min="0" value={String(options.valueColumn ?? "")} onInput={(event) => setOption("valueColumn", event.currentTarget.value)} /></label><label class="field"><span>Aggregate</span><select value={String(options.aggregate ?? "sum")} onChange={(event) => setOption("aggregate", event.currentTarget.value)}>{AGGREGATES.map((aggregate) => <option value={aggregate}>{aggregate}</option>)}</select></label></div>}
        {mode === "to-json" && <div class="table-control-grid"><label class="field"><span>Header policy</span><select value={String(options.headerPolicy ?? "unique")} onChange={(event) => setOption("headerPolicy", event.currentTarget.value)}><option value="unique">Make headers unique</option><option value="preserve">Preserve header text</option></select></label><label class="choice-line"><input type="checkbox" checked={options.pretty === true} onChange={(event) => setOption("pretty", event.currentTarget.checked)} /> Pretty JSON</label></div>}
        {mode === "from-json" && <label class="field"><span>Header schema mode</span><select value={String(options.headerMode ?? "first")} onChange={(event) => setOption("headerMode", event.currentTarget.value)}><option value="first">First record keys</option><option value="union">Union of all record keys</option></select></label>}
        {mode === "encoding" && <label class="field"><span>Source encoding (auto-detect when blank)</span><select value={String(options.encoding ?? "")} onChange={(event) => setOption("encoding", event.currentTarget.value)}><option value="">Auto-detect</option><option value="utf-8">UTF-8</option><option value="utf-16le">UTF-16 LE</option><option value="utf-16be">UTF-16 BE</option><option value="windows-1252">Windows-1252</option></select></label>}
        {mode === "duplicate-profile" && <div class="table-control-grid"><label class="field"><span>Key columns (optional)</span><input value={String(options.keyColumns ?? "")} onInput={(event) => setOption("keyColumns", event.currentTarget.value)} /></label><label class="field"><span>Maximum examples</span><input type="number" min="0" max="1000" value={String(options.maxExamples ?? "100")} onInput={(event) => setOption("maxExamples", event.currentTarget.value)} /></label></div>}
        {mode === "chart" && <div class="table-control-grid"><label class="field"><span>Label column</span><input type="number" min="0" value={String(options.labelColumn ?? "0")} onInput={(event) => setOption("labelColumn", event.currentTarget.value)} /></label><label class="field"><span>Value column (optional for count)</span><input type="number" min="0" value={String(options.valueColumn ?? "")} onInput={(event) => setOption("valueColumn", event.currentTarget.value)} /></label><label class="field"><span>Aggregate</span><select value={String(options.aggregate ?? "count")} onChange={(event) => setOption("aggregate", event.currentTarget.value)}>{AGGREGATES.map((aggregate) => <option value={aggregate}>{aggregate}</option>)}</select></label><label class="field"><span>Maximum bars</span><input type="number" min="1" max="100" value={String(options.maxBars ?? "30")} onInput={(event) => setOption("maxBars", event.currentTarget.value)} /></label></div>}
        <InlineError message={fileError || operation.error} />
        <ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>{title}</ToolSubmitButton><ToolResetButton onClick={reset} disabled={operation.isRunning} /></ToolActions>
      </form>
    </ToolFormCard>
    <ToolResultPanel eyebrow="Result" placeholder="Run the tool to see a bounded local result." busy={operation.isRunning}>
      {result !== null && <>
        {summary && <p class="file-note" role="status">{summary}</p>}
        {points.length > 0 && <div class="table-chart" role="img" aria-label={`${title} bar chart`}>{points.map((point) => <div class="table-chart-row" key={point.label}><span>{point.label}</span><div class="table-chart-track"><div class="table-chart-bar" style={{ width: `${Math.max(1, Math.round(Math.abs(point.value) / maxPoint * 100))}%` }} /></div><strong>{point.value}</strong></div>)}</div>}
        {result.previewRows !== undefined && result.headers !== undefined && <div class="table-preview-scroll"><table class="table-preview"><caption>{title} preview</caption><thead><tr>{result.headers.map((header, index) => <th scope="col" key={`${index}-${header}`}>{header || "(blank header)"}</th>)}</tr></thead><tbody>{result.previewRows.map((row, rowIndex) => <tr key={rowIndex}>{result.headers?.map((_header, index) => <td key={index}>{row[index] ?? ""}</td>)}</tr>)}</tbody></table></div>}
        {outputText && <pre class="table-output">{outputText}</pre>}
        {(typeof result.output === "string" || typeof result.json === "string" || typeof result.svg === "string") && <ToolActions><button type="button" onClick={download}>Scarica risultato</button></ToolActions>}
      </>}
    </ToolResultPanel>
  </ToolOperation>;
}
