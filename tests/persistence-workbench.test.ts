import { describe, expect, it } from "vitest";
import {
  createMemoryPersistence,
  type PersistenceAdapter,
} from "../src/persistence/persistence";
import { createWorkbenchRepository } from "../src/workbench/repository";
import { createDefaultWorkProfile } from "../src/profile/work-profile";
import { createDefaultWorkbenchState } from "../src/workbench/state";

function state() {
  return createDefaultWorkbenchState(
    createDefaultWorkProfile({ locale: "it-IT", timezone: "Europe/Rome" }),
  );
}

describe("in-memory persistence adapter", () => {
  it("supports get/put/delete without leaking stored references", async () => {
    const store = createMemoryPersistence();
    const value = { installedTools: ["business-day"] };
    await store.put("workbench/v1", value);

    const loaded = await store.get<typeof value>("workbench/v1");
    expect(loaded).toEqual(value);
    loaded?.installedTools.push("mutated-copy");
    expect(await store.get("workbench/v1")).toEqual(value);

    await store.delete("workbench/v1");
    expect(await store.get("workbench/v1")).toBeUndefined();
  });
});

describe("Workbench repository persistence behavior", () => {
  it("serializes rapid writes so the latest state wins", async () => {
    const writes: string[][] = [];
    const delayed: PersistenceAdapter = {
      get: async () => undefined,
      put: async (_key, value) => {
        const snapshot = value as { installedTools: string[] };
        await new Promise((resolve) =>
          setTimeout(resolve, snapshot.installedTools.length === 2 ? 20 : 0),
        );
        writes.push([...snapshot.installedTools]);
      },
      delete: async () => undefined,
    };
    const repository = createWorkbenchRepository(delayed, state());
    const first = repository.save({ ...state(), installedTools: ["business-day", "second"] });
    const second = repository.save({
      ...state(),
      installedTools: ["business-day", "second", "third"],
    });
    await Promise.all([first, second]);
    expect(writes).toEqual([
      ["business-day", "second"],
      ["business-day", "second", "third"],
    ]);
  });

  it("keeps current session state usable when durable storage rejects writes", async () => {
    const oldState = state();
    const denied: PersistenceAdapter = {
      get: async <T>() => structuredClone(oldState) as T,
      put: async () => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      },
      delete: async () => {
        throw new DOMException("Storage denied", "SecurityError");
      },
    };
    const repository = createWorkbenchRepository(denied, state());
    const next = { ...state(), installedTools: ["business-day", "future-tool"] };

    const save = await repository.save(next);
    expect(save.persisted).toBe(false);
    expect(save.warning).toMatch(/session/u);
    expect((await repository.load()).state.installedTools).toEqual([
      "business-day",
      "future-tool",
    ]);
  });
});
