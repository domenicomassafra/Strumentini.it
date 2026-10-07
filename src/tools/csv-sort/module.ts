import { assertBoundedTable, makeTableHandoff, sortTable, type TableSortComparator } from "../../engines/table/operations";
import { parseCsvTable } from "../../engines/table/csv";
import { tableModule, optionalBoolean, optionalEnum, optionalStringArray, requiredNumber, requiredText } from "../table/helpers";
import type { CsvSortOutput } from "./types";

const COMPARATORS: readonly TableSortComparator[] = ["lexical", "numeric", "date"];

const module = tableModule((value): CsvSortOutput => {
  const table = assertBoundedTable(parseCsvTable(requiredText(value)));
  const nullTokens = optionalStringArray(value, "nullTokens");
  const result = sortTable(table, { column: requiredNumber(value, "column"), direction: optionalEnum(value, "direction", ["asc", "desc"] as const, "asc"), comparator: optionalEnum(value, "comparator", COMPARATORS, "lexical"), nulls: optionalEnum(value, "nulls", ["first", "last"] as const, "last"), caseSensitive: optionalBoolean(value, "caseSensitive", true), ...(nullTokens === undefined ? {} : { nullTokens }), emptyAsNull: optionalBoolean(value, "emptyAsNull", true) });
  return { ...result, handoff: makeTableHandoff(result.output, result.table) };
});

export default module;
