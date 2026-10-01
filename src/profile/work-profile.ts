import type { ToolSummary } from "../catalog/manifest";

export type DayCode = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

export interface WorkProfile {
  locale: string;
  timezone: string;
  currency: string;
  dateFormat: "system" | "day-first" | "month-first";
  numberFormat: "system" | "decimal-comma" | "decimal-point";
  workweek: readonly DayCode[];
  preferredUnits: "metric" | "imperial" | "mixed";
}

export type WorkProfileUpdate = Partial<WorkProfile>;

const DEFAULT_WORKWEEK: readonly DayCode[] = ["MON", "TUE", "WED", "THU", "FRI"];

function validNonEmpty(value: string, fallback: string): string {
  const normalized = value.trim();
  return normalized === "" ? fallback : normalized;
}

export function createDefaultWorkProfile(
  environment: Pick<WorkProfile, "locale" | "timezone">,
): WorkProfile {
  return {
    locale: validNonEmpty(environment.locale, "it-IT"),
    timezone: validNonEmpty(environment.timezone, "UTC"),
    currency: "EUR",
    dateFormat: "system",
    numberFormat: "system",
    workweek: DEFAULT_WORKWEEK,
    preferredUnits: "metric",
  };
}

export function updateWorkProfile(
  current: WorkProfile,
  update: WorkProfileUpdate,
): WorkProfile {
  return {
    ...current,
    ...update,
    locale: validNonEmpty(update.locale ?? current.locale, current.locale),
    timezone: validNonEmpty(update.timezone ?? current.timezone, current.timezone),
    workweek: update.workweek === undefined ? current.workweek : [...update.workweek],
  };
}

export function profileValuesForTool(
  tool: ToolSummary,
  profile: WorkProfile,
): Readonly<Record<string, unknown>> {
  const source = profile as unknown as Readonly<Record<string, unknown>>;
  return Object.fromEntries(
    tool.profileFields
      .filter(({ key, sensitive }) => sensitive !== true && Object.prototype.hasOwnProperty.call(source, key))
      .map(({ key }) => [key, source[key]]),
  );
}
