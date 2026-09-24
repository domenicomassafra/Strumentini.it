import { assertBoundedTable, makeTableHandoff, profileDuplicateRows } from "../../engines/table/operations";
import { parseCsvTable } from "../../engines/table/csv";
import { tableModule, optionalIndexes, optionalNumber, requiredText } from "../table/helpers";
import type { DuplicateRowProfilerOutput } from "./types";

const module = tableModule((value): DuplicateRowProfilerOutput => {
  const table = assertBoundedTable(parseCsvTable(requiredText(value)));
  const keyColumns = optionalIndexes(value, "keyColumns");
  const result = profileDuplicateRows(table, { ...(keyColumns === undefined ? {} : { keyColumns }), maxExamples: optionalNumber(value, "maxExamples") ?? 100 });
  return { ...result, handoff: makeTableHandoff(result.output, result.table) };
});

export default module;
