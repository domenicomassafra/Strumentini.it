import { assertBoundedTable, filterTable, makeTableHandoff, type TableFilterOperator } from "../../engines/table/operations";
import { parseCsvTable } from "../../engines/table/csv";
import { tableModule, optionalBoolean, optionalStringArray, optionalText, requiredEnum, requiredNumber, requiredText } from "../table/helpers";
import type { CsvFilterOutput } from "./types";

const OPERATORS: readonly TableFilterOperator[] = ["equals", "not-equals", "contains", "not-contains", "starts-with", "ends-with", "regex", "empty", "not-empty"];

const module = tableModule((value): CsvFilterOutput => {
  const table = assertBoundedTable(parseCsvTable(requiredText(value)));
  const nullTokens = optionalStringArray(value, "nullTokens");
  const result = filterTable(table, { column: requiredNumber(value, "column"), operator: requiredEnum(value, "operator", OPERATORS), value: optionalText(value, "value") ?? "", caseSensitive: optionalBoolean(value, "caseSensitive", true), ...(nullTokens === undefined ? {} : { nullTokens }), emptyAsNull: optionalBoolean(value, "emptyAsNull", false) });
  return { ...result, handoff: makeTableHandoff(result.output, result.table) };
});

export default module;
