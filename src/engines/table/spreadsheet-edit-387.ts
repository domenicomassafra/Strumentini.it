import { isPotentialCsvFormula, parseCsvTable, serializeCsvTable, type CsvTable } from "./csv";
import { SPREADSHEET_INTERCHANGE_LIMITS, SpreadsheetInterchangeError } from "./spreadsheet-interchange";

/** The interactive editor renders every editable cell; refuse oversized grids. */
export const EDITOR_387_LIMITS = { rows: 200, columns: 32, csvBytes: 512 * 1024 } as const;

function invalid(message: string): never {
  throw new SpreadsheetInterchangeError("INVALID_INPUT", message);
}

export function validateEditable387(table: CsvTable): void {
  if (table.header.length === 0 || table.header.length > EDITOR_387_LIMITS.columns ||
      table.rows.length > EDITOR_387_LIMITS.rows) {
    invalid("Questo editor accetta al massimo 200 righe e 32 colonne; nessun dato è stato esportato.");
  }
  if (![",", ";", "\t", "|"].includes(table.delimiter)) invalid("Delimitatore CSV non supportato.");
  if (table.rows.some((row) => row.length !== table.header.length)) {
    invalid("Righe CSV irregolari: correggi la sorgente prima di importare.");
  }
  if ([table.header, ...table.rows].some((row) => row.some((value) => typeof value !== "string"))) {
    invalid("Ogni cella deve contenere testo.");
  }
  if ([table.header, ...table.rows].some((row) => row.some((value) => isPotentialCsvFormula(value)))) {
    invalid("Formula o prefisso CSV potenzialmente eseguibile: rifiutato, anche nelle intestazioni.");
  }
  if (new TextEncoder().encode(serializeCsvTable(table)).byteLength > EDITOR_387_LIMITS.csvBytes) {
    invalid("Tabella oltre il limite di modifica locale (512 KiB).");
  }
}

export function parseEditable387(csv: string): CsvTable {
  const bytes = new TextEncoder().encode(csv).byteLength;
  if (bytes > EDITOR_387_LIMITS.csvBytes || bytes > SPREADSHEET_INTERCHANGE_LIMITS.maxInputBytes) {
    invalid("CSV troppo grande per l'editor locale.");
  }
  const table = parseCsvTable(csv);
  validateEditable387(table);
  return table;
}

export function editCell387(table: CsvTable, row: number, column: number, value: string): CsvTable {
  if (!Number.isInteger(row) || !Number.isInteger(column) || column < 0 ||
      column >= table.header.length || row < -1 || row >= table.rows.length) invalid("Cella inesistente.");
  const header = [...table.header];
  const rows = table.rows.map((cells) => [...cells]);
  if (row === -1) header[column] = value;
  else rows[row]![column] = value;
  return { ...table, header, rows };
}

export function exportEditableCsv387(table: CsvTable): string {
  validateEditable387(table);
  return serializeCsvTable(table);
}
