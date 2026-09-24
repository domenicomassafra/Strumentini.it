import { assertBoundedTable, makeTableHandoff, transposeTable } from "../../engines/table/operations";
import { parseCsvTable } from "../../engines/table/csv";
import { tableModule, requiredText } from "../table/helpers";
import type { TableTransposeOutput } from "./types";

const module = tableModule((value): TableTransposeOutput => {
  const result = transposeTable(assertBoundedTable(parseCsvTable(requiredText(value))));
  return { ...result, handoff: makeTableHandoff(result.output, result.table) };
});

export default module;
