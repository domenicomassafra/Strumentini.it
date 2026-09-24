import type { DeveloperWebResult } from "../../engines/developer-web";

export interface HmacGeneratorInput { message: string; key: string; algorithm?: "SHA-256" | "SHA-384" | "SHA-512" }
export interface HmacGeneratorOutput extends DeveloperWebResult { algorithm: string; digestHex: string; digestBase64: string }
