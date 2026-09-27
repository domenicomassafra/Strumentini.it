const DAY_MS = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;

function parseDate(date: string): Date {
  if (!ISO_DATE.test(date)) throw new Error("INVALID_DATE");
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new Error("INVALID_DATE");
  }
  return parsed;
}

function wholeNumber(value: number, code: string): number {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(code);
  }
  return value;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addCalendarDays(date: string, days: number): string {
  const parsed = parseDate(date);
  parsed.setUTCDate(
    parsed.getUTCDate() + wholeNumber(days, "INVALID_DAY_OFFSET"),
  );
  return formatDate(parsed);
}

export function differenceInCalendarDays(
  later: string,
  earlier: string,
): number {
  return Math.round(
    (parseDate(later).getTime() - parseDate(earlier).getTime()) / DAY_MS,
  );
}

export function addBusinessDays(date: string, businessDays: number): string {
  const parsed = parseDate(date);
  let remaining = Math.abs(wholeNumber(businessDays, "INVALID_DAY_OFFSET"));
  const step = businessDays < 0 ? -1 : 1;
  while (remaining > 0) {
    parsed.setUTCDate(parsed.getUTCDate() + step);
    const day = parsed.getUTCDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return formatDate(parsed);
}

export function durationToDecimalHours(
  duration: { hours: number; minutes: number },
): number {
  if (
    !Number.isInteger(duration.hours) || duration.hours < 0 ||
    !Number.isInteger(duration.minutes) || duration.minutes < 0 ||
    duration.minutes > 59
  ) {
    throw new Error("INVALID_DURATION");
  }
  return duration.hours + duration.minutes / 60;
}

export function decimalHoursToDuration(
  decimalHours: number,
): { hours: number; minutes: number } {
  if (!Number.isFinite(decimalHours) || decimalHours < 0) {
    throw new Error("INVALID_DURATION");
  }
  const totalMinutes = Math.round(decimalHours * 60);
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}
