import type { DoiResult, IsbnResult } from "../../engines/research-reference";

export type DoiIsbnInput =
  | { kind: "doi"; value: string }
  | { kind: "isbn"; value: string };

export type DoiIsbnOutput = (DoiResult | IsbnResult) & { engineVersion: string };
