import Papa from "papaparse";
import {
  CSV_HARD_FILE_BYTES,
  CsvCleanerError,
} from "./io";
import {
  parseCsvTable,
  serializeCsvTable,
  type CsvTable,
  type CsvWarning,
} from "./csv";
export { readTableBlobBytes } from "./io";

export const TABLE_ENGINE_VERSION = "table-ops-v1";
export const TABLE_MAX_ROWS = 100_000;
export const TABLE_MAX_COLUMNS = 1_000;
export const TABLE_MAX_CELLS = 2_000_000;
export const TABLE_MAX_JSON_LENGTH = 50 * 1024 * 1024;
export const TABLE_MAX_REGEX_LENGTH = 512;

export type TableDelimiter = "," | ";" | "\t" | "|";
export type TableSortComparator = "lexical" | "numeric" | "date";
export type TableFilterOperator =
  | "equals"
  | "not-equals"
  | "contains"
  | "not-contains"
  | "starts-with"
  | "ends-with"
  | "regex"
  | "empty"
  | "not-empty";
export type TableJoinType = "inner" | "left" | "right" | "full";
export type TableAggregate = "count" | "sum" | "min" | "max";

export interface TableTextOptions {
  delimiter?: TableDelimiter;
  maxPreviewRows?: number;
}

export interface DelimiterCandidate {
  delimiter: TableDelimiter;
  label: string;
  recordCount: number;
  positiveRecords: number;
  modeFields: number;
  consistency: number;
  score: number;
}

export interface DelimiterDetection {
  delimiter: TableDelimiter;
  label: string;
  confidence: "high" | "medium" | "low";
  candidates: DelimiterCandidate[];
  sample: string;
  warnings: CsvWarning[];
}

export interface TablePreviewResult {
  output: string;
  table: CsvTable;
  headers: string[];
  rowCount: number;
  columnCount: number;
  previewRows: string[][];
  previewTruncated: boolean;
  engineVersion: string;
}

export interface EncodingFixResult {
  output: string;
  outputBytes: number;
  detectedEncoding: string;
  requestedEncoding?: string;
  bomRemoved: boolean;
  normalizedLineEndings: number;
  replacementCharacters: number;
  warnings: string[];
  engineVersion: string;
}

export interface TableColumnSelectionResult {
  output: string;
  table: CsvTable;
  selectedColumns: number[];
  headers: string[];
  droppedColumns: Array<{ index: number; name: string }>;
  filledMissingCells: number;
  engineVersion: string;
}

export interface TableFilterResult {
  output: string;
  table: CsvTable;
  matchedRows: number;
  rejectedRows: number;
  column: number;
  operator: TableFilterOperator;
  value: string;
  caseSensitive: boolean;
  engineVersion: string;
}

export interface TableSortResult {
  output: string;
  table: CsvTable;
  sortedRows: number;
  column: number;
  comparator: TableSortComparator;
  direction: "asc" | "desc";
  nulls: "first" | "last";
  engineVersion: string;
}

export interface TableGroupCountResult {
  output: string;
  table: CsvTable;
  groupColumns: number[];
  groups: number;
  countColumn?: number;
  aggregate: TableAggregate;
  engineVersion: string;
}

export interface TableJoinResult {
  output: string;
  table: CsvTable;
  joinType: TableJoinType;
  leftKeyColumns: number[];
  rightKeyColumns: number[];
  leftRows: number;
  rightRows: number;
  matchedRows: number;
  unmatchedLeftRows: number;
  unmatchedRightRows: number;
  engineVersion: string;
}

export interface TablePivotResult {
  output: string;
  table: CsvTable;
  groupColumns: number[];
  valueColumn?: number;
  valueHeaderColumn?: number;
  aggregateColumn?: number;
  aggregate: TableAggregate;
  valueHeaders: string[];
  groups: number;
  engineVersion: string;
}

export interface CsvToJsonResult {
  json: string;
  records: Array<Record<string, string>>;
  headers: string[];
  rowCount: number;
  headerPolicy: "preserve" | "unique";
  warnings: string[];
  engineVersion: string;
}

export interface JsonToCsvResult {
  output: string;
  table: CsvTable;
  rowCount: number;
  headers: string[];
  headerMode: "first" | "union";
  droppedKeys: string[];
  warnings: string[];
  engineVersion: string;
}

export interface TsvToCsvResult {
  output: string;
  table: CsvTable;
  inputDelimiter: "\t";
  outputDelimiter: ",";
  rowCount: number;
  columnCount: number;
  warnings: CsvWarning[];
  engineVersion: string;
}

export interface TableTransposeResult {
  output: string;
  table: CsvTable;
  sourceRows: number;
  sourceColumns: number;
  outputRows: number;
  outputColumns: number;
  engineVersion: string;
}

export interface MissingProfileColumn {
  index: number;
  name: string;
  total: number;
  missing: number;
  present: number;
  missingRate: number;
}

export interface MissingProfileResult {
  output: string;
  table: CsvTable;
  totalRows: number;
  totalMissing: number;
  columns: MissingProfileColumn[];
  engineVersion: string;
}

export type InferredColumnType = "empty" | "string" | "number" | "boolean" | "date" | "mixed";

export interface ColumnTypeProfileColumn {
  index: number;
  name: string;
  total: number;
  empty: number;
  string: number;
  number: number;
  boolean: number;
  date: number;
  dominantType: InferredColumnType;
  mixed: boolean;
}

export interface ColumnTypeProfileResult {
  output: string;
  table: CsvTable;
  totalRows: number;
  columns: ColumnTypeProfileColumn[];
  engineVersion: string;
}

export interface DuplicateRowGroup {
  rowNumber: number;
  count: number;
  values: string[];
}

