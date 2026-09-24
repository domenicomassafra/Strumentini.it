import type { DeveloperWebResult } from "../../engines/developer-web";

export interface UnixTimestampInput { value: string | number; unit?: "seconds" | "milliseconds"; direction?: "to-date" | "to-timestamp" }
export interface UnixTimestampOutput extends DeveloperWebResult { timestamp: number; date: string }
