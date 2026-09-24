import type {
  AgeResult,
  CountdownResult,
  DateDifferenceResult,
  EpochConversionRow,
  HolidayRecord,
  IcsEventInput,
  IcsInspection,
  MeetingParticipant,
  MeetingWindow,
  QuarterResult,
  RecurrenceInput,
  WeekNumberResult,
  WorkingDurationResult,
} from "../../engines/date-time";

export type DateDifferenceToolInput = { start: string; end: string; timeZone?: string };
export type AddSubtractDaysToolInput = { startDate: string; amount: number };
export type WorkingHoursToolInput = { start: string; end: string; timeZone?: string };
export type TimezoneConverterToolInput = { value: string; sourceTimeZone: string; targetTimeZone: string; disambiguation?: "reject" | "earlier" | "later" };
export type MeetingPlannerToolInput = { date: string; durationMinutes: number; participants: readonly MeetingParticipant[]; limit?: number };
export type DurationToolInput = { start: string; end: string; timeZone?: string };
export type DecimalHoursToolInput = { value: string; direction: "time-to-decimal" | "decimal-to-time" };
export type TimesheetToolInput = { entries: readonly { date: string; start: string; end: string; breakMinutes?: number }[] };
export type WeekNumberToolInput = { date?: string; weekYear?: number; week?: number; weekSystem?: "iso" | "us"; direction?: "date-to-week" | "week-to-date" };
export type QuarterToolInput = { date?: string; year?: number; quarter?: number; direction?: "date-to-quarter" | "quarter-to-dates" };
export type DeadlineToolInput = { deadline: string; reference: string };
export type RecurringDateToolInput = RecurrenceInput;
export type AgeToolInput = { birthDate: string; asOfDate: string };
export type CalendarDateListToolInput = { startDate: string; endDate: string; stepDays: number };
export type IcsBuilderToolInput = IcsEventInput;
export type IcsViewerToolInput = { text: string };
export type EpochBatchToolInput = { values: readonly string[]; unit?: "seconds" | "milliseconds"; timeZone?: string };
export type PublicHolidayToolInput = { country: string; year: number };
export type DateDifferenceToolOutput = DateDifferenceResult;
export type AddSubtractDaysToolOutput = { startDate: string; amount: number; resultDate: string; basis: "calendar-day" };
export type WorkingHoursToolOutput = WorkingDurationResult;
export type TimezoneConverterToolOutput = { instant: string; source: string; target: string; sourceTimeZone: string; targetTimeZone: string; offsetMinutes: number };
export type MeetingPlannerToolOutput = { windows: readonly MeetingWindow[]; date: string; durationMinutes: number; policy: string };
export type DurationToolOutput = WorkingDurationResult;
export type DecimalHoursToolOutput = { input: string; direction: string; decimalHours?: string; time?: string; minutes?: number; seconds?: number };
export type TimesheetToolOutput = { entries: readonly { date: string; minutes: number; decimalHours: string }[]; totalMinutes: number; totalDecimalHours: string; byDate: Readonly<Record<string, number>> };
export type WeekNumberToolOutput = WeekNumberResult | { weekSystem: "iso" | "us"; weekYear: number; week: number; date: string; startDate: string; endDate: string };
export type QuarterToolOutput = QuarterResult;
export type DeadlineToolOutput = CountdownResult;
export type RecurringDateToolOutput = { dates: readonly string[]; policy: RecurrenceInput };
export type AgeToolOutput = AgeResult;
export type CalendarDateListToolOutput = { dates: readonly string[]; stepDays: number; inclusive: boolean };
export type IcsBuilderToolOutput = { text: string; uid: string };
export type IcsViewerToolOutput = IcsInspection;
export type EpochBatchToolOutput = { rows: readonly EpochConversionRow[]; timeZone: string };
export type PublicHolidayToolOutput = { country: string; year: number; holidays: readonly HolidayRecord[]; source: string };
