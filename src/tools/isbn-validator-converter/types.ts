export interface IsbnValidatorConverterInput {
  value: string;
}

export interface IsbnValidatorConverterOutput {
  kind: "ISBN-10" | "ISBN-13" | "ISBN";
  valid: boolean;
  digits?: string;
  isbn13?: string;
  reason?: string;
  engineVersion: string;
}
