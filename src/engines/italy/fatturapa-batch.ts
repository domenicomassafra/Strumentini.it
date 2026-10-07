import { readFatturaPaXml, type FatturaPaInvoiceBody, type FatturaPaReadResult } from "./fatturapa-reader";

export const FATTURAPA_BATCH_VERSION = "1.0";
export const FATTURAPA_BATCH_MAX_FILES = 50;
export const FATTURAPA_FILE_MAX_BYTES = 5 * 1024 * 1024;
export const FATTURAPA_BATCH_MAX_BYTES = 25 * 1024 * 1024;
export const FATTURAPA_BATCH_PREVIEW_ROWS = 25;

export interface NamedTextFile {
  readonly filename: string;
  readonly text: string;
  readonly bytes: number;
}

export interface FatturaPaBatchRow {
  readonly filename: string;
  readonly fileStatus: "ok" | "partial" | "error";
  readonly bodyIndex: number | null;
  readonly schemaFamily: string | null;
  readonly transmissionFormat: string | null;
  readonly xsdVersion: string | null;
  readonly invoiceNumber: string | null;
  readonly date: string | null;
  readonly currency: string | null;
  readonly supplier: string | null;
  readonly customer: string | null;
  readonly documentTotal: string | null;
  readonly representedLineTotal: string | null;
  readonly representedVatTaxAmount: string | null;
  readonly representedGrandTotal: string | null;
  readonly totalsReconciliation: "matched" | "different" | "unavailable";
  readonly fieldErrorCount: number;
  readonly error: string | null;
}

export interface FatturaPaBatchResult {
  readonly fileCount: number;
  readonly invoiceRowCount: number;
  readonly okFileCount: number;
  readonly partialFileCount: number;
  readonly errorFileCount: number;
  readonly previewLimit: number;
  readonly previewRows: readonly FatturaPaBatchRow[];
  readonly rows: readonly FatturaPaBatchRow[];
  readonly csv: string;
  readonly csvBytes: number;
  readonly completeExport: true;
}

interface ParsedDecimal {
  readonly integer: bigint;
  readonly scale: number;
}

function parseDecimal(value: string): ParsedDecimal | null {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/u.exec(value);
  if (match === null) return null;
  const fraction = match[3] ?? "";
  const sign = match[1] === "-" ? -1n : 1n;
  return { integer: sign * BigInt(`${match[2]}${fraction}`), scale: fraction.length };
}

function pow10(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}

function align(value: ParsedDecimal, scale: number): bigint {
  return value.integer * pow10(scale - value.scale);
}

function formatDecimal(integer: bigint, scale: number): string {
  const negative = integer < 0n;
  const digits = (negative ? -integer : integer).toString().padStart(scale + 1, "0");
  const body = scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
  return `${negative ? "-" : ""}${body}`;
}

function sumDecimalStrings(values: readonly (string | null)[]): string | null {
  if (values.length === 0 || values.some((value) => value === null)) return null;
  const parsed = values.map((value) => parseDecimal(value!));
  if (parsed.some((value) => value === null)) return null;
  const concrete = parsed as ParsedDecimal[];
  const scale = concrete.reduce((max, value) => Math.max(max, value.scale), 0);
  const total = concrete.reduce((sum, value) => sum + align(value, scale), 0n);
  return formatDecimal(total, scale);
}

function addDecimals(left: string | null, right: string | null): string | null {
  if (left === null || right === null) return null;
  return sumDecimalStrings([left, right]);
}

function decimalEquals(left: string, right: string): boolean {
  const a = parseDecimal(left);
  const b = parseDecimal(right);
  if (a === null || b === null) return false;
  const scale = Math.max(a.scale, b.scale);
  return align(a, scale) === align(b, scale);
}

function partyLabel(party: FatturaPaReadResult["supplier"]): string | null {
  return party.name ?? party.vatId ?? party.taxCode;
}

function rowFromBody(filename: string, parsed: FatturaPaReadResult, body: FatturaPaInvoiceBody, bodyIndex: number): FatturaPaBatchRow {
  const representedLineTotal = sumDecimalStrings(body.lines.map(({ lineTotal }) => lineTotal));
  const representedVatTaxAmount = body.vatSummaries.length === 0
    ? null
    : sumDecimalStrings(body.vatSummaries.map(({ taxAmount }) => taxAmount));
  const representedGrandTotal = addDecimals(representedLineTotal, representedVatTaxAmount);
  const totalsReconciliation = body.documentTotal === null || representedGrandTotal === null
    ? "unavailable"
    : decimalEquals(body.documentTotal, representedGrandTotal)
      ? "matched"
      : "different";
  const fieldErrorCount = parsed.fieldErrors.filter(({ path }) => path.includes(`FatturaElettronicaBody[${bodyIndex}]`)).length;
  return {
    filename,
    fileStatus: fieldErrorCount > 0 ? "partial" : "ok",
    bodyIndex,
    schemaFamily: parsed.family,
    transmissionFormat: parsed.transmissionFormat,
    xsdVersion: parsed.xsdVersion,
    invoiceNumber: body.number,
    date: body.date,
    currency: body.currency,
    supplier: partyLabel(parsed.supplier),
    customer: partyLabel(parsed.customer),
    documentTotal: body.documentTotal,
    representedLineTotal,
    representedVatTaxAmount,
    representedGrandTotal,
    totalsReconciliation,
    fieldErrorCount,
    error: fieldErrorCount > 0 ? `${fieldErrorCount} mapped field error(s); other readable fields preserved.` : null,
  };
}

