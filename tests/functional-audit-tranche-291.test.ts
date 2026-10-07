import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { catalog } from "../src/generated/catalog";

const root = resolve(import.meta.dirname, "..");
interface AuditEvidence { kind: string; ref: string; claim: string }
interface AuditRecord {
  toolId: string;
  category: string;
  ownerTicket: string;
  decision: "UPGRADED" | "ALREADY_COMPLETE" | "REFUSED";
  expectedFunctionality: string;
  observedFunctionality: string;
  rationale: string;
  evidence: AuditEvidence[];
  childTickets: string[];
}
interface AuditAssignment { toolId: string; category: string; ownerTicket: string }

const assignmentIndex = JSON.parse(
  readFileSync(resolve(root, "quality/functional-audit/original-200.assignments.json"), "utf8"),
) as { schemaVersion: 1; assignments: AuditAssignment[] };

const records = readdirSync(resolve(root, "quality/functional-audit/records"))
  .filter((name) => name.endsWith(".json"))
  .toSorted()
  .map((name) => JSON.parse(readFileSync(resolve(root, "quality/functional-audit/records", name), "utf8")) as AuditRecord);
const filesAssets = records.filter((record) => record.category === "files-assets");

describe("functional audit tranche 291", () => {
  it("has exact 15/15 catalog parity", () => {
    const ownedIds = new Set(assignmentIndex.assignments
      .filter((item) => item.ownerTicket === ".scratch/strumentiutili-expansion-20261005/issues/291-existing-files-assets-200-audit-tranche.md")
      .map((item) => item.toolId));
    const expected = catalog.filter((tool) => ownedIds.has(tool.id)).map((tool) => tool.id).toSorted();
    const actual = filesAssets.map((record) => record.toolId).toSorted();
    expect(expected).toHaveLength(15);
    expect(actual).toEqual(expected);
    for (const record of filesAssets) {
      const assignment = assignmentIndex.assignments.find((item) => item.toolId === record.toolId);
      expect(assignment).toMatchObject({
        category: "files-assets",
        ownerTicket: ".scratch/strumentiutili-expansion-20261005/issues/291-existing-files-assets-200-audit-tranche.md",
      });
      expect(record.ownerTicket).toBe(assignment?.ownerTicket);
    }
  });

  it("binds every decision to existing non-Result-v2 functional evidence", () => {
    for (const record of filesAssets) {
      const serialized = JSON.stringify(record.evidence).toLowerCase();
      expect(serialized).not.toContain("result-v2");
      expect(serialized).not.toContain("result v2");
      for (const evidence of record.evidence) {
        expect(existsSync(resolve(root, evidence.ref)), `${record.toolId}: missing ${evidence.ref}`).toBe(true);
      }
      for (const child of record.childTickets) {
        expect(existsSync(resolve(root, child)), `${record.toolId}: missing child ${child}`).toBe(true);
      }
    }
  });

  it("keeps the fourteen Gold-backed current jobs complete", () => {
    const complete = filesAssets.filter((record) => record.decision === "ALREADY_COMPLETE");
    expect(complete).toHaveLength(14);
    for (const record of complete) {
      const goldEvidence = record.evidence.find((item) => item.kind === "quality-receipt");
      const browserEvidence = record.evidence.find((item) => item.kind === "browser-acceptance");
      expect(goldEvidence, `${record.toolId}: Gold evidence`).toBeDefined();
      expect(browserEvidence, `${record.toolId}: browser evidence`).toBeDefined();
      const receipt = JSON.parse(readFileSync(resolve(root, goldEvidence!.ref), "utf8")) as { status?: unknown; toolId?: unknown };
      expect(receipt).toMatchObject({ status: "GOLD", toolId: record.toolId });
      expect(readFileSync(resolve(root, browserEvidence!.ref), "utf8")).toContain(record.toolId);
    }
    expect(complete.find((record) => record.toolId === "image-compare-slider")?.observedFunctionality)
      .toMatch(/public.*promises.*comparison|public.*summary.*comparison/iu);
  });

  it("refuses only image-resize while physical proof is canonically missing", () => {
    const refused = filesAssets.filter((record) => record.decision === "REFUSED");
    expect(refused.map((record) => record.toolId)).toEqual(["image-resize"]);
    const resize = refused[0]!;
    expect(resize.childTickets).toEqual([
      ".scratch/strumentiutili-expansion-20261005/issues/277-physical-android-chrome-image-resize-acceptance.md",
      ".scratch/strumentiutili-expansion-20261005/issues/278-physical-ios-safari-image-resize-acceptance.md",
      ".scratch/strumentiutili-expansion-20261005/issues/279-image-resize-gold-promotion-gate.md",
    ]);
    const certification = JSON.parse(readFileSync(resolve(root, "quality/receipts/image-resize/certification.json"), "utf8")) as {
      status?: unknown;
      goldEligible?: unknown;
      physicalAcceptance?: { iosSafari?: unknown; androidChrome?: unknown };
    };
    expect(certification).toMatchObject({
      status: "PARTIAL",
      goldEligible: false,
      physicalAcceptance: { iosSafari: "MISSING", androidChrome: "MISSING" },
    });
    expect(filesAssets.filter((record) => record.decision === "UPGRADED")).toEqual([]);
  });
});
