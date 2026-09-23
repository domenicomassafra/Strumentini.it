import type { EqualityMode } from "../../engines/text-list";

export interface ListCompareInput {
  left: string;
  right: string;
  equality?: EqualityMode;
}

export interface ListCompareOutput {
  equality: EqualityMode;
  leftDeduped: string[];
  rightDeduped: string[];
  intersection: string[];
  onlyLeft: string[];
  onlyRight: string[];
  engineVersion: string;
}
