export interface CitationKeyGeneratorInput {
  records: unknown;
}

export interface CitationKeyGeneratorOutput {
  keys: string[];
  records: unknown[];
  engineVersion: string;
}
