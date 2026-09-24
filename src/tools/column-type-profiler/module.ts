import { assertBoundedTable, makeTableHandoff, profileColumnTypes } from "../../engines/table/operations";
import { parseCsvTable } from "../../engines/table/csv";
import { tableModule, requiredText } from "../table/helpers";
import type { ColumnTypeProfilerOutput } from "./types";

const module = tableModule((value): ColumnTypeProfilerOutput => {
  const table = assertBoundedTable(parseCsvTable(requiredText(value)));
  const result = profileColumnTypes(table);
  return { ...result, handoff: makeTableHandoff(result.output, result.table) };
});

export default module;
