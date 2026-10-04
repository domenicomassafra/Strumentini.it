import type { BibtexEntry, DedupeGroup } from "../../engines/research-knowledge";

export interface BibtexDeduplicatorInput {
  text: string;
}

export interface BibtexDeduplicatorOutput {
  records: BibtexEntry[];
  unique: BibtexEntry[];
  duplicates: BibtexEntry[];
  groups: DedupeGroup[];
  bibtex: string;
  rules: string[];
  removed: number;
  inputCount: number;
  outputCount: number;
  directiveCount: number;
  truncated: boolean;
  engineVersion: string;
}