export interface DuplicateProfileResult {
  output: string;
  table: CsvTable;
  totalRows: number;
  duplicateGroups: number;
  duplicateRows: number;
  groups: DuplicateRowGroup[];
  engineVersion: string;
}

export interface QuickChartPoint {
  label: string;
  value: number;
}

export interface QuickChartResult {
  chartType: "bar";
  labelColumn: number;
  valueColumn?: number;
  aggregate: TableAggregate;
  points: QuickChartPoint[];
  truncated: boolean;
  svg: string;
  table: CsvTable;
  engineVersion: string;
}

export interface TableHandoff {
  descriptor: {
    type: "table";
    format: "csv";
    version: 1;
    encoding: "utf-8";
    bytes: number;
    rowCount: number;
    columnCount: number;
    columns: string[];
    duplicateHeaders: boolean;
    raggedRows: boolean;
  };
  payload: string;
}

const DELIMITERS: readonly TableDelimiter[] = [",", ";", "\t", "|"];
const DELIMITER_LABELS: Readonly<Record<TableDelimiter, string>> = {
  ",": "comma",
  ";": "semicolon",
  "\t": "tab",
  "|": "pipe",
};

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function assertBoundedTableText(text: string): void {
  if (typeof text !== "string") throw new Error("INVALID_INPUT: text must be a string");
  if (byteLength(text) > CSV_HARD_FILE_BYTES) {
    throw new CsvCleanerError("FILE_TOO_LARGE", "Input exceeds the 50 MiB table limit.");
  }
  if (text.length > TABLE_MAX_CELLS * 4) throw new Error("TABLE_INPUT_TOO_LARGE");
}

export function assertBoundedTable(table: CsvTable): CsvTable {
  if (table.header.length > TABLE_MAX_COLUMNS) throw new Error("TABLE_TOO_MANY_COLUMNS");
  if (table.rows.length > TABLE_MAX_ROWS) throw new Error("TABLE_TOO_MANY_ROWS");
  const actualCells = table.header.length + table.rows.reduce((total, row) => total + row.length, 0);
  if (actualCells > TABLE_MAX_CELLS) throw new Error("TABLE_TOO_MANY_CELLS");
  return table;
}

function dropTerminalEmptyRow(rows: string[][], text: string): string[][] {
  const last = rows.at(-1);
  if (/\r\n$|\r$|\n$/u.test(text) && last?.length === 1 && last[0] === "") return rows.slice(0, -1);
  return rows;
}

function inspectShape(rows: readonly string[][]): CsvWarning[] {
  if (rows.length === 0) return [];
  const warnings: CsvWarning[] = [];
  const header = rows[0] ?? [];
  const seen = new Set<string>();
  for (const name of header) {
    if (seen.has(name)) {
      warnings.push({ code: "DUPLICATE_HEADER", message: `Duplicate header: ${name || "(blank)"}` });
      break;
    }
    seen.add(name);
  }
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    if (row.length !== header.length) {
      warnings.push({ code: "RAGGED_ROW", message: `Row ${index + 1} has ${row.length} cells; expected ${header.length}.`, row: index + 1 });
    }
  }
  return warnings;
}

export function parseDelimitedTable(text: string, delimiter: TableDelimiter): CsvTable {
  assertBoundedTableText(text);
  const withoutBom = text.startsWith("\uFEFF") ? text.slice(1) : text;
  if (withoutBom === "") return { header: [], rows: [], delimiter, warnings: [] };
  const parsed = Papa.parse<string[]>(withoutBom, { delimiter, skipEmptyLines: false, dynamicTyping: false });
  const fatal = parsed.errors.filter((error) => error.code !== "UndetectableDelimiter");
  if (fatal.length > 0) throw new CsvCleanerError("PARSE_ERROR", fatal.map((error) => error.message).join("; "));
  const rows = dropTerminalEmptyRow(parsed.data.map((row) => row.map((cell) => String(cell))), withoutBom);
  return assertBoundedTable({ header: [...(rows[0] ?? [])], rows: rows.slice(1).map((row) => [...row]), delimiter, warnings: inspectShape(rows) });
}

function delimiterStats(text: string, delimiter: TableDelimiter): Omit<DelimiterCandidate, "delimiter" | "label" | "score"> {
  const counts: number[] = [];
  let current = 0;
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index] ?? "";
    if (character === "\"") {
      if (inQuotes && text[index + 1] === "\"") {
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && character === delimiter) current += 1;
    if (!inQuotes && (character === "\n" || character === "\r")) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      counts.push(current);
      current = 0;
    }
  }
  if (current > 0 || counts.length === 0) counts.push(current);
  const positive = counts.filter((count) => count > 0);
  const frequency = new Map<number, number>();
  for (const count of positive) frequency.set(count, (frequency.get(count) ?? 0) + 1);
  const mode = [...frequency.entries()].toSorted((left, right) => right[1] - left[1] || right[0] - left[0])[0];
  return {
    recordCount: Math.max(0, counts.length),
    positiveRecords: positive.length,
    modeFields: mode?.[0] ?? 0,
    consistency: positive.length === 0 ? 0 : (mode?.[1] ?? 0) / positive.length,
  };
}

