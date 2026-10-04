import type { UnknownRecord } from "../../engines/research-knowledge";

export interface NotesDeduplicatorInput {
  notes: unknown;
}

export interface NotesDeduplicatorOutput {
  records: Array<string | UnknownRecord>;
  unique: Array<string | UnknownRecord>;
  duplicates: Array<string | UnknownRecord>;
  removed: number;
  inputCount: number;
  outputCount: number;
  comparison: string;
  engineVersion: string;
}
