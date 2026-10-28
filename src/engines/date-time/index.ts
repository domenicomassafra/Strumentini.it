export const DATE_TIME_ENGINE_VERSION = "date-time-v1";

export type IsoDate = string;

export interface DateDifferenceResult {
  start: string;
  end: string;
  days: number;
  absoluteDays: number;
  milliseconds: number;
  seconds: number;
  minutes: number;
  hours: number;
  weeks: number;
  direction: "forward" | "backward" | "same";
  basis: "calendar-date" | "instant";
}

export interface WorkingDurationResult {
  start: string;
  end: string;
  milliseconds: number;
  seconds: number;
  minutes: number;
  hours: number;
  days: number;
  decimalHours: string;
  direction: "forward" | "backward" | "same";
}

export interface MeetingParticipant {
  timeZone: string;
  workingHours: { start: string; end: string };
}

export interface MeetingWindow {
  startInstant: string;
  endInstant: string;
  local: Readonly<Record<string, string>>;
}

export interface WeekNumberResult {
  date: string;
  weekSystem: "iso" | "us";
  weekYear: number;
  week: number;
  weekday: number;
  startDate: string;
  endDate: string;
}

export interface QuarterResult {
  date?: string;
  year: number;
  quarter: number;
  startDate: string;
  endDate: string;
  days: number;
}

export interface CountdownResult {
  deadline: string;
  reference: string;
  milliseconds: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  status: "remaining" | "due" | "overdue";
}

export interface RecurrenceInput {
  startDate: string;
  count: number;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval?: number;
  weekdays?: readonly number[];
  endDate?: string;
  monthOverflowPolicy?: "skip" | "clamp";
}

export interface AgeResult {
  birthDate: string;
  asOfDate: string;
  years: number;
  months: number;
  days: number;
  totalDays: number;
  nextAnniversary: string;
  daysUntilAnniversary: number;
  leapDayPolicy: "february-28-in-non-leap-years";
}

export interface IcsEventInput {
  uid?: string;
  summary: string;
  start: string;
  end?: string;
  allDay?: boolean;
  timeZone?: string;
  description?: string;
  location?: string;
}

export interface IcsEvent {
  uid: string;
  summary: string;
  start: string;
  end?: string;
  allDay: boolean;
  timeZone?: string;
  description?: string;
  location?: string;
  properties: Readonly<Record<string, string>>;
}

export interface IcsInspection {
  events: readonly IcsEvent[];
  lineCount: number;
  calendarProperties: Readonly<Record<string, string>>;
  unknownProperties: readonly string[];
}

export interface EpochConversionRow {
  input: string;
  ok: boolean;
  epochMilliseconds?: number;
  iso?: string;
  local?: string;
  error?: string;
}

export interface HolidayRecord {
  date: string;
  name: string;
  observed: boolean;
  /**
   * `statutory: false` marks a widely observed day that is not a nationwide
   * public holiday (for example the Canadian civic holiday): it is reported so
   * the plan is complete, but it must not be counted as a day off everywhere.
   */
  statutory: boolean;
  actualDate?: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const INSTANT_PARTS = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-](\d{2}):?(\d{2}))$/u;
const LOCAL_PARTS = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?$/u;
const CLOCK = /^(\d{1,2}):(\d{2})$/u;
const DECIMAL = /^([+-]?)(\d+)(?:\.(\d+))?$/u;
const DAY_MS = 86_400_000;
const MAX_ITERATIONS = 100_000;

function utcFromParts(year: number, month: number, day: number, hour = 0, minute = 0, second = 0, millisecond = 0): number {
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  date.setUTCHours(hour, minute, second, millisecond);
  return date.getTime();
}

function utcDate(year: number, month: number, day: number): Date {
  return new Date(utcFromParts(year, month, day));
}

function parseIsoDate(value: string): Date {
  if (!ISO_DATE.test(value)) throw new Error("INVALID_DATE");
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(utcFromParts(year, month - 1, day));
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error("INVALID_DATE");
  }
  return date;
}

function parseLocalTime(value: string): { hour: number; minute: number; second: number; millisecond: number } {
  const match = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?$/u.exec(value);
  if (match === null) throw new Error("INVALID_TIME");
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = match[3] === undefined ? 0 : Number(match[3]);
  const millisecond = match[4] === undefined ? 0 : Number(match[4].padEnd(3, "0").slice(0, 3));
  if (hour > 23 || minute > 59 || second > 59) throw new Error("INVALID_TIME");
  return { hour, minute, second, millisecond };
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function requireInteger(value: number, code: string): number {
  if (!Number.isSafeInteger(value)) throw new Error(code);
  return value;
}

function addDaysToDate(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function addCalendarDays(value: string, amount: number): string {
  const date = parseIsoDate(value);
  requireInteger(amount, "INVALID_DAY_OFFSET");
  return formatIsoDate(addDaysToDate(date, amount));
}

export function differenceInCalendarDays(start: string, end: string): number {
  const startDate = parseIsoDate(start);
  const endDate = parseIsoDate(end);
  return Math.abs(Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS));
}

function parseInstantOrDate(value: string, timeZone?: string): { milliseconds: number; basis: "calendar-date" | "instant"; instant: string } {
  if (ISO_DATE.test(value)) {
    const date = parseIsoDate(value);
    return { milliseconds: date.getTime(), basis: "calendar-date", instant: date.toISOString() };
  }
  const instantMatch = INSTANT_PARTS.exec(value);
  if (instantMatch !== null) {
    const date = instantMatch[1];
    const hour = Number(instantMatch[2]);
    const minute = Number(instantMatch[3]);
    const second = instantMatch[4] === undefined ? 0 : Number(instantMatch[4]);
    const millisecond = instantMatch[5] === undefined ? 0 : Number(instantMatch[5].padEnd(3, "0").slice(0, 3));
    const zone = instantMatch[6];
    const offsetHour = instantMatch[7] === undefined ? 0 : Number(instantMatch[7]);
    const offsetMinute = instantMatch[8] === undefined ? 0 : Number(instantMatch[8]);
    if (date === undefined || zone === undefined) throw new Error("INVALID_INSTANT");
    const dateValue = parseIsoDate(date);
    if (hour > 23 || minute > 59 || second > 59 || offsetHour > 23 || offsetMinute > 59) throw new Error("INVALID_INSTANT");
    let milliseconds = utcFromParts(dateValue.getUTCFullYear(), dateValue.getUTCMonth(), dateValue.getUTCDate(), hour, minute, second, millisecond);
    if (zone !== "Z") {
      const offset = offsetHour * 60 + offsetMinute;
      milliseconds += zone === "+" ? -offset * 60_000 : offset * 60_000;
    }
    return { milliseconds, basis: "instant", instant: new Date(milliseconds).toISOString() };
  }
  const localMatch = LOCAL_PARTS.exec(value);
  if (localMatch !== null && timeZone !== undefined) {
    const date = localMatch[1];
    const hour = localMatch[2];
    const minute = localMatch[3];
    if (date === undefined || hour === undefined || minute === undefined) throw new Error("INVALID_INSTANT");
    const time = `${hour}:${minute}:${localMatch[4] ?? "00"}${localMatch[5] === undefined ? "" : `.${localMatch[5]}`}`;
    const milliseconds = resolveLocal(date, time, timeZone);
    return { milliseconds, basis: "instant", instant: new Date(milliseconds).toISOString() };
  }
  if (!value.includes("T")) throw new Error("INVALID_DATE");
  throw new Error("INVALID_INSTANT");
}

function partsInZone(milliseconds: number, timeZone: string): { year: string; month: string; day: string; hour: string; minute: string; second: string } {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    throw new Error("INVALID_TIMEZONE");
  }
  const values: Record<string, string> = {};
  for (const part of formatter.formatToParts(new Date(milliseconds))) if (part.type !== "literal") values[part.type] = part.value;
  const year = values.year;
  const month = values.month;
  const day = values.day;
  const hour = values.hour;
  const minute = values.minute;
  const second = values.second;
  if (year === undefined || month === undefined || day === undefined || hour === undefined || minute === undefined || second === undefined) throw new Error("INVALID_TIMEZONE");
  return { year, month, day, hour, minute, second };
}

