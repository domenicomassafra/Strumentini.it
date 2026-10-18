import type { CsvTable } from "./csv";

type Limits = { readonly maxRows: number; readonly maxColumns: number; readonly maxCells: number };
type Reject = (code: "INVALID_INPUT" | "TABLE_TOO_LARGE", message: string) => never;

/** Validate the full incoming CSV width before a header-indexed XLSX writer
 * can silently drop a trailing cell from a ragged row. */
export function assertSpreadsheetTableBounds370(
  table: Pick<CsvTable, "header" | "rows">,
  limits: Limits,
  reject: Reject,
): void {
  const rowCount = table.rows.length + 1;
  const columnCount = Math.max(table.header.length, ...table.rows.map((row) => row.length), 0);
  const cellCount = table.header.length + table.rows.reduce((sum, row) => sum + row.length, 0);
  if (rowCount > limits.maxRows) reject("TABLE_TOO_LARGE", "Spreadsheet row count exceeds the local limit.");
  if (columnCount > limits.maxColumns) reject("TABLE_TOO_LARGE", "Spreadsheet column count exceeds the local limit.");
  if (cellCount > limits.maxCells) reject("TABLE_TOO_LARGE", "Spreadsheet cell count exceeds the local limit.");
  // Short rows intentionally pad empty trailing cells; long rows would lose
  // data because the writer maps only the declared header columns.
  if (table.rows.some((row) => row.length > table.header.length)) {
    reject("INVALID_INPUT", "CSV row has more cells than the header; refusing an XLSX export that would discard data.");
  }
}
