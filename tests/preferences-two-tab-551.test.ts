import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";

/**
 * #551, owner decision of 8 November 2026 14:49: the two-tab race must be
 * proved on BOTH the iPhone/mobile viewport and the desktop one.
 *
 * Each tab below is a separate module graph with its own IndexedDB connection,
 * which is exactly what two browser tabs are: a settings tab holding a snapshot
 * and a second tab writing favourites, recents and packs while that snapshot is
 * still open. Both viewports run the same assertion matrix, so a future
 * layout-specific writer cannot pass unnoticed. The real browser proof at the
 * two exact sizes is `scripts/acceptance-preferences-two-tabs-551.mjs`.
 */
const VIEWPORTS = [
  { name: "desktop 1280x800", width: 1280, height: 800, mobile: false, devicePixelRatio: 1 },
  { name: "iPhone 390x844", width: 390, height: 844, mobile: true, devicePixelRatio: 3 },
] as const;

type Viewport = (typeof VIEWPORTS)[number];

function stubViewport(viewport: Viewport): void {
  const mediaQuery = (query: string) => ({
    matches: viewport.mobile && /max-width|pointer: coarse|hover: none/u.test(query),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  });
  const window = Object.assign(new EventTarget(), {
    innerWidth: viewport.width,
    innerHeight: viewport.height,
    devicePixelRatio: viewport.devicePixelRatio,
    matchMedia: mediaQuery,
  });
  vi.stubGlobal("window", window);
}

/** Evaluates the settings and workbench modules again: a second browser tab. */
async function openTab() {
  vi.resetModules();
  const [store, membership, repository, persistence] = await Promise.all([
    import("../src/components/account/workbench-store"),
    import("../src/workbench/membership"),
    import("../src/workbench/repository"),
    import("../src/persistence/persistence"),
  ]);
  return { store, membership, repository, persistence };
}

const record = (tab: Awaited<ReturnType<typeof openTab>>, state: Parameters<typeof tab.repository.createWorkbenchRepository>[1]) =>
  tab.repository.createWorkbenchRepository(
    tab.persistence.createIndexedDbPersistence({ databaseName: "utility-workbench", storeName: "state" }),
    state,
  );

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("navigator", { language: "it-IT" });
});
afterEach(() => vi.unstubAllGlobals());

describe.each(VIEWPORTS)("#551 two tabs saving preferences ($name)", (viewport) => {
  beforeEach(() => stubViewport(viewport));

  it("keeps what the other tab wrote and the favourite it removed", async () => {
    const tabA = await openTab();
    await tabA.membership.setInstalled("kept-tool", true);
    // The Preferenze panel is open from here on: this is its snapshot.
    const panel = await tabA.store.loadWorkbenchState();
    expect(panel.state.installedTools).toEqual(["business-day", "kept-tool"]);

    // Second tab: real writes while the panel above stays open.
    const tabB = await openTab();
    await tabB.membership.setInstalled("late-favorite", true);
    await tabB.membership.noteToolUse("late-favorite");
    await tabB.membership.setInstalled("kept-tool", false);
    const { installPack } = await import("../src/workbench/state");
    const tabBRecord = record(tabB, (await tabB.store.loadWorkbenchState()).state);
    await tabBRecord.update((state) => installPack(state, "client-services", []));

    const saved = await tabA.store.savePreferences({ compactRows: true, profile: { currency: "USD" } });
    const after = await (await openTab()).store.loadWorkbenchState();

    expect(saved.persisted).toBe(true);
    expect(after.persisted).toBe(true);
    expect(after.state.installedTools).toEqual(["business-day", "late-favorite"]);
    expect(after.state.recent.map((entry) => entry.toolId)).toContain("late-favorite");
    expect(after.state.packs).toEqual(["client-services"]);
    expect(after.state.preferences.compactRows).toBe(true);
    expect(after.state.profile.currency).toBe("USD");
    expect(saved.state).toEqual(after.state);
  });

  it("keeps both updates when the two tabs save preferences at the same time", async () => {
    const tabA = await openTab();
    await tabA.store.loadWorkbenchState();
    const tabB = await openTab();

    const [fromA, fromB] = await Promise.all([
      tabA.store.savePreferences({ compactRows: true }),
      tabB.store.savePreferences({ profile: { currency: "USD", timezone: "Europe/Rome" } }),
    ]);
    const after = await (await openTab()).store.loadWorkbenchState();

    expect(fromA.persisted).toBe(true);
    expect(fromB.persisted).toBe(true);
    expect(after.state.preferences.compactRows).toBe(true);
    expect(after.state.profile.currency).toBe("USD");
    expect(after.state.profile.timezone).toBe("Europe/Rome");
  });
});
