import type {
  ColumnTypeProfileResult,
  CsvToJsonResult,
  DelimiterDetection,
  DuplicateProfileResult,
  EncodingFixResult,
  JsonToCsvResult,
  MissingProfileResult,
  QuickChartResult,
  TableColumnSelectionResult,
  TableFilterResult,
  TableGroupCountResult,
  TableHandoff,
  TableJoinResult,
  TablePivotResult,
  TablePreviewResult,
  TableSortResult,
  TableTransposeResult,
  TsvToCsvResult,
  TableAggregate,
  TableDelimiter,
  TableFilterOperator,
  TableJoinType,
  TableJoinNullKeyPolicy,
  TableSortComparator,
} from "../../engines/table/operations";

export type {
  ColumnTypeProfileResult,
  CsvToJsonResult,
  DelimiterDetection,
  DuplicateProfileResult,
  EncodingFixResult,
  JsonToCsvResult,
  MissingProfileResult,
  QuickChartResult,
  TableColumnSelectionResult,
  TableFilterResult,
  TableGroupCountResult,
  TableHandoff,
  TableJoinResult,
  TablePivotResult,
  TablePreviewResult,
  TableSortResult,
  TableTransposeResult,
  TsvToCsvResult,
  TableAggregate,
  TableDelimiter,
  TableFilterOperator,
  TableJoinType,
  TableJoinNullKeyPolicy,
  TableSortComparator,
};

export interface CsvViewerInput { text: string; delimiter?: TableDelimiter; maxPreviewRows?: number }
export type CsvViewerOutput = TablePreviewResult & { handoff: TableHandoff };
export interface CsvDelimiterDetectorInput { text: string }
export type CsvDelimiterDetectorOutput = DelimiterDetection & { output?: string; table?: import("../../engines/table/csv").CsvTable; handoff?: TableHandoff };
export interface CsvEncodingFixerInput { bytes: ArrayBuffer | Uint8Array | number[]; encoding?: string }
export type CsvEncodingFixerOutput = EncodingFixResult & { handoff?: TableHandoff };
export interface CsvColumnSelectorInput { text: string; columns: number[] }
export type CsvColumnSelectorOutput = TableColumnSelectionResult & { handoff: TableHandoff };
export interface CsvFilterInput { text: string; column: number; operator: TableFilterOperator; value?: string; caseSensitive?: boolean; nullTokens?: string[]; emptyAsNull?: boolean }
export type CsvFilterOutput = TableFilterResult & { handoff: TableHandoff };
export interface CsvSortInput { text: string; column: number; direction?: "asc" | "desc"; comparator?: TableSortComparator; nulls?: "first" | "last"; caseSensitive?: boolean; nullTokens?: string[]; emptyAsNull?: boolean }
export type CsvSortOutput = TableSortResult & { handoff: TableHandoff };
export interface CsvGroupCountInput { text: string; groupColumns: number[]; countColumn?: number; aggregate?: TableAggregate; caseSensitive?: boolean; nullTokens?: string[]; emptyAsNull?: boolean }
export type CsvGroupCountOutput = TableGroupCountResult & { handoff: TableHandoff };
export interface CsvJoinInput { leftText: string; rightText: string; leftKeyColumns: number[]; rightKeyColumns: number[]; joinType?: TableJoinType; caseSensitive?: boolean; suffix?: string; nullTokens?: string[]; emptyAsNull?: boolean; nullKeyPolicy?: TableJoinNullKeyPolicy }
export type CsvJoinOutput = TableJoinResult & { handoff: TableHandoff };
export interface CsvPivotInput { text: string; groupColumns: number[]; valueColumn?: number; valueHeaderColumn?: number; aggregateColumn?: number; aggregate?: TableAggregate; caseSensitive?: boolean; nullTokens?: string[]; emptyAsNull?: boolean }
export type CsvPivotOutput = TablePivotResult & { handoff: TableHandoff };
export interface CsvToJsonInput { text: string; headerPolicy?: "preserve" | "unique"; pretty?: boolean }
export type CsvToJsonOutput = CsvToJsonResult;
export interface JsonToCsvInput { json: string; headerMode?: "first" | "union" }
export type JsonToCsvOutput = JsonToCsvResult & { handoff: TableHandoff };
export interface TsvToCsvInput { text: string }
export type TsvToCsvOutput = TsvToCsvResult & { handoff: TableHandoff };
export interface TableTransposeInput { text: string }
export type TableTransposeOutput = TableTransposeResult & { handoff: TableHandoff };
export interface MissingValueProfilerInput { text: string }
export type MissingValueProfilerOutput = MissingProfileResult & { handoff: TableHandoff };
export interface ColumnTypeProfilerInput { text: string }
export type ColumnTypeProfilerOutput = ColumnTypeProfileResult & { handoff: TableHandoff };
export interface DuplicateRowProfilerInput { text: string; keyColumns?: number[]; maxExamples?: number }
export type DuplicateRowProfilerOutput = DuplicateProfileResult & { handoff: TableHandoff };
export interface QuickChartInput { text: string; labelColumn: number; valueColumn?: number; aggregate?: TableAggregate; maxBars?: number }
export type QuickChartOutput = QuickChartResult & { handoff: TableHandoff };
