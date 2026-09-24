export type ReferenceSortOrder = "author" | "year" | "title";

export interface ReferenceListSorterInput {
  records: unknown;
  order?: ReferenceSortOrder;
}

export interface ReferenceListSorterOutput {
  records: unknown[];
  unique: unknown[];
  order: ReferenceSortOrder;
  inputCount: number;
  outputCount: number;
  engineVersion: string;
}
