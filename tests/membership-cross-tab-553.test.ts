import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createIndexedDbPersistence, createMemoryPersistence } from "../src/persistence/persistence";
import { createWorkbenchRepository } from "../src/workbench/repository";
import { createDefaultWorkProfile } from "../src/profile/work-profile";
import { createDefaultWorkbenchState, installTool } from "../src/workbench/state";

const defaultState = () => createDefaultWorkbenchState(createDefaultWorkProfile({ locale: "it-IT", timezone: "Europe/Rome" }));

describe("#553 separate browser tabs share one durable workbench", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal("window", new EventTarget());
    await createIndexedDbPersistence().delete("workbench/state:v1");
  });
  afterEach(() => vi.unstubAllGlobals());

  it("keeps two simultaneous favourites and their persisted success receipts", async () => {
    const a = await import("../src/workbench/membership");
    vi.resetModules();
    const b = await import("../src/workbench/membership");
    const [first, second] = await Promise.all([
      a.setInstalled("alpha-tool", true),
      b.setInstalled("beta-tool", true),
    ]);
    expect(first.persisted).toBe(true);
    expect(second.persisted).toBe(true);
    expect((await a.loadMembership()).installed).toEqual(["business-day", "alpha-tool", "beta-tool"]);
  });

  it("does not erase recent use in another tab or duplicate its count", async () => {
    const a = await import("../src/workbench/membership");
    vi.resetModules();
    const b = await import("../src/workbench/membership");
    await Promise.all([a.noteToolUse("alpha-tool"), b.noteToolUse("alpha-tool"), b.setInstalled("beta-tool", true)]);
    const after = await a.loadMembership();
    expect(after.installed).toContain("beta-tool");
    expect(after.recent).toMatchObject([{ toolId: "alpha-tool", useCount: 2 }]);
  });

  it("a reset and a subsequent change use the same authoritative record", async () => {
    const a = await import("../src/workbench/membership");
    const repo = createWorkbenchRepository(createIndexedDbPersistence(), defaultState());
    await a.setInstalled("old-tool", true);
    expect((await repo.clear()).persisted).toBe(true);
    expect((await a.setInstalled("new-tool", true)).persisted).toBe(true);
    expect((await a.loadMembership()).installed).toEqual(["business-day", "new-tool"]);
  });

  it("does not report durable success when atomic writes are unavailable", async () => {
    const store = createMemoryPersistence();
    const key = "workbench/state:v1";
    await store.put(key, defaultState());
    const unavailable = { get: store.get, put: store.put, delete: store.delete };
    const repo = createWorkbenchRepository(unavailable, defaultState());
    const result = await repo.update((state) => installTool(state, "session-tool"));
    expect(result.persisted).toBe(false);
    expect(result.warning).toMatch(/session/u);
    expect(result.state.installedTools).toContain("session-tool");
    expect((await store.get<typeof result.state>(key))?.installedTools).toEqual(["business-day"]);
  });
});
