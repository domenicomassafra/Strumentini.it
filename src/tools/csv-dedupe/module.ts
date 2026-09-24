import { CSV_ENGINE_VERSION, dedupeCsvTable, parseCsvTable } from "../../engines/table/csv";
import { assertBoundedTable, assertBoundedTableText, makeTableHandoff } from "../../engines/table/operations";
import type { ToolModule } from "../../runtime/types";
import type { CsvDedupeInput, CsvDedupeOutput } from "./types";

const module: ToolModule = {
  run(value): CsvDedupeOutput {
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
    const input = value as Partial<CsvDedupeInput>;
    if (typeof input.text !== "string" || (input.mode !== "whole-row" && input.mode !== "key-columns")) throw new Error("INVALID_INPUT");
    if (input.keyColumns !== undefined && (!Array.isArray(input.keyColumns) || input.keyColumns.some((index) => typeof index !== "number"))) throw new Error("INVALID_INPUT");
    assertBoundedTableText(input.text);
    const result = dedupeCsvTable(assertBoundedTable(parseCsvTable(input.text)), {
      mode: input.mode,
      ...(input.keyColumns === undefined ? {} : { keyColumns: input.keyColumns }),
    });
    return {
      output: result.output,
      inputRows: result.inputRows,
      outputRows: result.outputRows,
      removedRows: result.removedRows,
      mode: result.mode,
      keyColumns: result.keyColumns,
      emptyKeyPolicy: result.emptyKeyPolicy,
      headers: result.table.header,
      warnings: result.table.warnings,
      engineVersion: CSV_ENGINE_VERSION,
      handoff: makeTableHandoff(result.output, result.table),
    };
  },
};

export default module;
