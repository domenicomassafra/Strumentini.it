import type { CsvSplitMode, CsvSplitResult } from "../../engines/table/advanced";

export interface CsvSplitterInput {
  readonly text?: string;
  readonly file?: Blob;
  readonly mode: CsvSplitMode;
  readonly rowsPerChunk?: number;
  readonly targetBytes?: number;
}

export type CsvSplitterOutput = CsvSplitResult;
