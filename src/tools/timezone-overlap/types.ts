import type { TimezoneOverlapResult, WorkingHours } from "../../engines/client-time-math";
import type { DefaultProvenance } from "../../runtime/types";

export interface TimezoneOverlapInput {
  date: string;
  otherTimeZone: string;
  otherWorkingHours: WorkingHours;
}

export interface TimezoneOverlapOutput extends TimezoneOverlapResult {
  homeTimeZone: string;
  otherTimeZone: string;
  homeWorkingHours: WorkingHours;
  provenance: {
    homeTimeZone: DefaultProvenance;
    homeWorkingHours: DefaultProvenance;
  };
}
