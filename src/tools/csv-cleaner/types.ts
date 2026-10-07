import type { TableHandoffEnvelope } from "../../runtime/handoff";

export interface CsvCleanerInput { text: string }
export interface CsvCleanerOutput {
  output: string;
  rows: number;
  columns: number;
  headers: string[];
  delimiter: string;
  warnings: Array<{ code: string; message: string; row?: number }>;
  changes: { strippedBom: boolean; normalizedRecordBreaks: number };
  dialect: { delimiter: string; encoding: "utf-8"; dynamicTyping: false };
  affectedRows: 0;
  affectedCells: 0;
  engineVersion: string;
  handoff: TableHandoffEnvelope;
}
