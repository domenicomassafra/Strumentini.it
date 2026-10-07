import {
  parseCsvTable,
  serializeCsvTable,
  type CsvTable,
  type CsvWarning,
} from "../../../engines/table/csv";
import {
  makeTableHandoff,
  parseDelimitedTable,
  type TableDelimiter,
  type TableHandoff,
} from "../../../engines/table/operations";
import { createBoundedTablePreview, type BoundedTablePreview } from "../../../runtime/bounded-preview";
import {
  createOutputArtifactDescriptor,
  type OutputArtifactDescriptor,
} from "../../../runtime/output-artifact";

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
  | "chart"
  | "sql"
  | "split"
  | "compare";

export interface TableResultWarning {
  readonly message: string;
  readonly row?: number;
  readonly column?: number;
  readonly code?: string;
}

export interface TableResultV2Model {
  readonly rows: number;
  readonly columns: number;
  readonly warnings: readonly TableResultWarning[];
  readonly rowWarningCount: number;
  readonly duplicateHeaderWarningCount: number;
  readonly tableArtifact: OutputArtifactDescriptor;
  readonly exportArtifact: OutputArtifactDescriptor;
  readonly exportPayload: string;
  readonly preview: BoundedTablePreview;
  readonly reusePayload: string | null;
  readonly handoff: TableHandoff;
}

interface HandoffShape {
  readonly accepts?: readonly { readonly type: string; readonly format?: string | undefined }[] | undefined;
  readonly emits?: readonly { readonly type: string; readonly format?: string | undefined }[] | undefined;
}

const PREVIEW_ROWS = 30;
const TABLE_DELIMITERS = new Set<TableDelimiter>([",", ";", "\t", "|"]);

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) return null;
  return [...value] as string[];
}

function tableFromUnknown(value: unknown): CsvTable | null {
  const candidate = record(value);
  if (candidate === null) return null;
  const header = stringArray(candidate.header);
  const rows = Array.isArray(candidate.rows) && candidate.rows.every((row) => stringArray(row) !== null)
    ? candidate.rows.map((row) => stringArray(row) ?? [])
    : null;
  if (header === null || rows === null || typeof candidate.delimiter !== "string") return null;
  const warnings = Array.isArray(candidate.warnings)
    ? candidate.warnings.filter((warning): warning is CsvWarning => {
        const item = record(warning);
        return item !== null && typeof item.code === "string" && typeof item.message === "string";
      }).map((warning) => ({ ...warning }))
    : [];
  return { header, rows, delimiter: candidate.delimiter, warnings };
}

function tableFromRecords(result: Record<string, unknown>): CsvTable | null {
  const headers = stringArray(result.headers);
  if (headers === null || !Array.isArray(result.records)) return null;
  const records = result.records.map(record);
  if (records.some((entry) => entry === null)) return null;
  return {
    header: headers,
    rows: records.map((entry) => headers.map((header) => String(entry?.[header] ?? ""))),
    delimiter: ",",
    warnings: [],
  };
}

function delimiterFrom(value: unknown): TableDelimiter | null {
  return typeof value === "string" && TABLE_DELIMITERS.has(value as TableDelimiter)
    ? value as TableDelimiter
    : null;
}

function resultTable(mode: TableWorkbenchMode, result: Record<string, unknown>, inputText: string): CsvTable {
  const direct = tableFromUnknown(result.table);
  if (direct !== null) return direct;

  if (mode === "to-json") {
    const fromRecords = tableFromRecords(result);
    if (fromRecords !== null) return fromRecords;
  }

  const output = typeof result.output === "string" ? result.output : null;
  if (output !== null) return parseCsvTable(output);

  if (mode === "delimiter") {
    const delimiter = delimiterFrom(result.delimiter);
    if (delimiter !== null) return parseDelimitedTable(inputText, delimiter);
  }

  throw new Error(`Result v2 table preview is unavailable for successful ${mode} output.`);
}

function artifact(
  kind: "text" | "structured" | "image" | "file",
  name: string,
  mime: string,
  payload: string,
  method: string,
): OutputArtifactDescriptor {
  return createOutputArtifactDescriptor({
    kind,
    name,
    mime,
    bytes: new TextEncoder().encode(payload),
    verification: {
      state: "verified",
      verifiedMime: mime,
      method,
    },
    fidelity: "structural",
    fidelityNote: "Il download usa l'output locale completo; il limite di righe si applica soltanto all'anteprima.",
  });
}

