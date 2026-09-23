export const CLIENT_TIME_MATH_ENGINE_VERSION = "client-time-math-v1";

export type RateUnit = "hour" | "day" | "project";

export interface RateConversionInput {
  amount: string;
  from: RateUnit;
  to: RateUnit;
  hoursPerDay?: string;
  projectHours?: string;
}

export interface RateConversionResult {
  amount: string;
  assumptions: {
    hoursPerDay: string;
    projectHours?: string;
  };
  rounding: {
    mode: "half-up";
    decimalPlaces: 2;
    stage: "final-only";
  };
  formula: "amount × target-unit-hours ÷ source-unit-hours";
}

export interface MarginMarkupResult {
  price: string;
  cost: string;
  profit: string;
  marginPercent: string | null;
  markupPercent: string | null;
  denominatorErrors: readonly {
    metric: "margin" | "markup";
    code: "INVALID_MARGIN_DENOMINATOR" | "INVALID_MARKUP_DENOMINATOR";
    message: string;
  }[];
  rounding: {
    moneyDecimalPlaces: 2;
    percentDecimalPlaces: 2;
    mode: "half-up";
    stage: "final-only";
  };
  formulas: {
    profit: "price − cost";
    margin: "profit ÷ price × 100";
    markup: "profit ÷ cost × 100";
  };
}

interface Rational {
  numerator: bigint;
  denominator: bigint;
}

const DECIMAL_PATTERN = /^([+-]?)(\d+)(?:\.(\d+))?$/u;
const MAX_DECIMAL_DIGITS = 80;

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a === 0n ? 1n : a;
}

function rational(numerator: bigint, denominator: bigint): Rational {
  if (denominator === 0n) throw new Error("INVALID_DENOMINATOR");
  const sign = denominator < 0n ? -1n : 1n;
  const normalizedNumerator = numerator * sign;
  const normalizedDenominator = denominator * sign;
  const divisor = gcd(normalizedNumerator, normalizedDenominator);
  return {
    numerator: normalizedNumerator / divisor,
    denominator: normalizedDenominator / divisor,
  };
}

function parseDecimal(value: string, code: string): Rational {
  const input = value.trim();
  const match = DECIMAL_PATTERN.exec(input);
  if (match === null) throw new Error(code);
  const whole = match[2] ?? "";
  const fraction = match[3] ?? "";
  if (whole.length + fraction.length > MAX_DECIMAL_DIGITS) throw new Error(code);
  const sign = match[1] === "-" ? -1n : 1n;
  const digits = BigInt(`${whole}${fraction}` || "0");
  return rational(sign * digits, 10n ** BigInt(fraction.length));
}

function compareZero(value: Rational): -1 | 0 | 1 {
  return value.numerator === 0n ? 0 : value.numerator < 0n ? -1 : 1;
}

function multiply(left: Rational, right: Rational): Rational {
  return rational(left.numerator * right.numerator, left.denominator * right.denominator);
}

function divide(left: Rational, right: Rational, code: string): Rational {
  if (right.numerator === 0n) throw new Error(code);
  return rational(left.numerator * right.denominator, left.denominator * right.numerator);
}

