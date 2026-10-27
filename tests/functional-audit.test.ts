import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { catalog } from "../src/generated/catalog";
import {
  functionalAuditInventoryEntrySchema,
  functionalAuditRecordSchema,
  validateFunctionalAuditAssignments,
  validateFunctionalAuditInventory,
  validateFunctionalAuditRecords,
  type FunctionalAuditAssignment,
  type FunctionalAuditInventoryEntry,
} from "../src/quality/functional-audit";

const owner = "legacy-expansion:284";
const child = "legacy-expansion:121";
const originalAssignmentIndex = JSON.parse(
  readFileSync(new URL("../quality/functional-audit/original-200.assignments.json", import.meta.url), "utf8"),
) as { readonly assignments: ReadonlyArray<{ readonly toolId: string }> };
const originalIds = new Set(originalAssignmentIndex.assignments.map(({ toolId }) => toolId));
const originalCatalog = catalog.filter((tool) => originalIds.has(tool.id));

function assignments(): FunctionalAuditAssignment[] {
  return originalCatalog.map((tool) => ({
    toolId: tool.id,
    category: tool.category,
    ownerTicket: "legacy-expansion:"
      + ({
        "business-math": "284",
        "client-work-math": "285",
        data: "286",
        "date-time": "287",
        developer: "288",
        documents: "289",
        files: "290",
        "files-assets": "291",
        "image-visual": "292",
        marketing: "293",
        research: "294",
        text: "295",
        "web-operations": "296",
      } as Record<string, string>)[tool.category],
    status: "pending",
    decision: null,
  }));
}

const fixtureIndex = JSON.parse(readFileSync(new URL("../quality/fixtures/index.json", import.meta.url), "utf8")) as {
  readonly families: ReadonlyArray<{ readonly id: string; readonly path: string }>;
};
const fixturePathById = new Map(fixtureIndex.families.map((entry) => [entry.id, entry.path]));

function inventory(rows = assignments()): FunctionalAuditInventoryEntry[] {
  const assignmentById = new Map(rows.map((entry) => [entry.toolId, entry]));
  return originalCatalog.map((tool) => {
    const assignment = assignmentById.get(tool.id);
    if (assignment === undefined) throw new Error("missing test assignment for " + tool.id);
    const resultDeclaration = "result" in tool ? tool.result : undefined;
    return {
      toolId: tool.id,
      category: tool.category,
      ownerTicket: assignment.ownerTicket,
      status: "PENDING" as const,
      decision: null,
      manifestRef: `src/tools/${tool.id}/manifest.ts`,
      runtime: { ...tool.runtime },
      result: {
        ref: `src/tools/${tool.id}/manifest.ts#result`,
        declaration: resultDeclaration === undefined ? null : { class: resultDeclaration.class, capabilities: [...resultDeclaration.capabilities] },
      },
      fixtureRefs: tool.gold.fixtureFamilies.map((id) => ({ id, ref: fixturePathById.get(id) ?? "" })),
      oracleRef: { entryId: tool.gold.oracleEntryId, ref: `quality/oracles/registry.json#${tool.gold.oracleEntryId}` },
      evidenceRefs: [],
      recordRef: null,
    };
  });
}

