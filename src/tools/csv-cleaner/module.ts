import { cleanCsvText, CSV_ENGINE_VERSION } from "../../engines/table/csv";
import type { ToolModule } from "../../runtime/types";
import type { CsvCleanerInput, CsvCleanerOutput } from "./types";

const module: ToolModule = {
  run(value): CsvCleanerOutput {
    if (typeof value !== "object" || value === null || typeof (value as Partial<CsvCleanerInput>).text !== "string") throw new Error("INVALID_INPUT");
    return { ...cleanCsvText((value as CsvCleanerInput).text), engineVersion: CSV_ENGINE_VERSION };
  },
};

export default module;
