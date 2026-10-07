import type { SheetData } from "write-excel-file/universal";
import { formatMarkdownTable } from "../text-writing";
import { parseCsvTable, serializeCsvTable, type CsvTable } from "./csv";

export const SPREADSHEET_INTERCHANGE_LIMITS = {
  maxInputBytes: 10 * 1024 * 1024,
  maxOutputBytes: 20 * 1024 * 1024,
  maxRows: 100_000,
  maxColumns: 512,
  maxCells: 500_000,
  maxSheets: 64,
} as const;

export type SpreadsheetColumnType = "text" | "number" | "date";

export interface SpreadsheetColumnPolicy {
  readonly column: number;
  readonly type: SpreadsheetColumnType;
}

export type SpreadsheetInterchangeErrorCode =
  | "INVALID_INPUT"
  | "FILE_TOO_LARGE"
  | "TABLE_TOO_LARGE"
  | "INVALID_COLUMN_POLICY"
  | "INVALID_NUMBER"
  | "INVALID_DATE"
  | "SHEET_SELECTION_REQUIRED"
  | "SHEET_NOT_FOUND"
  | "XLSX_READ_FAILED"
  | "XLSX_WRITE_FAILED"
  | "OUTPUT_TOO_LARGE";

export class SpreadsheetInterchangeError extends Error {
  constructor(readonly code: SpreadsheetInterchangeErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = "SpreadsheetInterchangeError";
  }
}

export interface SpreadsheetWriteResult {
  readonly bytes: ArrayBuffer;
  readonly byteLength: number;
  readonly sheetName: string;
  readonly rows: number;
  readonly columns: number;
  readonly columnTypes: readonly SpreadsheetColumnType[];
  readonly policy: "explicit-types-default-text";
}

export interface SpreadsheetReadResult {
  readonly csv: string;
  readonly sheetNames: readonly string[];
  readonly selectedSheet: string;
  readonly rows: number;
  readonly columns: number;
  readonly policy: "xlsx-values-to-safe-csv";
}

const encoder = new TextEncoder();

function fail(code: SpreadsheetInterchangeErrorCode, message: string): never {
  throw new SpreadsheetInterchangeError(code, message);
}

function assertInputBytes(bytes: number): void {
  if (!Number.isSafeInteger(bytes) || bytes < 0) fail("INVALID_INPUT", "Input byte length must be a non-negative safe integer.");
  if (bytes > SPREADSHEET_INTERCHANGE_LIMITS.maxInputBytes) {
    fail("FILE_TOO_LARGE", `Input exceeds the ${SPREADSHEET_INTERCHANGE_LIMITS.maxInputBytes}-byte local limit.`);
  }
}

function assertTableBounds(table: Pick<CsvTable, "header" | "rows">): void {
  const rowCount = table.rows.length + 1;
  const columnCount = Math.max(table.header.length, ...table.rows.map((row) => row.length), 0);
  const cellCount = table.header.length + table.rows.reduce((sum, row) => sum + row.length, 0);
  if (rowCount > SPREADSHEET_INTERCHANGE_LIMITS.maxRows) fail("TABLE_TOO_LARGE", "Spreadsheet row count exceeds the local limit.");
  if (columnCount > SPREADSHEET_INTERCHANGE_LIMITS.maxColumns) fail("TABLE_TOO_LARGE", "Spreadsheet column count exceeds the local limit.");
  if (cellCount > SPREADSHEET_INTERCHANGE_LIMITS.maxCells) fail("TABLE_TOO_LARGE", "Spreadsheet cell count exceeds the local limit.");
}

function normalizedSheetName(value: string | undefined): string {
  const name = (value ?? "Sheet1").trim();
  if (name === "" || name.length > 31 || /[\[\]/\\:*?]/u.test(name)) fail("INVALID_INPUT", "Sheet name must satisfy the XLSX 31-character and character rules.");
  return name;
}

function normalizedPolicies(columnCount: number, policies: readonly SpreadsheetColumnPolicy[] = []): SpreadsheetColumnType[] {
  const output = Array<SpreadsheetColumnType>(columnCount).fill("text");
  const seen = new Set<number>();
  for (const policy of policies) {
    if (!Number.isInteger(policy.column) || policy.column < 0 || policy.column >= columnCount || seen.has(policy.column)) {
      fail("INVALID_COLUMN_POLICY", "Column policies must name unique zero-based columns inside the table.");
    }
    if (policy.type !== "text" && policy.type !== "number" && policy.type !== "date") fail("INVALID_COLUMN_POLICY", "Unknown spreadsheet column type.");
    seen.add(policy.column);
    output[policy.column] = policy.type;
  }
  return output;
}

function strictNumber(value: string, row: number, column: number): number {
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value)) fail("INVALID_NUMBER", `Row ${row}, column ${column} is not an ungrouped decimal number.`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) fail("INVALID_NUMBER", `Row ${row}, column ${column} is outside the finite number range.`);
  return parsed;
}

function strictIsoDate(value: string, row: number, column: number): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (match === null) fail("INVALID_DATE", `Row ${row}, column ${column} must use YYYY-MM-DD for an explicit date column.`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    fail("INVALID_DATE", `Row ${row}, column ${column} contains an invalid calendar date.`);
  }
  return date;
}

function writeCell(value: string, type: SpreadsheetColumnType, row: number, column: number): SheetData[number][number] {
  if (type === "text") return { value, type: String };
  if (value === "") return null;
  if (type === "number") return { value: strictNumber(value, row, column), type: Number };
  return { value: strictIsoDate(value, row, column), type: Date, format: "yyyy-mm-dd" };
}

