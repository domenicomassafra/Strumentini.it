import { assertBoundedTable, makeTableHandoff, quickChartFromTable, type TableAggregate } from "../../engines/table/operations";
import { parseCsvTable, serializeCsvTable } from "../../engines/table/csv";
import { tableModule, optionalEnum, optionalNumber, requiredNumber, requiredText } from "../table/helpers";
import type { QuickChartOutput } from "./types";

const AGGREGATES: readonly TableAggregate[] = ["count", "sum", "min", "max"];

const module = tableModule((value): QuickChartOutput => {
  const table = assertBoundedTable(parseCsvTable(requiredText(value)));
  const valueColumn = optionalNumber(value, "valueColumn");
  const result = quickChartFromTable(table, { labelColumn: requiredNumber(value, "labelColumn"), ...(valueColumn === undefined ? {} : { valueColumn }), aggregate: optionalEnum(value, "aggregate", AGGREGATES, valueColumn === undefined ? "count" : "sum"), maxBars: optionalNumber(value, "maxBars") ?? 30 });
  const payload = serializeCsvTable(table);
  return { ...result, handoff: makeTableHandoff(payload, table) };
});

export default module;