function errorRow(filename: string, error: unknown): FatturaPaBatchRow {
  return {
    filename,
    fileStatus: "error",
    bodyIndex: null,
    schemaFamily: null,
    transmissionFormat: null,
    xsdVersion: null,
    invoiceNumber: null,
    date: null,
    currency: null,
    supplier: null,
    customer: null,
    documentTotal: null,
    representedLineTotal: null,
    representedVatTaxAmount: null,
    representedGrandTotal: null,
    totalsReconciliation: "unavailable",
    fieldErrorCount: 0,
    error: error instanceof Error ? error.message : "Unreadable FatturaPA file.",
  };
}

const CSV_HEADERS = [
  "filename",
  "fileStatus",
  "bodyIndex",
  "schemaFamily",
  "transmissionFormat",
  "xsdVersion",
  "invoiceNumber",
  "date",
  "currency",
  "supplier",
  "customer",
  "documentTotal",
  "representedLineTotal",
  "representedVatTaxAmount",
  "representedGrandTotal",
  "totalsReconciliation",
  "fieldErrorCount",
  "error",
] as const;

function csvCell(value: string): string {
  const safe = /^[\u0000-\u0020]*[=+\-@]/u.test(value) ? `'${value}` : value;
  return /[",\n\r]/u.test(safe) ? `"${safe.replace(/"/gu, '""')}"` : safe;
}

export function fatturaPaBatchCsv(rows: readonly FatturaPaBatchRow[]): string {
  const records = rows.map((row) => CSV_HEADERS.map((header) => {
    const value = row[header];
    return csvCell(value === null ? "" : String(value));
  }).join(","));
  return [CSV_HEADERS.join(","), ...records].join("\n");
}

export function readFatturaPaBatch(files: readonly NamedTextFile[]): FatturaPaBatchResult {
  if (!Array.isArray(files) || files.length === 0) throw new Error("INVALID_BATCH_FILES");
  if (files.length > FATTURAPA_BATCH_MAX_FILES) throw new Error("TOO_MANY_BATCH_FILES");
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  if (totalBytes > FATTURAPA_BATCH_MAX_BYTES) throw new Error("BATCH_TOO_LARGE");

  const rows: FatturaPaBatchRow[] = [];
  const statuses = new Map<string, "ok" | "partial" | "error">();
  for (const file of files) {
    if (file.bytes > FATTURAPA_FILE_MAX_BYTES) {
      rows.push(errorRow(file.filename, new Error(`FILE_TOO_LARGE: maximum ${FATTURAPA_FILE_MAX_BYTES} bytes per file.`)));
      statuses.set(file.filename, "error");
      continue;
    }
    try {
      const parsed = readFatturaPaXml(file.text);
      const fileRows = parsed.bodies.length === 0
        ? [errorRow(file.filename, new Error("FatturaPA document contains no invoice body."))]
        : parsed.bodies.map((body, index) => rowFromBody(file.filename, parsed, body, index + 1));
      rows.push(...fileRows);
      statuses.set(file.filename, fileRows.some(({ fileStatus }) => fileStatus === "error")
        ? "error"
        : fileRows.some(({ fileStatus }) => fileStatus === "partial")
          ? "partial"
          : "ok");
    } catch (error) {
      rows.push(errorRow(file.filename, error));
      statuses.set(file.filename, "error");
    }
  }
  const csv = fatturaPaBatchCsv(rows);
  const values = [...statuses.values()];
  return {
    fileCount: files.length,
    invoiceRowCount: rows.length,
    okFileCount: values.filter((status) => status === "ok").length,
    partialFileCount: values.filter((status) => status === "partial").length,
    errorFileCount: values.filter((status) => status === "error").length,
    previewLimit: FATTURAPA_BATCH_PREVIEW_ROWS,
    previewRows: rows.slice(0, FATTURAPA_BATCH_PREVIEW_ROWS),
    rows,
    csv,
    csvBytes: new TextEncoder().encode(csv).byteLength,
    completeExport: true,
  };
}
