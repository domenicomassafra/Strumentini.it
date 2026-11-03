import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("navigator", { language: "it-IT" });
  vi.stubGlobal("window", new EventTarget());
});
afterEach(() => vi.unstubAllGlobals());

describe("#551 preferences saved after a newer Workbench snapshot", () => {
  it("retains favorites and recent activity added after the settings panel loaded", async () => {
    const { loadWorkbenchState, savePreferences } = await import("../src/components/account/workbench-store");
    const { setInstalled, noteToolUse, loadMembership } = await import("../src/workbench/membership");
    const previous = await loadWorkbenchState();

    await setInstalled("new-tool", true);
    await noteToolUse("new-tool");
    const afterClick = await loadMembership();
    expect(afterClick.installed).toContain("new-tool");
    expect(afterClick.recent[0]?.toolId).toBe("new-tool");

    const { createWorkbenchRepository } = await import("../src/workbench/repository");
    const { createIndexedDbPersistence } = await import("../src/persistence/persistence");
    const current = await loadWorkbenchState();
    const other = createWorkbenchRepository(createIndexedDbPersistence(), current.state);
    await other.save({ ...current.state, packs: ["client-services"] });

    const saved = await savePreferences({ compactRows: true, profile: { currency: "USD" } });
    const after = await loadWorkbenchState();
    expect(saved.persisted).toBe(true);
    expect(after.persisted).toBe(true);
    expect(after.state.installedTools).toEqual(afterClick.installed);
    expect(after.state.recent).toEqual(afterClick.recent);
    expect(previous.state.packs).toEqual([]);
    expect(after.state.packs).toEqual(["client-services"]);
    expect(saved.state).toEqual(after.state);
    expect(after.state.preferences.compactRows).toBe(true);
    expect(after.state.profile.currency).toBe("USD");
  });

  it("serializes overlapping preference changes without dropping either update", async () => {
    const { savePreferences, loadWorkbenchState } = await import("../src/components/account/workbench-store");
    const [first, second] = await Promise.all([
      savePreferences({ profile: { currency: "USD" } }),
      savePreferences({ compactRows: true, profile: { timezone: "Europe/Rome" } }),
    ]);
    const current = await loadWorkbenchState();
    expect(first.persisted).toBe(true);
    expect(second.persisted).toBe(true);
    expect(current.state.profile.currency).toBe("USD");
    expect(current.state.profile.timezone).toBe("Europe/Rome");
    expect(current.state.preferences.compactRows).toBe(true);
    expect(second.state).toEqual(current.state);
  });

  it("keeps a session-only update and reports persisted=false when storage is denied", async () => {
    vi.stubGlobal("indexedDB", { open: () => { throw new DOMException("denied", "SecurityError"); } });
    const { savePreferences, loadWorkbenchState } = await import("../src/components/account/workbench-store");
    const saved = await savePreferences({ compactRows: true });
    expect(saved.persisted).toBe(false);
    expect(saved.state.preferences.compactRows).toBe(true);
    const loaded = await loadWorkbenchState();
    expect(loaded.state.preferences.compactRows).toBe(true);
    expect(loaded.persisted).toBe(false);
  });
});
