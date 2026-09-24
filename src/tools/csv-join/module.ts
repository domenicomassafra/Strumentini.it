import { assertBoundedTable, joinCsvTables, makeTableHandoff, type TableJoinType } from "../../engines/table/operations";
import { parseCsvTable } from "../../engines/table/csv";
import { tableModule, optionalBoolean, optionalEnum, optionalText, requiredIndexes, requiredText } from "../table/helpers";
import type { CsvJoinOutput } from "./types";

const JOIN_TYPES: readonly TableJoinType[] = ["inner", "left", "right", "full"];

const module = tableModule((value): CsvJoinOutput => {
  const left = assertBoundedTable(parseCsvTable(requiredText(value, "leftText")));
  const right = assertBoundedTable(parseCsvTable(requiredText(value, "rightText")));
  const suffix = optionalText(value, "suffix");
  const result = joinCsvTables(left, right, { leftKeyColumns: requiredIndexes(value, "leftKeyColumns"), rightKeyColumns: requiredIndexes(value, "rightKeyColumns"), joinType: optionalEnum(value, "joinType", JOIN_TYPES, "inner"), caseSensitive: optionalBoolean(value, "caseSensitive", true), ...(suffix === undefined ? {} : { suffix }) });
  return { ...result, handoff: makeTableHandoff(result.output, result.table) };
});

export default module;
