import type { DeveloperWebResult } from "../../engines/developer-web";

export interface Base64CodecInput { text: string; mode: "encode" | "decode"; urlSafe?: boolean }
export interface Base64CodecOutput extends DeveloperWebResult { value: string; byteLength: number }
