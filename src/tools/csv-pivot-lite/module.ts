import { assertBoundedTable, makeTableHandoff, pivotTable, type TableAggregate } from "../../engines/table/operations";
import { parseCsvTable } from "../../engines/table/csv";
import { tableModule, optionalBoolean, optionalEnum, optionalNumber, optionalStringArray, requiredIndexes, requiredText } from "../table/helpers";
import type { CsvPivotOutput } from "./types";

const AGGREGATES: readonly TableAggregate[] = ["count", "sum", "min", "max"];

const module = tableModule((value): CsvPivotOutput => {
  const table = assertBoundedTable(parseCsvTable(requiredText(value)));
  const valueColumn = optionalNumber(value, "valueColumn");
  const valueHeaderColumn = optionalNumber(value, "valueHeaderColumn");
  const aggregateColumn = optionalNumber(value, "aggregateColumn");
  const nullTokens = optionalStringArray(value, "nullTokens");
  const result = pivotTable(table, { groupColumns: requiredIndexes(value, "groupColumns"), ...(valueColumn === undefined ? {} : { valueColumn }), ...(valueHeaderColumn === undefined ? {} : { valueHeaderColumn }), ...(aggregateColumn === undefined ? {} : { aggregateColumn }), aggregate: optionalEnum(value, "aggregate", AGGREGATES, "sum"), caseSensitive: optionalBoolean(value, "caseSensitive", true), ...(nullTokens === undefined ? {} : { nullTokens }), emptyAsNull: optionalBoolean(value, "emptyAsNull", false) });
  return { ...result, handoff: makeTableHandoff(result.output, result.table) };
});

export default module;
