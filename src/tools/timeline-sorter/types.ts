export type TimelineDirection = "ascending" | "descending";

export interface TimelineSorterInput {
  records: unknown;
  direction?: TimelineDirection;
}

export interface TimelineSorterOutput {
  items: unknown[];
  sorted: unknown[];
  invalid: unknown[];
  direction: TimelineDirection;
  engineVersion: string;
}