export function detectCsvDelimiter(text: string): DelimiterDetection {
  assertBoundedTableText(text);
  const candidates = DELIMITERS.map((delimiter) => {
    const stats = delimiterStats(text, delimiter);
    const score = stats.positiveRecords * 100 + Math.round(stats.consistency * 100) + stats.modeFields;
    return { delimiter, label: DELIMITER_LABELS[delimiter], ...stats, score };
  }).toSorted((left, right) => right.score - left.score || DELIMITERS.indexOf(left.delimiter) - DELIMITERS.indexOf(right.delimiter));
  const selected = candidates[0];
  if (selected === undefined || selected.positiveRecords === 0) {
    return {
      delimiter: ",",
      label: "comma",
      confidence: "low",
      candidates,
      sample: text.slice(0, 500),
      warnings: [{ code: "DELIMITER_FALLBACK", message: "No consistent delimiter was found; comma fallback was used." }],
    };
  }
  let table: CsvTable | undefined;
  let warnings: CsvWarning[] = [];
  try {
    table = parseDelimitedTable(text, selected.delimiter);
  } catch (error) {
    warnings = [{ code: "DELIMITER_FALLBACK", message: error instanceof Error ? error.message : "Delimiter candidate could not be parsed." }];
  }
  const confidence = selected.consistency >= 0.8 && selected.positiveRecords >= 2 ? "high" : selected.consistency >= 0.5 ? "medium" : "low";
  return { delimiter: selected.delimiter, label: selected.label, confidence, candidates, sample: table === undefined ? text.slice(0, 500) : serializeCsvTable(table).slice(0, 500), warnings };
}

export function viewCsvTable(text: string, options: TableTextOptions = {}): TablePreviewResult {
  assertBoundedTableText(text);
  const table = assertBoundedTable(options.delimiter === undefined ? parseCsvTable(text) : parseDelimitedTable(text, options.delimiter));
  const maxPreviewRows = Math.max(0, Math.min(options.maxPreviewRows ?? 100, 1000));
  return {
    output: serializeCsvTable(table),
    table,
    headers: [...table.header],
    rowCount: table.rows.length,
    columnCount: table.header.length,
    previewRows: table.rows.slice(0, maxPreviewRows).map((row) => [...row]),
    previewTruncated: table.rows.length > maxPreviewRows,
    engineVersion: TABLE_ENGINE_VERSION,
  };
}

function toBytes(value: ArrayBuffer | Uint8Array | number[]): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (Array.isArray(value) && value.every((item) => Number.isInteger(item) && item >= 0 && item <= 255)) return Uint8Array.from(value);
  throw new Error("INVALID_INPUT: bytes must be an ArrayBuffer, Uint8Array, or byte array");
}

function hasUtf8Bom(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
}

function hasUtf16LeBom(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe;
}

function hasUtf16BeBom(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff;
}

function isValidUtf8(bytes: Uint8Array): boolean {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

export function detectTextEncoding(bytes: Uint8Array): string {
  if (hasUtf8Bom(bytes)) return "utf-8";
  if (hasUtf16LeBom(bytes)) return "utf-16le";
  if (hasUtf16BeBom(bytes)) return "utf-16be";
  const sample = bytes.slice(0, Math.min(bytes.length, 4096));
  const oddZeros = sample.filter((_value, index) => index % 2 === 1 && _value === 0).length;
  const evenZeros = sample.filter((_value, index) => index % 2 === 0 && _value === 0).length;
  if (oddZeros > evenZeros * 2 && oddZeros > 2) return "utf-16le";
  if (evenZeros > oddZeros * 2 && evenZeros > 2) return "utf-16be";
  return isValidUtf8(sample) ? "utf-8" : "windows-1252";
}

function decodeBytes(bytes: Uint8Array, encoding: string): string {
  const decoder = new TextDecoder(encoding, { fatal: encoding === "utf-8" });
  return decoder.decode(bytes);
}

export function fixTableEncoding(value: ArrayBuffer | Uint8Array | number[], requestedEncoding?: string): EncodingFixResult {
  const bytes = toBytes(value);
  if (bytes.byteLength > CSV_HARD_FILE_BYTES) throw new CsvCleanerError("FILE_TOO_LARGE", "Input exceeds the 50 MiB table limit.");
  const detectedEncoding = detectTextEncoding(bytes);
  const encoding = requestedEncoding ?? detectedEncoding;
  if (!["utf-8", "utf-16le", "utf-16be", "windows-1252"].includes(encoding)) throw new Error("INVALID_ENCODING");
  const decoded = decodeBytes(bytes, encoding);
  const byteOrderMark = hasUtf8Bom(bytes) || hasUtf16LeBom(bytes) || hasUtf16BeBom(bytes);
  const decodedByteOrderMark = decoded.startsWith("\uFEFF");
  const bomRemoved = byteOrderMark || decodedByteOrderMark;
  const withoutBom = decodedByteOrderMark ? decoded.slice(1) : decoded;
  const normalized = normalizeTextLineEndings(withoutBom);
  const replacementCharacters = [...normalized.output].filter((character) => character === "\uFFFD").length;
  const warnings: string[] = [];
  if (encoding !== detectedEncoding) warnings.push(`Requested ${encoding}; detected ${detectedEncoding}.`);
  if (bomRemoved) warnings.push("Removed a leading byte-order mark.");
  if (replacementCharacters > 0) warnings.push(`${replacementCharacters} replacement character${replacementCharacters === 1 ? "" : "s"} remained after decoding.`);
  return {
    output: normalized.output,
    outputBytes: byteLength(normalized.output),
    detectedEncoding,
    ...(requestedEncoding === undefined ? {} : { requestedEncoding }),
    bomRemoved,
    normalizedLineEndings: normalized.normalized,
    replacementCharacters,
    warnings,
    engineVersion: TABLE_ENGINE_VERSION,
  };
}

function normalizeTextLineEndings(text: string): { output: string; normalized: number } {
  let output = "";
  let normalized = 0;
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index] ?? "";
    if (character === "\"") {
      if (inQuotes && text[index + 1] === "\"") {
        output += "\"\"";
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      output += character;
      continue;
    }
    if (!inQuotes && character === "\r") {
      if (text[index + 1] === "\n") index += 1;
      output += "\n";
      normalized += 1;
      continue;
    }
    output += character;
  }
  return { output, normalized };
}

