import { makeTableHandoff, viewCsvTable, type TableDelimiter, type TableTextOptions } from "../../engines/table/operations";
import { tableModule, inputObject, optionalEnum, optionalNumber, requiredText } from "../table/helpers";
import type { CsvViewerOutput } from "./types";

const DELIMITERS = [",", ";", "\t", "|"] as const;

const module = tableModule((value): CsvViewerOutput => {
  const input = inputObject(value);
  const options: TableTextOptions = {};
  if (input.delimiter !== undefined) options.delimiter = optionalEnum<TableDelimiter>(value, "delimiter", DELIMITERS, ",");
  const maxPreviewRows = optionalNumber(value, "maxPreviewRows");
  if (maxPreviewRows !== undefined) options.maxPreviewRows = maxPreviewRows;
  const result = viewCsvTable(requiredText(value), options);
  return { ...result, handoff: makeTableHandoff(result.output, result.table) };
});

export default module;
