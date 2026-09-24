import type { DeveloperWebResult } from "../../engines/developer-web";

export interface RegexTesterInput { pattern: string; flags?: string; text: string; replacement?: string }
export interface RegexTesterOutput extends DeveloperWebResult { matches: Array<{ index: number; value: string }>; matchCount: number }
