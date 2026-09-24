import type { DeveloperWebResult } from "../../engines/developer-web";

export interface UuidGeneratorInput { count?: number; version?: 4 | 7; uppercase?: boolean; seed?: string; bytes?: number[] }
export interface UuidGeneratorOutput extends DeveloperWebResult { uuids: string[]; version: number }