function subtract(left: Rational, right: Rational): Rational {
  return rational(
    left.numerator * right.denominator - right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

function formatRounded(value: Rational, decimalPlaces: number): string {
  const negative = value.numerator < 0n;
  const numerator = negative ? -value.numerator : value.numerator;
  const scale = 10n ** BigInt(decimalPlaces);
  const scaled = numerator * scale;
  let quotient = scaled / value.denominator;
  const remainder = scaled % value.denominator;
  if (remainder * 2n >= value.denominator) quotient += 1n;
  const whole = quotient / scale;
  const fraction = quotient % scale;
  const sign = negative && quotient !== 0n ? "-" : "";
  if (decimalPlaces === 0) return `${sign}${whole}`;
  return `${sign}${whole}.${fraction.toString().padStart(decimalPlaces, "0")}`;
}

function formatExactFiniteDecimal(value: Rational): string {
  let denominator = value.denominator;
  let twos = 0;
  let fives = 0;
  while (denominator % 2n === 0n) {
    denominator /= 2n;
    twos += 1;
  }
  while (denominator % 5n === 0n) {
    denominator /= 5n;
    fives += 1;
  }
  if (denominator !== 1n) throw new Error("NON_TERMINATING_DECIMAL");
  const places = Math.max(twos, fives);
  const scaledNumerator = value.numerator * 2n ** BigInt(places - twos) * 5n ** BigInt(places - fives);
  const negative = scaledNumerator < 0n;
  const digits = (negative ? -scaledNumerator : scaledNumerator).toString().padStart(places + 1, "0");
  if (places === 0) return `${negative ? "-" : ""}${digits}`;
  const whole = digits.slice(0, -places) || "0";
  const fraction = digits.slice(-places).replace(/0+$/u, "");
  return `${negative ? "-" : ""}${whole}${fraction === "" ? "" : `.${fraction}`}`;
}

function positiveDecimal(value: string | undefined, fallback: string, code: string): Rational {
  const parsed = parseDecimal(value ?? fallback, code);
  if (compareZero(parsed) <= 0) throw new Error(code);
  return parsed;
}

function rateUnitHours(
  unit: RateUnit,
  hoursPerDay: Rational,
  projectHours: Rational | undefined,
): Rational {
  if (unit === "hour") return rational(1n, 1n);
  if (unit === "day") return hoursPerDay;
  if (projectHours === undefined) throw new Error("PROJECT_HOURS_REQUIRED");
  return projectHours;
}

export function convertRate(input: RateConversionInput): RateConversionResult {
  const amount = parseDecimal(input.amount, "INVALID_RATE");
  if (compareZero(amount) < 0) throw new Error("INVALID_RATE");
  const hoursPerDay = positiveDecimal(input.hoursPerDay, "8", "INVALID_HOURS_PER_DAY");
  const projectHours = input.projectHours === undefined
    ? undefined
    : positiveDecimal(input.projectHours, "1", "INVALID_PROJECT_HOURS");
  const sourceHours = rateUnitHours(input.from, hoursPerDay, projectHours);
  const targetHours = rateUnitHours(input.to, hoursPerDay, projectHours);
  const converted = divide(multiply(amount, targetHours), sourceHours, "INVALID_RATE_BASIS");
  const assumptions: RateConversionResult["assumptions"] = {
    hoursPerDay: formatExactFiniteDecimal(hoursPerDay),
  };
  if (projectHours !== undefined) assumptions.projectHours = formatExactFiniteDecimal(projectHours);
  return {
    amount: formatRounded(converted, 2),
    assumptions,
    rounding: { mode: "half-up", decimalPlaces: 2, stage: "final-only" },
    formula: "amount × target-unit-hours ÷ source-unit-hours",
  };
}

export function calculateMarginMarkup(priceInput: string, costInput: string): MarginMarkupResult {
  const price = parseDecimal(priceInput, "INVALID_PRICE");
  const cost = parseDecimal(costInput, "INVALID_COST");
  const profit = subtract(price, cost);
  const hundred = rational(100n, 1n);
  const denominatorErrors: MarginMarkupResult["denominatorErrors"][number][] = [];
  let marginPercent: string | null = null;
  let markupPercent: string | null = null;

  if (compareZero(price) === 0) {
    denominatorErrors.push({
      metric: "margin",
      code: "INVALID_MARGIN_DENOMINATOR",
      message: "Margin is undefined when price/revenue is zero.",
    });
  } else {
    marginPercent = formatRounded(multiply(divide(profit, price, "INVALID_MARGIN_DENOMINATOR"), hundred), 2);
  }

  if (compareZero(cost) === 0) {
    denominatorErrors.push({
      metric: "markup",
      code: "INVALID_MARKUP_DENOMINATOR",
      message: "Markup is undefined when cost is zero.",
    });
  } else {
    markupPercent = formatRounded(multiply(divide(profit, cost, "INVALID_MARKUP_DENOMINATOR"), hundred), 2);
  }

  return {
    price: formatRounded(price, 2),
    cost: formatRounded(cost, 2),
    profit: formatRounded(profit, 2),
    marginPercent,
    markupPercent,
    denominatorErrors,
    rounding: {
      moneyDecimalPlaces: 2,
      percentDecimalPlaces: 2,
      mode: "half-up",
      stage: "final-only",
    },
    formulas: {
      profit: "price − cost",
      margin: "profit ÷ price × 100",
      markup: "profit ÷ cost × 100",
    },
  };
}

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached !== undefined) return cached;
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
  formatterCache.set(timeZone, formatter);
  return formatter;
}

