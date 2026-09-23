import type { MarginMarkupResult } from "../../engines/client-time-math";
import type { DefaultProvenance } from "../../runtime/types";

export interface MarginMarkupInput {
  price: string;
  cost: string;
}

export interface MarginMarkupOutput extends MarginMarkupResult {
  currency: string;
  currencyProvenance: DefaultProvenance;
}
