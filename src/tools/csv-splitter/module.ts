import { splitCsvBlob, splitCsvText, type CsvSplitMode } from "../../engines/table/advanced";
import { inputObject, optionalNumber, requiredEnum, tableModule } from "../table/helpers";
import type { CsvSplitterOutput } from "./types";

const MODES: readonly CsvSplitMode[] = ["rows", "bytes"];

export default tableModule(async (value, signal): Promise<CsvSplitterOutput> => {
  const input = inputObject(value);
  const mode = requiredEnum(value, "mode", MODES);
  const rowsPerChunk = optionalNumber(value, "rowsPerChunk");
  const targetBytes = optionalNumber(value, "targetBytes");
  const options = { mode, ...(rowsPerChunk === undefined ? {} : { rowsPerChunk }), ...(targetBytes === undefined ? {} : { targetBytes }) };
  if (typeof Blob !== "undefined" && input.file instanceof Blob) return splitCsvBlob(input.file, options, signal);
  if (typeof input.text !== "string") throw new Error("INVALID_INPUT: choose a CSV file or paste CSV text");
  return splitCsvText(input.text, options, signal);
});
