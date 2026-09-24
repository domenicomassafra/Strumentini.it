import { makeTableHandoff, detectCsvDelimiter, parseDelimitedTable } from "../../engines/table/operations";
import { serializeCsvTable } from "../../engines/table/csv";
import { tableModule, requiredText } from "../table/helpers";
import type { CsvDelimiterDetectorOutput } from "./types";

const module = tableModule((value): CsvDelimiterDetectorOutput => {
  const text = requiredText(value);
  const detection = detectCsvDelimiter(text);
  try {
    const table = parseDelimitedTable(text, detection.delimiter);
    const output = serializeCsvTable(table);
    return { ...detection, output, table, handoff: makeTableHandoff(output, table) };
  } catch {
    return detection;
  }
});

export default module;
