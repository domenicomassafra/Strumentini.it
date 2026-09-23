export interface CsvCleanerInput { text: string }
export interface CsvCleanerOutput {
  output: string;
  rows: number;
  columns: number;
  delimiter: string;
  warnings: Array<{ code: string; message: string; row?: number }>;
  changes: { strippedBom: boolean; normalizedRecordBreaks: number };
  engineVersion: string;
}
