export interface VocabularyFrequencyAnalyzerInput {
  text: string;
  minLength?: number | string;
  limit?: number | string;
  stopwords?: string[];
}

export interface VocabularyFrequencyAnalyzerOutput {
  terms: Array<{ term: string; count: number }>;
  total: number;
  unique: number;
  ignoredStopwords: number;
  engineVersion: string;
}
