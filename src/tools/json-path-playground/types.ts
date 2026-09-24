import type { DeveloperWebResult } from "../../engines/developer-web";

export interface JsonPathPlaygroundInput { json: string; path: string }
export interface JsonPathPlaygroundOutput extends DeveloperWebResult { matches: Array<{ path: string; value: unknown }>; matchCount: number }
