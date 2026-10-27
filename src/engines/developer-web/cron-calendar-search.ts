import { invalid } from "./types";

export interface CronWallClock {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly dayOfWeek: number;
}

export const CRON_MINUTE_MS = 60_000;
export const CRON_SEARCH_MINUTES = 527_000;

export function cronTimeZoneFormatter(timeZone: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    invalid("INVALID_TIMEZONE", "The selected IANA timezone is not supported by this browser.");
  }
}

export function wallClock(formatter: Intl.DateTimeFormat, date: Date): CronWallClock {
  const parts = Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  return {
    year,
    month,
    day,
    hour,
    minute,
    dayOfWeek: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  };
}

export function wallClockIso(value: CronWallClock): string {
  const two = (part: number) => part.toString().padStart(2, "0");
  return `${value.year.toString().padStart(4, "0")}-${two(value.month)}-${two(value.day)}T${two(value.hour)}:${two(value.minute)}`;
}

// Only jump to the first UTC minute with a different local day/hour. UTC
// traversal includes both occurrences during overlaps and skips DST gaps.
export function nextCronWallBoundary(
  formatter: Intl.DateTimeFormat,
  start: number,
  end: number,
  current: CronWallClock,
  unit: "day" | "hour",
): number {
  const samePeriod = (at: number): boolean => {
    const value = wallClock(formatter, new Date(at));
    return value.year === current.year && value.month === current.month && value.day === current.day &&
      (unit === "day" || value.hour === current.hour);
  };
  const span = unit === "day" ? 48 * 60 * CRON_MINUTE_MS : 3 * 60 * CRON_MINUTE_MS;
  let lower = start;
  let upper = Math.min(start + span, end);
  while (upper < end && samePeriod(upper)) {
    lower = upper;
    upper = Math.min(upper + span, end);
  }
  if (samePeriod(upper)) return end;
  while (upper - lower > CRON_MINUTE_MS) {
    const middle = lower + Math.floor((upper - lower) / (2 * CRON_MINUTE_MS)) * CRON_MINUTE_MS;
    if (samePeriod(middle)) lower = middle;
    else upper = middle;
  }
  return upper;
}
