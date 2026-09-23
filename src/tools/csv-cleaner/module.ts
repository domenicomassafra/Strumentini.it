import { cleanCsvText, CSV_ENGINE_VERSION } from "../../engines/table/csv";
import type { ToolModule } from "../../runtime/types";
import type { TableHandoffEnvelope } from "../../runtime/handoff";
import type { CsvCleanerInput, CsvCleanerOutput } from "./types";

const module: ToolModule = {
  run(value): CsvCleanerOutput {
    if (typeof value !== "object" || value === null || typeof (value as Partial<CsvCleanerInput>).text !== "string") throw new Error("INVALID_INPUT");
    const cleaned = cleanCsvText((value as CsvCleanerInput).text);
    const duplicateHeaders = cleaned.warnings.some((warning) => warning.code === "DUPLICATE_HEADER");
    const raggedRows = cleaned.warnings.some((warning) => warning.code === "RAGGED_ROW");
    const handoff: TableHandoffEnvelope = {
      descriptor: {
        type: "table",
        format: "csv",
        version: 1,
        encoding: "utf-8",
        bytes: new TextEncoder().encode(cleaned.output).byteLength,
        rowCount: Math.max(0, cleaned.rows - 1),
        columnCount: cleaned.columns,
        columns: cleaned.headers,
        duplicateHeaders,
        raggedRows,
      },
      payload: cleaned.output,
    };
    return { ...cleaned, engineVersion: CSV_ENGINE_VERSION, handoff };
  },
};

export default module;
