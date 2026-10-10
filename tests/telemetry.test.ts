import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { businessDayManifest } from "../src/tools/business-day/manifest";
import businessDayModule from "../src/tools/business-day/module";
import { createRegistry } from "../src/runtime/registry";
import { createToolRuntime } from "../src/runtime/tool-runtime";
import {
  createAllowlistedTelemetryAdapter,
  createMemoryTelemetryTransport,
  createRecordingTelemetryAdapter,
  type TelemetryTransport,
} from "../src/telemetry/adapter";
import { deriveExperimentReport } from "../src/telemetry/reporting";
import { validateTelemetryEvent } from "../src/telemetry/schema";

const fixedNow = new Date("2026-09-24T12:00:00.000Z");

function event(name: string, properties: Record<string, unknown>, subjectId = "participant-1", occurredAt = "2026-09-24T10:00:00.000Z") {
  return { name, properties, subjectId, cohort: "validation", occurredAt };
}

describe("privacy-safe telemetry schema", () => {
  it("accepts the approved event shapes and normalizes aliases", () => {
    const result = validateTelemetryEvent({
      event: "tool_completed",
      properties: { toolId: "business-day", durationBucket: "under-100ms" },
      subjectId: "participant-1",
      occurredAt: fixedNow.toISOString(),
    }, fixedNow);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.event.name).toBe("tool_completed");
      expect(result.event.properties).toEqual({ tool_id: "business-day", duration_bucket: "under-100ms" });
    }
  });

  it.each([
    { name: "tool_completed", properties: { tool_id: "business-day", raw_input: "secret" } },
    { name: "tool_completed", properties: { tool_id: "https://example.com/private" } },
    { name: "tool_completed", properties: { tool_id: "business-day", duration_bucket: "secret text" } },
    { name: "profile_default_applied", properties: { field_key: "currency", value: "USD" } },
    { name: "search_zero_result", properties: { intent_code: "unknown", query: "private search" } },
    { name: "config_imported", properties: { config_version: 1, outcome: "success", filename: "private.json" } },
  ])("rejects forbidden or unapproved fields without echoing them", (candidate) => {
    const result = validateTelemetryEvent(candidate, fixedNow);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).not.toContain("secret");
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("rejects profile values and raw file-like values even under safe-looking keys", () => {
    expect(validateTelemetryEvent(event("tool_completed", { tool_id: "private.txt" }), fixedNow).ok).toBe(false);
    expect(validateTelemetryEvent(event("tool_completed", { tool_id: "file-hash", tool_family: "private.pdf" }), fixedNow).ok).toBe(false);
    expect(validateTelemetryEvent(event("profile_default_applied", { field_key: "profileValue" }), fixedNow).ok).toBe(false);
  });

  it("allows declared non-value profile field keys", () => {
    const result = validateTelemetryEvent(event("profile_default_applied", { field: "hoursPerDay" }), fixedNow);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.event.properties.field_key).toBe("hours_per_day");
  });
});

