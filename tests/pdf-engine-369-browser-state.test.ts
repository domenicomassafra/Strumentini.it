import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { editorHydrated, invalidPdfRejected } from "../scripts/pdf-engine-369-browser-state.mjs";

describe("STR-369 compiled browser readiness", () => {
  it("waits for Astro hydration even when the server-rendered file input exists", () => {
    let serverRendered = true;
    let inputPresent = false;
    let insideIsland = true;
    const island = { hasAttribute: (attribute: string) => attribute === "ssr" && serverRendered };
    const document = {
      querySelector: () => inputPresent ? { closest: () => insideIsland ? island : null } : null,
    };
    const ready = () => runInNewContext(editorHydrated, { document });

    expect(ready()).toBe(false); // no form yet
    inputPresent = true;
    expect(ready()).toBe(false); // SSR form is visible, but events are not attached
    insideIsland = false;
    expect(ready()).toBe(false); // no known hydration owner
    insideIsland = true;
    serverRendered = false;
    expect(ready()).toBe(true); // the actual Astro hydration completion signal
  });

  it("accepts a malformed PDF rejection only with a nonempty editor error", () => {
    let alerts: { textContent: string }[] = [];
    const document = { querySelectorAll: () => alerts };
    const rejected = () => runInNewContext(invalidPdfRejected, { document });

    expect(rejected()).toBe(false);
    alerts = [{ textContent: "  " }];
    expect(rejected()).toBe(false); // an empty alert must never count as a rejection
    alerts = [{ textContent: "PDF non valido" }];
    expect(rejected()).toBe(true);
  });
});
