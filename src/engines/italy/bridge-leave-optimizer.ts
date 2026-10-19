import { DAY_CODES, type DayCode } from "../date-time/business-days";
import { getItalyReferenceProvenance, ITALY_NATIONAL_HOLIDAYS_2026 } from "../../reference-data/italy";
import { assertItalyPinnedAnnualUse158 } from "../../reference-data/italy/freshness-158";

export type { DayCode } from "../date-time/business-days";

export const ITALY_BRIDGE_OPTIMIZER_VERSION = "2026.1";
const MILLIS_PER_DAY = 86_400_000;
const DAY_INDEX = new Map<DayCode, number>(DAY_CODES.map((day, index) => [day, index]));

export type BridgeOptimizerErrorCode =
  | "UNSUPPORTED_HOLIDAY_YEAR"
  | "INVALID_LEAVE_BUDGET"
  | "INVALID_WORKWEEK";

export class BridgeOptimizerError extends Error {
  readonly code: BridgeOptimizerErrorCode;

  constructor(code: BridgeOptimizerErrorCode, message: string) {
    super(message);
    this.name = "BridgeOptimizerError";
    this.code = code;
  }
}

export interface BridgeOptimizerInput {
  readonly year: number;
  readonly leaveDayBudget: number;
  readonly workweek: readonly DayCode[];
  readonly maxResults?: number;
}

export interface BridgeOpportunity {
  readonly startDate: string;
  readonly endDate: string;
  readonly consecutiveDaysOff: number;
  readonly leaveDaysUsed: number;
  readonly leaveDates: readonly string[];
  readonly holidays: readonly { readonly date: string; readonly name: string }[];
  readonly efficiency: number | null;
}

export interface BridgeOptimizerResult {
  readonly year: 2026;
  readonly leaveDayBudget: number;
  readonly workweek: readonly DayCode[];
  readonly holidayDates: readonly string[];
  readonly opportunities: readonly BridgeOpportunity[];
  readonly provenance: ReturnType<typeof getItalyReferenceProvenance>;
  readonly policy: string;
}

interface CalendarDay {
  readonly date: string;
  readonly epochDay: number;
  readonly working: boolean;
  readonly holidayName: string | null;
}

function formatUtcDate(epochDay: number): string {
  return new Date(epochDay * MILLIS_PER_DAY).toISOString().slice(0, 10);
}

function yearCalendar(year: number, workweek: ReadonlySet<number>, holidayNames: ReadonlyMap<string, string>): CalendarDay[] {
  const start = Date.UTC(year, 0, 1) / MILLIS_PER_DAY;
  const end = Date.UTC(year + 1, 0, 1) / MILLIS_PER_DAY;
  const output: CalendarDay[] = [];
  for (let epochDay = start; epochDay < end; epochDay += 1) {
    const date = formatUtcDate(epochDay);
    const weekday = new Date(epochDay * MILLIS_PER_DAY).getUTCDay();
    const holidayName = holidayNames.get(date) ?? null;
    output.push({ date, epochDay, working: workweek.has(weekday) && holidayName === null, holidayName });
  }
  return output;
}

function normalizedWorkweek(workweek: readonly DayCode[]): ReadonlySet<number> {
  if (!Array.isArray(workweek) || workweek.length === 0) {
    throw new BridgeOptimizerError("INVALID_WORKWEEK", "Workweek must contain at least one weekday.");
  }
  const indexes = workweek.map((day) => DAY_INDEX.get(day));
  if (indexes.some((value) => value === undefined) || new Set(indexes).size !== indexes.length) {
    throw new BridgeOptimizerError("INVALID_WORKWEEK", "Workweek contains an unsupported or duplicate weekday.");
  }
  return new Set(indexes as number[]);
}

function candidateKey(leaveDates: readonly string[], startDate: string, endDate: string): string {
  return leaveDates.length === 0 ? `natural:${startDate}:${endDate}` : leaveDates.join(",");
}

