import type { DiffOperation } from "../../engines/text-list";

export interface TextDiffInput {
  before: string;
  after: string;
}

export interface TextDiffOutput {
  operations: DiffOperation[];
  additions: number;
  removals: number;
  unchanged: number;
  engineVersion: string;
}