function validateIndexes(indexes: readonly number[], columnCount: number, code: string): number[] {
  if (indexes.length === 0 || new Set(indexes).size !== indexes.length) throw new Error(code);
  if (indexes.some((index) => !Number.isInteger(index) || index < 0 || index >= columnCount)) throw new Error(code);
  return [...indexes];
}

function outputTable(table: CsvTable, rows: string[][], warnings: CsvWarning[] = []): CsvTable {
  return { header: [...table.header], rows: rows.map((row) => [...row]), delimiter: table.delimiter, warnings: [...table.warnings, ...warnings] };
}

export function selectTableColumns(table: CsvTable, indexes: readonly number[]): TableColumnSelectionResult {
  const selected = validateIndexes(indexes, table.header.length, "INVALID_COLUMNS");
  let filledMissingCells = 0;
  const rows = table.rows.map((row) => selected.map((index) => {
    const value = row[index];
    if (value !== undefined) return value;
    filledMissingCells += 1;
    return "";
  }));
  const headers = selected.map((index) => table.header[index] ?? "");
  const result = assertBoundedTable({ header: headers, rows, delimiter: table.delimiter, warnings: inspectShape([headers, ...rows]) });
  const selectedSet = new Set(selected);
  return {
    output: serializeCsvTable(result),
    table: result,
    selectedColumns: selected,
    headers,
    droppedColumns: table.header.flatMap((name, index) => selectedSet.has(index) ? [] : [{ index, name }]),
    filledMissingCells,
    engineVersion: TABLE_ENGINE_VERSION,
  };
}

function filterValue(value: string, operator: TableFilterOperator, query: string, caseSensitive: boolean): boolean {
  const left = caseSensitive ? value : value.toLocaleLowerCase();
  const right = caseSensitive ? query : query.toLocaleLowerCase();
  if (operator === "empty") return value.trim() === "";
  if (operator === "not-empty") return value.trim() !== "";
  if (operator === "equals") return left === right;
  if (operator === "not-equals") return left !== right;
  if (operator === "contains") return left.includes(right);
  if (operator === "not-contains") return !left.includes(right);
  if (operator === "starts-with") return left.startsWith(right);
  if (operator === "ends-with") return left.endsWith(right);
  if (query.length > TABLE_MAX_REGEX_LENGTH) throw new Error("REGEX_TOO_LARGE");
  return new RegExp(query, caseSensitive ? "u" : "iu").test(value);
}

export function filterTable(table: CsvTable, options: { column: number; operator: TableFilterOperator; value?: string; caseSensitive?: boolean }): TableFilterResult {
  const allowedOperators: readonly TableFilterOperator[] = ["equals", "not-equals", "contains", "not-contains", "starts-with", "ends-with", "regex", "empty", "not-empty"];
  if (!allowedOperators.includes(options.operator)) throw new Error("INVALID_OPERATOR");
  const column = options.column;
  if (!Number.isInteger(column) || column < 0 || column >= table.header.length) throw new Error("INVALID_COLUMN");
  const value = options.value ?? "";
  const caseSensitive = options.caseSensitive ?? true;
  const rows = table.rows.filter((row) => filterValue(row[column] ?? "", options.operator, value, caseSensitive));
  const result = assertBoundedTable(outputTable(table, rows));
  return {
    output: serializeCsvTable(result),
    table: result,
    matchedRows: rows.length,
    rejectedRows: table.rows.length - rows.length,
    column,
    operator: options.operator,
    value,
    caseSensitive,
    engineVersion: TABLE_ENGINE_VERSION,
  };
}

interface SortValue {
  missing: boolean;
  key: string | number;
}

function rowValue(value: string, comparator: TableSortComparator, caseSensitive: boolean): SortValue {
  if (value.trim() === "") return { missing: true, key: "" };
  if (comparator === "numeric") {
    const key = Number(value);
    return { missing: !Number.isFinite(key), key };
  }
  if (comparator === "date") {
    const key = Date.parse(value);
    return { missing: Number.isNaN(key), key };
  }
  return { missing: false, key: caseSensitive ? value : value.toLocaleLowerCase() };
}

export function sortTable(table: CsvTable, options: { column: number; direction?: "asc" | "desc"; comparator?: TableSortComparator; nulls?: "first" | "last"; caseSensitive?: boolean }): TableSortResult {
  const column = options.column;
  if (!Number.isInteger(column) || column < 0 || column >= table.header.length) throw new Error("INVALID_COLUMN");
  const direction = options.direction ?? "asc";
  const comparator = options.comparator ?? "lexical";
  const nulls = options.nulls ?? "last";
  const caseSensitive = options.caseSensitive ?? true;
  const indexed = table.rows.map((row, index) => ({ row, index }));
  indexed.sort((left, right) => {
    const leftValue = rowValue(left.row[column] ?? "", comparator, caseSensitive);
    const rightValue = rowValue(right.row[column] ?? "", comparator, caseSensitive);
    if (leftValue.missing !== rightValue.missing) return nulls === "first" ? (leftValue.missing ? -1 : 1) : (leftValue.missing ? 1 : -1);
    if (leftValue.missing && rightValue.missing) return left.index - right.index;
    let comparison = 0;
    if (typeof leftValue.key === "number" && typeof rightValue.key === "number") comparison = leftValue.key - rightValue.key;
    else comparison = String(leftValue.key).localeCompare(String(rightValue.key), "en", { numeric: false, sensitivity: caseSensitive ? "variant" : "base" });
    if (comparison === 0) return left.index - right.index;
    return direction === "asc" ? comparison : -comparison;
  });
  const result = assertBoundedTable(outputTable(table, indexed.map(({ row }) => row)));
  return { output: serializeCsvTable(result), table: result, sortedRows: result.rows.length, column, comparator, direction, nulls, engineVersion: TABLE_ENGINE_VERSION };
}

