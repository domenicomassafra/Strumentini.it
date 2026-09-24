export const TELEMETRY_EVENT_NAMES = [
  "tool_opened",
  "tool_completed",
  "tool_failed",
  "workspace_tool_added",
  "workspace_tool_removed",
  "onboarding_completed",
  "pack_installed",
  "pack_removed",
  "profile_default_applied",
  "profile_default_overridden",
  "search_zero_result",
  "handoff_used",
  "config_exported",
  "config_imported",
] as const;

export type TelemetryEventName = (typeof TELEMETRY_EVENT_NAMES)[number];

export const TOOL_ENTRY_SOURCES = ["public", "search", "workbench"] as const;
export type ToolEntrySource = (typeof TOOL_ENTRY_SOURCES)[number];

export const ERROR_CODES = ["not-found", "invalid-input", "cancelled", "runtime-error"] as const;
export type TelemetryErrorCode = (typeof ERROR_CODES)[number];

export const DURATION_BUCKETS = ["under-100ms", "100ms-to-1s", "1s-to-5s", "over-5s"] as const;
export type DurationBucket = (typeof DURATION_BUCKETS)[number];

export const TOOL_FAMILIES = ["business", "campaign", "data", "document", "image", "research", "text", "time", "other"] as const;
export type ToolFamily = (typeof TOOL_FAMILIES)[number];

export const ONBOARDING_CONTEXT_IDS = [
  "client-services",
  "marketing-growth",
  "content-creator",
  "research-academia",
  "development-data",
  "office-operations",
  "finance-business",
  "other",
] as const;
export type OnboardingContextId = (typeof ONBOARDING_CONTEXT_IDS)[number];

export const PROFILE_FIELD_KEYS = [
  "locale",
  "timezone",
  "currency",
  "date_format",
  "number_format",
  "workweek",
  "preferred_units",
  "hours_per_day",
  "working_hours",
] as const;
export type ProfileFieldKey = (typeof PROFILE_FIELD_KEYS)[number];

export const SEARCH_INTENT_CODES = [
  "data",
  "documents",
  "images",
  "marketing",
  "research",
  "scheduling",
  "text",
  "time",
  "unknown",
] as const;
export type SearchIntentCode = (typeof SEARCH_INTENT_CODES)[number];

export const SEARCH_CATEGORY_CODES = [
  "all",
  "business",
  "campaign",
  "data",
  "document",
  "image",
  "research",
  "text",
  "time",
  "unknown",
] as const;
export type SearchCategoryCode = (typeof SEARCH_CATEGORY_CODES)[number];

export const DESCRIPTOR_TYPES = [
  "text",
  "lines",
  "number",
  "date-time",
  "url",
  "table",
  "structured",
  "file",
  "image",
  "bytes",
  "none",
] as const;
export type TelemetryDescriptorType = (typeof DESCRIPTOR_TYPES)[number];

export const VALIDATION_COHORTS = ["validation"] as const;
export type ValidationCohort = (typeof VALIDATION_COHORTS)[number];

export type TelemetryProperty = string | number | boolean;
export type TelemetryProperties = Readonly<Record<string, TelemetryProperty>>;

export interface TelemetryEventInput {
  name?: unknown;
  event?: unknown;
  properties?: unknown;
  occurredAt?: unknown;
  timestamp?: unknown;
  subjectId?: unknown;
  cohort?: unknown;
}

export type TelemetryEvent = TelemetryEventInput;

export interface ValidatedTelemetryEvent {
  readonly name: TelemetryEventName;
  readonly properties: TelemetryProperties;
  readonly occurredAt: string;
  readonly subjectId?: string;
  readonly cohort?: ValidationCohort;
}

export type TelemetryValidationFailureCode =
  | "INVALID_EVENT"
  | "UNKNOWN_EVENT"
  | "FORBIDDEN_FIELD"
  | "INVALID_VALUE";

export type TelemetryValidationResult =
  | { ok: true; event: ValidatedTelemetryEvent }
  | { ok: false; code: TelemetryValidationFailureCode; reason: string };

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/u;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/u;

export const FORBIDDEN_TELEMETRY_PROPERTY_KEYS = [
  "content",
  "text",
  "input",
  "output",
  "raw_input",
  "raw_output",
  "filename",
  "file_name",
  "file_bytes",
  "bytes",
  "url",
  "href",
  "query",
  "search_text",
  "profile",
  "profile_value",
  "value",
  "name",
] as const;

const FORBIDDEN_PROPERTY_KEYS = new Set<string>(FORBIDDEN_TELEMETRY_PROPERTY_KEYS);

const PROPERTY_ALIASES: Readonly<Record<string, string>> = {
  toolId: "tool_id",
  entrySource: "entry_source",
  durationBucket: "duration_bucket",
  errorCode: "error_code",
  contextId: "context_id",
  packId: "pack_id",
  field: "field_key",
  fieldKey: "field_key",
  hoursPerDay: "hours_per_day",
  workingHours: "working_hours",
  intentCode: "intent_code",
  categoryCode: "category_code",
  sourceToolId: "source_tool_id",
  targetToolId: "target_tool_id",
  descriptorType: "descriptor_type",
  toolFamily: "tool_family",
  toolCount: "tool_count",
  packCount: "pack_count",
  configVersion: "config_version",
  subjectId: "subject_id",
};