export async function tableToXlsx(
  table: CsvTable,
  options: { readonly sheetName?: string; readonly columnPolicies?: readonly SpreadsheetColumnPolicy[] } = {},
): Promise<SpreadsheetWriteResult> {
  assertTableBounds(table);
  const sheetName = normalizedSheetName(options.sheetName);
  const columnTypes = normalizedPolicies(table.header.length, options.columnPolicies);
  const data: SheetData = [
    table.header.map((value) => ({ value, type: String })),
    ...table.rows.map((row, rowIndex) => table.header.map((_header, columnIndex) => writeCell(row[columnIndex] ?? "", columnTypes[columnIndex] ?? "text", rowIndex + 2, columnIndex + 1))),
  ];
  try {
    const { default: writeXlsxFile } = await import("write-excel-file/universal");
    const blob = await writeXlsxFile([{ sheet: sheetName, data }]).toBlob();
    if (blob.size > SPREADSHEET_INTERCHANGE_LIMITS.maxOutputBytes) fail("OUTPUT_TOO_LARGE", "Generated XLSX exceeds the local output limit.");
    const bytes = await blob.arrayBuffer();
    return {
      bytes,
      byteLength: bytes.byteLength,
      sheetName,
      rows: table.rows.length,
      columns: table.header.length,
      columnTypes,
      policy: "explicit-types-default-text",
    };
  } catch (error) {
    if (error instanceof SpreadsheetInterchangeError) throw error;
    fail("XLSX_WRITE_FAILED", error instanceof Error ? error.message : "XLSX writer failed.");
  }
}

export async function csvToXlsx(
  text: string,
  options: { readonly sheetName?: string; readonly columnPolicies?: readonly SpreadsheetColumnPolicy[] } = {},
): Promise<SpreadsheetWriteResult> {
  if (typeof text !== "string" || text.trim() === "") fail("INVALID_INPUT", "CSV text is required.");
  assertInputBytes(encoder.encode(text).byteLength);
  return tableToXlsx(parseCsvTable(text), options);
}

export async function markdownTableToXlsx(
  markdown: string,
  options: { readonly sheetName?: string; readonly columnPolicies?: readonly SpreadsheetColumnPolicy[] } = {},
): Promise<SpreadsheetWriteResult> {
  if (typeof markdown !== "string" || markdown.trim() === "") fail("INVALID_INPUT", "Markdown table text is required.");
  assertInputBytes(encoder.encode(markdown).byteLength);
  const formatted = formatMarkdownTable({ text: markdown });
  if (formatted.table === null) fail("INVALID_INPUT", "No Markdown table was found.");
  return tableToXlsx({ header: formatted.table.headers, rows: formatted.table.rows, delimiter: ",", warnings: [] }, options);
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) fail("XLSX_READ_FAILED", "Workbook contains an invalid date value.");
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  fail("XLSX_READ_FAILED", "Workbook contains an unsupported cell value.");
}

export async function xlsxToCsv(
  bytes: ArrayBuffer,
  options: { readonly sheet?: string | number; readonly delimiter?: string } = {},
): Promise<SpreadsheetReadResult> {
  if (!(bytes instanceof ArrayBuffer)) fail("INVALID_INPUT", "XLSX input must be an ArrayBuffer.");
  assertInputBytes(bytes.byteLength);
  let sheets: Array<{ sheet: string; data: unknown[][] }>;
  try {
    const { default: readXlsxFile } = await import("read-excel-file/universal");
    sheets = await readXlsxFile(bytes) as Array<{ sheet: string; data: unknown[][] }>;
  } catch (error) {
    fail("XLSX_READ_FAILED", error instanceof Error ? error.message : "XLSX reader failed.");
  }
  if (sheets.length === 0) fail("XLSX_READ_FAILED", "Workbook contains no sheets.");
  if (sheets.length > SPREADSHEET_INTERCHANGE_LIMITS.maxSheets) fail("TABLE_TOO_LARGE", "Workbook sheet count exceeds the local limit.");
  const sheetNames = sheets.map(({ sheet }) => sheet);
  let selected: (typeof sheets)[number] | undefined;
  if (options.sheet === undefined) {
    if (sheets.length !== 1) fail("SHEET_SELECTION_REQUIRED", `Workbook contains ${sheets.length} sheets: ${sheetNames.join(", ")}. Select one explicitly.`);
    selected = sheets[0];
  } else if (typeof options.sheet === "number") {
    if (!Number.isInteger(options.sheet) || options.sheet < 1) fail("SHEET_NOT_FOUND", "Numeric sheet selection is one-based.");
    selected = sheets[options.sheet - 1];
  } else {
    selected = sheets.find(({ sheet }) => sheet === options.sheet);
  }
  if (selected === undefined) fail("SHEET_NOT_FOUND", `Requested sheet was not found. Available sheets: ${sheetNames.join(", ")}.`);
  const rows = selected.data.map((row) => row.map(csvCell));
  if (rows.length === 0) return { csv: "", sheetNames, selectedSheet: selected.sheet, rows: 0, columns: 0, policy: "xlsx-values-to-safe-csv" };
  const [header = [], ...body] = rows;
  const delimiter = options.delimiter ?? ",";
  if (![",", ";", "\t", "|"].includes(delimiter)) fail("INVALID_INPUT", "CSV delimiter must be comma, semicolon, tab or pipe.");
  const table: CsvTable = { header, rows: body, delimiter, warnings: [] };
  assertTableBounds(table);
  return {
    csv: serializeCsvTable(table),
    sheetNames,
    selectedSheet: selected.sheet,
    rows: body.length,
    columns: header.length,
    policy: "xlsx-values-to-safe-csv",
  };
}