describe("telemetry adapter isolation", () => {
  it("keeps aggregate Cloudflare Web Analytics outside Tool Runtime and longitudinal telemetry", () => {
    const source = readFileSync(new URL("../src/components/analytics/CloudflareWebAnalytics.astro", import.meta.url), "utf8");
    expect(source).toContain("PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN");
    expect(source).toContain("https://static.cloudflareinsights.com/beacon.min.js");
    expect(source).not.toMatch(/tool-runtime|telemetry\/|configureTelemetry|createHttpTelemetryTransport/u);
  });

  it("is disabled without an explicit disclosed validation cohort", () => {
    const transport = createMemoryTelemetryTransport();
    const adapter = createAllowlistedTelemetryAdapter({ enabled: true, transport });
    expect(adapter.track({ name: "tool_opened", properties: { tool_id: "business-day", entry_source: "public" } }).status).toBe("disabled");
    expect(transport.events).toHaveLength(0);
  });

  it("never throws when a transport is blocked", () => {
    const blocked: TelemetryTransport = { send: () => { throw new Error("network blocked"); } };
    const adapter = createRecordingTelemetryAdapter(blocked, { subjectId: "participant-1", now: () => fixedNow });
    const result = adapter.track({ name: "tool_opened", properties: { tool_id: "business-day", entry_source: "public" } });
    expect(result.status).toBe("blocked");
    expect(result.accepted).toBe(false);
  });

  it("emits no tool input, output, or profile values", async () => {
    const transport = createMemoryTelemetryTransport();
    const adapter = createRecordingTelemetryAdapter(transport, { subjectId: "participant-1", now: () => fixedNow });
    const summary = (({ implementation: _implementation, ...rest }) => rest)(businessDayManifest);
    const runtime = createToolRuntime(
      createRegistry([summary], { "business-day": async () => ({ default: businessDayModule }) }),
      adapter,
      () => Date.parse(fixedNow.toISOString()),
    );
    await runtime.run(
      "business-day",
      { mode: "add", startDate: "2026-09-18", amount: 1 },
      { profile: { workweek: ["MON", "TUE", "WED", "THU", "FRI"], currency: "USD" } },
    );
    const serialized = JSON.stringify(transport.events);
    expect(serialized).not.toContain("2026-09-18");
    expect(serialized).not.toContain("USD");
    expect(serialized).not.toContain("startDate");
  });

  it("keeps tool execution successful when telemetry is blocked", async () => {
    const blocked: TelemetryTransport = { send: () => { throw new Error("network blocked"); } };
    const adapter = createRecordingTelemetryAdapter(blocked, { subjectId: "participant-1", now: () => fixedNow });
    const summary = (({ implementation: _implementation, ...rest }) => rest)(businessDayManifest);
    const runtime = createToolRuntime(
      createRegistry([summary], { "business-day": async () => ({ default: businessDayModule }) }),
      adapter,
      () => Date.parse(fixedNow.toISOString()),
    );
    const result = await runtime.run("business-day", { mode: "add", startDate: "2026-09-18", amount: 1 }, { profile: { workweek: ["MON", "TUE", "WED", "THU", "FRI"] } });
    expect(result.ok).toBe(true);
  });
});

