import type { DeveloperWebResult } from "../../engines/developer-web";

export interface JsonFormatterInput { text: string; mode?: "format" | "validate"; indent?: number; sortKeys?: boolean }
export interface JsonFormatterOutput extends DeveloperWebResult { formatted: string; value: unknown; duplicateKeys: string[] }
