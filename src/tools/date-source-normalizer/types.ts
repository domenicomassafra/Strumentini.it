export interface DateSourceNormalizerInput {
  value: string;
  dayFirst?: boolean | string;
}

export interface DateSourceNormalizerOutput {
  valid: boolean;
  input: string;
  iso?: string;
  precision?: "year" | "month" | "day";
  reason?: string;
  engineVersion: string;
}
