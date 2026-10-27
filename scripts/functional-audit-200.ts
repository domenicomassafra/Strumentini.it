import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { catalog } from "../src/generated/catalog";
import { validateOriginal200FunctionalEvidence } from "./functional-audit-evidence-66";
import {
  functionalAuditAssignmentIndexSchema,
  functionalAuditInventorySchema,
  validateFunctionalAuditAssignments,
  validateFunctionalAuditInventory,
  validateFunctionalAuditRecords,
  type FunctionalAuditAssignment,
  type FunctionalAuditInventoryEntry,
} from "../src/quality/functional-audit";

const root = resolve(import.meta.dirname, "..");
const assignmentPath = resolve(root, "quality/functional-audit/original-200.assignments.json");
const inventoryPath = resolve(root, "quality/functional-audit/original-200.inventory.json");
const recordsDir = resolve(root, "quality/functional-audit/records");
const checkOnly = process.argv.includes("--check");
const requireComplete = process.argv.includes("--require-complete");

const ownerByCategory: Readonly<Record<string, string>> = {
  "business-math": "legacy-expansion:284",
  "client-work-math": "legacy-expansion:285",
  data: "legacy-expansion:286",
  "date-time": "legacy-expansion:287",
  developer: "legacy-expansion:288",
  documents: "legacy-expansion:289",
  files: "legacy-expansion:290",
  "files-assets": "legacy-expansion:291",
  "image-visual": "legacy-expansion:292",
  marketing: "legacy-expansion:293",
  research: "legacy-expansion:294",
  text: "legacy-expansion:295",
  "web-operations": "legacy-expansion:296",
};

const persistedAssignmentText = await readFile(assignmentPath, "utf8").catch(() => "");
if (persistedAssignmentText.length === 0) throw new Error("original-200 assignment snapshot is required");
let persistedAssignmentValue: unknown;
try {
  persistedAssignmentValue = JSON.parse(persistedAssignmentText) as unknown;
} catch (error) {
  throw new Error(`original-200 assignment snapshot is invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
}
const persistedAssignmentIndex = functionalAuditAssignmentIndexSchema.safeParse(persistedAssignmentValue);
if (!persistedAssignmentIndex.success) throw new Error(`original-200 assignment snapshot does not match its schema: ${persistedAssignmentIndex.error.message}`);
const currentCatalogById = new Map<string, (typeof catalog)[number]>(catalog.map((tool) => [tool.id, tool]));
const originalAuditCatalog = persistedAssignmentIndex.data.assignments.map((assignment) => {
  const tool = currentCatalogById.get(assignment.toolId);
  if (tool === undefined) throw new Error(`original-200 catalog tool is missing: ${assignment.toolId}`);
  if (tool.category !== assignment.category) throw new Error(`${assignment.toolId}: original-200 category changed from ${assignment.category} to ${tool.category}`);
  return tool;
});

const assignments: FunctionalAuditAssignment[] = originalAuditCatalog.map((tool) => {
  const ownerTicket = ownerByCategory[tool.category];
  if (ownerTicket === undefined) throw new Error("No original-200 audit tranche for category " + tool.category);
  return {
    toolId: tool.id,
    category: tool.category,
    ownerTicket,
    status: "pending" as const,
    decision: null,
  };
}).toSorted((left, right) => left.toolId.localeCompare(right.toolId));

const assignmentReport = validateFunctionalAuditAssignments(originalAuditCatalog, assignments);
if (!assignmentReport.ok) throw new Error(assignmentReport.issues.join("\n"));
const renderedAssignments = JSON.stringify({ schemaVersion: 1, assignments }, null, 2) + "\n";
const parsedIndex = functionalAuditAssignmentIndexSchema.safeParse({ schemaVersion: 1, assignments });
if (!parsedIndex.success) throw new Error(parsedIndex.error.message);

if (checkOnly || requireComplete) {
  const existing = persistedAssignmentText;
  if (existing !== renderedAssignments) throw new Error("functional-audit assignment index is stale");
  const existingParsed = functionalAuditAssignmentIndexSchema.safeParse(JSON.parse(existing) as unknown);
  if (!existingParsed.success) throw new Error("functional-audit assignment index does not match its machine-readable schema");
} else {
  await mkdir(dirname(assignmentPath), { recursive: true });
  await writeFile(assignmentPath, renderedAssignments, "utf8");
}

const recordFiles = await readdir(recordsDir, { withFileTypes: true }).catch(() => []);
const rawRecords: unknown[] = [];
for (const entry of recordFiles.toSorted((left, right) => left.name.localeCompare(right.name))) {
  if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
  rawRecords.push(JSON.parse(await readFile(resolve(recordsDir, entry.name), "utf8")) as unknown);
}
const recordReport = validateFunctionalAuditRecords(originalAuditCatalog, assignments, rawRecords, requireComplete);
if (!recordReport.ok) throw new Error(recordReport.issues.join("\n"));
if (requireComplete) {
  const functionalProof = await validateOriginal200FunctionalEvidence(originalAuditCatalog, recordReport.records, {
    readJson: async (ref) => JSON.parse(await readFile(resolve(root, ref), "utf8")) as unknown,
    readText: async (ref) => readFile(resolve(root, ref), "utf8"),
  });
  if (!functionalProof.ok) throw new Error(functionalProof.issues.join("\n"));
}

const fixtureIndex = JSON.parse(await readFile(resolve(root, "quality/fixtures/index.json"), "utf8")) as {
  readonly families: ReadonlyArray<{ readonly id: string; readonly path: string }>;
};
const fixturePathById = new Map(fixtureIndex.families.map((entry) => [entry.id, entry.path]));
const recordById = new Map(recordReport.records.map((record) => [record.toolId, record]));
const inventory: FunctionalAuditInventoryEntry[] = assignments.map((assignment) => {
  const tool = originalAuditCatalog.find(({ id }) => id === assignment.toolId);
  if (tool === undefined) throw new Error("functional-audit inventory lost catalog tool " + assignment.toolId);
  const record = recordById.get(tool.id);
  const resultDeclaration = "result" in tool ? tool.result : undefined;
  const status = record === undefined ? "PENDING" as const : record.decision === "REFUSED" ? "REFUSED" as const : "VERIFIED" as const;
  const evidenceRefs = record === undefined ? [] : [...new Set(record.evidence.map(({ ref }) => ref))].toSorted();
  return {
    toolId: tool.id,
    category: tool.category,
    ownerTicket: assignment.ownerTicket,
    status,
    decision: record?.decision ?? null,
    manifestRef: `src/tools/${tool.id}/manifest.ts`,
    runtime: { ...tool.runtime },
    result: {
      ref: `src/tools/${tool.id}/manifest.ts#result`,
      declaration: resultDeclaration === undefined ? null : { class: resultDeclaration.class, capabilities: [...resultDeclaration.capabilities] },
    },
    fixtureRefs: tool.gold.fixtureFamilies.map((id) => ({ id, ref: fixturePathById.get(id) ?? "" })),
    oracleRef: { entryId: tool.gold.oracleEntryId, ref: `quality/oracles/registry.json#${tool.gold.oracleEntryId}` },
    evidenceRefs,
    recordRef: record === undefined ? null : `quality/functional-audit/records/${tool.id}.json`,
  };
}).toSorted((left, right) => left.toolId.localeCompare(right.toolId));

