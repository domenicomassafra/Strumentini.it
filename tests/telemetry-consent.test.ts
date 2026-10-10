import { describe, expect, it, vi } from "vitest";
import {
  hasValidationTelemetryConsent,
  saveValidationTelemetryConsent,
  TELEMETRY_CONSENT_STORAGE_KEY,
} from "../src/telemetry/consent";
import { createAllowlistedTelemetryAdapter, createMemoryTelemetryTransport } from "../src/telemetry/adapter";

describe("#346 consent for validation telemetry", () => {
  it("fails closed on missing, malformed and inaccessible local storage", () => {
    expect(hasValidationTelemetryConsent(null)).toBe(false);
    expect(hasValidationTelemetryConsent({ getItem: () => null })).toBe(false);
    expect(hasValidationTelemetryConsent({ getItem: () => "true" })).toBe(false);
    expect(hasValidationTelemetryConsent({ getItem: () => { throw new Error("denied"); } })).toBe(false);
    expect(saveValidationTelemetryConsent(null, true)).toBe(false);
    expect(saveValidationTelemetryConsent({ getItem: () => null, setItem: () => { throw new Error("quota"); } }, true)).toBe(false);
  });

  it("activates only for a persisted explicit grant and revokes without retaining a grant", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    expect(hasValidationTelemetryConsent(storage)).toBe(false);
    expect(saveValidationTelemetryConsent(storage, true)).toBe(true);
    expect(values.get(TELEMETRY_CONSENT_STORAGE_KEY)).toBe("granted");
    expect(hasValidationTelemetryConsent(storage)).toBe(true);
    expect(saveValidationTelemetryConsent(storage, false)).toBe(true);
    expect(values.get(TELEMETRY_CONSENT_STORAGE_KEY)).toBe("denied");
    expect(hasValidationTelemetryConsent(storage)).toBe(false);
  });

  it("cannot emit a valid event until the recorded grant exists, then stops on revocation", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    const transport = createMemoryTelemetryTransport();
    const sample = { name: "tool_completed", properties: { tool_id: "business-day", duration_bucket: "under-100ms" } };
    const adapter = () => createAllowlistedTelemetryAdapter({
      enabled: hasValidationTelemetryConsent(storage),
      disclosed: true,
      cohort: "validation",
      transport,
      now: () => "2026-10-11T00:00:00.000Z",
    });
    expect(adapter().track(sample).status).toBe("disabled");
    expect(transport.events).toHaveLength(0);
    saveValidationTelemetryConsent(storage, true);
    expect(adapter().track(sample).status).toBe("accepted");
    expect(transport.events).toHaveLength(1);
    saveValidationTelemetryConsent(storage, false);
    expect(adapter().track(sample).status).toBe("disabled");
    expect(transport.events).toHaveLength(1);
  });

  it("does not touch any remote transport while disabled", () => {
    const send = vi.fn();
    const adapter = createAllowlistedTelemetryAdapter({
      enabled: false,
      disclosed: true,
      cohort: "validation",
      transport: { send },
    });
    adapter.track({ name: "tool_opened", properties: { tool_id: "csv-cleaner", entry_source: "search" } });
    expect(send).not.toHaveBeenCalled();
  });
});