function keyFor(values: readonly string[], caseSensitive: boolean): string {
  return JSON.stringify(values.map((value) => caseSensitive ? value : value.toLocaleLowerCase()));
}

export function groupCountTable(table: CsvTable, options: { groupColumns: readonly number[]; countColumn?: number; aggregate?: TableAggregate }): TableGroupCountResult {
  const groupColumns = validateIndexes(options.groupColumns, table.header.length, "INVALID_GROUP_COLUMNS");
  if (options.countColumn !== undefined && (!Number.isInteger(options.countColumn) || options.countColumn < 0 || options.countColumn >= table.header.length)) throw new Error("INVALID_COUNT_COLUMN");
  const aggregate = options.aggregate ?? "count";
  if (aggregate !== "count" && options.countColumn === undefined) throw new Error("VALUE_COLUMN_REQUIRED");
  const groups = new Map<string, { values: string[]; count: number; numeric: number[] }>();
  for (const row of table.rows) {
    const values = groupColumns.map((column) => row[column] ?? "");
    const key = JSON.stringify(values);
    const current = groups.get(key) ?? { values, count: 0, numeric: [] };
    current.count += 1;
    if (options.countColumn !== undefined) {
      const raw = row[options.countColumn] ?? "";
      if (aggregate === "count") current.count += 0;
      else {
        const number = Number(raw);
        if (raw.trim() !== "" && Number.isFinite(number)) current.numeric.push(number);
        else if (raw.trim() !== "") throw new Error("INVALID_NUMERIC_VALUE");
      }
    }
    groups.set(key, current);
  }
  const outputHeader = [...groupColumns.map((index) => table.header[index] ?? `column_${index + 1}`), "count"];
  const outputRows = [...groups.values()].map((group) => {
    let count = group.count;
    if (aggregate === "sum") count = group.numeric.reduce((total, value) => total + value, 0);
    if (aggregate === "min") count = group.numeric.length === 0 ? 0 : Math.min(...group.numeric);
    if (aggregate === "max") count = group.numeric.length === 0 ? 0 : Math.max(...group.numeric);
    return [...group.values, String(count)];
  });
  const result = assertBoundedTable({ header: outputHeader, rows: outputRows, delimiter: table.delimiter, warnings: [...table.warnings] });
  return { output: serializeCsvTable(result), table: result, groupColumns, groups: result.rows.length, ...(options.countColumn === undefined ? {} : { countColumn: options.countColumn }), aggregate, engineVersion: TABLE_ENGINE_VERSION };
}

function uniqueHeaders(headers: readonly string[], suffix = ""): string[] {
  const used = new Set<string>();
  return headers.map((raw, index) => {
    const base = `${raw.trim() || `column_${index + 1}`}${suffix}`;
    let candidate = base;
    let suffixIndex = 2;
    while (used.has(candidate)) {
      candidate = `${base}_${suffixIndex}`;
      suffixIndex += 1;
    }
    used.add(candidate);
    return candidate;
  });
}

export function joinCsvTables(left: CsvTable, right: CsvTable, options: { leftKeyColumns: readonly number[]; rightKeyColumns: readonly number[]; joinType?: TableJoinType; caseSensitive?: boolean; suffix?: string }): TableJoinResult {
  const joinType = options.joinType ?? "inner";
  const caseSensitive = options.caseSensitive ?? true;
  const suffix = options.suffix ?? "_right";
  const leftKeys = validateIndexes(options.leftKeyColumns, left.header.length, "INVALID_LEFT_KEY_COLUMNS");
  const rightKeys = validateIndexes(options.rightKeyColumns, right.header.length, "INVALID_RIGHT_KEY_COLUMNS");
  if (leftKeys.length !== rightKeys.length) throw new Error("KEY_COLUMN_COUNT_MISMATCH");
  const rightMap = new Map<string, Array<{ row: string[]; index: number }>>();
  for (let index = 0; index < right.rows.length; index += 1) {
    const row = right.rows[index] ?? [];
    const key = keyFor(rightKeys.map((column) => row[column] ?? ""), caseSensitive);
    const current = rightMap.get(key) ?? [];
    current.push({ row, index });
    rightMap.set(key, current);
  }
  const usedHeaders = new Set<string>();
  const allocateHeader = (raw: string, index: number, headerSuffix: string): string => {
    const base = `${raw.trim() || `column_${index + 1}`}${headerSuffix}`;
    let candidate = base;
    let suffixIndex = 2;
    while (usedHeaders.has(candidate)) {
      candidate = `${base}_${suffixIndex}`;
      suffixIndex += 1;
    }
    usedHeaders.add(candidate);
    return candidate;
  };
  const outputHeader = [
    ...left.header.map((name, index) => allocateHeader(name, index, "")),
    ...right.header.map((name, index) => allocateHeader(name, index, suffix)),
  ];
  if (outputHeader.length > TABLE_MAX_COLUMNS) throw new Error("TABLE_TOO_MANY_COLUMNS");
  const outputRows: string[][] = [];
  const matchedRight = new Set<number>();
  const unmatchedLeft: string[] = [];
  let matchedOutputRows = 0;
  let projectedRows = 0;
  for (const leftRow of left.rows) {
    const key = keyFor(leftKeys.map((column) => leftRow[column] ?? ""), caseSensitive);
    const matches = rightMap.get(key) ?? [];
    projectedRows += matches.length === 0 ? (joinType === "left" || joinType === "full" ? 1 : 0) : matches.length;
    if (projectedRows > TABLE_MAX_ROWS) throw new Error("TABLE_RESULT_TOO_LARGE");
    if (matches.length === 0) {
      unmatchedLeft.push(key);
      if (joinType === "left" || joinType === "full") outputRows.push([...leftRow, ...right.header.map(() => "")]);
      continue;
    }
    for (const match of matches) {
      matchedRight.add(match.index);
      outputRows.push([...leftRow, ...match.row]);
      matchedOutputRows += 1;
    }
  }
  if (joinType === "right" || joinType === "full") {
    projectedRows += [...Array(right.rows.length).keys()].filter((index) => !matchedRight.has(index)).length;
    if (projectedRows > TABLE_MAX_ROWS) throw new Error("TABLE_RESULT_TOO_LARGE");
    for (let index = 0; index < right.rows.length; index += 1) {
      if (!matchedRight.has(index)) outputRows.push([...left.header.map(() => ""), ...(right.rows[index] ?? [])]);
    }
  }
  const result = assertBoundedTable({ header: outputHeader, rows: outputRows, delimiter: left.delimiter, warnings: [...left.warnings, ...right.warnings] });
  return {
    output: serializeCsvTable(result),
    table: result,
    joinType,
    leftKeyColumns: leftKeys,
    rightKeyColumns: rightKeys,
    leftRows: left.rows.length,
    rightRows: right.rows.length,
    matchedRows: matchedOutputRows,
    unmatchedLeftRows: unmatchedLeft.length,
    unmatchedRightRows: [...Array(right.rows.length).keys()].filter((index) => !matchedRight.has(index)).length,
    engineVersion: TABLE_ENGINE_VERSION,
  };
}

