import { CSV_ENGINE_VERSION, mapCsvColumns, parseCsvTable } from "../../engines/table/csv";
import type { ToolModule } from "../../runtime/types";
import type { CsvColumnMapInput, CsvColumnMapOutput } from "./types";

const module: ToolModule = {
  run(value): CsvColumnMapOutput {
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
    const input = value as Partial<CsvColumnMapInput>;
    if (typeof input.text !== "string" || !Array.isArray(input.mapping)) throw new Error("INVALID_INPUT");
    const result = mapCsvColumns(parseCsvTable(input.text), input.mapping);
    return {
      output: result.output,
      headers: result.table.header,
      mapping: result.mapping,
      droppedColumns: result.droppedColumns,
      filledMissingCells: result.filledMissingCells,
      warnings: result.table.warnings,
      engineVersion: CSV_ENGINE_VERSION,
    };
  },
};

export default module;
