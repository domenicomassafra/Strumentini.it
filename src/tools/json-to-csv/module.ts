import { jsonToCsvTable, makeTableHandoff } from "../../engines/table/operations";
import { tableModule, optionalEnum, requiredText } from "../table/helpers";
import type { JsonToCsvOutput } from "./types";

const module = tableModule((value): JsonToCsvOutput => {
  const result = jsonToCsvTable(requiredText(value, "json"), { headerMode: optionalEnum(value, "headerMode", ["first", "union"] as const, "first") });
  return { ...result, handoff: makeTableHandoff(result.output, result.table) };
});

export default module;
