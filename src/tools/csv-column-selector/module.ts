import { assertBoundedTable, makeTableHandoff, selectTableColumns } from "../../engines/table/operations";
import { parseCsvTable } from "../../engines/table/csv";
import { tableModule, requiredIndexes, requiredText } from "../table/helpers";
import type { CsvColumnSelectorOutput } from "./types";

const module = tableModule((value): CsvColumnSelectorOutput => {
  const table = assertBoundedTable(parseCsvTable(requiredText(value)));
  const result = selectTableColumns(table, requiredIndexes(value, "columns"));
  return { ...result, handoff: makeTableHandoff(result.output, result.table) };
});

export default module;
