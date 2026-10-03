import { describe, expect, it } from "vitest";
import type { ToolSummary } from "../src/catalog/manifest";
import { createRegistry } from "../src/runtime/registry";
import { createToolRuntime } from "../src/runtime/tool-runtime";
import type { ToolModule } from "../src/runtime/types";
import { businessDayManifest } from "../src/tools/business-day/manifest";
import businessDayModule from "../src/tools/business-day/module";

const summary = (({ implementation: _implementation, ...rest }) => rest)(businessDayManifest) as ToolSummary;

describe("registry and runtime seams", () => {
  it("does not load implementation for metadata reads and loads on run", async () => {
    let loads = 0;
    const registry = createRegistry([summary], {
      "business-day": async () => {
        loads += 1;
        return { default: businessDayModule as ToolModule };
      },
    });
    expect(registry.list()).toHaveLength(1);
    expect(registry.get("business-day")?.name).toBe("Business Day Calculator");
    expect(loads).toBe(0);

    const runtime = createToolRuntime(registry);
    const run = await runtime.run(
      "business-day",
      { mode: "add", startDate: "2026-09-18", amount: 1 },
      { profile: { workweek: ["MON", "TUE", "WED", "THU", "FRI"], locale: "it-IT" } },
    );
    expect(loads).toBe(1);
    expect(run.ok).toBe(true);
    if (run.ok) {
      expect(run.value).toMatchObject({ mode: "add", resultDate: "2026-09-21" });
      expect(run.defaults).toContainEqual({
        field: "workweek",
        value: ["MON", "TUE", "WED", "THU", "FRI"],
        provenance: "profile",
      });
    }
  });

  it("normalizes unknown tools and invalid input", async () => {
    const registry = createRegistry([summary], { "business-day": async () => ({ default: businessDayModule }) });
    const runtime = createToolRuntime(registry);
    expect(runtime.preflight("missing")).toMatchObject({ ok: false, code: "NOT_FOUND" });
    const invalid = await runtime.run("business-day", { mode: "add" }, { profile: { workweek: ["MON"] } });
    expect(invalid).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });

  it("reuses a loaded tool module and retries after a failed load", async () => {
    let loads = 0;
    let fail = true;
    const registry = createRegistry([summary], {
      "business-day": async () => {
        loads += 1;
        if (fail) throw new Error("temporary load failure");
        return { default: businessDayModule };
      },
    });

    await expect(registry.load("business-day")).rejects.toThrow("temporary load failure");
    fail = false;
    const first = await registry.load("business-day");
    const second = await registry.load("business-day");
    expect(first).toBe(second);
    expect(loads).toBe(2);
  });
});
