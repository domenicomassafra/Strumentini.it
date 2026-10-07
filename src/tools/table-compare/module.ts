import { compareCsvText } from "../../engines/table/advanced";
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
  return compareCsvText(requiredText(value, "leftText"), requiredText(value, "rightText"), {
    leftKeyColumns: requiredIndexes(value, "leftKeyColumns"),
    rightKeyColumns: requiredIndexes(value, "rightKeyColumns"),
    leftCompareColumns: requiredIndexes(value, "leftCompareColumns"),
    rightCompareColumns: requiredIndexes(value, "rightCompareColumns"),
    caseSensitive: optionalBoolean(value, "caseSensitive", true),
    ...(tokens === undefined ? {} : { nullTokens: tokens }),
    emptyAsNull: optionalBoolean(value, "emptyAsNull", true),
  });
});