describe("original-200 functional audit schema", () => {
  it("keeps exactly one assignment for every original catalog id", () => {
    const rows = assignments();
    expect(rows).toHaveLength(200);
    expect(originalCatalog).toHaveLength(200);
    expect(validateFunctionalAuditAssignments(originalCatalog, rows)).toEqual({ ok: true, issues: [] });
  });

  it("fails missing, duplicate, and stale assignment sabotage", () => {
    const rows = assignments();
    expect(validateFunctionalAuditAssignments(originalCatalog, rows.slice(1)).issues.join(" ")).toMatch(/missing/u);
    expect(validateFunctionalAuditAssignments(originalCatalog, [...rows, rows[0]!]).issues.join(" ")).toMatch(/duplicate/u);
    expect(validateFunctionalAuditAssignments(originalCatalog, [
      ...rows,
      { toolId: "stale-tool", category: "business-math", ownerTicket: owner, status: "pending", decision: null },
    ]).issues.join(" ")).toMatch(/stale/u);
  });

  it("binds a deterministic 200/200 inventory to manifest/runtime/result/fixture/oracle refs", () => {
    const rows = assignments();
    const entries = inventory(rows);
    expect(entries).toHaveLength(200);
    expect(validateFunctionalAuditInventory(originalCatalog, rows, entries, fixturePathById)).toEqual({ ok: true, issues: [] });
    expect(entries.every((entry) => entry.status === "PENDING" && entry.evidenceRefs.length === 0)).toBe(true);
  });

  it("fails missing, duplicate, stale and evidence-less verified inventory sabotage", () => {
    const rows = assignments();
    const entries = inventory(rows);
    const missing = validateFunctionalAuditInventory(originalCatalog, rows, entries.slice(1), fixturePathById);
    expect(missing.issues.join(" ")).toMatch(/missing functional-audit inventory entry/u);

    const duplicate = validateFunctionalAuditInventory(originalCatalog, rows, [...entries, entries[0]!], fixturePathById);
    expect(duplicate.issues.join(" ")).toMatch(/duplicate functional-audit inventory entry/u);

    const stale = structuredClone(entries);
    stale[0] = { ...stale[0]!, manifestRef: "src/tools/stale-tool/manifest.ts" };
    expect(validateFunctionalAuditInventory(originalCatalog, rows, stale, fixturePathById).issues.join(" ")).toMatch(/stale manifest ref/u);

    const forged = {
      ...entries[0]!,
      status: "VERIFIED",
      decision: "ALREADY_COMPLETE",
      recordRef: `quality/functional-audit/records/${entries[0]!.toolId}.json`,
      evidenceRefs: [],
    } as const;
    expect(functionalAuditInventoryEntrySchema.safeParse(forged).success).toBe(false);
  });

  it.each(["ALREADY_COMPLETE", "REFUSED"] as const)("requires concrete evidence and rationale for %s", (decision) => {
    const record = {
      toolId: "break-even",
      category: "business-math",
      ownerTicket: owner,
      decision,
      expectedFunctionality: "Compute break-even units and revenue.",
      observedFunctionality: "Exact formulas and edge cases are already covered.",
      rationale: "The observed behavior matches the declared functional scope.",
      evidence: [{ kind: "unit-test", ref: "tests/business-tools.test.ts", claim: "Break-even vectors execute the declared behavior" }],
      childTickets: [],
    } as const;
    expect(functionalAuditRecordSchema.safeParse({ ...record, rationale: "" }).success).toBe(false);
    expect(functionalAuditRecordSchema.safeParse({ ...record, evidence: [] }).success).toBe(false);
    expect(functionalAuditRecordSchema.safeParse(record).success).toBe(true);
  });

  it("rejects visual-only or Result-v2-only upgrade evidence", () => {
    expect(functionalAuditRecordSchema.safeParse({
      toolId: "break-even",
      category: "business-math",
      ownerTicket: owner,
      decision: "UPGRADED",
      expectedFunctionality: "Compute break-even units and revenue.",
      observedFunctionality: "Expanded calculation shipped.",
      rationale: "Functional behavior changed.",
      evidence: [{ kind: "screenshot", ref: "image.png", claim: "Looks correct" }],
      childTickets: [child],
    }).success).toBe(false);

    expect(functionalAuditRecordSchema.safeParse({
      toolId: "break-even",
      category: "business-math",
      ownerTicket: owner,
      decision: "UPGRADED",
      expectedFunctionality: "Compute break-even units and revenue.",
      observedFunctionality: "Only Result v2 presentation changed.",
      rationale: "Visual migration only.",
      evidence: [{ kind: "unit-test", ref: "tests/result-v2-renderer.test.ts", claim: "Checks only Result v2 visual rendering" }],
      childTickets: [child],
    }).success).toBe(false);

    expect(functionalAuditRecordSchema.safeParse({
      toolId: "break-even",
      category: "business-math",
      ownerTicket: owner,
      decision: "UPGRADED",
      expectedFunctionality: "Compute break-even units and revenue.",
      observedFunctionality: "Only the result renderer changed.",
      rationale: "Renderer migration.",
      evidence: [{ kind: "browser-acceptance", ref: "result-v2-browser", claim: "Result v2 renderer passes" }],
      childTickets: [child],
    }).success).toBe(false);

    expect(functionalAuditRecordSchema.safeParse({
      toolId: "break-even",
      category: "business-math",
      ownerTicket: owner,
      decision: "UPGRADED",
      expectedFunctionality: "Compute break-even units and revenue.",
      observedFunctionality: "Only a browser screenshot was reviewed.",
      rationale: "Visual review only.",
      evidence: [{ kind: "browser-acceptance", ref: "quality/receipts/result-v2/browser-state-matrix.json", claim: "Screenshot and layout look correct" }],
      childTickets: [child],
    }).success).toBe(false);

    expect(functionalAuditRecordSchema.safeParse({
      toolId: "break-even",
      category: "business-math",
      ownerTicket: owner,
      decision: "UPGRADED",
      expectedFunctionality: "Compute break-even units and revenue.",
      observedFunctionality: "A new scenario is covered by an executable test.",
      rationale: "Functional behavior changed.",
      evidence: [{ kind: "unit-test", ref: "tests/business-tools.test.ts", claim: "Executes the new break-even scenario through the public module" }],
      childTickets: [child],
    }).success).toBe(true);
  });

  it("requires a targeted child ticket for an upgraded decision", () => {
    expect(functionalAuditRecordSchema.safeParse({
      toolId: "break-even",
      category: "business-math",
      ownerTicket: owner,
      decision: "UPGRADED",
      expectedFunctionality: "Compute break-even units and revenue.",
      observedFunctionality: "A new break-even scenario is executable.",
      rationale: "Functional behavior changed.",
      evidence: [{ kind: "unit-test", ref: "tests/business-tools.test.ts", claim: "Executes the added scenario through the public module" }],
      childTickets: [],
    }).success).toBe(false);
  });

  it("rejects duplicate final records even when each individual record is valid", () => {
    const rows = assignments();
    const valid = {
      toolId: "break-even",
      category: "business-math",
      ownerTicket: owner,
      decision: "ALREADY_COMPLETE",
      expectedFunctionality: "Compute break-even units and revenue.",
      observedFunctionality: "Current formulas and error cases are covered.",
      rationale: "The current narrow public job is complete.",
      evidence: [{ kind: "unit-test", ref: "tests/business-tools.test.ts", claim: "Break-even vectors pass" }],
      childTickets: [],
    } as const;
    const report = validateFunctionalAuditRecords(originalCatalog, rows, [valid, valid]);
    expect(report.ok).toBe(false);
    expect(report.issues.join(" ")).toMatch(/duplicate functional-audit record: break-even/u);
  });

  it("keeps the final gate red until every assignment has one audited decision", () => {
    const rows = assignments();
    const report = validateFunctionalAuditRecords(originalCatalog, rows, [], true);
    expect(report.ok).toBe(false);
    expect(report.issues.filter((issue) => issue.startsWith("missing final functional-audit record:"))).toHaveLength(200);
  });
});
