import { assertBoundedTable, groupCountTable, makeTableHandoff, type TableAggregate } from "../../engines/table/operations";
import { parseCsvTable } from "../../engines/table/csv";
import { tableModule, optionalEnum, optionalNumber, requiredIndexes, requiredText } from "../table/helpers";
import type { CsvGroupCountOutput } from "./types";

const AGGREGATES: readonly TableAggregate[] = ["count", "sum", "min", "max"];

const module = tableModule((value): CsvGroupCountOutput => {
  const table = assertBoundedTable(parseCsvTable(requiredText(value)));
  const countColumn = optionalNumber(value, "countColumn");
  const result = groupCountTable(table, { groupColumns: requiredIndexes(value, "groupColumns"), ...(countColumn === undefined ? {} : { countColumn }), aggregate: optionalEnum(value, "aggregate", AGGREGATES, "count") });
  return { ...result, handoff: makeTableHandoff(result.output, result.table) };
});

export default module;
