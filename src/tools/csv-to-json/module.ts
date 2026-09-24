import { csvTableToJson } from "../../engines/table/operations";
import { tableModule, optionalBoolean, optionalEnum, requiredText } from "../table/helpers";
import type { CsvToJsonOutput } from "./types";

const module = tableModule((value): CsvToJsonOutput => csvTableToJson(requiredText(value), { headerPolicy: optionalEnum(value, "headerPolicy", ["preserve", "unique"] as const, "unique"), pretty: optionalBoolean(value, "pretty", false) }));

export default module;
