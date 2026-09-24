import { createDeveloperWebModule } from "../../engines/developer-web";
import type { JsonYamlConverterInput, JsonYamlConverterOutput } from "./types";

const module = createDeveloperWebModule("json-yaml-converter");
export default module;
export type { JsonYamlConverterInput, JsonYamlConverterOutput };
