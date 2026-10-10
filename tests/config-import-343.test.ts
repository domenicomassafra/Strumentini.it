import { describe, expect, it, vi } from "vitest";
import { createDefaultWorkProfile } from "../src/profile/work-profile";
import { createDefaultWorkbenchState } from "../src/workbench/state";
import {
  CONFIG_343_MAX_BYTES,
  applyDeviceConfig343,
  commitDeviceConfig343,
  exportDeviceConfig343,
  previewDeviceConfig343,
} from "../src/workbench/config-import-343";

const known = new Set(["business-day", "csv-cleaner", "pdf-merge"]);

function state() {
  return {
    ...createDefaultWorkbenchState(createDefaultWorkProfile({ locale: "it-IT", timezone: "Europe/Rome" })),
    installedTools: ["business-day", "csv-cleaner"],
    packs: ["work-starter"],
    preferences: { compactRows: true },
    recent: [
      { toolId: "csv-cleaner", lastUsedAt: "2026-10-10T10:20:33.000Z", useCount: 6 },
      { toolId: "business-day", lastUsedAt: "2026-10-09T07:00:00.000Z", useCount: 2 },
    ],
  } as const;
}

function exported() { return exportDeviceConfig343(state() as unknown as ReturnType<typeof createDefaultWorkbenchState>, known); }

function corrupted(change: (value: Record<string, unknown>) => void): string {
  const object = JSON.parse(exported()) as Record<string, unknown>;
  change(object);
  return JSON.stringify(object);
}

