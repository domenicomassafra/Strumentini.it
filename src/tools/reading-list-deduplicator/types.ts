export interface ReadingListDeduplicatorInput {
  records: unknown;
}

export interface ReadingListDeduplicatorOutput {
  records: unknown[];
  unique: unknown[];
  duplicates: unknown[];
  removed: number;
  inputCount: number;
  outputCount: number;
  engineVersion: string;
}
