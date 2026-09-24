import type { DayCode, WorkProfile } from "../profile/work-profile";
import type { WorkbenchState } from "./state";

export interface WorkbenchConfigV1 {
  kind: "utility-workbench-config";
  version: 1;
  installedTools: string[];
  packs: string[];
  layout: {
    mode: "list";
  };
  profile: WorkProfile;
  preferences: {
    compactRows: boolean;
  };
}

export type ImportPreview =
  | {
      ok: true;
      config: WorkbenchConfigV1;
      summary: {
        addedTools: string[];
        removedTools: string[];
        profileChanged: boolean;
        preferencesChanged: boolean;
        packsChanged: boolean;
      };
    }
  | {
      ok: false;
      error: string;
    };

const DAY_CODES = new Set<DayCode>(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);
const MAX_CONFIG_BYTES = 1024 * 1024;
const MAX_CONFIG_IDS = 500;
const MAX_PROFILE_STRING = 128;
const TOOL_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const DATE_FORMATS = new Set(["system", "day-first", "month-first"]);
const NUMBER_FORMATS = new Set(["system", "decimal-comma", "decimal-point"]);
const UNIT_SYSTEMS = new Set(["metric", "imperial", "mixed"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= MAX_CONFIG_IDS && value.every((item) => typeof item === "string" && item.trim() !== "" && item.length <= 64 && TOOL_ID_PATTERN.test(item));
}

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function parseProfile(value: unknown): WorkProfile | undefined {
  if (!isRecord(value)) return undefined;
  if (!hasExactKeys(value, [
    "locale",
    "timezone",
    "currency",
    "dateFormat",
    "numberFormat",
    "workweek",
    "preferredUnits",
  ])) return undefined;
  const workweek = value.workweek;
  if (
    typeof value.locale !== "string" ||
    value.locale.trim() === "" ||
    typeof value.timezone !== "string" ||
    value.timezone.trim() === "" ||
    typeof value.currency !== "string" ||
    value.currency.trim() === "" ||
    typeof value.dateFormat !== "string" ||
    !DATE_FORMATS.has(value.dateFormat) ||
    typeof value.numberFormat !== "string" ||
    !NUMBER_FORMATS.has(value.numberFormat) ||
    !Array.isArray(workweek) ||
    workweek.length === 0 ||
    !workweek.every((day) => typeof day === "string" && DAY_CODES.has(day as DayCode)) ||
    new Set(workweek).size !== workweek.length ||
    typeof value.preferredUnits !== "string" ||
    !UNIT_SYSTEMS.has(value.preferredUnits)
  ) {
    return undefined;
  }
  if (![value.locale, value.timezone, value.currency].every((item) => typeof item === "string" && item.length <= MAX_PROFILE_STRING && !/[\u0000-\u001f\u007f]/u.test(item))) return undefined;

  return {
    locale: value.locale,
    timezone: value.timezone,
    currency: value.currency,
    dateFormat: value.dateFormat as WorkProfile["dateFormat"],
    numberFormat: value.numberFormat as WorkProfile["numberFormat"],
    workweek: workweek as DayCode[],
    preferredUnits: value.preferredUnits as WorkProfile["preferredUnits"],
  };
}

function parseConfig(value: unknown): WorkbenchConfigV1 | undefined {
  if (!isRecord(value)) return undefined;
  if (!hasExactKeys(value, [
    "kind",
    "version",
    "installedTools",
    "packs",
    "layout",
    "profile",
    "preferences",
  ])) return undefined;
  if (value.kind !== "utility-workbench-config" || value.version !== 1) return undefined;
  if (!stringArray(value.installedTools) || !unique(value.installedTools)) return undefined;
  if (!stringArray(value.packs) || !unique(value.packs)) return undefined;
  if (
    !isRecord(value.layout) ||
    !hasExactKeys(value.layout, ["mode"]) ||
    value.layout.mode !== "list"
  ) return undefined;
  if (
    !isRecord(value.preferences) ||
    !hasExactKeys(value.preferences, ["compactRows"]) ||
    typeof value.preferences.compactRows !== "boolean"
  ) return undefined;
  const profile = parseProfile(value.profile);
  if (profile === undefined) return undefined;

  return {
    kind: "utility-workbench-config",
    version: 1,
    installedTools: [...value.installedTools],
    packs: [...value.packs],
    layout: { mode: "list" },
    profile,
    preferences: { compactRows: value.preferences.compactRows },
  };
}

export function configFromState(state: WorkbenchState): WorkbenchConfigV1 {
  return {
    kind: "utility-workbench-config",
    version: 1,
    installedTools: [...state.installedTools],
    packs: [...state.packs],
    layout: { ...state.layout },
    profile: structuredClone(state.profile),
    preferences: { ...state.preferences },
  };
}

export function exportWorkbenchConfig(state: WorkbenchState): string {
  return JSON.stringify(configFromState(state), null, 2);
}

export function previewWorkbenchImport(
  serialized: string,
  current: WorkbenchState,
): ImportPreview {
  if (serialized.length > MAX_CONFIG_BYTES) return { ok: false, error: "This configuration exceeds the local size limit." };
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    return { ok: false, error: "This file is not valid JSON." };
  }
  const config = parseConfig(parsed);
  if (config === undefined) {
    return { ok: false, error: "This configuration is malformed or uses an unsupported version." };
  }

  return {
    ok: true,
    config,
    summary: {
      addedTools: config.installedTools.filter((id) => !current.installedTools.includes(id)),
      removedTools: current.installedTools.filter((id) => !config.installedTools.includes(id)),
      profileChanged: JSON.stringify(config.profile) !== JSON.stringify(current.profile),
      preferencesChanged: JSON.stringify(config.preferences) !== JSON.stringify(current.preferences),
      packsChanged: JSON.stringify(config.packs) !== JSON.stringify(current.packs),
    },
  };
}

export function applyImportedConfig(
  current: WorkbenchState,
  config: WorkbenchConfigV1,
): WorkbenchState {
  return {
    ...current,
    installedTools: [...config.installedTools],
    packs: [...config.packs],
    layout: { ...config.layout },
    profile: structuredClone(config.profile),
    preferences: { ...config.preferences },
  };
}