function resolveLocal(date: string, time: string, timeZone: string): number {
  ensureTimeZone(timeZone);
  const dateValue = parseIsoDate(date);
  const targetTime = parseLocalTime(time);
  const targetText = `${dateValue.getUTCFullYear().toString().padStart(4, "0")}-${(dateValue.getUTCMonth() + 1).toString().padStart(2, "0")}-${dateValue.getUTCDate().toString().padStart(2, "0")}T${targetTime.hour.toString().padStart(2, "0")}:${targetTime.minute.toString().padStart(2, "0")}:${targetTime.second.toString().padStart(2, "0")}`;
  const naive = utcFromParts(dateValue.getUTCFullYear(), dateValue.getUTCMonth(), dateValue.getUTCDate(), targetTime.hour, targetTime.minute, targetTime.second, targetTime.millisecond);
  const samples = [-36, -24, -12, -6, 0, 6, 12, 24, 36].map((hours) => naive + hours * 3_600_000);
  const matches = new Set<number>();
  for (const sample of samples) {
    const values = partsInZone(sample, timeZone);
    const localAsUtc = utcFromParts(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
    const offset = localAsUtc - Math.floor(sample / 1000) * 1000;
    const candidate = naive - offset;
    const candidateValues = partsInZone(candidate, timeZone);
    if (`${candidateValues.year}-${candidateValues.month}-${candidateValues.day}T${candidateValues.hour}:${candidateValues.minute}:${candidateValues.second}` === targetText) matches.add(candidate);
  }
  const ordered = [...matches].toSorted((left, right) => left - right);
  if (ordered.length === 0) throw new Error("INVALID_LOCAL_TIME_GAP");
  if (ordered.length > 1) throw new Error("INVALID_LOCAL_TIME_OVERLAP");
  return ordered[0]!;
}

function formatInstantInZone(milliseconds: number, timeZone: string): string {
  const values = partsInZone(milliseconds, timeZone);
  const localAsUtc = utcFromParts(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
  const offset = Math.round((localAsUtc - Math.floor(milliseconds / 1000) * 1000) / 60_000);
  const sign = offset < 0 ? "-" : "+";
  const absolute = Math.abs(offset);
  const offsetText = `${sign}${Math.floor(absolute / 60).toString().padStart(2, "0")}:${(absolute % 60).toString().padStart(2, "0")}`;
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}${offsetText}`;
}

function parseDecimal(value: string, code: string): { numerator: bigint; denominator: bigint } {
  const match = DECIMAL.exec(value.trim());
  if (match === null) throw new Error(code);
  const digits = `${match[2] ?? ""}${match[3] ?? ""}` || "0";
  const numerator = BigInt(digits) * (match[1] === "-" ? -1n : 1n);
  const denominator = 10n ** BigInt((match[3] ?? "").length);
  return { numerator, denominator };
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a === 0n ? 1n : a;
}

function reduceDecimal(numerator: bigint, denominator: bigint): { numerator: bigint; denominator: bigint } {
  if (denominator === 0n) throw new Error("INVALID_DENOMINATOR");
  const sign = denominator < 0n ? -1n : 1n;
  const n = numerator * sign;
  const d = denominator * sign;
  const divisor = greatestCommonDivisor(n, d);
  return { numerator: n / divisor, denominator: d / divisor };
}

function decimalMultiply(left: { numerator: bigint; denominator: bigint }, right: { numerator: bigint; denominator: bigint }): { numerator: bigint; denominator: bigint } {
  return reduceDecimal(left.numerator * right.numerator, left.denominator * right.denominator);
}

function formatRounded(value: { numerator: bigint; denominator: bigint }, places: number): string {
  const scale = 10n ** BigInt(places);
  const scaled = value.numerator * scale;
  const negative = scaled < 0n;
  const absolute = negative ? -scaled : scaled;
  const quotient = absolute / value.denominator;
  const remainder = absolute % value.denominator;
  const rounded = remainder * 2n >= value.denominator ? quotient + 1n : quotient;
  const whole = rounded / scale;
  const fraction = rounded % scale;
  const sign = negative && rounded !== 0n ? "-" : "";
  return places === 0 ? `${sign}${whole}` : `${sign}${whole}.${fraction.toString().padStart(places, "0")}`;
}

function parseClock(value: string): number {
  const match = CLOCK.exec(value.trim());
  if (match === null) throw new Error("INVALID_TIME");
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isSafeInteger(hours) || !Number.isSafeInteger(minutes) || hours > 168 || minutes > 59) throw new Error("INVALID_TIME");
  return hours * 60 + minutes;
}

function formatClockSeconds(seconds: number): string {
  if (!Number.isSafeInteger(seconds) || seconds < 0) throw new Error("INVALID_DURATION");
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  const prefix = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  return remainder === 0 ? prefix : `${prefix}:${remainder.toString().padStart(2, "0")}`;
}

function trimDecimal(value: string): string {
  return value.includes(".") ? value.replace(/0+$/u, "").replace(/\.$/u, "") : value;
}

function decimalMinutesToHours(minutes: number): string {
  return trimDecimal(formatRounded({ numerator: BigInt(minutes), denominator: 60n }, 6));
}

function decimalMillisecondsToHours(milliseconds: number): string {
  const absolute = Math.abs(milliseconds);
  const value = trimDecimal(formatRounded({ numerator: BigInt(absolute), denominator: 3_600_000n }, 6));
  return milliseconds < 0 ? `-${value}` : value;
}

function durationParts(milliseconds: number): { seconds: number; minutes: number; hours: number; days: number } {
  const absolute = Math.abs(milliseconds);
  const seconds = Math.floor(absolute / 1000);
  return { seconds, minutes: Math.floor(seconds / 60), hours: Math.floor(seconds / 3600), days: Math.floor(seconds / 86_400) };
}

function ensureTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
  } catch {
    throw new Error("INVALID_TIMEZONE");
  }
}

function daysInMonth(year: number, month: number): number {
  return utcDate(year, month, 0).getUTCDate();
}

const ITALIAN_WEEKDAYS = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"] as const;
const ITALIAN_MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"] as const;

export function isGregorianLeapYear(year: number): boolean {
  if (!Number.isInteger(year) || year < 1 || year > 9999) throw new Error("INVALID_YEAR");
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function calendarWeekday(date: string): { date: string; isoWeekday: number; weekdayIt: string } {
  const parsed = parseIsoDate(date);
  const isoWeekday = parsed.getUTCDay() === 0 ? 7 : parsed.getUTCDay();
  return { date, isoWeekday, weekdayIt: ITALIAN_WEEKDAYS[isoWeekday - 1]! };
}

export interface PrintableMonthCalendar {
  readonly year: number;
  readonly month: number;
  readonly monthNameIt: string;
  readonly weekdayHeadersIt: readonly ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
  readonly weeks: readonly (readonly (number | null)[])[];
  readonly text: string;
  readonly locale: "it-IT";
  readonly weekStartsOn: "monday";
}

export function printableMonthCalendar(year: number, month: number): PrintableMonthCalendar {
  if (!Number.isInteger(year) || year < 1 || year > 9999) throw new Error("INVALID_YEAR");
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error("INVALID_MONTH");
  const first = utcDate(year, month - 1, 1);
  const firstIsoWeekday = first.getUTCDay() === 0 ? 7 : first.getUTCDay();
  const totalDays = daysInMonth(year, month);
  const cells: Array<number | null> = Array.from({ length: firstIsoWeekday - 1 }, () => null);
  for (let day = 1; day <= totalDays; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: Array<readonly (number | null)[]> = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
  const weekdayHeadersIt = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"] as const;
  const monthNameIt = ITALIAN_MONTHS[month - 1]!;
  const title = `${monthNameIt[0]!.toLocaleUpperCase("it-IT")}${monthNameIt.slice(1)} ${year}`;
  const rows = weeks.map((week) => week.map((day) => day === null ? "  " : String(day).padStart(2, " ")).join(" "));
  return {
    year,
    month,
    monthNameIt,
    weekdayHeadersIt,
    weeks,
    text: [title, weekdayHeadersIt.join(" "), ...rows].join("\n"),
    locale: "it-IT",
    weekStartsOn: "monday",
  };
}

function parseDateTimeField(value: string, timeZone?: string): number {
  return parseInstantOrDate(value, timeZone).milliseconds;
}

function localTimeParts(milliseconds: number, timeZone: string): { date: string; time: string } {
  const formatted = formatInstantInZone(milliseconds, timeZone);
  return { date: formatted.slice(0, 10), time: formatted.slice(11, 16) };
}

export function differenceBetween(start: string, end: string, timeZone?: string): DateDifferenceResult {
  const startParsed = parseInstantOrDate(start, timeZone);
  const endParsed = parseInstantOrDate(end, timeZone);
  const calendar = startParsed.basis === "calendar-date" && endParsed.basis === "calendar-date";
  const signedDays = calendar
    ? Math.round((parseIsoDate(end).getTime() - parseIsoDate(start).getTime()) / DAY_MS)
    : Math.trunc((endParsed.milliseconds - startParsed.milliseconds) / DAY_MS);
  const milliseconds = calendar
    ? signedDays * DAY_MS
    : endParsed.milliseconds - startParsed.milliseconds;
  const absoluteMilliseconds = Math.abs(milliseconds);
  const parts = durationParts(absoluteMilliseconds);
  return {
    start: startParsed.instant,
    end: endParsed.instant,
    days: signedDays,
    absoluteDays: Math.abs(signedDays),
    milliseconds,
    seconds: Math.floor((absoluteMilliseconds % 3_600_000) / 1000),
    minutes: Math.floor((absoluteMilliseconds % 3_600_000) / 60_000),
    hours: parts.hours,
    weeks: Math.floor(Math.abs(signedDays) / 7),
    direction: milliseconds === 0 ? "same" : milliseconds > 0 ? "forward" : "backward",
    basis: calendar ? "calendar-date" : "instant",
  };
}

export function calculateWorkingDuration(start: string, end: string, timeZone?: string): WorkingDurationResult {
  const startMs = parseDateTimeField(start, timeZone);
  const endMs = parseDateTimeField(end, timeZone);
  const milliseconds = endMs - startMs;
  const parts = durationParts(milliseconds);
  return {
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
    milliseconds,
    seconds: parts.seconds,
    minutes: parts.minutes,
    hours: parts.hours,
    days: parts.days,
    decimalHours: decimalMillisecondsToHours(milliseconds),
    direction: milliseconds === 0 ? "same" : milliseconds > 0 ? "forward" : "backward",
  };
}

export function convertTimeZone(
  value: string,
  sourceTimeZone: string,
  targetTimeZone: string,
  disambiguation: "reject" | "earlier" | "later" = "reject",
): { instant: string; source: string; target: string; sourceTimeZone: string; targetTimeZone: string; offsetMinutes: number } {
  ensureTimeZone(sourceTimeZone);
  ensureTimeZone(targetTimeZone);
  let milliseconds: number;
  if (ISO_DATE.test(value)) milliseconds = resolveLocal(value, "00:00", sourceTimeZone);
  else if (LOCAL_PARTS.test(value)) {
    const [date, time] = value.split("T");
    if (date === undefined || time === undefined) throw new Error("INVALID_INSTANT");
    milliseconds = resolveDisambiguatedLocal(date, time, sourceTimeZone, disambiguation);
  } else milliseconds = parseInstantOrDate(value).milliseconds;
  const source = formatInstantInZone(milliseconds, sourceTimeZone);
  const target = formatInstantInZone(milliseconds, targetTimeZone);
  const sourceOffset = parseOffset(source);
  const targetOffset = parseOffset(target);
  return {
    instant: new Date(milliseconds).toISOString(),
    source,
    target,
    sourceTimeZone,
    targetTimeZone,
    offsetMinutes: targetOffset - sourceOffset,
  };
}

function resolveDisambiguatedLocal(date: string, time: string, timeZone: string, disambiguation: "reject" | "earlier" | "later"): number {
  if (disambiguation === "reject") return resolveLocal(date, time, timeZone);
  ensureTimeZone(timeZone);
  const dateValue = parseIsoDate(date);
  const targetTime = parseLocalTime(time);
  const naive = utcFromParts(dateValue.getUTCFullYear(), dateValue.getUTCMonth(), dateValue.getUTCDate(), targetTime.hour, targetTime.minute, targetTime.second, targetTime.millisecond);
  const targetText = `${date}T${targetTime.hour.toString().padStart(2, "0")}:${targetTime.minute.toString().padStart(2, "0")}:${targetTime.second.toString().padStart(2, "0")}`;
  const values = new Set<number>();
  for (let offset = -16 * 60; offset <= 16 * 60; offset += 15) {
    const candidate = naive - offset * 60_000;
    const parts = partsInZone(candidate, timeZone);
    if (`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}` === targetText) values.add(candidate);
  }
  const ordered = [...values].toSorted((left, right) => left - right);
  if (ordered.length === 0) throw new Error("INVALID_LOCAL_TIME_GAP");
  return disambiguation === "later" ? ordered.at(-1)! : ordered[0]!;
}

function parseOffset(value: string): number {
  const match = /([+-])(\d{2}):(\d{2})$/u.exec(value);
  if (match === null) throw new Error("INVALID_TIMEZONE");
  const amount = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -amount : amount;
}

export function findMeetingWindows(input: { date: string; durationMinutes: number; participants: readonly MeetingParticipant[]; limit?: number }): MeetingWindow[] {
  parseIsoDate(input.date);
  const duration = requireInteger(input.durationMinutes, "INVALID_DURATION");
  if (duration <= 0 || duration > 1440 || input.participants.length < 2) throw new Error("INVALID_DURATION");
  const limit = input.limit ?? 8;
  requireInteger(limit, "INVALID_LIMIT");
  if (limit <= 0 || limit > 100) throw new Error("INVALID_LIMIT");
  const intervals = input.participants.map((participant) => {
    ensureTimeZone(participant.timeZone);
    const start = parseClock(participant.workingHours.start);
    const end = parseClock(participant.workingHours.end);
    if (start >= end) throw new Error("INVALID_WORKING_HOURS");
    return {
      timeZone: participant.timeZone,
      start: resolveLocal(input.date, participant.workingHours.start, participant.timeZone),
      end: resolveLocal(input.date, participant.workingHours.end, participant.timeZone),
    };
  });
  const rangeStart = Math.max(...intervals.map((interval) => interval.start));
  const rangeEnd = Math.min(...intervals.map((interval) => interval.end));
  const step = 15 * 60_000;
  const firstCursor = Math.ceil(rangeStart / step) * step;
  const windows: MeetingWindow[] = [];
  for (let cursor = firstCursor; cursor + duration * 60_000 <= rangeEnd && windows.length < limit; cursor += step) {
    const end = cursor + duration * 60_000;
    const local: Record<string, string> = {};
    let valid = true;
    for (const interval of intervals) {
      if (cursor < interval.start || end > interval.end) { valid = false; break; }
      const localStart = localTimeParts(cursor, interval.timeZone);
      const localEnd = localTimeParts(end, interval.timeZone);
      local[interval.timeZone] = `${localStart.date} ${localStart.time}–${localEnd.time}`;
    }
    if (valid) windows.push({ startInstant: new Date(cursor).toISOString(), endInstant: new Date(end).toISOString(), local });
  }
  return windows;
}

export function timeToDecimalHours(value: string): string {
  const minutes = parseClock(value);
  return trimDecimal(formatRounded({ numerator: BigInt(minutes), denominator: 60n }, 6));
}

export function decimalHoursToTime(value: string): { time: string; minutes: number; seconds: number; decimalHours: string } {
  const decimal = parseDecimal(value, "INVALID_DECIMAL_HOURS");
  if (decimal.numerator < 0n) throw new Error("INVALID_DECIMAL_HOURS");
  const secondsValue = decimalMultiply(decimal, { numerator: 3600n, denominator: 1n });
  const seconds = Number(formatRounded(secondsValue, 0));
  requireInteger(seconds, "INVALID_DECIMAL_HOURS");
  if (seconds > 168 * 3600) throw new Error("INVALID_DECIMAL_HOURS");
  return { time: formatClockSeconds(seconds), minutes: Math.floor(seconds / 60), seconds, decimalHours: trimDecimal(formatRounded(decimal, 6)) };
}

export function totalTimesheet(entries: readonly { date: string; start: string; end: string; breakMinutes?: number }[]): { entries: readonly { date: string; minutes: number; decimalHours: string }[]; totalMinutes: number; totalDecimalHours: string; byDate: Readonly<Record<string, number>> } {
  if (entries.length > 100_000) throw new Error("TOO_MANY_ENTRIES");
  let totalMinutes = 0;
  const byDate: Record<string, number> = {};
  const normalized = entries.map((entry) => {
    parseIsoDate(entry.date);
    const start = parseClock(entry.start);
    const end = parseClock(entry.end);
    const breaks = entry.breakMinutes ?? 0;
    if (!Number.isSafeInteger(breaks) || breaks < 0) throw new Error("INVALID_BREAK");
    if (end <= start || breaks >= end - start) throw new Error("INVALID_DURATION");
    const minutes = end - start - breaks;
    totalMinutes += minutes;
    byDate[entry.date] = (byDate[entry.date] ?? 0) + minutes;
    return { date: entry.date, minutes, decimalHours: decimalMinutesToHours(minutes) };
  });
  return { entries: normalized, totalMinutes, totalDecimalHours: decimalMinutesToHours(totalMinutes), byDate };
}

function isoWeekParts(date: Date): { year: number; week: number; weekday: number } {
  const day = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  const thursday = addDaysToDate(date, 4 - day);
  const year = thursday.getUTCFullYear();
  const firstThursday = addDaysToDate(utcDate(year, 0, 4), 4 - (utcDate(year, 0, 4).getUTCDay() === 0 ? 7 : utcDate(year, 0, 4).getUTCDay()));
  const week = Math.floor((thursday.getTime() - firstThursday.getTime()) / (7 * DAY_MS)) + 1;
  return { year, week, weekday: day };
}

function usWeekParts(date: Date): { year: number; week: number; weekday: number } {
  const start = utcDate(date.getUTCFullYear(), 0, 1);
  const offset = start.getUTCDay();
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / DAY_MS);
  return { year: date.getUTCFullYear(), week: Math.floor((dayOfYear + offset) / 7) + 1, weekday: date.getUTCDay() === 0 ? 7 : date.getUTCDay() };
}

export function dateToWeekNumber(value: string, weekSystem: "iso" | "us" = "iso"): WeekNumberResult {
  const date = parseIsoDate(value);
  const parts = weekSystem === "iso" ? isoWeekParts(date) : usWeekParts(date);
  const start = weekStart(date, weekSystem);
  return { date: value, weekSystem, weekYear: parts.year, week: parts.week, weekday: parts.weekday, startDate: formatIsoDate(start), endDate: formatIsoDate(addDaysToDate(start, 6)) };
}

function weekStart(date: Date, weekSystem: "iso" | "us"): Date {
  const weekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  const offset = weekSystem === "iso" ? weekday - 1 : (date.getUTCDay() + 6) % 7;
  return addDaysToDate(date, -offset);
}

export function weekNumberToDate(weekYear: number, week: number, weekSystem: "iso" | "us" = "iso"): string {
  requireInteger(weekYear, "INVALID_WEEK_YEAR");
  requireInteger(week, "INVALID_WEEK");
  if (week < 1 || week > 53) throw new Error("INVALID_WEEK");
  if (weekSystem === "us") {
    const jan1 = utcDate(weekYear, 0, 1);
    const start = new Date(jan1.getTime() + (((jan1.getUTCDay() + 6) % 7) + (week - 1) * 7) * DAY_MS);
    if (dateToWeekNumber(formatIsoDate(start), "us").week !== week) throw new Error("INVALID_WEEK");
    return formatIsoDate(start);
  }
  const jan4 = utcDate(weekYear, 0, 4);
  const jan4Day = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay();
  const firstMonday = addDaysToDate(jan4, 1 - jan4Day);
  const date = addDaysToDate(firstMonday, (week - 1) * 7);
  if (isoWeekParts(date).week !== week || isoWeekParts(date).year !== weekYear) throw new Error("INVALID_WEEK");
  return formatIsoDate(date);
}

export function quarterForDate(value: string): QuarterResult {
  const date = parseIsoDate(value);
  const year = date.getUTCFullYear();
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  const start = utcDate(year, (quarter - 1) * 3, 1);
  const end = utcDate(year, quarter * 3, 0);
  return { date: value, year, quarter, startDate: formatIsoDate(start), endDate: formatIsoDate(end), days: differenceInCalendarDays(formatIsoDate(start), formatIsoDate(end)) + 1 };
}

export function quarterForNumber(year: number, quarter: number): QuarterResult {
  requireInteger(year, "INVALID_YEAR");
  requireInteger(quarter, "INVALID_QUARTER");
  if (quarter < 1 || quarter > 4) throw new Error("INVALID_QUARTER");
  const start = utcDate(year, (quarter - 1) * 3, 1);
  const end = utcDate(year, quarter * 3, 0);
  return { year, quarter, startDate: formatIsoDate(start), endDate: formatIsoDate(end), days: differenceInCalendarDays(formatIsoDate(start), formatIsoDate(end)) + 1 };
}

export function deadlineCountdown(deadline: string, reference: string): CountdownResult {
  const deadlineMs = parseDateTimeField(deadline);
  const referenceMs = parseDateTimeField(reference);
  const milliseconds = deadlineMs - referenceMs;
  const absolute = Math.abs(milliseconds);
  const seconds = Math.floor(absolute / 1000);
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return { deadline: new Date(deadlineMs).toISOString(), reference: new Date(referenceMs).toISOString(), milliseconds, days, hours, minutes, seconds: seconds % 60, status: milliseconds === 0 ? "due" : milliseconds > 0 ? "remaining" : "overdue" };
}

export function generateRecurringDates(input: RecurrenceInput): { dates: readonly string[]; policy: { frequency: RecurrenceInput["frequency"]; interval: number; monthOverflowPolicy: "skip" | "clamp"; weekdays?: readonly number[] } } {
  const start = parseIsoDate(input.startDate);
  const count = requireInteger(input.count, "INVALID_COUNT");
  const interval = input.interval ?? 1;
  requireInteger(interval, "INVALID_INTERVAL");
  if (count < 1 || count > 10_000 || interval < 1 || interval > 1000) throw new Error("INVALID_COUNT");
  if (input.endDate !== undefined) parseIsoDate(input.endDate);
  const overflow = input.monthOverflowPolicy ?? "skip";
  if (overflow !== "skip" && overflow !== "clamp") throw new Error("INVALID_OVERFLOW_POLICY");
  const weekdays = input.weekdays === undefined ? [] : input.weekdays.map((day) => {
    const value = requireInteger(day, "INVALID_WEEKDAY");
    if (value < 0 || value > 6) throw new Error("INVALID_WEEKDAY");
    return value;
  });
  const allowed = new Set(weekdays);
  const dates: string[] = [];
  const seen = new Set<string>();
  const addCandidate = (candidate: Date): boolean => {
    const value = formatIsoDate(candidate);
    if (input.endDate !== undefined && value > input.endDate) return false;
    if (value < formatIsoDate(start)) return true;
    if (allowed.size > 0 && !allowed.has(candidate.getUTCDay())) return true;
    if (!seen.has(value)) { dates.push(value); seen.add(value); }
    return true;
  };
  if (input.frequency === "weekly" && allowed.size > 0) {
    const mondayOffset = (start.getUTCDay() + 6) % 7;
    const firstMonday = addDaysToDate(start, -mondayOffset);
    const orderedWeekdays = [...allowed].toSorted((left, right) => left - right);
    for (let period = 0; period < MAX_ITERATIONS && dates.length < count; period += 1) {
      let ended = false;
      for (const weekday of orderedWeekdays) {
        const candidate = addDaysToDate(firstMonday, period * interval * 7 + ((weekday + 6) % 7));
        if (!addCandidate(candidate)) { ended = true; break; }
        if (dates.length >= count) break;
      }
      if (ended) break;
    }
  } else {
    for (let cursor = 0; cursor < MAX_ITERATIONS && dates.length < count; cursor += 1) {
      let candidate: Date;
      if (input.frequency === "daily") candidate = addDaysToDate(start, cursor * interval);
      else if (input.frequency === "weekly") candidate = addDaysToDate(start, cursor * interval * 7);
      else if (input.frequency === "monthly") {
        const monthIndex = start.getUTCMonth() + cursor * interval;
        const year = start.getUTCFullYear() + Math.floor(monthIndex / 12);
        const month = ((monthIndex % 12) + 12) % 12;
        const maxDay = daysInMonth(year, month + 1);
        if (start.getUTCDate() > maxDay && overflow === "skip") continue;
        candidate = utcDate(year, month, Math.min(start.getUTCDate(), maxDay));
      } else {
        const year = start.getUTCFullYear() + cursor * interval;
        const maxDay = daysInMonth(year, start.getUTCMonth() + 1);
        if (start.getUTCDate() > maxDay && overflow === "skip") continue;
        candidate = utcDate(year, start.getUTCMonth(), Math.min(start.getUTCDate(), maxDay));
      }
      if (!addCandidate(candidate)) break;
    }
  }
  return { dates, policy: { frequency: input.frequency, interval, monthOverflowPolicy: overflow, ...(weekdays.length === 0 ? {} : { weekdays }) } };
}

function monthDayDifference(start: Date, end: Date): { years: number; months: number; days: number } {
  let years = end.getUTCFullYear() - start.getUTCFullYear();
  let months = end.getUTCMonth() - start.getUTCMonth();
  let days = end.getUTCDate() - start.getUTCDate();
  let borrow = 0;
  while (days < 0) {
    months -= 1;
    const previousMonth = utcDate(end.getUTCFullYear(), end.getUTCMonth() - borrow, 0);
    days += previousMonth.getUTCDate();
    borrow += 1;
  }
  if (months < 0) { years -= 1; months += 12; }
  return { years, months, days };
}

export function calculateAge(birthDate: string, asOfDate: string): AgeResult {
  const birth = parseIsoDate(birthDate);
  const asOf = parseIsoDate(asOfDate);
  if (asOf.getTime() < birth.getTime()) throw new Error("INVALID_RANGE");
  const difference = monthDayDifference(birth, asOf);
  const anniversaryYear = asOf.getUTCFullYear();
  const maxDay = daysInMonth(anniversaryYear, birth.getUTCMonth() + 1);
  const nextAnniversary = utcDate(anniversaryYear, birth.getUTCMonth(), Math.min(birth.getUTCDate(), maxDay));
  const next = nextAnniversary.getTime() < asOf.getTime() ? utcDate(anniversaryYear + 1, birth.getUTCMonth(), Math.min(birth.getUTCDate(), daysInMonth(anniversaryYear + 1, birth.getUTCMonth() + 1))) : nextAnniversary;
  const totalDays = differenceInCalendarDays(birthDate, asOfDate);
  return { birthDate, asOfDate, years: difference.years, months: difference.months, days: difference.days, totalDays, nextAnniversary: formatIsoDate(next), daysUntilAnniversary: differenceInCalendarDays(asOfDate, formatIsoDate(next)), leapDayPolicy: "february-28-in-non-leap-years" };
}

export function calendarDateList(startDate: string, endDate: string, stepDays: number): { dates: readonly string[]; stepDays: number; inclusive: boolean } {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  requireInteger(stepDays, "INVALID_STEP");
  if (stepDays < 1 || stepDays > 1000) throw new Error("INVALID_STEP");
  const direction = end >= start ? 1 : -1;
  const dates: string[] = [];
  for (let index = 0, value = start; index < 10_000 && (direction > 0 ? value <= end : value >= end); index += 1, value = addDaysToDate(start, index * stepDays * direction)) dates.push(formatIsoDate(value));
  return { dates, stepDays, inclusive: true };
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/gu, "\\\\").replace(/;/gu, "\\;").replace(/,/gu, "\\,").replace(/\r\n|\r|\n/gu, "\\n");
}

function foldIcsLine(value: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(value).length <= 75) return value;
  const chunks: string[] = [];
  let chunk = "";
  for (const character of value) {
    if (encoder.encode(chunk + character).length > 74) { chunks.push(chunk); chunk = character; } else chunk += character;
  }
  if (chunk !== "") chunks.push(chunk);
  return chunks.join("\r\n ");
}

function deterministicUid(input: IcsEventInput, start: string): string {
  if (input.uid !== undefined && input.uid.trim() !== "") return input.uid.trim();
  let hash = 2166136261;
  for (const character of `${input.summary}\u0000${start}`) { hash ^= character.codePointAt(0) ?? 0; hash = Math.imul(hash, 16777619) >>> 0; }
  return `${hash.toString(16).padStart(8, "0")}-local-utility-workspace@local`;
}

function icsDateValue(value: string, timeZone: string | undefined, allDay: boolean): string {
  if (allDay) return value.replaceAll("-", "");
  if (timeZone !== undefined) {
    const milliseconds = parseInstantOrDate(value, timeZone).milliseconds;
    return new Date(milliseconds).toISOString().replace(/[-:]/gu, "").replace(/\.\d{3}Z$/u, "Z");
  }
  const milliseconds = parseInstantOrDate(value).milliseconds;
  return new Date(milliseconds).toISOString().replace(/[-:]/gu, "").replace(/\.\d{3}Z$/u, "Z");
}

export function buildIcsEvent(input: IcsEventInput): { text: string; uid: string } {
  if (input.summary.trim() === "") throw new Error("INVALID_SUMMARY");
  const allDay = input.allDay === true;
  if (allDay) {
    parseIsoDate(input.start);
    if (input.end !== undefined) parseIsoDate(input.end);
    if (input.end !== undefined && input.end <= input.start) throw new Error("INVALID_RANGE");
  }
  const start = icsDateValue(input.start, input.timeZone, allDay);
  const end = input.end === undefined ? undefined : icsDateValue(input.end, input.timeZone, allDay);
  if (!allDay && end !== undefined) {
    const startMs = parseInstantOrDate(input.start, input.timeZone).milliseconds;
    const endInput = input.end;
    if (endInput === undefined) throw new Error("INVALID_INPUT");
    const endMs = parseInstantOrDate(endInput, input.timeZone).milliseconds;
    if (endMs < startMs) throw new Error("INVALID_RANGE");
  }
  const uid = deterministicUid(input, start);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Strumentini.it//Strumenti data e ora//IT",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(uid)}`,
    `DTSTAMP:${new Date(0).toISOString().replace(/[-:]/gu, "").replace(/\.000Z$/u, "Z")}`,
    `DTSTART${allDay ? ";VALUE=DATE" : ""}:${start}`,
    ...(end === undefined ? [] : [`DTEND${allDay ? ";VALUE=DATE" : ""}:${end}`]),
    `SUMMARY:${escapeIcsText(input.summary.trim())}`,
    ...(input.description === undefined ? [] : [`DESCRIPTION:${escapeIcsText(input.description)}`]),
    ...(input.location === undefined ? [] : [`LOCATION:${escapeIcsText(input.location)}`]),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return { text: `${lines.map(foldIcsLine).join("\r\n")}\r\n`, uid };
}

