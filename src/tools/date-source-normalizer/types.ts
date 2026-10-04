import type { DateResult } from "../../engines/research-knowledge";

export interface DateSourceNormalizerInput {
  value: string;
  dayFirst?: boolean | string;
}

export type DateSourceNormalizerOutput = DateResult & {
  engineVersion: string;
};
