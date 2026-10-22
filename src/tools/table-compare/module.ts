import { parseCsvTable } from "../../engines/table/csv";
import { compareTables390, type KeyPrecision390 } from "../../engines/table/relations-390";
import { inputObject, optionalBoolean, requiredIndexes, requiredText, tableModule } from "../table/helpers";
import type { TableCompareOutput } from "./types";

function nullTokens(value: unknown): readonly string[] | undefined {
  const candidate = inputObject(value).nullTokens;
  if (candidate === undefined) return undefined;
  if (!Array.isArray(candidate) || candidate.some((entry) => typeof entry !== "string")) throw new Error("INVALID_NULL_POLICY");
  return candidate as string[];
}

export default tableModule((value): TableCompareOutput => {
  const tokens = nullTokens(value);
  const raw = inputObject(value);
  const precision = raw.keyPrecision ?? "text";
  if (!["text", "decimal-exact", "decimal-scale"].includes(String(precision))) throw new Error("INVALID_KEY_PRECISION");
  const decimalPlaces = raw.decimalPlaces === undefined ? undefined : Number(raw.decimalPlaces);
  const nullKeyPolicy = raw.nullKeyPolicy ?? "reject";
  if (nullKeyPolicy !== "reject" && nullKeyPolicy !== "match") throw new Error("INVALID_NULL_KEY_POLICY");
  return compareTables390(parseCsvTable(requiredText(value, "leftText")), parseCsvTable(requiredText(value, "rightText")), {
    leftKeyColumns: requiredIndexes(value, "leftKeyColumns"),
    rightKeyColumns: requiredIndexes(value, "rightKeyColumns"),
    leftCompareColumns: requiredIndexes(value, "leftCompareColumns"),
    rightCompareColumns: requiredIndexes(value, "rightCompareColumns"),
    caseSensitive: optionalBoolean(value, "caseSensitive", true),
    ...(tokens === undefined ? {} : { nullTokens: tokens }),
    emptyAsNull: optionalBoolean(value, "emptyAsNull", true),
    keyPrecision: precision as KeyPrecision390,
    ...(decimalPlaces === undefined ? {} : { decimalPlaces }),
    nullKeyPolicy,
  });
});
