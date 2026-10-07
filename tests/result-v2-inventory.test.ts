import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { catalog } from "../src/generated/catalog";
import type { ToolSummary } from "../src/catalog/manifest";
import {
  projectResultV2Inventory,
  renderResultV2InventorySource,
  type ResultV2RendererSeam,
} from "../src/catalog/projections";
import { discoverResultV2RendererSeams } from "../scripts/tool-factory/result-v2-inventory";
import { assignResultV2MigrationOwners } from "../scripts/tool-factory/result-v2-migration-ledger";

const root = resolve(import.meta.dirname, "..");

async function currentSeams(): Promise<readonly ResultV2RendererSeam[]> {
  return discoverResultV2RendererSeams(root, catalog.map(({ id }) => id));
}

describe("Result v2 inventory projection", () => {
  it("matches all current catalog ids and records renderer seams from real source imports", async () => {
    const seams = await currentSeams();
    const inventory = projectResultV2Inventory(catalog, seams);
    expect(catalog.length).toBeGreaterThan(0);
    expect(inventory).toHaveLength(catalog.length);
    expect(inventory.map(({ toolId }) => toolId)).toEqual(catalog.map(({ id }) => id).toSorted((left, right) => left.localeCompare(right, "it-IT")));

    expect(inventory.find(({ toolId }) => toolId === "business-day")?.rendererSeam).toEqual({
      kind: "bespoke",
      component: "BusinessDayTool",
      source: "src/components/tools/BusinessDayTool.tsx",
    });
    expect(inventory.find(({ toolId }) => toolId === "capacity-planner")?.rendererSeam).toEqual({
      kind: "shared",
      component: "BusinessMathTool",
      source: "src/components/tools/business-math/BusinessMathTool.tsx",
    });
    expect(inventory.find(({ toolId }) => toolId === "json-formatter")?.rendererSeam).toEqual({
      kind: "shared",
      component: "DeveloperWebTool",
      source: "src/components/tools/DeveloperWebTool.tsx",
    });
    expect(inventory.find(({ toolId }) => toolId === "table-transpose")?.rendererSeam).toEqual({
      kind: "shared",
      component: "TableWorkbench",
      source: "src/components/tools/table/TableWorkbench.tsx",
    });
  });

  it("keeps missing declarations and migration owners explicitly missing", async () => {
    const seams = await currentSeams();
    const sample: ToolSummary | undefined = catalog[0];
    if (sample === undefined) throw new Error("catalog fixture is empty");
    const synthetic = {
      ...sample,
      result: { class: "calculator" as const, capabilities: ["copy"] as const },
    };
    const seam = seams.find(({ toolId }) => toolId === sample.id);
    if (seam === undefined) throw new Error(`missing renderer seam fixture for ${sample.id}`);

    expect(projectResultV2Inventory([sample], [seam])[0]).toMatchObject({
      toolId: sample.id,
      resultDeclaration: { state: sample.result === undefined ? "missing" : "declared" },
      migrationOwner: null,
    });
    expect(projectResultV2Inventory([synthetic], [seam])[0]).toMatchObject({
      resultDeclaration: { state: "declared", class: "calculator", capabilities: ["copy"] },
      migrationOwner: null,
    });
    expect(projectResultV2Inventory([synthetic], [seam], [{ toolId: sample.id, owner: "ticket-082" }])[0]).toMatchObject({
      migrationOwner: "ticket-082",
    });
  });

  it("fails closed when a catalog id is missing from or duplicated in renderer discovery", async () => {
    const seams = await currentSeams();
    expect(() => projectResultV2Inventory(catalog, seams.slice(1))).toThrow(/missing renderer seam for catalog id/u);
    const first = seams[0];
    if (first === undefined) throw new Error("renderer seam fixture is empty");
    expect(() => projectResultV2Inventory(catalog, [...seams, first])).toThrow(/duplicate renderer seam id/u);
    expect(() => projectResultV2Inventory(catalog, seams, [
      { toolId: first.toolId, owner: "ticket-a" },
      { toolId: first.toolId, owner: "ticket-b" },
    ])).toThrow(/duplicate migration owner id/u);
  });

  it("renders deterministically and keeps the committed generated report current", async () => {
    const seams = await currentSeams();
    const owners = assignResultV2MigrationOwners(catalog, seams);
    const inventory = projectResultV2Inventory(catalog, seams, owners);
    const first = renderResultV2InventorySource(inventory);
    const secondSeams = await currentSeams();
    const second = renderResultV2InventorySource(projectResultV2Inventory(
      catalog,
      secondSeams,
      assignResultV2MigrationOwners(catalog, secondSeams),
    ));
    expect(second).toBe(first);
    expect(await readFile(resolve(root, "src/catalog/result-v2-inventory.generated.ts"), "utf8")).toBe(first);
  });
});