function primaryExport(
  toolId: string,
  mode: TableWorkbenchMode,
  result: Record<string, unknown>,
  tablePayload: string,
): { readonly payload: string; readonly artifact: OutputArtifactDescriptor } {
  if (mode === "to-json" && typeof result.json === "string") {
    return {
      payload: result.json,
      artifact: artifact("structured", `${toolId}.json`, "application/json", result.json, "JSON emesso dal motore table-operations locale"),
    };
  }
  if (mode === "chart" && typeof result.svg === "string") {
    return {
      payload: result.svg,
      artifact: artifact("image", `${toolId}.svg`, "image/svg+xml", result.svg, "SVG emesso dal motore table-operations locale"),
    };
  }
  if (mode === "encoding" && typeof result.output === "string") {
    return {
      payload: result.output,
      artifact: artifact("text", `${toolId}.txt`, "text/plain", result.output, "Testo UTF-8 normalizzato dal motore table-operations locale"),
    };
  }
  if (mode === "sql" && typeof result.output === "string") {
    return {
      payload: result.output,
      artifact: artifact("file", `${toolId}.sql`, "application/sql", result.output, "SQL generato localmente dal motore table-advanced; nessuna istruzione viene eseguita"),
    };
  }
  const payload = typeof result.output === "string" ? result.output : tablePayload;
  return {
    payload,
    artifact: artifact("text", `${toolId}.csv`, "text/csv", payload, "CSV prodotto o normalizzato dal motore table-operations locale"),
  };
}

function warningOf(value: unknown): TableResultWarning | null {
  if (typeof value === "string" && value.trim() !== "") return { message: value.trim() };
  const item = record(value);
  if (item === null || typeof item.message !== "string" || item.message.trim() === "") return null;
  return {
    message: item.message.trim(),
    ...(typeof item.row === "number" && Number.isInteger(item.row) && item.row > 0 ? { row: item.row } : {}),
    ...(typeof item.code === "string" && item.code.trim() !== "" ? { code: item.code } : {}),
  };
}

function warningsFor(result: Record<string, unknown>, table: CsvTable): readonly TableResultWarning[] {
  const values: TableResultWarning[] = [];
  for (const value of [...(Array.isArray(result.warnings) ? result.warnings : []), ...table.warnings]) {
    const warning = warningOf(value);
    if (warning !== null) values.push(warning);
  }
  const byMessage = new Map<string, TableResultWarning>();
  for (const warning of values) {
    const key = `${warning.message}\u0000${warning.row ?? ""}`;
    const existing = byMessage.get(key);
    if (existing === undefined || (existing.code === undefined && warning.code !== undefined)) byMessage.set(key, warning);
  }
  const firstHeader = new Map<string, number>();
  let duplicateColumn: number | null = null;
  for (let index = 0; index < table.header.length; index += 1) {
    const name = table.header[index] ?? "";
    if (firstHeader.has(name)) {
      duplicateColumn = index + 1;
      break;
    }
    firstHeader.set(name, index + 1);
  }
  return [...byMessage.values()].map((warning) =>
    warning.code === "DUPLICATE_HEADER" && warning.column === undefined && duplicateColumn !== null
      ? { ...warning, column: duplicateColumn }
      : warning
  );
}

function canReuseTable(mode: TableWorkbenchMode): boolean {
  return mode !== "to-json" && mode !== "from-json" && mode !== "sql";
}

export function buildTableResultV2Model(
  toolId: string,
  mode: TableWorkbenchMode,
  resultValue: unknown,
  inputText: string,
): TableResultV2Model {
  const result = record(resultValue);
  if (result === null) throw new TypeError("Result v2 table model requires an object result.");
  const table = resultTable(mode, result, inputText);
  const tablePayload = serializeCsvTable(table);
  const tableArtifact = artifact(
    "text",
    `${toolId}-tabella.csv`,
    "text/csv",
    tablePayload,
    "Tabella verificata tramite parser/serializer del motore table-operations locale",
  );
  const exported = primaryExport(toolId, mode, result, tablePayload);
  const warnings = warningsFor(result, table);
  return {
    rows: table.rows.length,
    columns: table.header.length,
    warnings,
    rowWarningCount: new Set(warnings.flatMap((warning) => warning.row === undefined ? [] : [warning.row])).size,
    duplicateHeaderWarningCount: warnings.filter((warning) => warning.code === "DUPLICATE_HEADER").length,
    tableArtifact,
    exportArtifact: exported.artifact,
    exportPayload: exported.payload,
    preview: createBoundedTablePreview(tableArtifact, table.header, table.rows, PREVIEW_ROWS),
    reusePayload: canReuseTable(mode) ? tablePayload : null,
    handoff: makeTableHandoff(tablePayload, table),
  };
}

export function emitsCsvTable(handoff: HandoffShape | undefined): boolean {
  return (handoff?.emits ?? []).some((descriptor) => descriptor.type === "table" && descriptor.format === "csv");
}

export function acceptsCsvTable(handoff: HandoffShape | undefined): boolean {
  return (handoff?.accepts ?? []).some((descriptor) => descriptor.type === "table" && descriptor.format === "csv");
}