function localPartsAt(epochMs: number, timeZone: string): LocalParts {
  const values: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const part of formatterFor(timeZone).formatToParts(new Date(epochMs))) {
    if (part.type !== "literal") values[part.type] = part.value;
  }
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function dateString(parts: Pick<LocalParts, "year" | "month" | "day">): string {
  return `${parts.year.toString().padStart(4, "0")}-${parts.month.toString().padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}`;
}

function timeString(parts: Pick<LocalParts, "hour" | "minute">): string {
  return `${parts.hour.toString().padStart(2, "0")}:${parts.minute.toString().padStart(2, "0")}`;
}

function offsetString(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? "-" : "+";
  const absolute = Math.abs(offsetMinutes);
  const hours = Math.floor(absolute / 60).toString().padStart(2, "0");
  const minutes = (absolute % 60).toString().padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

export interface ZonedInstant {
  instant: string;
  timeZone: string;
  local: string;
  localDate: string;
  localTime: string;
  offsetMinutes: number;
}

export function formatInstantInZone(instantInput: string, timeZone: string): ZonedInstant {
  const epochMs = Date.parse(instantInput);
  if (!Number.isFinite(epochMs)) throw new Error("INVALID_INSTANT");
  const parts = localPartsAt(epochMs, timeZone);
  const localEpochMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const sourceSecondMs = Math.floor(epochMs / 1000) * 1000;
  const offsetMinutes = Math.round((localEpochMs - sourceSecondMs) / 60_000);
  const localDate = dateString(parts);
  const localTime = `${timeString(parts)}:${parts.second.toString().padStart(2, "0")}`;
  return {
    instant: new Date(epochMs).toISOString(),
    timeZone,
    local: `${localDate}T${localTime}${offsetString(offsetMinutes)}`,
    localDate,
    localTime,
    offsetMinutes,
  };
}

function parseLocalDate(date: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(date);
  if (match === null) throw new Error("INVALID_DATE");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    throw new Error("INVALID_DATE");
  }
  return { year, month, day };
}

function parseLocalTime(time: string): { hour: number; minute: number } {
  const match = /^(\d{2}):(\d{2})$/u.exec(time);
  if (match === null) throw new Error("INVALID_TIME");
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error("INVALID_TIME");
  return { hour, minute };
}

function sameMinute(parts: LocalParts, target: LocalParts): boolean {
  return parts.year === target.year && parts.month === target.month && parts.day === target.day &&
    parts.hour === target.hour && parts.minute === target.minute;
}

export type LocalTimeDisambiguation = "reject" | "earlier" | "later";

