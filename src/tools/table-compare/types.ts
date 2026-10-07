import type { TableCompareResult } from "../../engines/table/advanced";

export interface TableCompareInput {
  readonly leftText: string;
  readonly rightText: string;
  readonly leftKeyColumns: readonly number[];
  readonly rightKeyColumns: readonly number[];
  readonly leftCompareColumns: readonly number[];
  readonly rightCompareColumns: readonly number[];
  readonly caseSensitive?: boolean;
  readonly nullTokens?: readonly string[];
  readonly emptyAsNull?: boolean;
}

export type TableCompareOutput = TableCompareResult;
