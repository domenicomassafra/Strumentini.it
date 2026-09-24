import type { DeveloperWebResult } from "../../engines/developer-web";

export interface QueryStringEditorInput { query: string; baseUrl?: string; setKey?: string; setValue?: string; removeKey?: string; sort?: boolean }
export interface QueryStringEditorOutput extends DeveloperWebResult { query: string; pairs: Array<{ key: string; value: string }> }