function unfoldIcs(text: string): string[] {
  if (text.length > 5_000_000) throw new Error("ICS_TOO_LARGE");
  const physical = text.replace(/\r\n/gu, "\n").replace(/\r/gu, "\n").split("\n");
  const lines: string[] = [];
  for (const line of physical) {
    if (line === "" && lines.length > 0) continue;
    if (line.startsWith(" ") || line.startsWith("\t")) {
      if (lines.length === 0) throw new Error("INVALID_ICS");
      lines[lines.length - 1] += line.slice(1);
    } else lines.push(line);
  }
  if (lines.length === 0 || lines.some((line) => line.includes("\n"))) throw new Error("INVALID_ICS");
  return lines;
}

function unescapeIcsText(value: string): string {
  return value.replace(/\\n/giu, "\n").replace(/\\,/gu, ",").replace(/\\;/gu, ";").replace(/\\\\/gu, "\\");
}

function parseIcsDateTime(value: string, allDay: boolean, timeZone?: string): string {
  if (allDay) {
    if (!/^\d{8}$/u.test(value)) throw new Error("INVALID_ICS_DATE");
    const date = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
    parseIsoDate(date);
    return date;
  }
  const utcMatch = /^(\d{8})T(\d{2})(\d{2})(\d{2})Z$/u.exec(value);
  const floatingMatch = /^(\d{8})T(\d{2})(\d{2})(\d{2})$/u.exec(value);
  const match = utcMatch ?? floatingMatch;
  if (match === null) throw new Error("INVALID_ICS_DATE_TIME");
  const date = `${match[1]!.slice(0, 4)}-${match[1]!.slice(4, 6)}-${match[1]!.slice(6, 8)}`;
  const time = `${match[2]}:${match[3]}:${match[4]}`;
  parseIsoDate(date);
  parseLocalTime(time);
  if (utcMatch !== null) return `${date}T${time}Z`;
  if (timeZone !== undefined) {
    ensureTimeZone(timeZone);
    return formatInstantInZone(resolveLocal(date, time, timeZone), timeZone);
  }
  return `${date}T${time}`;
}

