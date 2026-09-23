import { describe, expect, it } from "vitest";
import { createDefaultWorkProfile } from "../src/profile/work-profile";
import {
  applyImportedConfig,
  exportWorkbenchConfig,
  previewWorkbenchImport,
} from "../src/workbench/portability";
import {
  clearRecent,
  createDefaultWorkbenchState,
  installTool,
  moveTool,
  recordRecentTool,
  removeTool,
} from "../src/workbench/state";

function state() {
  return createDefaultWorkbenchState(
    createDefaultWorkProfile({ locale: "en-US", timezone: "UTC" }),
  );
}

describe("Workbench state seam", () => {
  it("installs, removes, and manually reorders tools", () => {
    const initial = state();
    const withSecond = installTool(initial, "second-tool");
    expect(withSecond.installedTools).toEqual(["business-day", "second-tool"]);
    expect(moveTool(withSecond, "second-tool", -1).installedTools).toEqual([
      "second-tool",
      "business-day",
    ]);
    expect(removeTool(withSecond, "business-day").installedTools).toEqual(["second-tool"]);
    expect(initial.installedTools).toEqual(["business-day"]);
  });

  it("stores only tool-level Recent metadata and can clear it", () => {
    const recent = recordRecentTool(state(), "business-day", "2026-09-23T18:00:00.000Z");
    expect(recent.recent).toEqual([
      { toolId: "business-day", lastUsedAt: "2026-09-23T18:00:00.000Z", useCount: 1 },
    ]);
    expect(JSON.stringify(recent.recent)).not.toMatch(/input|output|url|file|startDate/ui);
    expect(clearRecent(recent).recent).toEqual([]);
  });
});

describe("portable Workbench configuration seam", () => {
  it("exports versioned configuration without Recent or task content", () => {
    const current = recordRecentTool(state(), "business-day", "2026-09-23T18:00:00.000Z");
    const artifact = exportWorkbenchConfig(current);
    expect(artifact).toContain('"version": 1');
    expect(artifact).toContain('"installedTools"');
    expect(artifact).toContain('"packs"');
    expect(artifact).toContain('"profile"');
    expect(artifact).not.toContain('"recent"');
    expect(artifact).not.toContain("2026-09-23T18:00:00.000Z");
  });

  it("previews material changes and applies a validated import atomically", () => {
    const current = state();
    const preview = previewWorkbenchImport(
      JSON.stringify({
        kind: "utility-workbench-config",
        version: 1,
        installedTools: ["second-tool", "business-day"],
        packs: ["client-work"],
        layout: { mode: "list" },
        profile: {
          locale: "it-IT",
          timezone: "Europe/Rome",
          currency: "EUR",
          dateFormat: "system",
          numberFormat: "system",
          workweek: ["MON", "TUE", "WED", "THU", "FRI"],
          preferredUnits: "metric",
        },
        preferences: { compactRows: true },
      }),
      current,
    );

    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.summary).toMatchObject({
      addedTools: ["second-tool"],
      profileChanged: true,
      packsChanged: true,
    });
    const next = applyImportedConfig(current, preview.config);
    expect(next.installedTools).toEqual(["second-tool", "business-day"]);
    expect(next.profile.currency).toBe("EUR");
    expect(current.profile.currency).toBe("USD");
  });

  it("rejects malformed/unsupported imports without mutating current state", () => {
    const current = state();
    const before = structuredClone(current);
    expect(previewWorkbenchImport("not json", current).ok).toBe(false);
    expect(
      previewWorkbenchImport(
        JSON.stringify({ kind: "utility-workbench-config", version: 99 }),
        current,
      ).ok,
    ).toBe(false);
    expect(
      previewWorkbenchImport(
        JSON.stringify({
          ...JSON.parse(exportWorkbenchConfig(current)),
          rawTaskInput: "must never be accepted into config",
        }),
        current,
      ).ok,
    ).toBe(false);
    expect(current).toEqual(before);
  });
});
