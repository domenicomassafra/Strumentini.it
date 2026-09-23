import type { RateConversionResult, RateUnit } from "../../engines/client-time-math";
import type { DefaultProvenance } from "../../runtime/types";

export interface RateConverterInput {
  amount: string;
  from: RateUnit;
  to: RateUnit;
  projectHours?: string;
}

export interface RateConverterOutput extends RateConversionResult {
  currency: string;
  provenance: {
    currency: DefaultProvenance;
    hoursPerDay: DefaultProvenance;
  };
}
