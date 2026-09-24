import type { CsvColumnMapEntry } from "../../engines/table/csv";
import type { TableHandoff } from "../table/types";

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
  handoff: TableHandoff;
}
