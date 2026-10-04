import type { VocabularyAnalysis } from "../../engines/research-knowledge";

export interface VocabularyFrequencyAnalyzerInput {
  text: string;
  minLength?: number;
  limit?: number;
  stopwords?: string[];
}

export interface VocabularyFrequencyAnalyzerOutput extends VocabularyAnalysis {
  engineVersion: string;
}
