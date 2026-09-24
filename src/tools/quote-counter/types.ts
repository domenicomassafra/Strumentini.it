export interface QuoteCounterInput {
  text: string;
}

export interface QuoteCounterOutput {
  characters: number;
  charactersWithoutWhitespace: number;
  words: number;
  lines: number;
  readingMinutes: number;
  normalized: string;
  engineVersion: string;
}
