import { makeTableHandoff, tsvToCsv } from "../../engines/table/operations";
import { tableModule, requiredText } from "../table/helpers";
import type { TsvToCsvOutput } from "./types";

const module = tableModule((value): TsvToCsvOutput => {
  const result = tsvToCsv(requiredText(value));
  return { ...result, handoff: makeTableHandoff(result.output, result.table) };
});

export default module;
