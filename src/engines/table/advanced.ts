import { parseCsvTable, serializeCsvTable, type CsvTable, type CsvWarning } from "./csv";

export const TABLE_ADVANCED_ENGINE_VERSION = "table-advanced-v1";
export const CSV_SPLIT_READ_CHUNK_BYTES = 256 * 1024;
export const CSV_SPLIT_MAX_RECORD_CHARS = 1024 * 1024;
export const CSV_SPLIT_MAX_CHUNK_BYTES = 8 * 1024 * 1024;
export const CSV_SPLIT_MAX_CHUNKS = 500;
export const TABLE_COMPARE_MAX_DIFF_ROWS = 200_000;

const textEncoder = new TextEncoder();

function bytes(value: string): number {
  return textEncoder.encode(value).byteLength;
}

function ensureRunning(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
}

function requireIndexes(indexes: readonly number[], columnCount: number, code: string): number[] {
  if (indexes.length === 0 || new Set(indexes).size !== indexes.length) throw new Error(code);
  if (indexes.some((index) => !Number.isInteger(index) || index < 0 || index >= columnCount)) throw new Error(code);
  return [...indexes];
}

export type SqlDialect = "postgresql" | "mysql" | "sqlite";
export type SqlColumnType = "text" | "integer" | "real" | "boolean" | "date";

export interface CsvToSqlOptions {
  readonly dialect: SqlDialect;
  readonly tableName: string;
  readonly typeOverrides?: Readonly<Record<number, SqlColumnType>>;
  readonly nullTokens?: readonly string[];
  readonly emptyAsNull?: boolean;
  readonly includeCreateTable?: boolean;
}

export interface CsvToSqlResult {
  readonly output: string;
  readonly table: CsvTable;
  readonly dialect: SqlDialect;
  readonly tableName: string;
  readonly columns: readonly { readonly index: number; readonly name: string; readonly type: SqlColumnType; readonly sqlType: string; readonly source: "inferred" | "override" }[];
  readonly nullPolicy: { readonly tokens: readonly string[]; readonly emptyAsNull: boolean };
  readonly sqlPreview: string;
  readonly sqlPreviewTruncated: boolean;
  readonly rowCount: number;
  readonly engineVersion: string;
}

const INTEGER_RE = /^[+-]?(?:0|[1-9]\d*)$/u;
const LEADING_ZERO_INTEGER_RE = /^[+-]?0\d+$/u;
const REAL_RE = /^[+-]?(?:(?:\d+\.\d*)|(?:\d*\.\d+)|(?:\d+))(?:[eE][+-]?\d+)?$/u;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/u;

