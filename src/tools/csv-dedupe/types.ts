export interface CsvDedupeInput {
  text: string;
  mode: "whole-row" | "key-columns";
  keyColumns?: number[];
}

import type { TableHandoff } from "../table/types";

export interface CsvDedupeOutput {
  output: string;
  inputRows: number;
  outputRows: number;
  removedRows: number;
  mode: "whole-row" | "key-columns";
  keyColumns: number[];
  emptyKeyPolicy: "keep";
  headers: string[];
  warnings: Array<{ code: string; message: string; row?: number }>;
  engineVersion: string;
  handoff: TableHandoff;
}
