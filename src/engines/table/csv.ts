import Papa from "papaparse";

export const CSV_ENGINE_VERSION = "1";
export const CSV_SOFT_FILE_BYTES = 10 * 1024 * 1024;
export const CSV_HARD_FILE_BYTES = 50 * 1024 * 1024;

export type CsvWarningCode = "DUPLICATE_HEADER" | "RAGGED_ROW" | "DELIMITER_FALLBACK";

export interface CsvWarning {
  code: CsvWarningCode;
  message: string;
  row?: number;
}

export interface ParsedCsv {
  rows: string[][];
  delimiter: string;
  warnings: CsvWarning[];
}

export interface CsvCleanResult {
  output: string;
  rows: number;
  columns: number;
  headers: string[];
  delimiter: string;
  warnings: CsvWarning[];
  changes: {
    strippedBom: boolean;
    normalizedRecordBreaks: number;
  };
}

export interface CsvTable {
  header: string[];
  rows: string[][];
  delimiter: string;
  warnings: CsvWarning[];
}

export interface CsvDedupeResult {
  output: string;
  table: CsvTable;
  inputRows: number;
  outputRows: number;
  removedRows: number;
  mode: "whole-row" | "key-columns";
  keyColumns: number[];
  emptyKeyPolicy: "keep";
}

export interface CsvColumnMapEntry {
  sourceIndex: number;
  outputName: string;
}

export interface CsvColumnMapResult {
  output: string;
  table: CsvTable;
  mapping: CsvColumnMapEntry[];
  droppedColumns: Array<{ index: number; name: string }>;
  filledMissingCells: number;
}

export class CsvCleanerError extends Error {
  constructor(readonly code: "PARSE_ERROR" | "FILE_TOO_LARGE" | "SEMANTIC_MISMATCH" | "CANCELLED", message: string) {
    super(message);
    this.name = "CsvCleanerError";
  }
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
    if (row.length !== header.length) warnings.push({ code: "RAGGED_ROW", message: `Row ${index + 1} has ${row.length} cells; expected ${header.length}.`, row: index + 1 });
  }
  return warnings;
}

function detectDelimiter(text: string): { delimiter: string; confident: boolean } {
  const candidates = [",", ";", "\t", "|"];
  let best: { delimiter: string; score: number } | undefined;

  for (const delimiter of candidates) {
    const counts: number[] = [];
    let current = 0;
    let inQuotes = false;
    for (let index = 0; index < text.length && counts.length < 8; index += 1) {
      const char = text[index] ?? "";
      if (char === '"') {
        if (inQuotes && text[index + 1] === '"') {
          index += 1;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }
      if (!inQuotes && char === delimiter) current += 1;
      if (!inQuotes && (char === "\n" || char === "\r")) {
        if (char === "\r" && text[index + 1] === "\n") index += 1;
        counts.push(current);
        current = 0;
      }
    }
    if (current > 0 || counts.length === 0) counts.push(current);
    const positive = counts.filter((count) => count > 0);
    if (positive.length === 0) continue;
    const frequency = new Map<number, number>();
    for (const count of positive) frequency.set(count, (frequency.get(count) ?? 0) + 1);
    const mode = [...frequency.entries()].toSorted((a, b) => b[1] - a[1] || b[0] - a[0])[0];
    if (mode === undefined) continue;
    const score = mode[1] * 100 + positive.length * 10 + mode[0];
    if (best === undefined || score > best.score) best = { delimiter, score };
  }

  return best === undefined ? { delimiter: ",", confident: false } : { delimiter: best.delimiter, confident: true };
}

export function parseCsvText(text: string): ParsedCsv {
  const detected = detectDelimiter(text);
  const result = Papa.parse<string[]>(text, { delimiter: detected.delimiter, skipEmptyLines: false, dynamicTyping: false });
  const fatal = result.errors.filter((error) => error.code !== "UndetectableDelimiter");
  if (fatal.length > 0) throw new CsvCleanerError("PARSE_ERROR", fatal.map((error) => error.message).join("; "));
  const rows = dropTerminalEmptyRow(result.data.map((row) => row.map((cell) => String(cell))), text);
  const warnings = inspectShape(rows);
  if (!detected.confident || result.errors.some((error) => error.code === "UndetectableDelimiter")) {
    warnings.push({ code: "DELIMITER_FALLBACK", message: "Delimiter could not be inferred confidently; comma fallback was used." });
  }
  return { rows, delimiter: result.meta.delimiter || ",", warnings };
}

export function parseCsvTable(text: string): CsvTable {
  const parsed = parseCsvText(text);
  const [header = [], ...rows] = parsed.rows;
  return { header: [...header], rows: rows.map((row) => [...row]), delimiter: parsed.delimiter, warnings: parsed.warnings };
}

export function serializeCsvTable(table: Pick<CsvTable, "header" | "rows" | "delimiter">): string {
  return Papa.unparse([table.header, ...table.rows], { delimiter: table.delimiter, newline: "\n" });
}

function validateColumnIndexes(indexes: readonly number[], columnCount: number, code: string): number[] {
  if (indexes.length === 0 || new Set(indexes).size !== indexes.length) throw new Error(code);
  if (indexes.some((index) => !Number.isInteger(index) || index < 0 || index >= columnCount)) throw new Error(code);
  return [...indexes];
}

export function dedupeCsvTable(
  table: CsvTable,
  options: { mode: "whole-row" | "key-columns"; keyColumns?: readonly number[]; emptyKeyPolicy?: "keep" },
): CsvDedupeResult {
  const keyColumns = options.mode === "key-columns"
    ? validateColumnIndexes(options.keyColumns ?? [], table.header.length, "INVALID_KEY_COLUMNS")
    : [];
  const seen = new Set<string>();
  const rows: string[][] = [];
  for (let index = 0; index < table.rows.length; index += 1) {
    const row = table.rows[index] ?? [];
    const keyValues = options.mode === "whole-row" ? row : keyColumns.map((column) => row[column] ?? "");
    const emptyKey = options.mode === "key-columns" && keyValues.every((value) => value === "");
    const key = emptyKey ? `__empty_key_row_${index}` : JSON.stringify(keyValues);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push([...row]);
  }
  const outputTable: CsvTable = { ...table, header: [...table.header], rows, warnings: [...table.warnings] };
  return {
    output: serializeCsvTable(outputTable),
    table: outputTable,
    inputRows: table.rows.length,
    outputRows: rows.length,
    removedRows: table.rows.length - rows.length,
    mode: options.mode,
    keyColumns,
    emptyKeyPolicy: "keep",
  };
}

export function mapCsvColumns(table: CsvTable, mapping: readonly CsvColumnMapEntry[]): CsvColumnMapResult {
  if (mapping.length === 0) throw new Error("INVALID_COLUMN_MAP");
  const sourceIndexes = validateColumnIndexes(mapping.map((entry) => entry.sourceIndex), table.header.length, "INVALID_COLUMN_MAP");
  const outputNames = mapping.map((entry) => entry.outputName.trim());
  if (outputNames.some((name) => name === "") || new Set(outputNames).size !== outputNames.length) {
    throw new Error("INVALID_OUTPUT_HEADERS");
  }
  let filledMissingCells = 0;
  const rows = table.rows.map((row) => sourceIndexes.map((index) => {
    const value = row[index];
    if (value === undefined) {
      filledMissingCells += 1;
      return "";
    }
    return value;
  }));
  const selected = new Set(sourceIndexes);
  const droppedColumns = table.header.flatMap((name, index) => selected.has(index) ? [] : [{ index, name }]);
  const outputTable: CsvTable = {
    header: outputNames,
    rows,
    delimiter: table.delimiter,
    warnings: inspectShape([outputNames, ...rows]),
  };
  return {
    output: serializeCsvTable(outputTable),
    table: outputTable,
    mapping: mapping.map((_entry, index) => ({ sourceIndex: sourceIndexes[index]!, outputName: outputNames[index]! })),
    droppedColumns,
    filledMissingCells,
  };
}

export function normalizeRecordLineEndings(text: string): { output: string; normalized: number } {
  let output = "";
  let inQuotes = false;
  let normalized = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? "";
    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') {
        output += '""';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      output += char;
      continue;
    }
    if (!inQuotes && char === "\r") {
      if (text[index + 1] === "\n") index += 1;
      output += "\n";
      normalized += 1;
      continue;
    }
    output += char;
  }
  return { output, normalized };
}

