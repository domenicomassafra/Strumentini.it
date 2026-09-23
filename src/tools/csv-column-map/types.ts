import type { CsvColumnMapEntry } from "../../engines/table/csv";

export interface CsvColumnMapInput {
  text: string;
  mapping: CsvColumnMapEntry[];
}

export interface CsvColumnMapOutput {
  output: string;
  headers: string[];
  mapping: CsvColumnMapEntry[];
  droppedColumns: Array<{ index: number; name: string }>;
  filledMissingCells: number;
  warnings: Array<{ code: string; message: string; row?: number }>;
  engineVersion: string;
}
