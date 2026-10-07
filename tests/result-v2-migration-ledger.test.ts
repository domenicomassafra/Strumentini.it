import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { catalog } from "../src/generated/catalog";
import { projectResultV2Inventory } from "../src/catalog/projections";
import { discoverResultV2RendererSeams } from "../scripts/tool-factory/result-v2-inventory";
import {
  RESULT_V2_MIGRATION_OWNER_RULES,
  RESULT_V2_MIGRATION_TICKETS,
  assertResultV2MigrationLedgerComplete,
  assertResultV2MigrationTicketsExist,
  assignResultV2MigrationOwners,
  type ResultV2MigrationTicket,
} from "../scripts/tool-factory/result-v2-migration-ledger";

const root = resolve(import.meta.dirname, "..");

describe("Result v2 renderer migration ledger", () => {
  it("assigns exactly one real migration ticket to every current tool", async () => {
    await assertResultV2MigrationTicketsExist(root);
    const seams = await discoverResultV2RendererSeams(root, catalog.map(({ id }) => id));
    const owners = assignResultV2MigrationOwners(catalog, seams);
    const inventory = projectResultV2Inventory(catalog, seams, owners);
    assertResultV2MigrationLedgerComplete(inventory);

    expect(inventory).toHaveLength(catalog.length);
    expect(new Set(inventory.map(({ toolId }) => toolId)).size).toBe(catalog.length);
    expect(inventory.every(({ migrationOwner }) => migrationOwner !== null)).toBe(true);
    expect(inventory.every(({ resultDeclaration }) =>
      resultDeclaration.state === "missing" || resultDeclaration.state === "declared")).toBe(true);
    expect(inventory.filter(({ resultDeclaration }) => resultDeclaration.state === "declared")).toHaveLength(
      catalog.filter((entry) => "result" in entry).length,
    );

    const counts = new Map<string, number>();
    for (const { migrationOwner } of inventory) {
      if (migrationOwner === null) throw new Error("complete ledger contains a null owner");
      counts.set(migrationOwner, (counts.get(migrationOwner) ?? 0) + 1);
    }
    const ticketPaths = Object.values(RESULT_V2_MIGRATION_TICKETS).map(({ path }) => path).toSorted();
    expect([...counts.keys()].toSorted()).toEqual(ticketPaths);
    expect([...counts.values()].every((count) => count > 0)).toBe(true);
    expect([...counts.values()].reduce((sum, count) => sum + count, 0)).toBe(catalog.length);
  });

  it("keeps renderer seams source-resolved while declaration progress changes independently", async () => {
    const seams = await discoverResultV2RendererSeams(root, catalog.map(({ id }) => id));
    const inventory = projectResultV2Inventory(catalog, seams, assignResultV2MigrationOwners(catalog, seams));
    expect(inventory.find(({ rendererSeam }) => rendererSeam.component === "BusinessMathTool")).toMatchObject({
      rendererSeam: {
        kind: "shared",
        component: "BusinessMathTool",
        source: "src/components/tools/business-math/BusinessMathTool.tsx",
      },
      resultDeclaration: { state: "declared", class: "calculator" },
      migrationOwner: RESULT_V2_MIGRATION_TICKETS.businessMathShared.path,
    });
    const fileHashEngine = ["file", "hash"].join("-");
    const fileHashEntry = inventory.find(({ engine }) => engine === fileHashEngine);
    expect(fileHashEntry).toMatchObject({
      rendererSeam: {
        kind: "bespoke",
        component: "FileHashTool",
      },
      resultDeclaration: { state: "declared", class: "validator" },
      migrationOwner: RESULT_V2_MIGRATION_TICKETS.urlMarketingQrBespoke.path,
    });
    expect(fileHashEntry?.rendererSeam.source).toMatch(/FileHashTool\.tsx$/u);
  });

  it("fails closed on orphan, duplicate, stale, and nonexistent owner sabotage", async () => {
    const seams = await discoverResultV2RendererSeams(root, catalog.map(({ id }) => id));
    const owners = assignResultV2MigrationOwners(catalog, seams);
    expect(() => assertResultV2MigrationLedgerComplete(projectResultV2Inventory(catalog, seams, owners.slice(1))))
      .toThrow(/missing migration owner/u);

    const first = owners[0];
    if (first === undefined) throw new Error("migration owner fixture is empty");
    expect(() => projectResultV2Inventory(catalog, seams, [...owners, first])).toThrow(/duplicate migration owner id/u);
    expect(() => projectResultV2Inventory(catalog, seams, [...owners, { toolId: "stale-tool-id", owner: first.owner }]))
      .toThrow(/migration owner id is not in catalog/u);

    const missingTicket: ResultV2MigrationTicket = {
      id: 999,
      title: "Missing migration ticket",
      path: ".scratch/strumentiutili-expansion-20261005/issues/999-missing-migration-ticket.md",
    };
    await expect(assertResultV2MigrationTicketsExist(root, [missingTicket])).rejects.toThrow(/migration ticket does not exist/u);

    const overlappingRules = [RESULT_V2_MIGRATION_OWNER_RULES[0], RESULT_V2_MIGRATION_OWNER_RULES[0]].filter((rule) => rule !== undefined);
    const sharedBusinessMath = catalog.filter(({ engine }) => engine === "business-math").slice(0, 1);
    const sharedBusinessMathId = sharedBusinessMath[0]?.id;
    if (sharedBusinessMathId === undefined) throw new Error("shared business-math fixture is empty");
    const sharedBusinessMathSeam = seams.filter(({ toolId }) => toolId === sharedBusinessMathId);
    expect(() => assignResultV2MigrationOwners(sharedBusinessMath, sharedBusinessMathSeam, overlappingRules)).toThrow(/duplicate migration ownership/u);
  });

  it("keeps the generated ledger current and free of null owners", async () => {
    const source = await readFile(resolve(root, "src/catalog/result-v2-inventory.generated.ts"), "utf8");
    expect(source).not.toContain('"migrationOwner": null');
    expect(source.match(/"migrationOwner":/gu)).toHaveLength(catalog.length);
    const missing = source.match(/"state": "missing"/gu)?.length ?? 0;
    const declared = source.match(/"state": "declared"/gu)?.length ?? 0;
    expect(missing + declared).toBe(catalog.length);
    expect(declared).toBe(catalog.filter((entry) => "result" in entry).length);
  });
});
