import type { DeveloperWebResult } from "../../engines/developer-web";

export interface CronNextRunInput { expression: string; from?: string; count?: number }
export interface CronNextRunOutput extends DeveloperWebResult { runs: string[]; timezone: string }
