import type { SpreadsheetColumnType } from "./spreadsheet-interchange";

/** Keep raw values and imported column types together for faithful edit/export. */
export function csvCell387(value: unknown, refuse: (reason: string) => never): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) return refuse("Workbook contains an invalid date value.");
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return refuse("Workbook contains an unsupported cell value.");
}

export function readColumnTypes387(rows: readonly unknown[][], columnCount: number): (SpreadsheetColumnType | "mixed")[] {
  return Array.from({ length: columnCount }, (_, column) => {
    const types = new Set<SpreadsheetColumnType | "mixed">();
    for (const row of rows.slice(1)) {
      const value = row[column];
      if (value === null || value === undefined || value === "") continue;
      types.add(value instanceof Date ? "date" : typeof value === "number" ? "number" : typeof value === "boolean" ? "mixed" : "text");
    }
    return types.size > 1 ? "mixed" : ([...types][0] ?? "text");
  });
}
