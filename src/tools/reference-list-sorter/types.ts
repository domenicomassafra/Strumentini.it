import type { SortedReferenceList } from "../../engines/research-knowledge";

export type ReferenceSortOrder = "author" | "year" | "title";

export interface ReferenceListSorterInput {
  records: unknown;
  order?: ReferenceSortOrder;
}

export type ReferenceListSorterOutput = SortedReferenceList & {
  engineVersion: string;
};