export function cleanCsvText(input: string): CsvCleanResult {
  const strippedBom = input.startsWith("\uFEFF");
  const withoutBom = strippedBom ? input.slice(1) : input;
  const before = parseCsvText(withoutBom);
  const lineEndings = normalizeRecordLineEndings(withoutBom);
  const after = parseCsvText(lineEndings.output);
  if (JSON.stringify(before.rows) !== JSON.stringify(after.rows)) {
    throw new CsvCleanerError("SEMANTIC_MISMATCH", "Cleanup changed parsed cell values.");
  }
  return {
    output: lineEndings.output,
    rows: after.rows.length,
    columns: after.rows[0]?.length ?? 0,
    headers: [...(after.rows[0] ?? [])],
    delimiter: after.delimiter,
    warnings: after.warnings,
    changes: { strippedBom, normalizedRecordBreaks: lineEndings.normalized },
  };
}

export async function readBlobText(
  blob: Blob,
  signal?: AbortSignal,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  if (blob.size > CSV_HARD_FILE_BYTES) throw new CsvCleanerError("FILE_TOO_LARGE", "File exceeds the 50 MiB hard limit.");
  if (signal?.aborted) throw new CsvCleanerError("CANCELLED", "Operation cancelled");
  const reader = blob.stream().getReader();
  const decoder = new TextDecoder("utf-8", { ignoreBOM: true });
  let read = 0;
  let output = "";
  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel();
        throw new CsvCleanerError("CANCELLED", "Operation cancelled");
      }
      const chunk = await reader.read();
      if (chunk.done) break;
      read += chunk.value.byteLength;
      output += decoder.decode(chunk.value, { stream: true });
      onProgress?.(blob.size === 0 ? 1 : Math.min(1, read / blob.size));
    }
    output += decoder.decode();
    onProgress?.(1);
    return output;
  } finally {
    reader.releaseLock();
  }
}

export function provePapaAbort(text: string, stopAfterRows: number): boolean {
  let rows = 0;
  let aborted = false;
  Papa.parse(text, {
    step(_row, parser) {
      rows += 1;
      if (rows >= stopAfterRows) parser.abort();
    },
    complete(result) {
      aborted = result.meta.aborted === true;
    },
  });
  return aborted;
}
