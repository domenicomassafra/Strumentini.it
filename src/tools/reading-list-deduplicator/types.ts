import type { CitationRecord, DedupeGroup } from "../../engines/research-knowledge";

export interface ReadingListDeduplicatorInput {
  records: unknown;
}

export interface ReadingListDeduplicatorOutput {
  records: CitationRecord[];
  unique: CitationRecord[];
  duplicates: CitationRecord[];
  groups: DedupeGroup[];
  removed: number;
  inputCount: number;
  outputCount: number;
  engineVersion: string;
}
