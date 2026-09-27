export const BUSINESS_DAY_ENGINE_VERSION = "1";

export const DAY_CODES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
export type DayCode = (typeof DAY_CODES)[number];

export interface BusinessCalendar {
  workweek: readonly DayCode[];
  excludedDates?: readonly string[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const DAY_INDEX = new Map<DayCode, number>(DAY_CODES.map((day, index) => [day, index]));

function parseIsoDate(value: string): Date {
  if (!ISO_DATE.test(value)) throw new Error("INVALID_DATE");
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error("INVALID_DATE");
  }
  return parsed;
}

function formatIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function normalizeCalendar(calendar: BusinessCalendar): {
  workingDays: ReadonlySet<number>;
  excludedDates: ReadonlySet<string>;
} {
  if (calendar.workweek.length === 0) throw new Error("INVALID_WORKWEEK");

  const indexes = calendar.workweek.map((day) => DAY_INDEX.get(day));
  if (indexes.some((value) => value === undefined)) throw new Error("INVALID_WORKWEEK");
  const workingDays = new Set(indexes as number[]);
  if (workingDays.size !== indexes.length) throw new Error("INVALID_WORKWEEK");

  const excludedDates = new Set<string>();
  for (const date of calendar.excludedDates ?? []) {
    parseIsoDate(date);
    excludedDates.add(date);
  }

  return { workingDays, excludedDates };
}

function isBusinessDay(
  value: Date,
  normalized: ReturnType<typeof normalizeCalendar>,
): boolean {
  const iso = formatIsoDate(value);
  return normalized.workingDays.has(value.getUTCDay()) && !normalized.excludedDates.has(iso);
}

export function addBusinessDays(
  startDate: string,
  amount: number,
  calendar: BusinessCalendar,
): string {
  if (!Number.isInteger(amount)) throw new Error("INVALID_DAY_OFFSET");
  const current = parseIsoDate(startDate);
  const normalized = normalizeCalendar(calendar);
  let remaining = Math.abs(amount);
  const step = amount < 0 ? -1 : 1;

  while (remaining > 0) {
    current.setUTCDate(current.getUTCDate() + step);
    if (isBusinessDay(current, normalized)) remaining -= 1;
  }

  return formatIsoDate(current);
}

export function businessDaysBetween(
  startDate: string,
  endDate: string,
  calendar: BusinessCalendar,
): number {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  const normalized = normalizeCalendar(calendar);

  if (start.getTime() === end.getTime()) return 0;
  const direction = end > start ? 1 : -1;
  const cursor = new Date(start);
  let count = 0;

  while (cursor.getTime() !== end.getTime()) {
    cursor.setUTCDate(cursor.getUTCDate() + direction);
    if (isBusinessDay(cursor, normalized)) count += direction;
  }

  return count;
}
