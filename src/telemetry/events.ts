import type { TelemetryAdapter } from "./adapter";
import { trackSafely } from "./adapter";
import {
  durationBucket,
  type DurationBucket,
  type OnboardingContextId,
  type ProfileFieldKey,
  type SearchCategoryCode,
  type SearchIntentCode,
  type TelemetryDescriptorType,
  type ToolEntrySource,
  type ToolFamily,
} from "./schema";

export interface TelemetrySubjectContext {
  subjectId?: string;
}

export function trackToolOpened(
  adapter: TelemetryAdapter,
  toolId: string,
  entrySource: ToolEntrySource,
  context: TelemetrySubjectContext = {},
): void {
  trackSafely(adapter, {
    name: "tool_opened",
    properties: { tool_id: toolId, entry_source: entrySource },
    ...(context.subjectId === undefined ? {} : { subjectId: context.subjectId }),
  });
}

export function trackToolCompleted(
  adapter: TelemetryAdapter,
  toolId: string,
  durationMs: number,
  toolFamily: ToolFamily = "other",
  context: TelemetrySubjectContext = {},
): void {
  trackSafely(adapter, {
    name: "tool_completed",
    properties: { tool_id: toolId, duration_bucket: durationBucket(durationMs), tool_family: toolFamily },
    ...(context.subjectId === undefined ? {} : { subjectId: context.subjectId }),
  });
}

export function trackToolFailed(
  adapter: TelemetryAdapter,
  toolId: string,
  errorCode: "not-found" | "invalid-input" | "cancelled" | "runtime-error",
  toolFamily: ToolFamily = "other",
  context: TelemetrySubjectContext = {},
): void {
  trackSafely(adapter, {
    name: "tool_failed",
    properties: { tool_id: toolId, error_code: errorCode, tool_family: toolFamily },
    ...(context.subjectId === undefined ? {} : { subjectId: context.subjectId }),
  });
}

export function trackWorkspaceToolAdded(adapter: TelemetryAdapter, toolId: string, context: TelemetrySubjectContext = {}): void {
  trackSafely(adapter, {
    name: "workspace_tool_added",
    properties: { tool_id: toolId },
    ...(context.subjectId === undefined ? {} : { subjectId: context.subjectId }),
  });
}

export function trackWorkspaceToolRemoved(adapter: TelemetryAdapter, toolId: string, context: TelemetrySubjectContext = {}): void {
  trackSafely(adapter, {
    name: "workspace_tool_removed",
    properties: { tool_id: toolId },
    ...(context.subjectId === undefined ? {} : { subjectId: context.subjectId }),
  });
}

export function trackOnboardingCompleted(adapter: TelemetryAdapter, contextId: OnboardingContextId, context: TelemetrySubjectContext = {}): void {
  trackSafely(adapter, {
    name: "onboarding_completed",
    properties: { context_id: contextId },
    ...(context.subjectId === undefined ? {} : { subjectId: context.subjectId }),
  });
}

export function trackPackInstalled(adapter: TelemetryAdapter, packId: string, context: TelemetrySubjectContext = {}): void {
  trackSafely(adapter, {
    name: "pack_installed",
    properties: { pack_id: packId },
    ...(context.subjectId === undefined ? {} : { subjectId: context.subjectId }),
  });
}

export function trackPackRemoved(adapter: TelemetryAdapter, packId: string, context: TelemetrySubjectContext = {}): void {
  trackSafely(adapter, {
    name: "pack_removed",
    properties: { pack_id: packId },
    ...(context.subjectId === undefined ? {} : { subjectId: context.subjectId }),
  });
}

export function trackProfileDefault(adapter: TelemetryAdapter, fieldKey: ProfileFieldKey, kind: "applied" | "overridden", context: TelemetrySubjectContext = {}): void {
  trackSafely(adapter, {
    name: kind === "applied" ? "profile_default_applied" : "profile_default_overridden",
    properties: { field_key: fieldKey },
    ...(context.subjectId === undefined ? {} : { subjectId: context.subjectId }),
  });
}

