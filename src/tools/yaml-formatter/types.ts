import type { DeveloperWebResult } from "../../engines/developer-web";

export interface YamlFormatterInput { text: string; indent?: number }
export interface YamlFormatterOutput extends DeveloperWebResult { formatted: string; value: unknown }
