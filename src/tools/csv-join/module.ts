import { assertBoundedTable, joinCsvTables, makeTableHandoff, type TableJoinNullKeyPolicy, type TableJoinType } from "../../engines/table/operations";
import { parseCsvTable } from "../../engines/table/csv";
import { tableModule, optionalBoolean, optionalEnum, optionalStringArray, optionalText, requiredIndexes, requiredText } from "../table/helpers";
import type { CsvJoinOutput } from "./types";

const JOIN_TYPES: readonly TableJoinType[] = ["inner", "left", "right", "full"];
const NULL_KEY_POLICIES: readonly TableJoinNullKeyPolicy[] = ["match", "never-match"];

const module = tableModule((value): CsvJoinOutput => {
  const left = assertBoundedTable(parseCsvTable(requiredText(value, "leftText")));
  const right = assertBoundedTable(parseCsvTable(requiredText(value, "rightText")));
  const suffix = optionalText(value, "suffix");
  const nullTokens = optionalStringArray(value, "nullTokens");
  const result = joinCsvTables(left, right, { leftKeyColumns: requiredIndexes(value, "leftKeyColumns"), rightKeyColumns: requiredIndexes(value, "rightKeyColumns"), joinType: optionalEnum(value, "joinType", JOIN_TYPES, "inner"), caseSensitive: optionalBoolean(value, "caseSensitive", true), ...(suffix === undefined ? {} : { suffix }), ...(nullTokens === undefined ? {} : { nullTokens }), emptyAsNull: optionalBoolean(value, "emptyAsNull", false), nullKeyPolicy: optionalEnum(value, "nullKeyPolicy", NULL_KEY_POLICIES, "match") });
  return { ...result, handoff: makeTableHandoff(result.output, result.table) };
});

export default module;