export function inspectIcs(text: string): IcsInspection {
  const lines = unfoldIcs(text);
  const events: IcsEvent[] = [];
  const calendarProperties: Record<string, string> = {};
  const unknownProperties = new Set<string>();
  let inCalendar = false;
  let current: Record<string, string> | undefined;
  for (const line of lines) {
    const separator = line.indexOf(":");
    if (separator <= 0) throw new Error("INVALID_ICS");
    const descriptor = line.slice(0, separator);
    const value = line.slice(separator + 1);
    const [property, ...parameters] = descriptor.split(";");
    if (property === undefined || property === "") throw new Error("INVALID_ICS");
    if (property === "BEGIN" && value === "VCALENDAR") { if (inCalendar || current !== undefined) throw new Error("INVALID_ICS"); inCalendar = true; continue; }
    if (property === "END" && value === "VCALENDAR") { if (!inCalendar || current !== undefined) throw new Error("INVALID_ICS"); inCalendar = false; continue; }
    if (!inCalendar) throw new Error("INVALID_ICS");
    if (property === "BEGIN" && value === "VEVENT") { if (current !== undefined) throw new Error("INVALID_ICS"); current = {}; continue; }
    if (property === "END" && value === "VEVENT") {
      if (current === undefined) throw new Error("INVALID_ICS");
      const start = current.DTSTART;
      const summary = current.SUMMARY;
      const uid = current.UID;
      if (start === undefined || summary === undefined || uid === undefined) throw new Error("INVALID_ICS");
      const allDay = (current.__allDay ?? "false") === "true";
      const timeZone = current.__tzid;
      const properties = Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith("__")));
      const event: IcsEvent = { uid, summary: unescapeIcsText(summary), start: parseIcsDateTime(start, allDay, timeZone), allDay, properties };
      if (timeZone !== undefined) event.timeZone = timeZone;
      const end = current.DTEND;
      if (end !== undefined) event.end = parseIcsDateTime(end, allDay, timeZone);
      if (current.DESCRIPTION !== undefined) event.description = unescapeIcsText(current.DESCRIPTION);
      if (current.LOCATION !== undefined) event.location = unescapeIcsText(current.LOCATION);
      events.push(event);
      current = undefined;
      continue;
    }
    if (current === undefined) {
      if (property === "VERSION" || property === "PRODID" || property === "CALSCALE") calendarProperties[property] = value;
      else unknownProperties.add(property);
      continue;
    }
    if (property === "DTSTART" || property === "DTEND") {
      const valueType = parameters.find((parameter) => parameter.startsWith("VALUE="));
      const timeZone = parameters.find((parameter) => parameter.startsWith("TZID="))?.slice("TZID=".length);
      if (property === "DTSTART" && valueType === "VALUE=DATE") current.__allDay = "true";
      if (timeZone !== undefined) current.__tzid = timeZone;
      current[property] = value;
    } else current[property] = value;
  }
  if (inCalendar || events.length === 0) throw new Error("INVALID_ICS");
  return { events, lineCount: lines.length, calendarProperties, unknownProperties: [...unknownProperties].toSorted() };
}

