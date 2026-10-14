import type { SheetData } from "write-excel-file/universal";
import { inflateSync } from "fflate";
import { formatMarkdownTable } from "../text-writing";
import { parseXmlDocument, type XmlElement } from "../developer-web/structured-repair";
import { analyzeOoxmlPackage, OOXML_PACKAGE_LIMITS, OoxmlPackageError, type OoxmlZipEntry } from "../ooxml/package";
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
  | "UNSUPPORTED_XLSX_FEATURE"
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
  // A nonzero source that Number() rounds to zero, or a subnormal below
  // Excel's supported numeric magnitude, must be exported as literal text.
  if ((parsed === 0 && /[1-9]/u.test(value)) || (parsed !== 0 && Math.abs(parsed) < 2.2251e-308)) {
    fail("INVALID_NUMBER", `Row ${row}, column ${column} is too small for a faithful XLSX numeric cell; export it as text.`);
  }
  // Excel stores at most 15 significant decimal digits. Coercing a longer
  // decimal or an unsafe integer would silently change the user's source.
  // Such values are still supported in the default text column policy.
  const significantDigits = value.replace(/^-|\./gu, "").replace(/^0+/u, "").replace(/0+$/u, "").length;
  if (significantDigits > 15 || (Number.isInteger(parsed) && !Number.isSafeInteger(parsed))) {
    fail("INVALID_NUMBER", `Row ${row}, column ${column} exceeds safe XLSX numeric precision; export it as text.`);
  }
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

// This is an archive *preflight*, not macro extraction or sanitization. The
// existing OOXML analyzer walks the real ZIP central directory and local
// headers without inflating workbook cells, bounding member counts, names,
// expanded sizes and ratios before the general-purpose Excel reader runs.
const MAX_CONTENT_TYPES_XML_BYTES = 128 * 1024;
const contentTypesDecoder = new TextDecoder("utf-8", { fatal: true });

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const value of bytes) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readBoundedXlsxXml(bytes: ArrayBuffer, entry: OoxmlZipEntry, budget = MAX_CONTENT_TYPES_XML_BYTES): string {
  if (entry.uncompressedSize > budget || entry.compressedSize > budget) {
    fail("FILE_TOO_LARGE", "XLSX XML metadata exceeds the local inspection budget.");
  }
  const view = new DataView(bytes);
  const offset = entry.localHeaderOffset;
  const nameLength = view.getUint16(offset + 26, true);
  const extraLength = view.getUint16(offset + 28, true);
  const start = offset + 30 + nameLength + extraLength;
  if (start + entry.compressedSize > bytes.byteLength) fail("XLSX_READ_FAILED", "XLSX XML metadata is truncated.");
  const compressed = new Uint8Array(bytes, start, entry.compressedSize);
  let unpacked: Uint8Array;
  try {
    unpacked = entry.compressionMethod === 0 ? compressed : inflateSync(compressed, {
      out: new Uint8Array(entry.uncompressedSize + 1),
    });
  } catch {
    fail("XLSX_READ_FAILED", "XLSX XML metadata could not be decompressed within the declared budget.");
  }
  if (unpacked.byteLength !== entry.uncompressedSize || crc32(unpacked) !== entry.crc32) {
    fail("XLSX_READ_FAILED", "XLSX XML metadata does not match the ZIP directory.");
  }
  try {
    return contentTypesDecoder.decode(unpacked);
  } catch {
    fail("XLSX_READ_FAILED", "XLSX XML metadata is not UTF-8.");
  }
}

// The already installed bounded XML parser rejects DTDs, external entities,
// malformed XML, excess nodes and nesting. XML attributes remain raw strings;
// decode ONLY its validated built-in/numeric references, once, with no DTD.
function checkedXlsxXml(xml: string, rootName: string): XmlElement {
  try {
    const root = parseXmlDocument(xml).root;
    if (root.name.split(":").at(-1) !== rootName) fail("XLSX_READ_FAILED", `Unexpected XLSX ${rootName} XML root.`);
    return root;
  } catch {
    fail("XLSX_READ_FAILED", `Invalid or unsupported XLSX ${rootName} XML metadata.`);
  }
}

function decodedXlsxAttribute(element: XmlElement, key: string): string | undefined {
  return element.attributes.find(({ name }) => name === key)?.value.replace(/&(?:#x[0-9A-Fa-f]+|#[0-9]+|amp|lt|gt|quot|apos);/gu, (entity) => {
    const value = entity.slice(1, -1);
    if (value[0] === "#") return String.fromCodePoint(Number.parseInt(value.slice(value[1] === "x" ? 2 : 1), value[1] === "x" ? 16 : 10));
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[value] ?? entity;
  });
}

function containsActualXlsxFormulaTag(xml: string): boolean {
  // Comments and CDATA can legitimately describe `<f>` without defining a
  // worksheet formula. Consume those lexical regions before considering an
  // opening element with XML local name `f` (including namespace prefixes).
  const tokens = /<!--[^]*?-->|<!\[CDATA\[[^]*?\]\]>|(<(?:[A-Za-z_][\w.-]*:)?f(?=[\s/>]))/gu;
  for (const match of xml.matchAll(tokens)) if (match[1] !== undefined) return true;
  return false;
}

