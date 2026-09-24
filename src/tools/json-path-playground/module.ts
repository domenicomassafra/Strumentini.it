import { createDeveloperWebModule } from "../../engines/developer-web";
import type { JsonPathPlaygroundInput, JsonPathPlaygroundOutput } from "./types";

const module = createDeveloperWebModule("json-path-playground");
export default module;
export type { JsonPathPlaygroundInput, JsonPathPlaygroundOutput };
