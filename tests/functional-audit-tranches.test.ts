import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { catalog } from "../src/generated/catalog";
import {
  functionalAuditAssignmentIndexSchema,
  validateFunctionalAuditRecords,
  type FunctionalAuditAssignment,
  type FunctionalAuditRecord,
} from "../src/quality/functional-audit";

const root = resolve(import.meta.dirname, "..");
const targetCategories = ["research", "text", "web-operations"] as const;
const expectedCounts = { research: 21, text: 21, "web-operations": 8 } as const;

const assignmentIndex = functionalAuditAssignmentIndexSchema.parse(JSON.parse(
  readFileSync(resolve(root, "quality/functional-audit/original-200.assignments.json"), "utf8"),
)) as { schemaVersion: 1; assignments: FunctionalAuditAssignment[] };
const originalToolIds = new Set(assignmentIndex.assignments.map(({ toolId }) => toolId));
const originalCatalog = catalog.filter(({ id }) => originalToolIds.has(id));

const recordFiles = readdirSync(resolve(root, "quality/functional-audit/records"))
  .filter((name) => name.endsWith(".json"))
  .toSorted();
const rawRecords = recordFiles.map((name) => JSON.parse(
  readFileSync(resolve(root, "quality/functional-audit/records", name), "utf8"),
) as unknown);
const report = validateFunctionalAuditRecords(originalCatalog, assignmentIndex.assignments, rawRecords);
const records = report.records as readonly FunctionalAuditRecord[];

describe("functional audit tranches 294-296", () => {
  it("has exact catalog parity for research, text and web-operations", () => {
    expect(report.ok, report.issues.join("\n")).toBe(true);
    for (const category of targetCategories) {
      const expectedIds = originalCatalog
        .filter((tool) => tool.category === category)
        .map((tool) => tool.id)
        .toSorted();
      const actualIds = records
        .filter((record) => record.category === category)
        .map((record) => record.toolId)
        .toSorted();
      expect(expectedIds).toHaveLength(expectedCounts[category]);
      expect(actualIds).toEqual(expectedIds);
    }
  });

  it("binds every decision to existing functional evidence and matching Gold receipts", () => {
    for (const record of records.filter((entry) => targetCategories.includes(entry.category as never))) {
      for (const evidence of record.evidence) {
        expect(existsSync(resolve(root, evidence.ref)), `${record.toolId}: missing evidence ${evidence.ref}`).toBe(true);
      }
      for (const child of record.childTickets) {
        expect(existsSync(resolve(root, child)), `${record.toolId}: missing child ticket ${child}`).toBe(true);
      }
      if (record.decision !== "ALREADY_COMPLETE") continue;
      const qualityEvidence = record.evidence.find((item) => item.kind === "quality-receipt");
      const browserEvidence = record.evidence.find((item) => item.kind === "browser-acceptance");
      const unitEvidence = record.evidence.find((item) => item.kind === "unit-test");
      expect(qualityEvidence, `${record.toolId}: quality receipt`).toBeDefined();
      expect(browserEvidence, `${record.toolId}: browser acceptance`).toBeDefined();
      expect(unitEvidence, `${record.toolId}: unit test`).toBeDefined();
      const receipt = JSON.parse(readFileSync(resolve(root, qualityEvidence!.ref), "utf8")) as {
        toolId?: unknown;
        status?: unknown;
      };
      expect(receipt).toMatchObject({ toolId: record.toolId, status: "GOLD" });
      expect(readFileSync(resolve(root, browserEvidence!.ref), "utf8")).toContain(record.toolId);
    }
  });

  it("records RIS/BibTeX as upgraded after authoritative oracle closure", () => {
    const research = records.filter((record) => record.category === "research");
    expect(research.filter((record) => record.decision === "REFUSED").map((record) => record.toolId))
      .toEqual([]);
    const ris = research.find((record) => record.toolId === "ris-bibtex-converter");
    expect(ris).toMatchObject({
      decision: "UPGRADED",
      childTickets: [
        ".scratch/strumentiutili-expansion-20261005/issues/276-ris-bibtex-converter-authoritative-oracle-closure.md",
      ],
    });
    expect(ris?.evidence.some((item) => item.kind === "oracle" && item.ref.endsWith("/ORACLE.md"))).toBe(true);
    expect(ris?.evidence.some((item) => item.kind === "quality-receipt" && item.ref.endsWith("ris-bibtex-converter.gold.json"))).toBe(true);
    expect(records.filter((record) => record.category === "text" && record.decision !== "ALREADY_COMPLETE")).toEqual([]);
    expect(records.filter((record) => record.category === "web-operations" && record.decision !== "ALREADY_COMPLETE")).toEqual([]);
  });

  it("closes the global final gate once every audit tranche has a final record", () => {
    const finalReport = validateFunctionalAuditRecords(originalCatalog, assignmentIndex.assignments, rawRecords, true);
    const decidedIds = new Set(records.map((record) => record.toolId));
    const expectedMissing = assignmentIndex.assignments
      .filter((assignment) => !decidedIds.has(assignment.toolId))
      .map((assignment) => assignment.toolId)
      .toSorted();
    const reportedMissing = finalReport.issues
      .filter((issue) => issue.startsWith("missing final functional-audit record:"))
      .map((issue) => issue.slice("missing final functional-audit record: ".length))
      .toSorted();
    expect(finalReport.ok).toBe(true);
    expect(decidedIds.size).toBe(originalCatalog.length);
    expect(decidedIds.size).toBe(200);
    expect(expectedMissing).toEqual([]);
    expect(reportedMissing).toEqual(expectedMissing);
  });
});