export function convertEpochBatch(values: readonly string[], unit: "seconds" | "milliseconds" = "seconds", timeZone = "UTC"): { rows: readonly EpochConversionRow[]; timeZone: string } {
  ensureTimeZone(timeZone);
  const rows = values.map((input): EpochConversionRow => {
    if (!/^[+-]?\d+$/u.test(input.trim())) return { input, ok: false, error: "INVALID_EPOCH" };
    const value = BigInt(input.trim());
    const milliseconds = unit === "seconds" ? value * 1000n : value;
    if (milliseconds > BigInt(Number.MAX_SAFE_INTEGER) || milliseconds < BigInt(Number.MIN_SAFE_INTEGER)) return { input, ok: false, error: "EPOCH_OUT_OF_RANGE" };
    const epochMilliseconds = Number(milliseconds);
    const date = new Date(epochMilliseconds);
    if (!Number.isFinite(date.getTime())) return { input, ok: false, error: "EPOCH_OUT_OF_RANGE" };
    return { input, ok: true, epochMilliseconds, iso: date.toISOString(), local: formatInstantInZone(epochMilliseconds, timeZone) };
  });
  return { rows, timeZone };
}

/**
 * Substitute-day rules, kept explicit per country so the result can be audited:
 * - `none`: the calendar date stands, weekend or not (Italy, and every rule that
 *   never substitutes).
 * - `observed`: the fixed in-lieu-of rule used by US federal holidays, Saturday
 *   moves to the preceding Friday and Sunday to the following Monday.
 * - `next-working-day`: the UK/Canada rule, where each affected holiday in date
 *   order claims the next Monday-Friday that no other holiday already holds.
 *   Without it, Christmas on a Saturday would land on 24 December and Boxing
 *   Day on the Monday, which is wrong whenever the two fall on the same weekend.
 */
