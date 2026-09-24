import type { DeveloperWebResult } from "../../engines/developer-web";

export interface CronExplainerInput { expression: string }
export interface CronExplainerOutput extends DeveloperWebResult { expression: string; fields: Record<string, unknown> }