export function pivotTable(table: CsvTable, options: { groupColumns: readonly number[]; valueColumn?: number; valueHeaderColumn?: number; aggregateColumn?: number; aggregate?: TableAggregate }): TablePivotResult {
  const groupColumns = validateIndexes(options.groupColumns, table.header.length, "INVALID_GROUP_COLUMNS");
  const aggregate = options.aggregate ?? "sum";
  const valueHeaderColumn = options.valueHeaderColumn;
  const aggregateColumn = options.aggregateColumn ?? options.valueColumn;
  if (valueHeaderColumn !== undefined && (!Number.isInteger(valueHeaderColumn) || valueHeaderColumn < 0 || valueHeaderColumn >= table.header.length)) throw new Error("INVALID_VALUE_HEADER_COLUMN");
  if (aggregateColumn !== undefined && (!Number.isInteger(aggregateColumn) || aggregateColumn < 0 || aggregateColumn >= table.header.length)) throw new Error("INVALID_VALUE_COLUMN");
  if (aggregate !== "count" && aggregateColumn === undefined) throw new Error("VALUE_COLUMN_REQUIRED");
  const groups = new Map<string, string[]>();
  const values = new Set<string>();
  for (const row of table.rows) {
    const groupValues = groupColumns.map((column) => row[column] ?? "");
    const groupKey = JSON.stringify(groupValues);
    if (!groups.has(groupKey)) groups.set(groupKey, groupValues);
    const value = valueHeaderColumn === undefined ? (aggregateColumn === undefined ? "count" : row[aggregateColumn] ?? "") : row[valueHeaderColumn] ?? "";
    values.add(value);
  }
  const valueHeaders = [...values];
  if (groupColumns.length + valueHeaders.length > TABLE_MAX_COLUMNS) throw new Error("TABLE_TOO_MANY_COLUMNS");
  const records = new Map<string, Array<{ seen: boolean; value: number }>>();
  for (const groupKey of groups.keys()) records.set(groupKey, valueHeaders.map(() => ({ seen: false, value: 0 })));
  for (const row of table.rows) {
    const groupKey = JSON.stringify(groupColumns.map((column) => row[column] ?? ""));
    const value = valueHeaderColumn === undefined ? (aggregateColumn === undefined ? "count" : row[aggregateColumn] ?? "") : row[valueHeaderColumn] ?? "";
    const valueIndex = valueHeaders.indexOf(value);
    const target = records.get(groupKey);
    const cell = target?.[valueIndex];
    if (cell === undefined) continue;
    if (aggregate === "count") {
      cell.seen = true;
      cell.value += 1;
      continue;
    }
    const rawNumber = aggregateColumn === undefined ? "" : row[aggregateColumn] ?? "";
    if (rawNumber.trim() === "") continue;
    const number = Number(rawNumber);
    if (!Number.isFinite(number)) throw new Error("INVALID_NUMERIC_VALUE");
    if (!cell.seen) {
      cell.seen = true;
      cell.value = number;
    } else if (aggregate === "sum") cell.value += number;
    else if (aggregate === "min") cell.value = Math.min(cell.value, number);
    else cell.value = Math.max(cell.value, number);
  }
  const outputHeader = [...groupColumns.map((index) => table.header[index] ?? `column_${index + 1}`), ...valueHeaders];
  const outputRows = [...groups.values()].map((groupValues) => {
    const groupKey = JSON.stringify(groupValues);
    return [...groupValues, ...(records.get(groupKey) ?? valueHeaders.map(() => ({ seen: false, value: 0 }))).map((cell) => cell.seen ? String(cell.value) : "")];
  });
  const result = assertBoundedTable({ header: outputHeader, rows: outputRows, delimiter: table.delimiter, warnings: [...table.warnings] });
  return { output: serializeCsvTable(result), table: result, groupColumns, ...(options.valueColumn === undefined ? {} : { valueColumn: options.valueColumn }), ...(valueHeaderColumn === undefined ? {} : { valueHeaderColumn }), ...(options.aggregateColumn === undefined ? {} : { aggregateColumn: options.aggregateColumn }), aggregate, valueHeaders, groups: outputRows.length, engineVersion: TABLE_ENGINE_VERSION };
}