type SubstituteRule = "none" | "observed" | "next-working-day";

function observedDate(date: string, saturdayToFriday: boolean, sundayToMonday: boolean): { date: string; observed: boolean; actualDate?: string } {
  const parsed = parseIsoDate(date);
  const actual = parsed.getUTCDay();
  if (actual === 6 && saturdayToFriday) return { date: formatIsoDate(addDaysToDate(parsed, -1)), observed: true, actualDate: date };
  if (actual === 0 && sundayToMonday) return { date: formatIsoDate(addDaysToDate(parsed, 1)), observed: true, actualDate: date };
  return { date, observed: false };
}

function nextWorkingDay(date: string, taken: ReadonlySet<string>): string {
  const parsed = parseIsoDate(date);
  for (let step = 0; step <= 7; step += 1) {
    const candidate = formatIsoDate(addDaysToDate(parsed, step));
    const weekday = parseIsoDate(candidate).getUTCDay();
    if (weekday !== 0 && weekday !== 6 && !taken.has(candidate)) return candidate;
  }
  return date;
}

function nthWeekday(year: number, month: number, weekday: number, nth: number): string {
  const first = utcDate(year, month, 1);
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return formatIsoDate(utcDate(year, month, 1 + offset + (nth - 1) * 7));
}

function lastWeekday(year: number, month: number, weekday: number): string {
  const last = utcDate(year, month + 1, 0);
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return formatIsoDate(utcDate(year, month, last.getUTCDate() - offset));
}

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = (h + l - 7 * m + 114) % 31 + 1;
  return utcDate(year, month - 1, day);
}

