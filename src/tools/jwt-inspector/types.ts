import type { DeveloperWebResult } from "../../engines/developer-web";

export interface JwtInspectorInput { token: string }
export interface JwtInspectorOutput extends DeveloperWebResult { header: Record<string, unknown>; payload: Record<string, unknown>; unsecured: boolean }