describe("#343 versioned configuration import/export, device-only", () => {
  it("roundtrips installed IDs, packs, profile, preferences, and verified recent metadata, without arbitrary state content", () => {
    const current = createDefaultWorkbenchState(createDefaultWorkProfile({ locale: "en-US", timezone: "UTC" }));
    const serialized = exported();
    const preview = previewDeviceConfig343(serialized, current, known);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.summary).toMatchObject({ added: 1, removed: 0, recent: 2, profileChanged: true, packsChanged: true });
    const restored = applyDeviceConfig343(current, preview.config);
    expect(restored.installedTools).toEqual(state().installedTools);
    expect(restored.profile).toEqual(state().profile);
    expect(restored.preferences).toEqual(state().preferences);
    expect(restored.recent).toEqual(state().recent);
    expect(exportDeviceConfig343(restored, known)).toEqual(serialized);
    expect(JSON.parse(serialized)).toEqual({
      kind: "utility-workbench-config", version: 2,
      installedTools: state().installedTools, packs: state().packs,
      layout: { mode: "list" }, profile: state().profile,
      preferences: state().preferences, recent: state().recent,
    });
    expect(serialized).not.toMatch(/fileName|blob|fileContent|password|email|secret|lastValue|accessToken/u);
  });

  it("refuses malicious keys throughout object, including constructor/prototype and concealed files", () => {
    const base = state() as unknown as ReturnType<typeof createDefaultWorkbenchState>;
    const payloads = [
      '{"kind":"utility-workbench-config","version":2,"__proto__":{"polluted":true}}',
      corrupted((item) => { Object.defineProperty(item, "__proto__", { value: { polluted: true }, enumerable: true }); }),
      corrupted((item) => { item["constructor"] = { prototype: { polluted: true } }; }),
      corrupted((item) => { (item.profile as Record<string, unknown>)["constructor"] = { prototype: { polluted: true } }; }),
      corrupted((item) => { (item.recent as unknown[])[0] = { toolId: "csv-cleaner", lastUsedAt: "2026-10-10T10:20:33.000Z", useCount: 6, content: "sensitive" }; }),
      corrupted((item) => { item.fileContents = "document"; }),
    ];
    for (const text of payloads) expect(previewDeviceConfig343(text, base, known).ok).toBe(false);
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
  });

  it("rejects missing, duplicate, unknown or malformed tool/recent/pack IDs without rewriting current state", () => {
    const base = state() as unknown as ReturnType<typeof createDefaultWorkbenchState>;
    const cases = [
      corrupted((item) => { item.installedTools = ["csv-cleaner", "csv-cleaner"]; }),
      corrupted((item) => { item.installedTools = ["unknown-tool"]; }),
      corrupted((item) => { item.installedTools = ["../../etc/passwd"]; }),
      corrupted((item) => { item.packs = ["work-starter", "work-starter"]; }),
      corrupted((item) => { item.packs = ["pack name with spaces"]; }),
      corrupted((item) => { (item.recent as unknown[]).push((item.recent as unknown[])[0]); }),
      corrupted((item) => { (item.recent as Record<string, unknown>[])[0]!.toolId = "not-in-catalog"; }),
      corrupted((item) => { (item.recent as Record<string, unknown>[])[0]!.lastUsedAt = "yesterday"; }),
      corrupted((item) => { (item.recent as Record<string, unknown>[])[0]!.useCount = -1; }),
      corrupted((item) => { (item.recent as Record<string, unknown>[])[0]!.useCount = Number.MAX_SAFE_INTEGER + 1; }),
      corrupted((item) => { (item.profile as Record<string, unknown>).workweek = ["MON", "MON"]; }),
      corrupted((item) => { (item.profile as Record<string, unknown>).currency = "AAA\nBBB"; }),
      corrupted((item) => { (item.preferences as Record<string, unknown>).compactRows = "true"; }),
    ];
    const snapshot = JSON.stringify(base);
    for (const text of cases) expect(previewDeviceConfig343(text, base, known).ok, text).toBe(false);
    expect(JSON.stringify(base)).toEqual(snapshot);
  });

  it("refuses old schema with distinct helpful error and future versions fail closed", () => {
    const base = state() as unknown as ReturnType<typeof createDefaultWorkbenchState>;
    const old = corrupted((item) => { item.version = 1; delete item.recent; });
    const oldResult = previewDeviceConfig343(old, base, known);
    expect(oldResult.ok).toBe(false);
    if (!oldResult.ok) expect(oldResult.error).toMatch(/vecchio schema v1/u);
    expect(previewDeviceConfig343(corrupted((item) => { item.version = 99; }), base, known).ok).toBe(false);
    expect(previewDeviceConfig343(corrupted((item) => { item.kind = "other"; }), base, known).ok).toBe(false);
  });

  it("refuses invalid/empty/oversized input before any state changes", () => {
    const base = state() as unknown as ReturnType<typeof createDefaultWorkbenchState>;
    const snapshot = JSON.stringify(base);
    for (const text of ["", "not json", "{}", "\u0000", "{".repeat(CONFIG_343_MAX_BYTES + 1)]) {
      expect(previewDeviceConfig343(text, base, known).ok).toBe(false);
    }
    expect(JSON.stringify(base)).toBe(snapshot);
  });

  it("never merges or shares user data with imported configuration", () => {
    const before = state() as unknown as ReturnType<typeof createDefaultWorkbenchState>;
    const parsed = previewDeviceConfig343(exported(), before, known);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const next = applyDeviceConfig343(before, parsed.config);
    next.recent[0]!.useCount = 25;
    next.installedTools.pop();
    expect(before.recent[0]!.useCount).toBe(6);
    expect(parsed.config.recent[0]!.useCount).toBe(6);
    expect(before.installedTools).toEqual(["business-day", "csv-cleaner"]);
  });

  it("fails closed when IndexedDB permission is denied; a caller cannot mutate validated preview before commit", async () => {
    const before = state() as unknown as ReturnType<typeof createDefaultWorkbenchState>;
    const parsed = previewDeviceConfig343(exported(), before, known);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const snapshot = JSON.stringify(before);
    vi.stubGlobal("indexedDB", { open: () => { throw new DOMException("Storage denied", "SecurityError"); } });
    try {
      expect(await commitDeviceConfig343(before, parsed.config, known)).toBe(false);
      parsed.config.installedTools.push("outside-catalog");
      expect(await commitDeviceConfig343(before, parsed.config, known)).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});
