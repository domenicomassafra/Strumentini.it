export interface BibtexDeduplicatorInput {
  text: string;
}

export interface BibtexDeduplicatorOutput {
  records: unknown[];
  unique: unknown[];
  duplicates: unknown[];
  bibtex: string;
  removed: number;
  inputCount: number;
  outputCount: number;
  engineVersion: string;
}
