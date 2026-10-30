import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { catalog } from "../src/generated/catalog";
import { buildCertificationIndex } from "../src/quality/certification";
import {
  functionalAuditAssignmentIndexSchema,
  validateFunctionalAuditRecords,
  type FunctionalAuditAssignment,
  type FunctionalAuditRecord,
} from "../src/quality/functional-audit";

const root = resolve(import.meta.dirname, "..");
const ownerTicket = "legacy-expansion:292";
const ticket317 = "legacy-expansion:317";

const assignments = functionalAuditAssignmentIndexSchema.parse(JSON.parse(
  readFileSync(resolve(root, "quality/functional-audit/original-200.assignments.json"), "utf8"),
)).assignments as FunctionalAuditAssignment[];
const originalToolIds = new Set(assignments.map(({ toolId }) => toolId));
const originalCatalog = catalog.filter(({ id }) => originalToolIds.has(id));
const imageVisualIds = originalCatalog
  .filter((tool) => tool.category === "image-visual")
  .map((tool) => tool.id)
  .toSorted();
const rawRecords = imageVisualIds.map((toolId) => JSON.parse(
  readFileSync(resolve(root, "quality/functional-audit/records", `${toolId}.json`), "utf8"),
) as unknown);
const report = validateFunctionalAuditRecords(originalCatalog, assignments, rawRecords);
const records = report.records as readonly FunctionalAuditRecord[];

describe("functional audit tranche 292", () => {
  it("has exact 5/5 image-visual catalog parity under ticket 292", () => {
    expect(report.ok, report.issues.join("\n")).toBe(true);
    expect(imageVisualIds).toHaveLength(5);
    expect(records.map((record) => record.toolId).toSorted()).toEqual(imageVisualIds);
    expect(records.every((record) => record.ownerTicket === ownerTicket)).toBe(true);
  });

  it("proves every current narrow job with concrete Gold, unit and browser evidence", () => {
    for (const record of records) {
      expect(record.decision, record.toolId).toBe("ALREADY_COMPLETE");
      expect(record.childTickets, record.toolId).toEqual([]);
      expect(JSON.stringify(record.evidence).toLowerCase()).not.toMatch(/result[ -]?v2/u);
      const gold = record.evidence.find((item) => item.kind === "quality-receipt");
      const unit = record.evidence.find((item) => item.kind === "unit-test");
      const browser = record.evidence.find((item) => item.kind === "browser-acceptance");
      expect(gold, `${record.toolId}: Gold evidence`).toBeDefined();
      expect(unit, `${record.toolId}: unit evidence`).toBeDefined();
      expect(browser, `${record.toolId}: browser evidence`).toBeDefined();
      for (const evidence of record.evidence) {
        expect(evidence.ref.startsWith("legacy-expansion:") ? /^legacy-expansion:[1-9]\d*$/u.test(evidence.ref) : existsSync(resolve(root, evidence.ref)), `${record.toolId}: missing ${evidence.ref}`).toBe(true);
      }
      const receipt = JSON.parse(readFileSync(resolve(root, gold!.ref), "utf8")) as { toolId?: unknown; status?: unknown };
      expect(receipt).toMatchObject({ toolId: record.toolId, status: "GOLD" });
      expect(readFileSync(resolve(root, browser!.ref), "utf8")).toContain(record.toolId);
    }
  });

  it("keeps all five evidence bindings current in the live certification index", async () => {
    const index = await buildCertificationIndex();
    for (const toolId of imageVisualIds) {
      const certification = index.tools.find((tool) => tool.id === toolId);
      expect(certification, toolId).toMatchObject({
        status: "GOLD",
        oracle: { status: "VERIFIED" },
      });
      // A receipt's historical GOLD status is distinct from release
      // eligibility after a canonical oracle/fixture authority change.
      expect(certification?.releaseGate, toolId).toBe(certification?.goldEligible ? "PASS" : "BLOCKED");
      expect(certification?.certificationReceipt, toolId).not.toBeNull();
      expect(certification?.fixtures.every((fixture) => fixture.status === "VERIFIED"), toolId).toBe(true);
    }
  }, 90_000);

  it("keeps 298-317 roadmap enhancements separate from current-contract gaps", () => {
    for (const record of records) {
      const roadmapRefs = record.evidence
        .filter((item) => item.kind === "source-contract" && /^legacy-expansion:(?:29[8-9]|30[0-9]|31[0-7])$/.test(item.ref))
        .map((item) => item.ref);
      if (record.toolId === "platform-size-presets") {
        expect(roadmapRefs).toEqual([ticket317]);
        expect(record.rationale).toMatch(/additive|future/iu);
      } else {
        expect(roadmapRefs, record.toolId).toEqual([]);
      }
    }
  });
});