export function trackSearchZeroResult(
  adapter: TelemetryAdapter,
  intentCode: SearchIntentCode,
  categoryCode?: SearchCategoryCode,
  context: TelemetrySubjectContext = {},
): void {
  trackSafely(adapter, {
    name: "search_zero_result",
    properties: {
      intent_code: intentCode,
      ...(categoryCode === undefined ? {} : { category_code: categoryCode }),
    },
    ...(context.subjectId === undefined ? {} : { subjectId: context.subjectId }),
  });
}

export function trackHandoffUsed(
  adapter: TelemetryAdapter,
  sourceToolId: string,
  targetToolId: string,
  descriptorType: TelemetryDescriptorType,
  context: TelemetrySubjectContext = {},
): void {
  trackSafely(adapter, {
    name: "handoff_used",
    properties: { source_tool_id: sourceToolId, target_tool_id: targetToolId, descriptor_type: descriptorType },
    ...(context.subjectId === undefined ? {} : { subjectId: context.subjectId }),
  });
}

export function trackConfigExported(
  adapter: TelemetryAdapter,
  counts: { toolCount: number; packCount: number; configVersion?: number },
  context: TelemetrySubjectContext = {},
): void {
  trackSafely(adapter, {
    name: "config_exported",
    properties: {
      config_version: counts.configVersion ?? 1,
      tool_count: counts.toolCount,
      pack_count: counts.packCount,
    },
    ...(context.subjectId === undefined ? {} : { subjectId: context.subjectId }),
  });
}

export function trackConfigImported(
  adapter: TelemetryAdapter,
  outcome: "success" | "rejected" | "failed",
  counts: { toolCount: number; packCount: number; configVersion?: number },
  context: TelemetrySubjectContext = {},
): void {
  trackSafely(adapter, {
    name: "config_imported",
    properties: {
      config_version: counts.configVersion ?? 1,
      outcome,
      tool_count: counts.toolCount,
      pack_count: counts.packCount,
    },
    ...(context.subjectId === undefined ? {} : { subjectId: context.subjectId }),
  });
}

export function classifySearchIntent(rawQuery: string): SearchIntentCode {
  const normalized = rawQuery.toLocaleLowerCase();
  if (/(csv|table|spreadsheet|column|row|delimiter|json)/u.test(normalized)) return "data";
  if (/(pdf|document|file|metadata)/u.test(normalized)) return "documents";
  if (/(image|photo|pixel|resize)/u.test(normalized)) return "images";
  if (/(campaign|utm|marketing|seo|url|link)/u.test(normalized)) return "marketing";
  if (/(research|citation|doi|isbn|bibliograph)/u.test(normalized)) return "research";
  if (/(meeting|schedule|timezone|calendar|date|deadline)/u.test(normalized)) return "scheduling";
  if (/(text|list|word|diff|quote)/u.test(normalized)) return "text";
  if (/(time|duration|rate|currency|margin)/u.test(normalized)) return "time";
  return "unknown";
}

export function classifySearchCategory(rawCategory: string): SearchCategoryCode {
  const normalized = rawCategory.toLocaleLowerCase();
  if (normalized === "all" || normalized === "") return "all";
  if (normalized.includes("data") || normalized.includes("csv") || normalized.includes("table")) return "data";
  if (normalized.includes("document") || normalized.includes("pdf") || normalized.includes("file")) return "document";
  if (normalized.includes("image") || normalized.includes("photo")) return "image";
  if (normalized.includes("research") || normalized.includes("citation")) return "research";
  if (normalized.includes("campaign") || normalized.includes("marketing") || normalized.includes("url")) return "campaign";
  if (normalized.includes("text") || normalized.includes("writing")) return "text";
  if (normalized.includes("time") || normalized.includes("date")) return "time";
  if (normalized.includes("business") || normalized.includes("finance") || normalized.includes("operation")) return "business";
  return "unknown";
}

export function durationBucketForTelemetry(durationMs: number): DurationBucket {
  return durationBucket(durationMs);
}
