import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The data-loss case of #551: the Preferenze panel saves from a snapshot taken
 * when the page opened, while the workbench keeps writing favorites and recent
 * activity. Saving the snapshot back as the whole record erases everything a
 * newer write put there. This harness stands in for the durable IndexedDB store
 * and lets one competing tab commit exactly between the read and the write, so
 * the race is deterministic instead of timing-dependent.
 */
const shared = vi.hoisted(() => {
  const values = new Map<string, unknown>();
  const clone = <T>(value: T): T => (value === undefined ? value : structuredClone(value));
  let competing: (() => Promise<void>) | undefined;

  async function runCompeting(): Promise<void> {
    const pending = competing;
    competing = undefined;
    if (pending !== undefined) await pending();
  }

  const adapter = {
    async get<T>(key: string): Promise<T | undefined> {
      // The snapshot is taken first: it represents the record as this tab sees it.
      const snapshot = clone(values.get(key)) as T | undefined;
      await runCompeting();
      return snapshot;
    },
    async put<T>(key: string, value: T): Promise<void> {
      values.set(key, clone(value));
    },
    async update<T>(key: string, mutate: (current: T | undefined) => T): Promise<T> {
      // The competing tab commits first, then this record is read and written
      // inside the same atomic step: the fresh values are what the merge sees.
      await runCompeting();
      const next = mutate(clone(values.get(key)) as T | undefined);
      values.set(key, clone(next));
      return clone(next);
    },
    async delete(key: string): Promise<void> {
      values.delete(key);
    },
    async keys(prefix: string): Promise<string[]> {
      return [...values.keys()].filter((key) => key.startsWith(prefix));
    },
  };

  return {
    adapter,
    /** The next read/write of the settings record races with this tab. */
    writeFromOtherTab(next: () => Promise<void>): void {
      competing = next;
    },
    reset(): void {
      values.clear();
      competing = undefined;
    },
  };
});

vi.mock("../src/persistence/persistence", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/persistence/persistence")>();
  return { ...actual, createIndexedDbPersistence: () => shared.adapter };
});

beforeEach(() => {
  vi.resetModules();
  shared.reset();
  vi.stubGlobal("navigator", { language: "it-IT" });
  vi.stubGlobal("window", new EventTarget());
});
afterEach(() => vi.unstubAllGlobals());

describe("#551 preferences must not overwrite a newer workbench record", () => {
  it("keeps favorites and recent activity a newer snapshot added before the save", async () => {
    const { loadWorkbenchState, savePreferences } = await import("../src/components/account/workbench-store");
    const membership = await import("../src/workbench/membership");

    const openedPanel = await loadWorkbenchState();
    expect(openedPanel.state.installedTools).toEqual(["business-day"]);

    shared.writeFromOtherTab(async () => {
      await membership.setInstalled("late-favorite", true);
      await membership.noteToolUse("late-favorite");
    });

    const saved = await savePreferences({ compactRows: true, profile: { currency: "USD" } });
    const after = await loadWorkbenchState();

    expect(saved.persisted).toBe(true);
    expect(after.state.installedTools).toContain("late-favorite");
    expect(after.state.recent.map((entry) => entry.toolId)).toContain("late-favorite");
    expect(after.state.preferences.compactRows).toBe(true);
    expect(after.state.profile.currency).toBe("USD");
    expect(saved.state).toEqual(after.state);
  });

  it("does not resurrect a favorite another tab removed before the save", async () => {
    const { savePreferences } = await import("../src/components/account/workbench-store");
    const membership = await import("../src/workbench/membership");

    await membership.setInstalled("kept-tool", true);

    shared.writeFromOtherTab(async () => {
      await membership.setInstalled("kept-tool", false);
    });

    const saved = await savePreferences({ compactRows: true });
    expect(saved.state.installedTools).not.toContain("kept-tool");
    expect(saved.state.preferences.compactRows).toBe(true);
  });

  it("reports a session-only save when the store has no atomic update", async () => {
    const { savePreferences } = await import("../src/components/account/workbench-store");
    const store = shared.adapter;
    // A store that can only get/put cannot merge: the change must not be
    // announced as durable while the previous record stays on the device.
    const originalUpdate = store.update;
    (store as { update?: unknown }).update = undefined;
    try {
      const saved = await savePreferences({ compactRows: true });
      expect(saved.state.preferences.compactRows).toBe(true);
      expect(saved.persisted).toBe(false);
    } finally {
      store.update = originalUpdate;
    }
  });
});