export function resolveLocalDateTime(
  date: string,
  time: string,
  timeZone: string,
  disambiguation: LocalTimeDisambiguation = "reject",
): string {
  const parsedDate = parseLocalDate(date);
  const parsedTime = parseLocalTime(time);
  formatterFor(timeZone);
  const target: LocalParts = { ...parsedDate, ...parsedTime, second: 0 };
  const naiveMs = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute, 0);
  const offsets = new Set<number>();
  for (const sampleHours of [-36, -24, -12, -6, 0, 6, 12, 24, 36]) {
    const sampleMs = naiveMs + sampleHours * 3_600_000;
    const parts = localPartsAt(sampleMs, timeZone);
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    offsets.add(asUtc - sampleMs);
  }
  const matches = [...offsets]
    .map((offsetMs) => naiveMs - offsetMs)
    .filter((candidate, index, candidates) => candidates.indexOf(candidate) === index)
    .filter((candidate) => sameMinute(localPartsAt(candidate, timeZone), target))
    .toSorted((left, right) => left - right);

  if (matches.length === 0) throw new Error("INVALID_LOCAL_TIME_GAP");
  if (matches.length > 1 && disambiguation === "reject") throw new Error("INVALID_LOCAL_TIME_OVERLAP");
  const selected = disambiguation === "later" ? matches.at(-1) : matches[0];
  if (selected === undefined) throw new Error("INVALID_LOCAL_TIME");
  return new Date(selected).toISOString();
}

function addCalendarDays(date: string, days: number): string {
  const parsed = parseLocalDate(date);
  const value = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
  return value.toISOString().slice(0, 10);
}

function minutesSinceMidnight(time: string): number {
  const parsed = parseLocalTime(time);
  return parsed.hour * 60 + parsed.minute;
}

export interface WorkingHours {
  start: string;
  end: string;
}

export interface TimezoneOverlapInput {
  date: string;
  homeTimeZone: string;
  otherTimeZone: string;
  homeWorkingHours: WorkingHours;
  otherWorkingHours: WorkingHours;
}

export interface TimezoneOverlapResult {
  segments: readonly {
    startInstant: string;
    endInstant: string;
    home: string;
    other: string;
  }[];
  assumptions: {
    dateBasis: "home-local-date";
    boundaries: "same-day-working-hours";
    ambiguousBoundaryPolicy: "reject";
    nonexistentBoundaryPolicy: "reject";
  };
}

function workingInterval(date: string, hours: WorkingHours, timeZone: string): [number, number] {
  if (minutesSinceMidnight(hours.start) >= minutesSinceMidnight(hours.end)) {
    throw new Error("INVALID_WORKING_HOURS");
  }
  const start = Date.parse(resolveLocalDateTime(date, hours.start, timeZone, "reject"));
  const end = Date.parse(resolveLocalDateTime(date, hours.end, timeZone, "reject"));
  return [start, end];
}

function localRange(startMs: number, endMs: number, timeZone: string): string {
  const start = formatInstantInZone(new Date(startMs).toISOString(), timeZone);
  const end = formatInstantInZone(new Date(endMs).toISOString(), timeZone);
  const startText = `${start.localDate} ${start.localTime.slice(0, 5)}`;
  const endText = start.localDate === end.localDate ? end.localTime.slice(0, 5) : `${end.localDate} ${end.localTime.slice(0, 5)}`;
  return `${startText}–${endText}`;
}

export function findTimezoneOverlap(input: TimezoneOverlapInput): TimezoneOverlapResult {
  parseLocalDate(input.date);
  const [homeStart, homeEnd] = workingInterval(input.date, input.homeWorkingHours, input.homeTimeZone);
  const otherCandidateDates = [-1, 0, 1].map((offset) => addCalendarDays(input.date, offset));
  const segments = otherCandidateDates.flatMap((otherDate) => {
    const [otherStart, otherEnd] = workingInterval(otherDate, input.otherWorkingHours, input.otherTimeZone);
    const start = Math.max(homeStart, otherStart);
    const end = Math.min(homeEnd, otherEnd);
    if (start >= end) return [];
    return [{
      startInstant: new Date(start).toISOString(),
      endInstant: new Date(end).toISOString(),
      home: localRange(start, end, input.homeTimeZone),
      other: localRange(start, end, input.otherTimeZone),
    }];
  });
  return {
    segments,
    assumptions: {
      dateBasis: "home-local-date",
      boundaries: "same-day-working-hours",
      ambiguousBoundaryPolicy: "reject",
      nonexistentBoundaryPolicy: "reject",
    },
  };
}