const inventoryReport = validateFunctionalAuditInventory(originalAuditCatalog, assignments, inventory, fixturePathById);
if (!inventoryReport.ok) throw new Error(inventoryReport.issues.join("\n"));
for (const entry of inventory) {
  if (entry.status === "PENDING") continue;
  for (const ref of entry.evidenceRefs) {
    if (/^[a-z]+:\/\//iu.test(ref) || /^legacy-expansion:[1-9]\d*$/u.test(ref)) continue;
    await access(resolve(root, ref)).catch(() => {
      throw new Error(`${entry.toolId}: functional evidence ref does not resolve: ${ref}`);
    });
  }
}
const inventoryPayload = { schemaVersion: 1 as const, entries: inventory };
const parsedInventory = functionalAuditInventorySchema.safeParse(inventoryPayload);
if (!parsedInventory.success) throw new Error(parsedInventory.error.message);
const renderedInventory = JSON.stringify(inventoryPayload, null, 2) + "\n";
if (checkOnly || requireComplete) {
  const existing = await readFile(inventoryPath, "utf8").catch(() => "");
  if (existing !== renderedInventory) throw new Error("functional-audit inventory is stale");
  const existingParsed = functionalAuditInventorySchema.safeParse(JSON.parse(existing) as unknown);
  if (!existingParsed.success) throw new Error("functional-audit inventory does not match its machine-readable schema");
} else {
  await writeFile(inventoryPath, renderedInventory, "utf8");
}

const counts = Object.fromEntries(
  [...new Set(assignments.map((entry) => entry.category))]
    .toSorted()
    .map((category) => [category, assignments.filter((entry) => entry.category === category).length]),
);
console.log(
  "original-200 functional audit:",
  assignments.length,
  "assigned,",
  recordReport.records.length,
  "final record(s),",
  inventory.filter(({ status }) => status === "VERIFIED").length,
  "verified,",
  inventory.filter(({ status }) => status === "REFUSED").length,
  "refused,",
  requireComplete ? "final gate PASS" : "final decisions pending",
  JSON.stringify(counts),
);