export function csvTableToJson(text: string, options: { headerPolicy?: "preserve" | "unique"; pretty?: boolean } = {}): CsvToJsonResult {
  assertBoundedTableText(text);
  const table = assertBoundedTable(parseCsvTable(text));
  const headerPolicy = options.headerPolicy ?? "unique";
  if (headerPolicy === "preserve" && new Set(table.header).size !== table.header.length) throw new Error("DUPLICATE_HEADERS_REQUIRE_UNIQUE");
  if (table.rows.some((row) => row.length > table.header.length)) throw new Error("RAGGED_ROWS_REQUIRE_EXPANSION");
  const headers = headerPolicy === "unique" ? uniqueHeaders(table.header) : [...table.header];
  const records = table.rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
  const warnings = table.warnings.map((warning) => warning.message);
  return { json: JSON.stringify(records, null, options.pretty === true ? 2 : 0), records, headers, rowCount: records.length, headerPolicy, warnings, engineVersion: TABLE_ENGINE_VERSION };
}

function jsonValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  return JSON.stringify(value);
}

export function jsonToCsvTable(json: string, options: { headerMode?: "first" | "union" } = {}): JsonToCsvResult {
  if (typeof json !== "string" || byteLength(json) > TABLE_MAX_JSON_LENGTH) throw new Error("INVALID_JSON_INPUT");
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("INVALID_JSON");
  }
  const records = Array.isArray(parsed) ? parsed : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { data?: unknown }).data) ? (parsed as { data: unknown[] }).data : null;
  if (records === null || records.length === 0) throw new Error("JSON_ARRAY_REQUIRED");
  if (records.some((record) => typeof record !== "object" || record === null || Array.isArray(record))) throw new Error("JSON_OBJECT_ROWS_REQUIRED");
  const objects = records as Array<Record<string, unknown>>;
  const headerMode = options.headerMode ?? "first";
  const firstKeys = Object.keys(objects[0] ?? {});
  const headers = headerMode === "union" ? uniqueHeaders([...new Set(objects.flatMap((record) => Object.keys(record)))]) : uniqueHeaders(firstKeys);
  const droppedKeys = [...new Set(objects.flatMap((record) => Object.keys(record).filter((key) => !headers.includes(key))))];
  const rows = objects.map((record) => headers.map((header) => jsonValue(record[header])));
  const result = assertBoundedTable({ header: headers, rows, delimiter: ",", warnings: [] });
  const warnings = droppedKeys.length > 0 ? [`Keys not present in the selected header mode were omitted: ${droppedKeys.join(", ")}.`] : [];
  return { output: serializeCsvTable(result), table: result, rowCount: rows.length, headers, headerMode, droppedKeys, warnings, engineVersion: TABLE_ENGINE_VERSION };
}

export function tsvToCsv(text: string): TsvToCsvResult {
  const table = assertBoundedTable(parseDelimitedTable(text, "\t"));
  const outputTable: CsvTable = { header: [...table.header], rows: table.rows.map((row) => [...row]), delimiter: ",", warnings: [...table.warnings] };
  return { output: serializeCsvTable(outputTable), table: outputTable, inputDelimiter: "\t", outputDelimiter: ",", rowCount: outputTable.rows.length, columnCount: outputTable.header.length, warnings: outputTable.warnings, engineVersion: TABLE_ENGINE_VERSION };
}

export function transposeTable(table: CsvTable): TableTransposeResult {
  const width = table.header.length;
  const sourceRows = table.rows.length;
  const headers = uniqueHeaders(table.header);
  const outputRows = Array.from({ length: width }, (_, column) => [headers[column] ?? `column_${column + 1}`, ...table.rows.map((row) => row[column] ?? "")]);
  const output = assertBoundedTable({ header: ["field", ...headers], rows: outputRows, delimiter: table.delimiter, warnings: [...table.warnings] });
  return { output: serializeCsvTable(output), table: output, sourceRows, sourceColumns: width, outputRows: outputRows.length, outputColumns: headers.length + 1, engineVersion: TABLE_ENGINE_VERSION };
}

export function profileMissingValues(table: CsvTable): MissingProfileResult {
  const totalRows = table.rows.length;
  const columns = table.header.map((name, index) => {
    const missing = table.rows.reduce((count, row) => count + ((row[index] ?? "").trim() === "" ? 1 : 0), 0);
    return { index, name, total: totalRows, missing, present: totalRows - missing, missingRate: totalRows === 0 ? 0 : missing / totalRows };
  });
  return { output: serializeCsvTable(table), table, totalRows, totalMissing: columns.reduce((sum, column) => sum + column.missing, 0), columns, engineVersion: TABLE_ENGINE_VERSION };
}

function inferCellType(value: string): Exclude<InferredColumnType, "empty" | "mixed"> | "empty" {
  if (value.trim() === "") return "empty";
  if (/^(?:true|false)$/iu.test(value.trim())) return "boolean";
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/u.test(value.trim()) && Number.isFinite(Number(value))) return "number";
  if (/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/u.test(value.trim()) && !Number.isNaN(Date.parse(value))) return "date";
  return "string";
}