export const HOLIDAY_COUNTRY_CODES = ["CA", "GB", "IT", "US"] as const;
export type HolidayCountryCode = (typeof HOLIDAY_COUNTRY_CODES)[number];

export function lookupPublicHolidays(country: string, year: number): { country: string; year: number; holidays: readonly HolidayRecord[]; source: string } {
  const normalized = country.trim().toUpperCase();
  requireInteger(year, "INVALID_YEAR");
  if (year < 1900 || year > 2100) throw new Error("INVALID_YEAR");
  if (!(HOLIDAY_COUNTRY_CODES as readonly string[]).includes(normalized)) throw new Error("INVALID_COUNTRY");
  const records: HolidayRecord[] = [];
  const claimed = new Set<string>();
  const addWeekday = (date: string, name: string, statutory = true) => {
    claimed.add(date);
    records.push({ date, name, observed: false, statutory });
  };
  const addFixed = (month: number, day: number, name: string, rule: SubstituteRule = "none", statutory = true) => {
    const actualDate = formatIsoDate(utcDate(year, month - 1, day));
    // One explicit key order for every record so the rendered JSON and the
    // certification fixture read identically.
    let item: HolidayRecord;
    if (rule === "observed") {
      const observed = observedDate(actualDate, true, true);
      item = observed.observed
        ? { date: observed.date, name, observed: true, statutory, actualDate }
        : { date: actualDate, name, observed: false, statutory };
    } else if (rule === "next-working-day") {
      const parsed = parseIsoDate(actualDate);
      const weekend = parsed.getUTCDay() === 0 || parsed.getUTCDay() === 6 || claimed.has(actualDate);
      const substitute = weekend ? nextWorkingDay(actualDate, claimed) : actualDate;
      item = substitute === actualDate
        ? { date: actualDate, name, observed: false, statutory }
        : { date: substitute, name, observed: true, statutory, actualDate };
    } else {
      item = { date: actualDate, name, observed: false, statutory };
    }
    claimed.add(item.date);
    if (item.actualDate !== undefined) claimed.add(item.actualDate);
    records.push(item);
  };
  if (normalized === "US") {
    addFixed(1, 1, "Capodanno", "observed");
    addWeekday(nthWeekday(year, 0, 1, 3), "Giorno di Martin Luther King Jr.");
    addWeekday(nthWeekday(year, 1, 1, 3), "Giorno dei Presidenti");
    addWeekday(lastWeekday(year, 4, 1), "Giorno della memoria dei caduti");
    if (year >= 2021) addFixed(6, 19, "Juneteenth", "observed");
    addFixed(7, 4, "Giorno dell'Indipendenza", "observed");
    addWeekday(nthWeekday(year, 8, 1, 1), "Festa del Lavoro");
    addWeekday(nthWeekday(year, 9, 1, 2), "Giorno di Colombo");
    addFixed(11, 11, "Giorno dei Veterani", "observed");
    addWeekday(nthWeekday(year, 10, 4, 4), "Giorno del Ringraziamento");
    addFixed(12, 25, "Natale", "observed");
  } else if (normalized === "CA") {
    addFixed(1, 1, "Capodanno", "next-working-day");
    const easter = easterSunday(year);
    addWeekday(formatIsoDate(addDaysToDate(easter, -2)), "Venerdì Santo");
    const victoria = utcDate(year, 4, 25);
    addWeekday(formatIsoDate(addDaysToDate(victoria, -((victoria.getUTCDay() + 6) % 7))), "Giorno della Regina Vittoria");
    addFixed(7, 1, "Festa del Canada", "next-working-day");
    addWeekday(nthWeekday(year, 7, 1, 1), "Festa civica", false);
    addWeekday(nthWeekday(year, 8, 1, 1), "Festa del Lavoro");
    if (year >= 2021) addFixed(9, 30, "Giornata nazionale per la verità e la riconciliazione", "next-working-day");
    addWeekday(nthWeekday(year, 9, 1, 2), "Giorno del Ringraziamento");
    addFixed(12, 25, "Natale", "next-working-day");
    addFixed(12, 26, "Festa del 26 dicembre", "next-working-day");
  } else if (normalized === "GB") {
    addFixed(1, 1, "Capodanno", "next-working-day");
    const easter = easterSunday(year);
    addWeekday(formatIsoDate(addDaysToDate(easter, -2)), "Venerdì Santo");
    addWeekday(formatIsoDate(addDaysToDate(easter, 1)), "Lunedì dell'Angelo");
    addWeekday(nthWeekday(year, 4, 1, 1), "Festa bancaria di inizio maggio");
    addWeekday(lastWeekday(year, 7, 1), "Festa bancaria estiva");
    addFixed(12, 25, "Natale", "next-working-day");
    addFixed(12, 26, "Festa del 26 dicembre", "next-working-day");
  } else {
    addFixed(1, 1, "Capodanno");
    addFixed(1, 6, "Epifania");
    const easter = easterSunday(year);
    addWeekday(formatIsoDate(addDaysToDate(easter, 1)), "Lunedì dell'Angelo");
    addFixed(4, 25, "Festa della Liberazione");
    addFixed(5, 1, "Festa dei Lavoratori");
    addFixed(6, 2, "Festa della Repubblica");
    addFixed(8, 15, "Assunzione di Maria");
    addFixed(11, 1, "Ognissanti");
    addFixed(12, 8, "Immacolata Concezione");
    addFixed(12, 25, "Natale");
    addFixed(12, 26, "Santo Stefano");
  }
  records.sort((left, right) => left.date.localeCompare(right.date) || left.name.localeCompare(right.name));
  return { country: normalized, year, holidays: records, source: "embedded-calendar-v2" };
}

export { formatIsoDate, parseIsoDate };
