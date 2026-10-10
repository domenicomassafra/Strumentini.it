import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultWorkProfile } from "../src/profile/work-profile";
import { createMemoryPersistence } from "../src/persistence/persistence";
import { createWorkbenchRepository } from "../src/workbench/repository";
import { createDefaultWorkbenchState, recordRecentTool } from "../src/workbench/state";

function initialState() {
  return createDefaultWorkbenchState(createDefaultWorkProfile({ locale: "it-IT", timezone: "Europe/Rome" }));
}

describe("ticket 330: successful tool use is only private metadata", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("window", new EventTarget());
    vi.stubGlobal("CustomEvent", class<T> extends Event {
      detail: T;
      constructor(type: string, init?: CustomEventInit<T>) {
        super(type);
        this.detail = init?.detail as T;
      }
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("stores only tool ID/time/count, preserves favorites, survives rehydration and caps repeat count", async () => {
    const persistence = createMemoryPersistence();
    const initial = initialState();
    const repository = createWorkbenchRepository(persistence, initial);
    const completed = recordRecentTool(initial, "utm-builder", "2026-10-10T22:00:00.000Z");
    await repository.save(completed);
    const afterReload = createWorkbenchRepository(persistence, initial);
    const rehydrated = await afterReload.load();
    expect(rehydrated.state.installedTools).toEqual(initial.installedTools);
    expect(rehydrated.state.recent).toEqual([{
      toolId: "utm-builder", lastUsedAt: "2026-10-10T22:00:00.000Z", useCount: 1,
    }]);
    expect(JSON.stringify(rehydrated.state.recent)).not.toMatch(/file|name|content|input|https|value/ui);
    expect(recordRecentTool(initial, "../../private.pdf")).toBe(initial);
    expect(recordRecentTool(initial, "file.pdf")).toBe(initial);
    const full = recordRecentTool({ ...initial, recent: [{
      toolId: "utm-builder", lastUsedAt: "2026-10-10T22:00:00.000Z", useCount: 1_000_000_000,
    }] }, "utm-builder");
    expect(full.recent[0]?.useCount).toBe(1_000_000_000);
  });

  it("serializes close successes and emits live updates when IndexedDB is denied", async () => {
    const { MEMBERSHIP_EVENT, noteToolUse, loadMembership } = await import("../src/workbench/membership");
    const events: unknown[] = [];
    window.addEventListener(MEMBERSHIP_EVENT, (event) => {
      events.push((event as CustomEvent).detail);
    });
    await Promise.all([
      noteToolUse("utm-builder"),
      noteToolUse("csv-cleaner"),
      noteToolUse("utm-builder"),
    ]);
    const current = await loadMembership();
    expect(current.persisted).toBe(false);
    expect(current.recent.map((entry) => [entry.toolId, entry.useCount])).toEqual([
      ["utm-builder", 2], ["csv-cleaner", 1],
    ]);
    expect(events).toHaveLength(3);
    expect(events.at(-1)).toMatchObject({ persisted: false, recent: current.recent });
    expect(JSON.stringify(current)).not.toContain(".csv");
  });

  it("ignores unsafe completion IDs before touching persistence", async () => {
    const { recordCompletedTool } = await import("../src/workbench/completed-tool");
    const { loadMembership } = await import("../src/workbench/membership");
    recordCompletedTool(undefined);
    recordCompletedTool("../../user/private.pdf");
    recordCompletedTool("unsafe file name");
    await Promise.resolve();
    expect((await loadMembership()).recent).toEqual([]);
    recordCompletedTool("utm-builder");
    await vi.waitFor(async () => {
      expect((await loadMembership()).recent.map((entry) => entry.toolId)).toEqual(["utm-builder"]);
    });
  });
});
