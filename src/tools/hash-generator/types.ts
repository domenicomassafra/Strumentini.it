import type { DeveloperWebResult } from "../../engines/developer-web";

export interface HashGeneratorInput { text: string; algorithm?: "SHA-256" | "SHA-384" | "SHA-512" }
export interface HashGeneratorOutput extends DeveloperWebResult { algorithm: string; digestHex: string }
