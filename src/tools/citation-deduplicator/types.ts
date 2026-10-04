import type { CitationRecord, DedupeGroup } from "../../engines/research-knowledge";

export type CitationDeduplicatorMode = "exact" | "identifier" | "title-author-year";

export interface CitationDeduplicatorInput {
  records: unknown;
  mode?: CitationDeduplicatorMode;
}

export interface CitationDeduplicatorOutput {
  records: CitationRecord[];
  unique: CitationRecord[];
  duplicates: CitationRecord[];
  groups: DedupeGroup[];
  removed: number;
  inputCount: number;
  outputCount: number;
  engineVersion: string;
}
