import type { DeveloperWebResult } from "../../engines/developer-web";

export type Base64CodecInput =
  | { text: string; mode: "encode" | "decode" | "decode-bytes"; urlSafe?: boolean }
  | { bytes: number[]; mode: "encode-bytes"; urlSafe?: boolean }
  | { bytes: number[]; mode: "encode-image"; envelope?: "plain" | "data-url" }
  | { text: string; mode: "decode-image"; envelope?: "plain" | "data-url" };
export interface Base64CodecOutput extends DeveloperWebResult { value: string; byteLength: number }
