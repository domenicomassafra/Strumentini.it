export type CitationDeduplicatorMode = "exact" | "identifier" | "title-author-year";

export interface CitationDeduplicatorInput {
  records: unknown;
  mode?: CitationDeduplicatorMode;
}

export interface CitationDeduplicatorOutput {
  records: unknown[];
  unique: unknown[];
  duplicates: unknown[];
  removed: number;
  inputCount: number;
  outputCount: number;
  engineVersion: string;
}
