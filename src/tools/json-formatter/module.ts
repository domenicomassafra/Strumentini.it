import { createDeveloperWebModule } from "../../engines/developer-web";
import type { JsonFormatterInput, JsonFormatterOutput } from "./types";

const module = createDeveloperWebModule("json-formatter");
export default module;
export type { JsonFormatterInput, JsonFormatterOutput };