function compareOpportunity(left: BridgeOpportunity, right: BridgeOpportunity): number {
  const leftEfficiency = left.efficiency ?? left.consecutiveDaysOff;
  const rightEfficiency = right.efficiency ?? right.consecutiveDaysOff;
  if (rightEfficiency !== leftEfficiency) return rightEfficiency - leftEfficiency;
  if (right.consecutiveDaysOff !== left.consecutiveDaysOff) return right.consecutiveDaysOff - left.consecutiveDaysOff;
  if (left.leaveDaysUsed !== right.leaveDaysUsed) return left.leaveDaysUsed - right.leaveDaysUsed;
  if (left.startDate !== right.startDate) return left.startDate.localeCompare(right.startDate);
  return left.endDate.localeCompare(right.endDate);
}

export function optimizeItalianBridges(input: BridgeOptimizerInput): BridgeOptimizerResult {
  if (input.year !== 2026) {
    throw new BridgeOptimizerError(
      "UNSUPPORTED_HOLIDAY_YEAR",
      `Only 2026 is supported by the pinned authoritative Italian holiday source pack; received ${input.year}.`,
    );
  }
  assertItalyPinnedAnnualUse158("italy-national-holidays", input.year);
  if (!Number.isInteger(input.leaveDayBudget) || input.leaveDayBudget < 0 || input.leaveDayBudget > 60) {
    throw new BridgeOptimizerError("INVALID_LEAVE_BUDGET", "Leave-day budget must be an integer from 0 through 60.");
  }
  const maxResults = input.maxResults ?? 20;
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 100) {
    throw new BridgeOptimizerError("INVALID_LEAVE_BUDGET", "Result limit must be an integer from 1 through 100.");
  }

  const workweek = normalizedWorkweek(input.workweek);
  const holidayNames = new Map(ITALY_NATIONAL_HOLIDAYS_2026.data.holidays.map((holiday) => [holiday.date, holiday.name]));
  const days = yearCalendar(2026, workweek, holidayNames);
  const deduped = new Map<string, BridgeOpportunity>();

  for (let start = 0; start < days.length; start += 1) {
    let leaveDaysUsed = 0;
    let holidayCount = 0;
    const leaveDates: string[] = [];

    for (let end = start; end < days.length; end += 1) {
      const day = days[end]!;
      if (day.working) {
        leaveDaysUsed += 1;
        leaveDates.push(day.date);
      }
      if (day.holidayName !== null) {
        holidayCount += 1;
      }
      if (leaveDaysUsed > input.leaveDayBudget) break;
      if (holidayCount === 0) continue;
      if (leaveDaysUsed === 0 && input.leaveDayBudget > 0) continue;

      let expandedStart = start;
      let expandedEnd = end;
      while (expandedStart > 0 && !days[expandedStart - 1]!.working) expandedStart -= 1;
      while (expandedEnd + 1 < days.length && !days[expandedEnd + 1]!.working) expandedEnd += 1;
      const intervalDays = expandedEnd - expandedStart + 1;
      const expandedHolidays = days
        .slice(expandedStart, expandedEnd + 1)
        .filter((expandedDay) => expandedDay.holidayName !== null)
        .map((expandedDay) => ({ date: expandedDay.date, name: expandedDay.holidayName! }));
      const opportunity: BridgeOpportunity = {
        startDate: days[expandedStart]!.date,
        endDate: days[expandedEnd]!.date,
        consecutiveDaysOff: intervalDays,
        leaveDaysUsed,
        leaveDates: [...leaveDates],
        holidays: expandedHolidays,
        efficiency: leaveDaysUsed === 0 ? null : intervalDays / leaveDaysUsed,
      };
      const key = candidateKey(leaveDates, opportunity.startDate, opportunity.endDate);
      const previous = deduped.get(key);
      if (previous === undefined || compareOpportunity(opportunity, previous) < 0) deduped.set(key, opportunity);
    }
  }

  return {
    year: 2026,
    leaveDayBudget: input.leaveDayBudget,
    workweek: [...input.workweek],
    holidayDates: ITALY_NATIONAL_HOLIDAYS_2026.data.holidays.map(({ date }) => date),
    opportunities: [...deduped.values()].sort(compareOpportunity).slice(0, maxResults),
    provenance: getItalyReferenceProvenance(ITALY_NATIONAL_HOLIDAYS_2026),
    policy: "An opportunity is a continuous in-year interval containing at least one pinned 2026 national holiday; working days inside it consume leave, and adjacent non-working days are expanded without extra leave. Local-only patronal holidays are not added automatically.",
  };
}
