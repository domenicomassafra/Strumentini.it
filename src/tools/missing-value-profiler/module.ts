import { assertBoundedTable, makeTableHandoff, profileMissingValues } from "../../engines/table/operations";
import { parseCsvTable } from "../../engines/table/csv";
import { tableModule, requiredText } from "../table/helpers";
import type { MissingValueProfilerOutput } from "./types";

const module = tableModule((value): MissingValueProfilerOutput => {
  const table = assertBoundedTable(parseCsvTable(requiredText(value)));
  const result = profileMissingValues(table);
  return { ...result, handoff: makeTableHandoff(result.output, result.table) };
});

export default module;
