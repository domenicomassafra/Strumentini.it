import { assertBoundedTable, fixTableEncoding, makeTableHandoff } from "../../engines/table/operations";
import { parseCsvTable } from "../../engines/table/csv";
import { tableModule, inputObject, optionalText } from "../table/helpers";
import type { CsvEncodingFixerOutput } from "./types";

function bytesValue(value: unknown): ArrayBuffer | Uint8Array | number[] {
  const candidate = inputObject(value).bytes;
  if (candidate instanceof ArrayBuffer || candidate instanceof Uint8Array) return candidate;
  if (Array.isArray(candidate) && candidate.every((item) => typeof item === "number" && Number.isInteger(item) && item >= 0 && item <= 255)) return candidate as number[];
  throw new Error("INVALID_INPUT");
}

const module = tableModule((value): CsvEncodingFixerOutput => {
  const result = fixTableEncoding(bytesValue(value), optionalText(value, "encoding"));
  try {
    const table = assertBoundedTable(parseCsvTable(result.output));
    return { ...result, handoff: makeTableHandoff(result.output, table) };
  } catch {
    return result;
  }
});

export default module;
