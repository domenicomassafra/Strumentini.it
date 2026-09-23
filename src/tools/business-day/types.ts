import type { DayCode } from "../../engines/date-time/business-days";

export type BusinessDayInput =
  | {
      mode: "add";
      startDate: string;
      amount: number;
      workweek?: readonly DayCode[];
      excludedDates?: readonly string[];
    }
  | {
      mode: "between";
      startDate: string;
      endDate: string;
      workweek?: readonly DayCode[];
      excludedDates?: readonly string[];
    };

export type BusinessDayOutput =
  | {
      mode: "add";
      resultDate: string;
      amount: number;
      assumptions: BusinessDayAssumptions;
    }
  | {
      mode: "between";
      businessDays: number;
      assumptions: BusinessDayAssumptions;
    };

export interface BusinessDayAssumptions {
  workweek: readonly DayCode[];
  excludedDates: readonly string[];
  inclusiveStart: false;
  inclusiveEnd: true;
}