const REQUIRED_PROPERTIES: Readonly<Record<TelemetryEventName, readonly string[]>> = {
  tool_opened: ["tool_id", "entry_source"],
  tool_completed: ["tool_id"],
  tool_failed: ["tool_id", "error_code"],
  workspace_tool_added: ["tool_id"],
  workspace_tool_removed: ["tool_id"],
  onboarding_completed: ["context_id"],
  pack_installed: ["pack_id"],
  pack_removed: ["pack_id"],
  profile_default_applied: ["field_key"],
  profile_default_overridden: ["field_key"],
  search_zero_result: ["intent_code"],
  handoff_used: ["source_tool_id", "target_tool_id", "descriptor_type"],
  config_exported: ["config_version"],
  config_imported: ["config_version", "outcome"],
};

const OPTIONAL_PROPERTIES: Readonly<Record<TelemetryEventName, readonly string[]>> = {
  tool_opened: ["tool_family"],
  tool_completed: ["duration_bucket", "tool_family"],
  tool_failed: ["tool_family"],
  workspace_tool_added: [],
  workspace_tool_removed: [],
  onboarding_completed: [],
  pack_installed: [],
  pack_removed: [],
  profile_default_applied: [],
  profile_default_overridden: [],
  search_zero_result: ["category_code"],
  handoff_used: [],
  config_exported: ["tool_count", "pack_count"],
  config_imported: ["tool_count", "pack_count"],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeId(value: unknown): value is string {
  return typeof value === "string"
    && SAFE_ID.test(value)
    && !value.includes("@")
    && !value.includes(".")
    && !/[\\/?#\s]/u.test(value);
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function isIntegerBetween(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && ISO_TIMESTAMP.test(value) && !Number.isNaN(Date.parse(value));
}

function normalizePropertyKey(key: string): string {
  return PROPERTY_ALIASES[key] ?? key;
}

function propertyRule(name: TelemetryEventName, key: string): ((value: unknown) => boolean) | undefined {
  if (key === "tool_id" || key === "pack_id" || key === "source_tool_id" || key === "target_tool_id") {
    return isSafeId;
  }
  if (key === "entry_source") return (value) => isOneOf(value, TOOL_ENTRY_SOURCES);
  if (key === "duration_bucket") return (value) => isOneOf(value, DURATION_BUCKETS);
  if (key === "error_code") return (value) => isOneOf(value, ERROR_CODES);
  if (key === "tool_family") return (value) => isOneOf(value, TOOL_FAMILIES);
  if (key === "context_id") return (value) => isOneOf(value, ONBOARDING_CONTEXT_IDS);
  if (key === "field_key") return (value) => isOneOf(value, PROFILE_FIELD_KEYS);
  if (key === "intent_code") return (value) => isOneOf(value, SEARCH_INTENT_CODES);
  if (key === "category_code") return (value) => isOneOf(value, SEARCH_CATEGORY_CODES);
  if (key === "descriptor_type") return (value) => isOneOf(value, DESCRIPTOR_TYPES);
  if (key === "config_version") return (value) => isIntegerBetween(value, 1, 999);
  if (key === "tool_count" || key === "pack_count") return (value) => isIntegerBetween(value, 0, 10000);
  if (key === "outcome") return (value) => isOneOf(value, ["success", "rejected", "failed"] as const);
  if (name === "config_imported" && key === "outcome") return (value) => isOneOf(value, ["success", "rejected", "failed"] as const);
  return undefined;
}

function eventKeys(name: TelemetryEventName): readonly string[] {
  return [...REQUIRED_PROPERTIES[name], ...OPTIONAL_PROPERTIES[name]];
}

function normalizeProperties(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;
  const normalized: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  try {
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") return undefined;
      const canonical = normalizePropertyKey(key);
      if (Object.prototype.hasOwnProperty.call(normalized, canonical)) return undefined;
      normalized[canonical] = canonical === "field_key" ? normalizeProfileFieldKey(value[key]) ?? value[key] : value[key];
    }
  } catch {
    return undefined;
  }
  return normalized;
}

function timestampFor(value: unknown, now: Date | number | string): string | undefined {
  if (value === undefined) {
    const generated = new Date(now);
    return Number.isNaN(generated.getTime()) ? undefined : generated.toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const numeric = new Date(value);
    return Number.isNaN(numeric.getTime()) ? undefined : numeric.toISOString();
  }
  return isTimestamp(value) ? value : undefined;
}

function normalizedTopLevel(input: Record<string, unknown>): Record<string, unknown> {
  const name = input.name === undefined ? input.event : input.name;
  if (input.name !== undefined && input.event !== undefined && input.name !== input.event) {
    return {};
  }
  if (input.occurredAt !== undefined && input.timestamp !== undefined && input.occurredAt !== input.timestamp) {
    return {};
  }
  return {
    ...input,
    name,
    occurredAt: input.occurredAt === undefined ? input.timestamp : input.occurredAt,
    ...(Object.prototype.hasOwnProperty.call(input, "subject_id") ? { subjectId: input.subject_id } : {}),
  };
}

function invalid(code: TelemetryValidationFailureCode, reason: string): TelemetryValidationResult {
  return { ok: false, code, reason };
}

export function validateTelemetryEvent(
  input: unknown,
  now: Date | number | string = new Date(),
): TelemetryValidationResult {
  if (!isRecord(input)) return invalid("INVALID_EVENT", "Telemetry input must be an object.");
  const topLevelKeys = Reflect.ownKeys(input);
  const allowedTopLevel = new Set(["name", "event", "properties", "occurredAt", "timestamp", "subjectId", "subject_id", "cohort"]);
  if (topLevelKeys.some((key) => typeof key !== "string" || !allowedTopLevel.has(key))) {
    return invalid("FORBIDDEN_FIELD", "Telemetry input contains an unapproved field.");
  }
  const normalizedTop = normalizedTopLevel(input);
  if (typeof normalizedTop.name !== "string" || !isOneOf(normalizedTop.name, TELEMETRY_EVENT_NAMES)) {
    return invalid("UNKNOWN_EVENT", "Telemetry event name is not approved.");
  }
  const name = normalizedTop.name;
  const properties = normalizeProperties(normalizedTop.properties);
  if (properties === undefined) return invalid("INVALID_EVENT", "Telemetry properties must be a plain object.");
  const keys = eventKeys(name);
  const keySet = new Set(keys);
  if (Object.keys(properties).some((key) => !keySet.has(key) || isForbiddenTelemetryProperty(key))) {
    return invalid("FORBIDDEN_FIELD", "Telemetry properties contain an unapproved field.");
  }
  for (const key of REQUIRED_PROPERTIES[name]) {
    if (!Object.prototype.hasOwnProperty.call(properties, key)) {
      return invalid("INVALID_EVENT", "Telemetry event is missing a required field.");
    }
  }
  for (const [key, value] of Object.entries(properties)) {
    const rule = propertyRule(name, key);
    if (rule === undefined || !rule(value)) {
      return invalid("INVALID_VALUE", "Telemetry property value is not approved.");
    }
  }
  const occurredAt = timestampFor(normalizedTop.occurredAt, now);
  if (occurredAt === undefined) return invalid("INVALID_VALUE", "Telemetry timestamp is not approved.");
  const subjectId = normalizedTop.subjectId;
  if (subjectId !== undefined && !isSafeId(subjectId)) {
    return invalid("INVALID_VALUE", "Telemetry subject identifier is not approved.");
  }
  const cohort = normalizedTop.cohort;
  if (cohort !== undefined && cohort !== "validation") {
    return invalid("INVALID_VALUE", "Telemetry cohort is not approved.");
  }

  return {
    ok: true,
    event: {
      name,
      properties: structuredClone(properties) as TelemetryProperties,
      occurredAt,
      ...(subjectId === undefined ? {} : { subjectId }),
      ...(cohort === undefined ? {} : { cohort: cohort as ValidationCohort }),
    },
  };
}

export const validateEvent = validateTelemetryEvent;

export function createTelemetryEvent(
  input: unknown,
  now: Date | number | string = new Date(),
): TelemetryValidationResult {
  return validateTelemetryEvent(input, now);
}

export function sanitizeTelemetryEvent(
  input: unknown,
  now: Date | number | string = new Date(),
): ValidatedTelemetryEvent | undefined {
  const result = validateTelemetryEvent(input, now);
  return result.ok ? result.event : undefined;
}

export function isSafeTelemetryIdentifier(value: unknown): value is string {
  return isSafeId(value);
}

export function normalizeProfileFieldKey(value: unknown): ProfileFieldKey | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = PROPERTY_ALIASES[value] ?? value;
  return (PROFILE_FIELD_KEYS as readonly string[]).includes(normalized)
    ? normalized as ProfileFieldKey
    : undefined;
}

export function isProfileFieldKey(value: unknown): value is ProfileFieldKey {
  return typeof value === "string" && (PROFILE_FIELD_KEYS as readonly string[]).includes(value);
}

export function isForbiddenTelemetryProperty(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.toLocaleLowerCase().replace(/[-_]/gu, "");
  return FORBIDDEN_PROPERTY_KEYS.has(value)
    || FORBIDDEN_PROPERTY_KEYS.has(normalized)
    || ["content", "text", "input", "output", "rawinput", "rawoutput", "filename", "filebytes", "url", "query", "searchtext", "profile", "profilevalue", "bytes", "value", "name"].includes(normalized);
}

export function durationBucket(durationMs: number): DurationBucket {
  if (!Number.isFinite(durationMs) || durationMs < 0) return "over-5s";
  if (durationMs < 100) return "under-100ms";
  if (durationMs < 1000) return "100ms-to-1s";
  if (durationMs < 5000) return "1s-to-5s";
  return "over-5s";
}
