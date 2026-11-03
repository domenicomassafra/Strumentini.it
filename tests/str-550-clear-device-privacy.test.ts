import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("#550 local data erasure", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("indexedDB", new IDBFactory());
    vi.stubGlobal("navigator", { language: "it-IT" });
    vi.stubGlobal("window", Object.assign(new EventTarget(), {
      localStorage: { length: 0, key: () => null, removeItem: () => undefined },
      sessionStorage: { length: 0, key: () => null, removeItem: () => undefined },
    }));
    vi.stubGlobal("CustomEvent", class<T> extends Event {
      readonly detail: T;
      constructor(type: string, init?: CustomEventInit<T>) {
        super(type);
        this.detail = init?.detail as T;
      }
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("erases account identity, local choices, and opt-in original files from every owned store", async () => {
    const { createIndexedDbPersistence } = await import("../src/persistence/persistence");
    const { clearDeviceData } = await import("../src/components/account/workbench-store");
    const main = createIndexedDbPersistence({ databaseName: "utility-workbench", storeName: "state" });
    const editor = createIndexedDbPersistence({ databaseName: "strumentini-editor-projects-412", storeName: "state" });
    const image = createIndexedDbPersistence({ databaseName: "strumentini-image-projects-385", storeName: "projects" });
    await main.put("membership/favorites-sync:v1", {
      version: 1, account: "private-owner-123", revision: 8,
      tools: ["tax-calculator"], acknowledged: [{ toolId: "tax-calculator", installed: true, revision: 8 }],
    });
    await main.put("onboarding/answers:v1", { selectedWork: "confidential-profile" });
    await main.put("campaign-name/preset:v1", { client: "confidential-campaign" });
    await editor.put("editor-project/412/v2/private", { kind: "pdf", original: new Uint8Array([37, 80, 68, 70]) });
    await image.put("private-image", { original: new Blob(["synthetic-original-image"]) });

    expect((await clearDeviceData()).persisted).toBe(true);
    expect(await main.keys?.("")).toEqual([]);
    expect(await editor.keys?.("")).toEqual([]);
    expect(await image.keys?.("")).toEqual([]);
  });

  it("forgets the cached account baseline after a successful reset in the same tab", async () => {
    const { clearDeviceData } = await import("../src/components/account/workbench-store");
    const { membershipBaselineOwner, syncMembershipWithAccount } = await import("../src/workbench/membership");
    vi.stubGlobal("fetch", async () => Response.json({
      version: 1, account: "private-owner-123", revision: 0, entries: [], tools: [],
    }));
    expect(await syncMembershipWithAccount()).toBeDefined();
    expect(await membershipBaselineOwner()).toBe("private-owner-123");

    expect((await clearDeviceData()).persisted).toBe(true);
    expect(await membershipBaselineOwner()).toBeUndefined();
  });

  it("cannot recreate erased account records from a sync acknowledgement that arrives late", async () => {
    const { createIndexedDbPersistence } = await import("../src/persistence/persistence");
    const { clearDeviceData } = await import("../src/components/account/workbench-store");
    const { membershipBaselineOwner, setInstalled, syncMembershipWithAccount } =
      await import("../src/workbench/membership");
    let revision = 0;
    let entries: Array<{ toolId: string; installed: boolean; revision: number; operationId: string }> = [];
    let releasePost: (() => void) | undefined;
    const snapshot = () => ({
      version: 1, account: "private-owner-123", revision, entries,
      tools: entries.filter((entry) => entry.installed).map((entry) => entry.toolId),
    });
    vi.stubGlobal("fetch", async (_input: string, options?: RequestInit) => {
      if (options?.method !== "POST") return Response.json(snapshot());
      const body = JSON.parse(String(options.body)) as { toolId: string; installed: boolean; operationId: string };
      return new Promise<Response>((resolve) => {
        releasePost = () => {
          entries = [{ ...body, revision: ++revision }];
          resolve(Response.json({ ...snapshot(), applied: true, appliedRevision: revision }));
        };
      });
    });
    expect(await syncMembershipWithAccount()).toBeDefined();
    await setInstalled("new-tool", true);
    const late = syncMembershipWithAccount();
    await vi.waitFor(() => expect(releasePost).toBeTypeOf("function"));

    expect((await clearDeviceData()).persisted).toBe(true);
    releasePost!();
    expect(await late).toBeUndefined();
    const storage = createIndexedDbPersistence({ databaseName: "utility-workbench", storeName: "state" });
    expect(await storage.keys?.("")).toEqual([]);
    expect(await membershipBaselineOwner()).toBeUndefined();
  });

  it("erases the legacy clock key without removing keys owned by other applications", async () => {
    const stored = new Map([
      ["strumentini.resilient-clock.v1", "private-clock-state"],
      ["unrelated.third-party", "retain"],
    ]);
    vi.stubGlobal("window", Object.assign(new EventTarget(), {
      localStorage: {
        get length() { return stored.size; },
        key: (index: number) => [...stored.keys()][index] ?? null,
        removeItem: (key: string) => { stored.delete(key); },
      },
      sessionStorage: { length: 0, key: () => null, removeItem: () => undefined },
    }));
    const { clearDeviceData } = await import("../src/components/account/workbench-store");

    expect((await clearDeviceData()).persisted).toBe(true);
    expect(stored.has("strumentini.resilient-clock.v1")).toBe(false);
    expect(stored.get("unrelated.third-party")).toBe("retain");
  });
});