function assertSafeXlsxArchive(bytes: ArrayBuffer): void {
  let packageAnalysis: ReturnType<typeof analyzeOoxmlPackage>;
  try {
    packageAnalysis = analyzeOoxmlPackage(bytes);
  } catch (error) {
    if (error instanceof OoxmlPackageError) {
      if (error.code === "MACRO_PACKAGE_UNSUPPORTED") {
        fail("UNSUPPORTED_XLSX_FEATURE", "Macro-enabled Excel workbooks cannot be imported as CSV.");
      }
      if (error.code === "EXPANSION_LIMIT" || error.code === "PACKAGE_TOO_LARGE") {
        fail("FILE_TOO_LARGE", "XLSX ZIP member size or expansion exceeds the local limit.");
      }
      fail("XLSX_READ_FAILED", `Unsafe or unsupported XLSX ZIP structure: ${error.message}`);
    }
    fail("XLSX_READ_FAILED", "XLSX ZIP preflight failed.");
  }
  if (packageAnalysis.kind !== "xlsx") fail("XLSX_READ_FAILED", "Input ZIP is not an XLSX workbook.");
  // Workbook-to-workbook dependencies can retain remote targets and stale
  // external value caches invisible in the extracted CSV. The generic reader
  // silently discards these parts. Refuse before decoding workbook cells;
  // ordinary worksheet hyperlink relationships are inert and remain allowed.
  if (packageAnalysis.entries.some((entry) => /^xl\/externalLinks\//iu.test(entry.path))) {
    fail("UNSUPPORTED_XLSX_FEATURE", "External workbook dependencies are not supported in CSV import.");
  }
  const manifest = packageAnalysis.entries.find((entry) => entry.path === "[Content_Types].xml");
  if (!manifest) fail("XLSX_READ_FAILED", "Missing XLSX content types declaration.");
  const xml = readBoundedXlsxXml(bytes, manifest);
  // A workbook can declare macro capability even with no vbaProject.bin entry.
  // This deliberately refuses those declarations while ordinary data-only
  // spreadsheets (including plain hyperlink text) remain importable.
  if (/macroEnabled|vbaProject|application\/vnd\.ms-office\.activeX/iu.test(xml)) {
    fail("UNSUPPORTED_XLSX_FEATURE", "Excel macro or ActiveX content types are not supported in CSV import.");
  }
  const contentTypes = checkedXlsxXml(xml, "Types");
  if (contentTypes.children.some((child) => child.kind === "element" &&
      (child.name.split(":").at(-1) === "Override" || child.name.split(":").at(-1) === "Default") &&
      /(?:externalLink\+xml|macroEnabled|vbaProject|activeX)/iu.test(decodedXlsxAttribute(child, "ContentType") ?? ""))) {
    fail("UNSUPPORTED_XLSX_FEATURE", "Excel external workbook content types are not supported in CSV import.");
  }
  // A genuine external workbook part may be relocated outside xl/externalLinks.
  // The workbook's relationship Type, unlike its Target filename, is the
  // source of truth. Worksheet `hyperlink` relations stay inert and allowed.
  const workbookRels = packageAnalysis.entries.find((entry) => entry.path === "xl/_rels/workbook.xml.rels");
  if (workbookRels) {
    const relationships = checkedXlsxXml(readBoundedXlsxXml(bytes, workbookRels), "Relationships");
    if (relationships.children.some((child) => child.kind === "element" && child.name.split(":").at(-1) === "Relationship" &&
        /\/(?:externalLink|externalLinkPath)$/iu.test(decodedXlsxAttribute(child, "Type") ?? ""))) {
      fail("UNSUPPORTED_XLSX_FEATURE", "Excel external workbook relationships are not supported in CSV import.");
    }
  }
  // read-excel-file returns cached formula values (which may be forged or
  // stale) and blank cells for uncached formulas. Neither is a verified result.
  // Scan the independently ZIP-verified OOXML XML before letting that reader
  // produce CSV. Scan all xl XML parts so noncanonical worksheet paths and
  // hidden sheets are subject to the same refusal policy. The ZIP analyzer
  // already independently verifies all members under a 20 MiB TOTAL inflated
  // budget; the per-entry cap below matches its stricter 12 MiB bound.
  for (const entry of packageAnalysis.entries) {
    if (!/^xl\/.*\.xml$/iu.test(entry.path)) continue;
    const worksheetXml = readBoundedXlsxXml(bytes, entry, OOXML_PACKAGE_LIMITS.maxEntryUncompressedBytes);
    if (containsActualXlsxFormulaTag(worksheetXml)) {
      fail("UNSUPPORTED_XLSX_FEATURE", "Workbook formulas and their unverified cached results cannot be imported as CSV.");
    }
  }
}

export async function xlsxToCsv(
  bytes: ArrayBuffer,
  options: { readonly sheet?: string | number; readonly delimiter?: string } = {},
): Promise<SpreadsheetReadResult> {
  if (!(bytes instanceof ArrayBuffer)) fail("INVALID_INPUT", "XLSX input must be an ArrayBuffer.");
  assertInputBytes(bytes.byteLength);
  assertSafeXlsxArchive(bytes);
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
