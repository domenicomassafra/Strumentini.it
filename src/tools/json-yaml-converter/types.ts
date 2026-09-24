import type { DeveloperWebResult } from "../../engines/developer-web";

export interface JsonYamlConverterInput { text: string; direction: "json-to-yaml" | "yaml-to-json"; indent?: number }
export interface JsonYamlConverterOutput extends DeveloperWebResult { output: string; value: unknown }
