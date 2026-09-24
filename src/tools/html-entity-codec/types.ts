import type { DeveloperWebResult } from "../../engines/developer-web";

export interface HtmlEntityCodecInput { text: string; mode: "encode" | "decode"; numeric?: boolean }
export interface HtmlEntityCodecOutput extends DeveloperWebResult { value: string; warning: string }
