import type { DeveloperWebResult } from "../../engines/developer-web";

export interface UrlCodecInput { text: string; mode: "encode" | "decode"; set: "component" | "query" | "path" | "userinfo" }
export interface UrlCodecOutput extends DeveloperWebResult { value: string; roundTrip: boolean }
