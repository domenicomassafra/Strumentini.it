import { assertBoundedTable, makeTableHandoff, type TableJoinNullKeyPolicy, type TableJoinType } from "../../engines/table/operations";
import { parseCsvTable } from "../../engines/table/csv";
import { joinTables390, mergeCsvParts390, type KeyPrecision390 } from "../../engines/table/relations-390";
import { tableModule, inputObject, optionalBoolean, optionalEnum, optionalStringArray, optionalText, requiredIndexes, requiredText } from "../table/helpers";
import type { CsvJoinOutput } from "./types";

const JOIN_TYPES: readonly TableJoinType[] = ["inner", "left", "right", "full"];
const NULL_KEY_POLICIES: readonly TableJoinNullKeyPolicy[] = ["match", "never-match"];

const module = tableModule((value): CsvJoinOutput => {
  const raw = inputObject(value);
  if (raw.operation === "merge-parts") {
    if (!Array.isArray(raw.partsTexts) || raw.partsTexts.some((part) => typeof part !== "string")) throw new Error("INVALID_MERGE_PARTS");
    const merged = mergeCsvParts390(raw.partsTexts.map((part) => parseCsvTable(part as string)));
    return { ...merged, handoff: makeTableHandoff(merged.output, merged.table) };
  }
  if (raw.operation !== undefined && raw.operation !== "join") throw new Error("INVALID_TABLE_OPERATION");
  const left = assertBoundedTable(parseCsvTable(requiredText(value, "leftText")));
  const right = assertBoundedTable(parseCsvTable(requiredText(value, "rightText")));
  const suffix = optionalText(value, "suffix");
  const nullTokens = optionalStringArray(value, "nullTokens");
  const precision = raw.keyPrecision ?? "text";
  if (!["text", "decimal-exact", "decimal-scale"].includes(String(precision))) throw new Error("INVALID_KEY_PRECISION");
  const duplicatePolicy = raw.duplicatePolicy ?? "reject";
  if (duplicatePolicy !== "reject" && duplicatePolicy !== "expand") throw new Error("INVALID_DUPLICATE_POLICY");
  const decimalPlaces = raw.decimalPlaces === undefined ? undefined : Number(raw.decimalPlaces);
  const result = joinTables390(left, right, { leftKeyColumns: requiredIndexes(value, "leftKeyColumns"), rightKeyColumns: requiredIndexes(value, "rightKeyColumns"), joinType: optionalEnum(value, "joinType", JOIN_TYPES, "inner"), caseSensitive: optionalBoolean(value, "caseSensitive", true), ...(suffix === undefined ? {} : { suffix }), ...(nullTokens === undefined ? {} : { nullTokens }), emptyAsNull: optionalBoolean(value, "emptyAsNull", true), nullKeyPolicy: optionalEnum(value, "nullKeyPolicy", NULL_KEY_POLICIES, "never-match"), keyPrecision: precision as KeyPrecision390, ...(decimalPlaces === undefined ? {} : { decimalPlaces }), duplicatePolicy });
  return { ...result, handoff: makeTableHandoff(result.output, result.table) };
});

export default module;
