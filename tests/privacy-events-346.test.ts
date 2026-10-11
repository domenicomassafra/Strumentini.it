import { describe, expect, it, vi } from "vitest";
import { createPrivacySafeOutcomeAdapter } from "../src/telemetry/privacy-events-346";
import { createMemoryTelemetryTransport } from "../src/telemetry/adapter";
import { validateTelemetryEvent } from "../src/telemetry/schema";
import { deriveExperimentReport } from "../src/telemetry/reporting";
import {
  saveValidationTelemetryConsent,
  type TelemetryConsentStorage,
} from "../src/telemetry/consent";

function testHarness() {
  const stored = new Map<string, string>();
  const storage: TelemetryConsentStorage = {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => { stored.set(key, value); },
  };
  const transport = createMemoryTelemetryTransport();
  const session = vi.fn(async () => true);
  const options = {
    enabled: true,
    disclosed: true,
    cohort: "validation" as const,
    storage: () => storage,
    authenticated: session,
    transport,
    now: () => new Date("2026-10-11T19:12:41.432Z"),
  };
  return { storage, transport, session, options };
}
const tick = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise<void>((resolve) => setImmediate(resolve));
};

const success = {
  name: "tool_completed",
  properties: {
    tool_id: "pdf-rotate",
    tool_family: "document",
    duration_bucket: "100ms-to-1s",
  },
  subjectId: "person-834933",
};
const failure = {
  name: "tool_failed",
  properties: { tool_id: "pdf-rotate", tool_family: "document", error_code: "invalid-input" },
  subjectId: "person-834933",
};

describe("#346 strict privacy event contract", () => {
  it("allows only anonymous success/error technical shapes without tool IDs or fingerprint", () => {
    const ok = validateTelemetryEvent({
      name: "validation_operation_result",
      cohort: "validation",
      properties: { outcome: "success", tool_family: "document", duration_bucket: "100ms-to-1s" },
    }, new Date("2026-10-11T00:00:00.000Z"));
    expect(ok.ok).toBe(true);
    for (const properties of [
      { outcome: "success", tool_id: "pdf-rotate" },
      { outcome: "error", error_code: "invalid-input", filename: "SECRET.pdf" },
      { outcome: "success", subject_id: "person" },
      { outcome: "error", error_code: "secret from file" },
      { outcome: "success", file_hash: "abc" },
      { outcome: "success", error_code: "runtime-error" },
      { outcome: "error" },
    ]) {
      expect(validateTelemetryEvent({ name: "validation_operation_result", properties }).ok).toBe(false);
    }
    expect(validateTelemetryEvent({
      name: "validation_operation_result", properties: { outcome: "success" }, subjectId: "person",
    }).ok).toBe(false);
  });

  it("is disabled by default, by missing disclosure, missing cohort and denied storage", async () => {
    const h = testHarness();
    const disabled = [
      createPrivacySafeOutcomeAdapter({ ...h.options, enabled: false }),
      createPrivacySafeOutcomeAdapter({ ...h.options, disclosed: false }),
      createPrivacySafeOutcomeAdapter({ ...h.options, cohort: undefined }),
      createPrivacySafeOutcomeAdapter(h.options),
      createPrivacySafeOutcomeAdapter({ ...h.options, storage: () => null }),
      createPrivacySafeOutcomeAdapter({ ...h.options, storage: () => { throw new Error("denied"); } }),
    ];
    for (const adapter of disabled) expect(adapter.track(success).accepted).toBe(false);
    await tick();
    expect(h.session).not.toHaveBeenCalled();
    expect(h.transport.events).toHaveLength(0);
  });

  it("after explicit grant and authenticated session emits anonymized success and error", async () => {
    const h = testHarness();
    saveValidationTelemetryConsent(h.storage, true);
    const adapter = createPrivacySafeOutcomeAdapter(h.options);
    expect(adapter.track(success).accepted).toBe(true);
    expect(adapter.track(failure).accepted).toBe(true);
    await tick();
    expect(h.session).toHaveBeenCalledTimes(2);
    expect(h.transport.events).toEqual([
      {
        name: "validation_operation_result",
        properties: { outcome: "success", tool_family: "document", duration_bucket: "100ms-to-1s" },
        cohort: "validation",
        occurredAt: "2026-10-11T00:00:00.000Z",
      },
      {
        name: "validation_operation_result",
        properties: { outcome: "error", tool_family: "document", error_code: "invalid-input" },
        cohort: "validation",
        occurredAt: "2026-10-11T00:00:00.000Z",
      },
    ]);
    expect(JSON.stringify(h.transport.events)).not.toMatch(/person|pdf-rotate|filename|subject_id|fingerprint|file_hash/u);
    const report = deriveExperimentReport(h.transport.events, { now: "2026-10-18T00:00:00.000Z" });
    expect(report.cohortSize).toBe(0);
    expect(report.metrics.workbenchReturn7d.measurable).toBe(false);
    expect(report.metrics.workbenchReturn30d.measurable).toBe(false);
  });

  it("rejects unauthenticated sessions, malformed legacy events and non-outcome event types", async () => {
    const h = testHarness();
    h.session.mockResolvedValue(false);
    saveValidationTelemetryConsent(h.storage, true);
    const adapter = createPrivacySafeOutcomeAdapter(h.options);
    expect(adapter.track(success).accepted).toBe(true);
    expect(adapter.track({ ...success, properties: { ...success.properties, filename: "secret.pdf" } }).accepted).toBe(false);
    expect(adapter.track({ name: "search_zero_result", properties: { intent_code: "data" } }).accepted).toBe(false);
    await tick();
    expect(h.transport.events).toHaveLength(0);
  });

  it("revocation cancels queued events even if authentication was in flight, and remains disabled", async () => {
    const h = testHarness();
    saveValidationTelemetryConsent(h.storage, true);
    let completeAuth: (value: boolean) => void = () => {};
    h.session.mockImplementation(() => new Promise<boolean>((resolve) => { completeAuth = resolve; }));
    const adapter = createPrivacySafeOutcomeAdapter(h.options);
    expect(adapter.track(success).accepted).toBe(true);
    saveValidationTelemetryConsent(h.storage, false);
    completeAuth(true);
    await tick();
    expect(h.transport.events).toHaveLength(0);
    expect(adapter.track(failure).accepted).toBe(false);
    expect(h.session).toHaveBeenCalledTimes(1);
  });

  it("refuses transport on changed active state, denied storage, or authentication errors", async () => {
    const h = testHarness();
    let active = true;
    saveValidationTelemetryConsent(h.storage, true);
    h.session.mockRejectedValueOnce(new Error("no auth backend"));
    const adapter = createPrivacySafeOutcomeAdapter({ ...h.options, isActive: () => active });
    adapter.track(success);
    await tick();
    expect(h.transport.events).toHaveLength(0);
    active = false;
    adapter.track(success);
    await tick();
    expect(h.transport.events).toHaveLength(0);
  });
});
