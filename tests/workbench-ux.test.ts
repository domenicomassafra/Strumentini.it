import { describe, expect, it } from "vitest";
import type { ToolSummary } from "../src/catalog/manifest";
import { createDefaultWorkProfile } from "../src/profile/work-profile";
import { createDefaultWorkbenchState } from "../src/workbench/state";
import { formatRecentActivity, getWorkbenchSuggestions } from "../src/components/workbench/ux";

function tool(id: string, overrides: Partial<ToolSummary> = {}): ToolSummary {
  return {
    id,
    route: `/tools/${id}`,
    name: id,
    summary: `${id} task`,
    aliases: [],
    jobs: [],
    category: "text",
    inputTypes: ["text"],
    engine: "fixture",
    runtime: { location: "LOCAL", network: "forbidden" },
    profileFields: [],
    gold: { maintenanceClass: "E", oracleEntryId: id, fixtureFamilies: [] },
    ...overrides,
  };
}

describe("Workbench task-first UX seam", () => {
  it("formats Recent as relative tool activity and handles invalid timestamps", () => {
    const now = new Date("2026-09-24T12:00:00.000Z");
    expect(formatRecentActivity("2026-09-24T11:00:00.000Z", now)).toBe("1 hour ago");
    expect(formatRecentActivity("not-a-date", now)).toBe("time unavailable");
  });

  it("returns a capped deterministic set with visible reasons", () => {
    const state = {
      ...createDefaultWorkbenchState(createDefaultWorkProfile({ locale: "en-US", timezone: "UTC" })),
      installedTools: ["installed"],
    };
    const tools = [
      tool("installed", { category: "date-time", inputTypes: ["date"] }),
      tool("first", { category: "date-time" }),
      tool("second", { category: "date-time" }),
      tool("third", { category: "date-time" }),
      tool("fourth", { category: "date-time" }),
    ];
    const result = getWorkbenchSuggestions(tools, state);

    expect(result).toHaveLength(3);
    expect(result.map(({ tool: suggestion }) => suggestion.id)).toEqual(["first", "second", "third"]);
    expect(result.every(({ reason }) => reason.startsWith("Shares "))).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/rawTask|startDate|endDate/u);
  });

  it("uses the exact shared input type in the visible reason", () => {
    const state = {
      ...createDefaultWorkbenchState(createDefaultWorkProfile({ locale: "en-US", timezone: "UTC" })),
      installedTools: ["installed"],
    };
    const installed = tool("installed", { inputTypes: ["date", "number"] });
    const candidate = tool("candidate", { inputTypes: ["number"], category: "other" });
    expect(getWorkbenchSuggestions([installed, candidate], state)[0]?.reason).toBe("Handles Number inputs like installed.");
  });
});
