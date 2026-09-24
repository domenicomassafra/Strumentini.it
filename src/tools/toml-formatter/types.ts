import type { DeveloperWebResult } from "../../engines/developer-web";

export interface TomlFormatterInput { text: string }
export interface TomlFormatterOutput extends DeveloperWebResult { formatted: string; value: Record<string, unknown> }