describe("experiment reporting", () => {
  it("derives retention, reuse, source, default, pack, search, handoff, and portability metrics", () => {
    const events = [
      event("onboarding_completed", { context_id: "client-services" }, "participant-1", "2026-09-01T10:00:00.000Z"),
      event("workspace_tool_added", { tool_id: "business-day" }, "participant-1", "2026-09-01T10:01:00.000Z"),
      event("tool_opened", { tool_id: "business-day", entry_source: "workbench" }, "participant-1", "2026-09-20T10:00:00.000Z"),
      event("tool_completed", { tool_id: "business-day", duration_bucket: "under-100ms", tool_family: "time" }, "participant-1", "2026-09-20T10:00:01.000Z"),
      event("tool_completed", { tool_id: "timezone-overlap", duration_bucket: "1s-to-5s", tool_family: "time" }, "participant-1", "2026-09-03T10:00:00.000Z"),
      event("tool_opened", { tool_id: "business-day", entry_source: "public" }, "participant-1", "2026-09-03T11:00:00.000Z"),
      event("tool_opened", { tool_id: "business-day", entry_source: "search" }, "participant-1", "2026-09-04T11:00:00.000Z"),
      event("profile_default_applied", { field_key: "workweek" }, "participant-1", "2026-09-02T10:00:00.000Z"),
      event("profile_default_overridden", { field_key: "workweek" }, "participant-1", "2026-09-02T10:00:00.000Z"),
      event("pack_installed", { pack_id: "client-work" }, "participant-1", "2026-09-04T10:00:00.000Z"),
      event("pack_removed", { pack_id: "client-work" }, "participant-1", "2026-09-05T10:00:00.000Z"),
      event("search_zero_result", { intent_code: "data", category_code: "data" }, "participant-1", "2026-09-05T10:00:00.000Z"),
      event("handoff_used", { source_tool_id: "csv-cleaner", target_tool_id: "csv-dedupe", descriptor_type: "table" }, "participant-1", "2026-09-05T10:00:00.000Z"),
      event("config_exported", { config_version: 1, tool_count: 2, pack_count: 1 }, "participant-1", "2026-09-05T10:00:00.000Z"),
      event("config_imported", { config_version: 1, outcome: "success", tool_count: 2, pack_count: 1 }, "participant-1", "2026-09-05T10:00:00.000Z"),
    ];
    const report = deriveExperimentReport(events, { now: "2026-09-24T12:00:00.000Z" });

    expect(report.cohortSize).toBe(1);
    // A launch on September 20 is outside D7 for a September 1 cohort.
    // At September 24 the D30 cohort has not matured: 0 must not masquerade
    // as measured retention (see .measurable).
    expect(report.metrics.workbenchReturn7d.returnedSubjects).toBe(0);
    expect(report.metrics.workbenchReturn7d.measurable).toBe(true);
    expect(report.metrics.workbenchReturn30d.measurable).toBe(false);
    expect(report.metrics.distinctToolsReused.subjectsWithReuse).toBe(0);
    expect(report.metrics.distinctToolsReusedCount).toBe(0);
    expect(report.metrics.launchSourceCounts).toEqual({ public: 1, search: 1, workbench: 1 });
    expect(report.metrics.defaultReuse.workweek).toEqual({ applied: 1, overridden: 1 });
    expect(report.metrics.packBehavior.net).toBe(0);
    expect(report.metrics.searchZeroResults.total).toBe(1);
    expect(report.metrics.handoffUse.total).toBe(1);
    expect(report.metrics.configPortability.importSuccessRate).toBe(1);
    expect(Object.keys(report.experiments)).toEqual(["EXP-01", "EXP-02", "EXP-03", "EXP-04", "EXP-05", "EXP-06"]);
  });

  it("ignores invalid events and never exposes rejected content in the report", () => {
    const report = deriveExperimentReport([
      { name: "tool_completed", properties: { tool_id: "business-day", raw_output: "private output" } },
      { name: "search_zero_result", properties: { intent_code: "unknown", query: "private search" } },
    ], { now: fixedNow });
    expect(report.eventCount).toBe(0);
    expect(JSON.stringify(report)).not.toContain("private");
  });

  it("counts only matured subject activation and actual within-window return, not visits", () => {
    const report = deriveExperimentReport([
      event("tool_opened", { tool_id: "business-day", entry_source: "workbench" }, "never-activated", "2026-09-01T00:00:00.000Z"),
      event("onboarding_completed", { context_id: "office-operations" }, "matured", "2026-09-01T00:00:00.000Z"),
      event("tool_opened", { tool_id: "business-day", entry_source: "workbench" }, "matured", "2026-09-03T00:00:00.000Z"),
      event("onboarding_completed", { context_id: "office-operations" }, "not-matured", "2026-09-22T00:00:00.000Z"),
      event("tool_opened", { tool_id: "business-day", entry_source: "workbench" }, "not-matured", "2026-09-23T00:00:00.000Z"),
      event("onboarding_completed", { context_id: "office-operations" }, "late-only", "2026-09-01T00:00:00.000Z"),
      event("tool_opened", { tool_id: "business-day", entry_source: "workbench" }, "late-only", "2026-09-21T00:00:00.000Z"),
    ], { now: "2026-09-24T12:00:00.000Z" });
    expect(report.cohortSize).toBe(4);
    expect(report.metrics.workbenchReturn7d).toEqual({
      windowDays: 7, eligibleSubjects: 2, returnedSubjects: 1, rate: 0.5, measurable: true,
    });
    expect(report.metrics.workbenchReturn30d.measurable).toBe(false);
    expect(report.metrics.workbenchReturn30d.eligibleSubjects).toBe(0);
  });

  it("reports actual repeated completion per subject rather than opening two distinct tools", () => {
    const report = deriveExperimentReport([
      event("tool_opened", { tool_id: "business-day", entry_source: "public" }, "a"),
      event("tool_opened", { tool_id: "csv-cleaner", entry_source: "search" }, "a"),
      event("tool_completed", { tool_id: "business-day", duration_bucket: "100ms-to-1s" }, "a"),
      event("tool_completed", { tool_id: "business-day", duration_bucket: "100ms-to-1s" }, "a", "2026-09-24T11:00:00.000Z"),
      event("tool_completed", { tool_id: "csv-cleaner", duration_bucket: "100ms-to-1s" }, "b"),
      event("tool_completed", { tool_id: "csv-cleaner", duration_bucket: "100ms-to-1s" }, "c"),
    ], { now: "2026-09-24T12:00:00.000Z" });
    expect(report.metrics.distinctToolsReused).toMatchObject({
      subjectCount: 3, distinctToolCount: 2, reusedToolCount: 1,
      totalDistinctTools: 3, subjectsWithReuse: 1,
    });
    expect(report.metrics.distinctToolsReusedCount).toBe(1);
  });
});
