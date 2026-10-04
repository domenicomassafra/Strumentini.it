import type { CitationRecord } from "../../engines/research-knowledge";

export interface CitationKeyGeneratorInput {
  records: unknown;
}

export interface CitationKeyGeneratorOutput {
  keys: string[];
  records: CitationRecord[];
  keyCount: number;
  collisions: number;
  engineVersion: string;
}