export function profileColumnTypes(table: CsvTable): ColumnTypeProfileResult {
  const columns = table.header.map((name, index) => {
    const counts: Record<Exclude<InferredColumnType, "mixed">, number> = { empty: 0, string: 0, number: 0, boolean: 0, date: 0 };
    for (const row of table.rows) counts[inferCellType(row[index] ?? "") as Exclude<InferredColumnType, "mixed">] += 1;
    const nonEmpty = Object.entries(counts).filter(([type]) => type !== "empty") as Array<[Exclude<InferredColumnType, "mixed">, number]>;
    const sorted = nonEmpty.toSorted((left, right) => right[1] - left[1]);
    const mixed = new Set(nonEmpty.filter(([, count]) => count > 0).map(([type]) => type)).size > 1;
    const dominantType: InferredColumnType = (sorted[0]?.[1] ?? 0) === 0 ? "empty" : mixed && sorted[1]?.[1] === sorted[0]?.[1] ? "mixed" : sorted[0]![0];
    return { index, name, total: table.rows.length, ...counts, dominantType, mixed };
  });
  return { output: serializeCsvTable(table), table, totalRows: table.rows.length, columns, engineVersion: TABLE_ENGINE_VERSION };
}

export function profileDuplicateRows(table: CsvTable, options: { keyColumns?: readonly number[]; maxExamples?: number } = {}): DuplicateProfileResult {
  const keyColumns = options.keyColumns === undefined ? undefined : validateIndexes(options.keyColumns, table.header.length, "INVALID_KEY_COLUMNS");
  const seen = new Map<string, { count: number; values: string[]; firstRow: number }>();
  for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex += 1) {
    const row = table.rows[rowIndex] ?? [];
    const values = keyColumns === undefined ? [...row] : keyColumns.map((column) => row[column] ?? "");
    const key = JSON.stringify(values);
    const current = seen.get(key) ?? { count: 0, values, firstRow: rowIndex + 2 };
    current.count += 1;
    seen.set(key, current);
  }
  const maxExamples = Math.max(0, Math.min(options.maxExamples ?? 100, 1000));
  const groups: DuplicateRowGroup[] = [];
  for (const group of seen.values()) {
    if (group.count > 1 && groups.length < maxExamples) groups.push({ rowNumber: group.firstRow, count: group.count, values: group.values });
  }
  return { output: serializeCsvTable(table), table, totalRows: table.rows.length, duplicateGroups: [...seen.values()].filter((group) => group.count > 1).length, duplicateRows: [...seen.values()].reduce((sum, group) => sum + Math.max(0, group.count - 1), 0), groups, engineVersion: TABLE_ENGINE_VERSION };
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export function quickChartFromTable(table: CsvTable, options: { labelColumn: number; valueColumn?: number; aggregate?: TableAggregate; maxBars?: number }): QuickChartResult {
  const labelColumn = options.labelColumn;
  if (!Number.isInteger(labelColumn) || labelColumn < 0 || labelColumn >= table.header.length) throw new Error("INVALID_LABEL_COLUMN");
  if (options.valueColumn !== undefined && (!Number.isInteger(options.valueColumn) || options.valueColumn < 0 || options.valueColumn >= table.header.length)) throw new Error("INVALID_VALUE_COLUMN");
  const aggregate = options.aggregate ?? (options.valueColumn === undefined ? "count" : "sum");
  if (aggregate !== "count" && options.valueColumn === undefined) throw new Error("VALUE_COLUMN_REQUIRED");
  const maxBars = Math.max(1, Math.min(options.maxBars ?? 30, 100));
  const points = new Map<string, number>();
  for (const row of table.rows) {
    const label = row[labelColumn] ?? "";
    if (label.trim() === "") continue;
    const value = options.valueColumn === undefined ? 1 : Number(row[options.valueColumn] ?? "");
    if (options.valueColumn !== undefined && !Number.isFinite(value)) throw new Error("INVALID_NUMERIC_VALUE");
    const current = points.get(label);
    points.set(label, aggregate === "count" ? (current ?? 0) + 1 : aggregate === "sum" ? (current ?? 0) + value : aggregate === "min" ? current === undefined ? value : Math.min(current, value) : current === undefined ? value : Math.max(current, value));
  }
  const allPoints = [...points.entries()].map(([label, value]) => ({ label, value }));
  const selected = allPoints.slice(0, maxBars);
  const maxValue = Math.max(1, ...selected.map((point) => Math.abs(point.value)));
  const width = 640;
  const height = Math.max(120, selected.length * 28 + 30);
  const barWidth = width - 160;
  const bars = selected.map((point, index) => {
    const y = 20 + index * 28;
    const barHeight = Math.max(2, Math.round(Math.abs(point.value) / maxValue * 18));
    return `<g><text x="0" y="${y + 13}" font-size="12">${escapeXml(point.label.slice(0, 22))}</text><rect x="150" y="${y}" width="${barWidth}" height="18" fill="transparent"></rect><rect x="150" y="${y + (18 - barHeight) / 2}" width="${Math.max(1, Math.round(Math.abs(point.value) / maxValue * barWidth))}" height="${barHeight}" rx="3"></rect><text x="${width}" y="${y + 13}" text-anchor="end" font-size="12">${escapeXml(String(point.value))}</text></g>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Bar chart"><rect width="100%" height="100%" fill="transparent"></rect>${bars}</svg>`;
  return { chartType: "bar", labelColumn, ...(options.valueColumn === undefined ? {} : { valueColumn: options.valueColumn }), aggregate, points: selected, truncated: allPoints.length > selected.length, svg, table, engineVersion: TABLE_ENGINE_VERSION };
}

export function makeTableHandoff(payload: string, table: CsvTable): TableHandoff {
  return {
    descriptor: {
      type: "table",
      format: "csv",
      version: 1,
      encoding: "utf-8",
      bytes: byteLength(payload),
      rowCount: table.rows.length,
      columnCount: table.header.length,
      columns: [...table.header],
      duplicateHeaders: new Set(table.header).size !== table.header.length,
      raggedRows: table.rows.some((row) => row.length !== table.header.length),
    },
    payload,
  };
}

export { parseDelimitedTable as parseTableDelimitedText };
