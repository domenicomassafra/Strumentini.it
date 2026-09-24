export interface NotesDeduplicatorInput {
  notes: unknown;
}

export interface NotesDeduplicatorOutput {
  records: unknown[];
  unique: unknown[];
  duplicates: unknown[];
  removed: number;
  inputCount: number;
  outputCount: number;
  engineVersion: string;
}
