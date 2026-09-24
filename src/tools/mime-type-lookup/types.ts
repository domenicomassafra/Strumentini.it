import type { DeveloperWebResult } from "../../engines/developer-web";

export interface MimeTypeLookupInput { lookup: string; mode?: "extension" | "signature"; bytes?: string }
export interface MimeTypeLookupOutput extends DeveloperWebResult { mime: string | null; warning: string }