function dateValue(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isNullCell(value: string, nullTokens: readonly string[], emptyAsNull: boolean): boolean {
  return (emptyAsNull && value === "") || nullTokens.includes(value);
}

function inferSqlType(values: readonly string[], nullTokens: readonly string[], emptyAsNull: boolean): SqlColumnType {
  const present = values.filter((value) => !isNullCell(value, nullTokens, emptyAsNull));
  if (present.length === 0) return "text";
  if (present.some((value) => LEADING_ZERO_INTEGER_RE.test(value))) return "text";
  if (present.every((value) => INTEGER_RE.test(value))) return "integer";
  if (present.every((value) => REAL_RE.test(value) && Number.isFinite(Number(value)))) return "real";
  if (present.every((value) => /^(?:true|false)$/iu.test(value))) return "boolean";
  if (present.every(dateValue)) return "date";
  return "text";
}

function sqlType(dialect: SqlDialect, type: SqlColumnType): string {
  if (type === "text") return "TEXT";
  if (type === "integer") return dialect === "sqlite" ? "INTEGER" : "BIGINT";
  if (type === "real") return dialect === "postgresql" ? "DOUBLE PRECISION" : dialect === "mysql" ? "DOUBLE" : "REAL";
  if (type === "boolean") return dialect === "sqlite" ? "INTEGER" : "BOOLEAN";
  return dialect === "sqlite" ? "TEXT" : "DATE";
}

export function quoteSqlIdentifier(identifier: string, dialect: SqlDialect): string {
  if (identifier.length === 0) throw new Error("INVALID_SQL_IDENTIFIER: identifier cannot be empty");
  if (identifier.includes("\u0000")) throw new Error("INVALID_SQL_IDENTIFIER: NUL is not allowed");
  if (dialect === "mysql") return `\`${identifier.replaceAll("`", "``")}\``;
  return `"${identifier.replaceAll('"', '""')}"`;
}

function quoteSqlString(value: string, dialect: SqlDialect): string {
  if (value.includes("\u0000")) throw new Error("INVALID_SQL_VALUE: NUL is not allowed in generated SQL text");
  const escapedQuotes = value.replaceAll("'", "''");
  if (dialect === "postgresql") return `E'${escapedQuotes.replaceAll("\\", "\\\\")}'`;
  if (dialect === "mysql") return `'${escapedQuotes.replaceAll("\\", "\\\\")}'`;
  return `'${escapedQuotes}'`;
}

function canonicalInteger(value: string): string {
  if (!/^[+-]?\d+$/u.test(value)) throw new Error(`INVALID_SQL_VALUE: ${value} is not an integer`);
  const sign = value.startsWith("-") ? "-" : "";
  const unsigned = value.replace(/^[+-]/u, "").replace(/^0+(?=\d)/u, "");
  return `${sign}${unsigned}`;
}

function renderSqlValue(value: string, type: SqlColumnType, dialect: SqlDialect, nullTokens: readonly string[], emptyAsNull: boolean): string {
  if (isNullCell(value, nullTokens, emptyAsNull)) return "NULL";
  if (type === "text" || type === "date") {
    if (type === "date" && !dateValue(value)) throw new Error(`INVALID_SQL_VALUE: ${value} is not an ISO date`);
    return quoteSqlString(value, dialect);
  }
  if (type === "integer") return canonicalInteger(value);
  if (type === "real") {
    if (!REAL_RE.test(value) || !Number.isFinite(Number(value))) throw new Error(`INVALID_SQL_VALUE: ${value} is not a finite real number`);
    return value.startsWith("+") ? value.slice(1) : value;
  }
  if (!/^(?:true|false)$/iu.test(value)) throw new Error(`INVALID_SQL_VALUE: ${value} is not a boolean`);
  const truthy = value.toLowerCase() === "true";
  return dialect === "sqlite" ? (truthy ? "1" : "0") : (truthy ? "TRUE" : "FALSE");
}

export function csvTableToSql(table: CsvTable, options: CsvToSqlOptions): CsvToSqlResult {
  const tableName = options.tableName.trim();
  if (tableName === "") throw new Error("INVALID_SQL_IDENTIFIER: table name is required");
  if (new Set(table.header).size !== table.header.length || table.header.some((name) => name === "")) {
    throw new Error("INVALID_SQL_SCHEMA: headers must be non-empty and unique");
  }
  const nullTokens = [...new Set(options.nullTokens ?? ["NULL"])];
  const emptyAsNull = options.emptyAsNull ?? false;
  const typeOverrides = options.typeOverrides ?? {};
  for (const [rawIndex, type] of Object.entries(typeOverrides)) {
    const index = Number(rawIndex);
    if (!Number.isInteger(index) || index < 0 || index >= table.header.length) throw new Error("INVALID_SQL_TYPE_OVERRIDE: column index is out of range");
    if (!(new Set<SqlColumnType>(["text", "integer", "real", "boolean", "date"])).has(type)) throw new Error("INVALID_SQL_TYPE_OVERRIDE: unsupported type");
  }
  const columnTypes = table.header.map((name, index) => {
    const override = typeOverrides[index];
    const type = override ?? inferSqlType(table.rows.map((row) => row[index] ?? ""), nullTokens, emptyAsNull);
    return { index, name, type, sqlType: sqlType(options.dialect, type), source: override === undefined ? "inferred" as const : "override" as const };
  });
  const quotedTable = quoteSqlIdentifier(tableName, options.dialect);
  const quotedColumns = table.header.map((name) => quoteSqlIdentifier(name, options.dialect));
  const statements: string[] = [];
  if (options.includeCreateTable ?? true) {
    statements.push(`CREATE TABLE ${quotedTable} (\n${columnTypes.map((column) => `  ${quoteSqlIdentifier(column.name, options.dialect)} ${column.sqlType}`).join(",\n")}\n);`);
  }
  if (table.rows.length > 0) {
    const renderedRows = table.rows.map((row, rowIndex) => {
      if (row.length > table.header.length) throw new Error(`INVALID_SQL_ROW: row ${rowIndex + 2} has more cells than the header`);
      const values = columnTypes.map((column) => renderSqlValue(row[column.index] ?? "", column.type, options.dialect, nullTokens, emptyAsNull));
      return `(${values.join(", ")})`;
    });
    statements.push(`INSERT INTO ${quotedTable} (${quotedColumns.join(", ")}) VALUES\n${renderedRows.join(",\n")};`);
  }
  const output = statements.join("\n\n");
  const previewLimit = 6000;
  return {
    output,
    table,
    dialect: options.dialect,
    tableName,
    columns: columnTypes,
    nullPolicy: { tokens: nullTokens, emptyAsNull },
    sqlPreview: output.slice(0, previewLimit),
    sqlPreviewTruncated: output.length > previewLimit,
    rowCount: table.rows.length,
    engineVersion: TABLE_ADVANCED_ENGINE_VERSION,
  };
}

export function csvTextToSql(text: string, options: CsvToSqlOptions): CsvToSqlResult {
  return csvTableToSql(parseCsvTable(text), options);
}

export type CsvSplitMode = "rows" | "bytes";

export interface CsvSplitOptions {
  readonly mode: CsvSplitMode;
  readonly rowsPerChunk?: number;
  readonly targetBytes?: number;
  readonly readChunkBytes?: number;
  readonly onProgress?: (fraction: number) => void;
}

export interface CsvSplitChunk {
  readonly index: number;
  readonly filename: string;
  readonly content: string;
  readonly rowCount: number;
  readonly bytes: number;
}

export interface CsvSplitResult {
  readonly output: string;
  readonly table: CsvTable;
  readonly chunks: readonly CsvSplitChunk[];
  readonly rowCount: number;
  readonly delimiter: string;
  readonly recordSeparator: "\n" | "\r\n" | "\r";
  readonly repeatedHeader: string;
  readonly mode: CsvSplitMode;
  readonly peakParserBufferUpperBoundBytes: number;
  readonly readChunkBytes: number;
  readonly engineVersion: string;
}

class CsvStreamingRecordSplitter {
  currentRecord = "";
  inQuotes = false;
  quotePending = false;
  pendingCarriageReturn = false;
  peakRecordChars = 0;

  constructor(private readonly onRecord: (record: string, separator: "\n" | "\r\n" | "\r" | null) => void, private readonly signal?: AbortSignal) {}

  private append(char: string): void {
    this.currentRecord += char;
    if (this.currentRecord.length > CSV_SPLIT_MAX_RECORD_CHARS) throw new Error("CSV_RECORD_TOO_LARGE: one logical record exceeds the 1 MiB character ceiling");
    this.peakRecordChars = Math.max(this.peakRecordChars, this.currentRecord.length);
  }

  private finish(separator: "\n" | "\r\n" | "\r" | null): void {
    const record = this.currentRecord;
    this.currentRecord = "";
    this.onRecord(record, separator);
  }

  push(text: string): void {
    for (let index = 0; index < text.length; index += 1) {
      if ((index & 0x3fff) === 0) ensureRunning(this.signal);
      const char = text[index] ?? "";

      if (this.pendingCarriageReturn) {
        this.pendingCarriageReturn = false;
        if (char === "\n") {
          this.finish("\r\n");
          continue;
        }
        this.finish("\r");
      }

      if (this.inQuotes) {
        if (this.quotePending) {
          if (char === '"') {
            this.append(char);
            this.quotePending = false;
            continue;
          }
          this.inQuotes = false;
          this.quotePending = false;
        } else if (char === '"') {
          this.append(char);
          this.quotePending = true;
          continue;
        } else {
          this.append(char);
          continue;
        }
      }

      if (char === '"') {
        this.append(char);
        this.inQuotes = true;
      } else if (char === "\r") {
        this.pendingCarriageReturn = true;
      } else if (char === "\n") {
        this.finish("\n");
      } else {
        this.append(char);
      }
    }
  }

  end(): void {
    ensureRunning(this.signal);
    if (this.pendingCarriageReturn) {
      this.pendingCarriageReturn = false;
      this.finish("\r");
      return;
    }
    if (this.quotePending) {
      this.quotePending = false;
      this.inQuotes = false;
    }
    if (this.inQuotes) throw new Error("CSV_PARSE_ERROR: unterminated quoted field");
    if (this.currentRecord !== "") this.finish(null);
  }
}

function positiveInteger(value: number | undefined, fallback: number, code: string): number {
  const normalized = value ?? fallback;
  if (!Number.isSafeInteger(normalized) || normalized <= 0) throw new Error(code);
  return normalized;
}

export async function splitCsvBlob(blob: Blob, options: CsvSplitOptions, signal?: AbortSignal): Promise<CsvSplitResult> {
  ensureRunning(signal);
  if (blob.size === 0) throw new Error("INVALID_INPUT: CSV is empty");
  if (blob.size > 50 * 1024 * 1024) throw new Error("FILE_TOO_LARGE: splitter input exceeds 50 MiB");
  const rowsPerChunk = positiveInteger(options.rowsPerChunk, 10_000, "INVALID_SPLIT_ROWS");
  const targetBytes = positiveInteger(options.targetBytes, 2 * 1024 * 1024, "INVALID_SPLIT_BYTES");
  if (rowsPerChunk > 50_000) throw new Error("INVALID_SPLIT_ROWS: row chunks are limited to 50,000 records");
  if (targetBytes > CSV_SPLIT_MAX_CHUNK_BYTES) throw new Error("INVALID_SPLIT_BYTES: target exceeds the 8 MiB chunk ceiling");
  const readChunkBytes = Math.min(CSV_SPLIT_READ_CHUNK_BYTES, positiveInteger(options.readChunkBytes, CSV_SPLIT_READ_CHUNK_BYTES, "INVALID_READ_CHUNK_BYTES"));
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  const chunks: CsvSplitChunk[] = [];
  let header: string | null = null;
  let recordSeparator: "\n" | "\r\n" | "\r" = "\n";
  let currentRecords: string[] = [];
  let currentBytes = 0;
  let currentRows = 0;
  let rowCount = 0;

  const flush = () => {
    if (currentRows === 0) return;
    if (chunks.length >= CSV_SPLIT_MAX_CHUNKS) throw new Error(`CSV_TOO_MANY_CHUNKS: output is limited to ${CSV_SPLIT_MAX_CHUNKS} parts; increase rows or bytes per part`);
    const content = `${header ?? ""}${recordSeparator}${currentRecords.join(recordSeparator)}`;
    chunks.push({ index: chunks.length + 1, filename: `parte-${String(chunks.length + 1).padStart(3, "0")}.csv`, content, rowCount: currentRows, bytes: currentBytes });
    currentRecords = [];
    currentBytes = 0;
    currentRows = 0;
  };

  const appendRecord = (record: string, separator: "\n" | "\r\n" | "\r" | null) => {
    ensureRunning(signal);
    if (header === null) {
      header = record;
      if (separator !== null) recordSeparator = separator;
      return;
    }
    const separatorBytes = bytes(recordSeparator);
    const headerPrefixBytes = bytes(header) + separatorBytes;
    const recordBytes = bytes(record);
    const candidateBytes = currentRows === 0
      ? headerPrefixBytes + recordBytes
      : currentBytes + separatorBytes + recordBytes;
    if (options.mode === "bytes" && currentRows > 0 && candidateBytes > targetBytes) {
      flush();
      currentRecords = [record];
      currentBytes = headerPrefixBytes + recordBytes;
      currentRows = 1;
    } else {
      currentRecords.push(record);
      currentBytes = candidateBytes;
      currentRows += 1;
    }
    if (currentBytes > CSV_SPLIT_MAX_CHUNK_BYTES) throw new Error("CSV_CHUNK_TOO_LARGE: choose a smaller row count or byte target");
    rowCount += 1;
    if (options.mode === "rows" && currentRows >= rowsPerChunk) flush();
  };

  const splitter = new CsvStreamingRecordSplitter(appendRecord, signal);
  let processed = 0;
  let peakInputBufferUpperBoundBytes = 0;
  for (let offset = 0; offset < blob.size; offset += readChunkBytes) {
    ensureRunning(signal);
    const slice = blob.slice(offset, Math.min(blob.size, offset + readChunkBytes));
    const buffer = await slice.arrayBuffer();
    ensureRunning(signal);
    const decoded = decoder.decode(buffer, { stream: true });
    splitter.push(decoded);
    processed += buffer.byteLength;
    peakInputBufferUpperBoundBytes = Math.max(peakInputBufferUpperBoundBytes, buffer.byteLength + splitter.peakRecordChars * 4);
    options.onProgress?.(Math.min(1, processed / blob.size));
  }
  const tail = decoder.decode();
  if (tail !== "") splitter.push(tail);
  splitter.end();
  flush();
  options.onProgress?.(1);
  if (header === null) throw new Error("INVALID_INPUT: CSV has no header row");
  if (chunks.length === 0) {
    const content = header;
    chunks.push({ index: 1, filename: "parte-001.csv", content, rowCount: 0, bytes: bytes(content) });
  }
  const first = chunks[0]!;
  const table = parseCsvTable(first.content);
  return {
    output: first.content,
    table,
    chunks,
    rowCount,
    delimiter: table.delimiter,
    recordSeparator,
    repeatedHeader: header,
    mode: options.mode,
    peakParserBufferUpperBoundBytes: peakInputBufferUpperBoundBytes,
    readChunkBytes,
    engineVersion: TABLE_ADVANCED_ENGINE_VERSION,
  };
}

export async function splitCsvText(text: string, options: CsvSplitOptions, signal?: AbortSignal): Promise<CsvSplitResult> {
  if (bytes(text) > 10 * 1024 * 1024) throw new Error("FILE_TOO_LARGE: paste input is limited to 10 MiB; choose a local file for larger CSVs");
  return splitCsvBlob(new Blob([text], { type: "text/csv" }), options, signal);
}

export interface TableCompareOptions {
  readonly leftKeyColumns: readonly number[];
  readonly rightKeyColumns: readonly number[];
  readonly leftCompareColumns: readonly number[];
  readonly rightCompareColumns: readonly number[];
  readonly caseSensitive?: boolean;
  readonly nullTokens?: readonly string[];
  readonly emptyAsNull?: boolean;
}

export interface TableCompareChangedCell {
  readonly key: readonly string[];
  readonly leftRow: number;
  readonly rightRow: number;
  readonly leftColumn: number;
  readonly rightColumn: number;
  readonly leftColumnName: string;
  readonly rightColumnName: string;
  readonly leftValue: string;
  readonly rightValue: string;
}

export interface TableCompareAmbiguousKey {
  readonly key: readonly string[];
  readonly leftRows: readonly number[];
  readonly rightRows: readonly number[];
}

export interface TableCompareResult {
  readonly output: string;
  readonly table: CsvTable;
  readonly addedRows: number;
  readonly removedRows: number;
  readonly changedRows: number;
  readonly changedCells: readonly TableCompareChangedCell[];
  readonly ambiguousKeys: readonly TableCompareAmbiguousKey[];
  readonly ambiguousKeyCount: number;
  readonly rowCount: number;
  readonly warnings: readonly CsvWarning[];
  readonly policy: { readonly caseSensitive: boolean; readonly nullTokens: readonly string[]; readonly emptyAsNull: boolean };
  readonly engineVersion: string;
}

function normalizedCell(value: string, caseSensitive: boolean, nullTokens: readonly string[], emptyAsNull: boolean): string | null {
  if (isNullCell(value, nullTokens, emptyAsNull)) return null;
  return caseSensitive ? value : value.toLowerCase();
}

function keyFor(row: readonly string[], columns: readonly number[], caseSensitive: boolean, nullTokens: readonly string[], emptyAsNull: boolean): { normalized: string; display: string[] } {
  const display = columns.map((column) => row[column] ?? "");
  return { normalized: JSON.stringify(display.map((value) => normalizedCell(value, caseSensitive, nullTokens, emptyAsNull))), display };
}

interface IndexedRow { readonly row: string[]; readonly rowNumber: number; readonly displayKey: string[] }

function indexRows(table: CsvTable, columns: readonly number[], caseSensitive: boolean, nullTokens: readonly string[], emptyAsNull: boolean): Map<string, IndexedRow[]> {
  const index = new Map<string, IndexedRow[]>();
  table.rows.forEach((row, offset) => {
    const key = keyFor(row, columns, caseSensitive, nullTokens, emptyAsNull);
    const current = index.get(key.normalized) ?? [];
    current.push({ row, rowNumber: offset + 2, displayKey: key.display });
    index.set(key.normalized, current);
  });
  return index;
}

export function compareCsvTables(left: CsvTable, right: CsvTable, options: TableCompareOptions): TableCompareResult {
  const leftKeyColumns = requireIndexes(options.leftKeyColumns, left.header.length, "INVALID_LEFT_KEY_COLUMNS");
  const rightKeyColumns = requireIndexes(options.rightKeyColumns, right.header.length, "INVALID_RIGHT_KEY_COLUMNS");
  const leftCompareColumns = requireIndexes(options.leftCompareColumns, left.header.length, "INVALID_LEFT_COMPARE_COLUMNS");
  const rightCompareColumns = requireIndexes(options.rightCompareColumns, right.header.length, "INVALID_RIGHT_COMPARE_COLUMNS");
  if (leftKeyColumns.length !== rightKeyColumns.length) throw new Error("INVALID_KEY_COLUMNS: key arity must match");
  if (leftCompareColumns.length !== rightCompareColumns.length) throw new Error("INVALID_COMPARE_COLUMNS: compare arity must match");
  const caseSensitive = options.caseSensitive ?? true;
  const nullTokens = [...new Set(options.nullTokens ?? ["NULL"])];
  const emptyAsNull = options.emptyAsNull ?? true;
  const leftIndex = indexRows(left, leftKeyColumns, caseSensitive, nullTokens, emptyAsNull);
  const rightIndex = indexRows(right, rightKeyColumns, caseSensitive, nullTokens, emptyAsNull);
  const allKeys = new Set([...leftIndex.keys(), ...rightIndex.keys()]);
  const ambiguousKeys: TableCompareAmbiguousKey[] = [];
  const changedCells: TableCompareChangedCell[] = [];
  const diffRows: string[][] = [];
  let addedRows = 0;
  let removedRows = 0;
  const changedRowKeys = new Set<string>();

  const pushDiff = (row: string[]) => {
    if (diffRows.length >= TABLE_COMPARE_MAX_DIFF_ROWS) throw new Error("TABLE_DIFF_TOO_LARGE: narrow the compare columns before exporting the complete diff");
    diffRows.push(row);
  };

  for (const key of allKeys) {
    const leftRows = leftIndex.get(key) ?? [];
    const rightRows = rightIndex.get(key) ?? [];
    const displayKey = leftRows[0]?.displayKey ?? rightRows[0]?.displayKey ?? [];
    if (leftRows.length > 1 || rightRows.length > 1) {
      ambiguousKeys.push({ key: displayKey, leftRows: leftRows.map((entry) => entry.rowNumber), rightRows: rightRows.map((entry) => entry.rowNumber) });
      pushDiff(["ambiguous", JSON.stringify(displayKey), "", leftRows.map((entry) => entry.rowNumber).join("|"), rightRows.map((entry) => entry.rowNumber).join("|"), "", ""]);
      continue;
    }
    const leftEntry = leftRows[0];
    const rightEntry = rightRows[0];
    if (leftEntry === undefined && rightEntry !== undefined) {
      addedRows += 1;
      pushDiff(["added", JSON.stringify(displayKey), "", "", String(rightEntry.rowNumber), "", JSON.stringify(rightEntry.row)]);
      continue;
    }
    if (rightEntry === undefined && leftEntry !== undefined) {
      removedRows += 1;
      pushDiff(["removed", JSON.stringify(displayKey), "", String(leftEntry.rowNumber), "", JSON.stringify(leftEntry.row), ""]);
      continue;
    }
    if (leftEntry === undefined || rightEntry === undefined) continue;
    for (let index = 0; index < leftCompareColumns.length; index += 1) {
      const leftColumn = leftCompareColumns[index]!;
      const rightColumn = rightCompareColumns[index]!;
      const leftValue = leftEntry.row[leftColumn] ?? "";
      const rightValue = rightEntry.row[rightColumn] ?? "";
      if (normalizedCell(leftValue, caseSensitive, nullTokens, emptyAsNull) === normalizedCell(rightValue, caseSensitive, nullTokens, emptyAsNull)) continue;
      changedRowKeys.add(key);
      const changed: TableCompareChangedCell = {
        key: displayKey,
        leftRow: leftEntry.rowNumber,
        rightRow: rightEntry.rowNumber,
        leftColumn,
        rightColumn,
        leftColumnName: left.header[leftColumn] ?? `col_${leftColumn}`,
        rightColumnName: right.header[rightColumn] ?? `col_${rightColumn}`,
        leftValue,
        rightValue,
      };
      changedCells.push(changed);
      pushDiff(["changed", JSON.stringify(displayKey), `${changed.leftColumnName} ↔ ${changed.rightColumnName}`, String(changed.leftRow), String(changed.rightRow), leftValue, rightValue]);
    }
  }

  const warnings: CsvWarning[] = ambiguousKeys.slice(0, 100).map((entry) => {
    const row = entry.leftRows[0] ?? entry.rightRows[0];
    return {
      code: "DUPLICATE_KEY",
      message: `Chiave duplicata ambigua ${JSON.stringify(entry.key)}; righe sinistra ${entry.leftRows.join(",") || "—"}, destra ${entry.rightRows.join(",") || "—"}.`,
      ...(row === undefined ? {} : { row }),
    };
  });
  const outputTable: CsvTable = {
    header: ["status", "key", "column", "left_row", "right_row", "left_value", "right_value"],
    rows: diffRows,
    delimiter: ",",
    warnings,
  };
  return {
    output: serializeCsvTable(outputTable),
    table: outputTable,
    addedRows,
    removedRows,
    changedRows: changedRowKeys.size,
    changedCells,
    ambiguousKeys,
    ambiguousKeyCount: ambiguousKeys.length,
    rowCount: diffRows.length,
    warnings,
    policy: { caseSensitive, nullTokens, emptyAsNull },
    engineVersion: TABLE_ADVANCED_ENGINE_VERSION,
  };
}

export function compareCsvText(leftText: string, rightText: string, options: TableCompareOptions): TableCompareResult {
  return compareCsvTables(parseCsvTable(leftText), parseCsvTable(rightText), options);
}
