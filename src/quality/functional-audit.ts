import { z } from "zod";

export const FUNCTIONAL_AUDIT_DECISIONS = ["UPGRADED", "ALREADY_COMPLETE", "REFUSED"] as const;
export const FUNCTIONAL_AUDIT_STATUSES = ["PENDING", "VERIFIED", "REFUSED"] as const;
export const FUNCTIONAL_EVIDENCE_KINDS = [
  "unit-test",
  "browser-acceptance",
  "oracle",
  "benchmark",
  "source-contract",
  "quality-receipt",
] as const;

export type FunctionalAuditDecision = (typeof FUNCTIONAL_AUDIT_DECISIONS)[number];
export type FunctionalAuditStatus = (typeof FUNCTIONAL_AUDIT_STATUSES)[number];
export type FunctionalEvidenceKind = (typeof FUNCTIONAL_EVIDENCE_KINDS)[number];

export interface FunctionalAuditAssignment {
  readonly toolId: string;
  readonly category: string;
  readonly ownerTicket: string;
  readonly status: "pending";
  readonly decision: null;
}

export interface FunctionalAuditEvidence {
  readonly kind: FunctionalEvidenceKind;
  readonly ref: string;
  readonly claim: string;
}

export interface FunctionalAuditRecord {
  readonly toolId: string;
  readonly category: string;
  readonly ownerTicket: string;
  readonly decision: FunctionalAuditDecision;
  readonly expectedFunctionality: string;
  readonly observedFunctionality: string;
  readonly rationale: string;
  readonly evidence: readonly FunctionalAuditEvidence[];
  readonly childTickets: readonly string[];
}

export interface FunctionalAuditInventoryEntry {
  readonly toolId: string;
  readonly category: string;
  readonly ownerTicket: string;
  readonly status: FunctionalAuditStatus;
  readonly decision: FunctionalAuditDecision | null;
  readonly manifestRef: string;
  readonly runtime: {
    readonly location: "LOCAL" | "REFERENCE" | "REMOTE" | "AI";
    readonly network: "forbidden" | "reference-only" | "required";
  };
  readonly result: {
    readonly ref: string;
    readonly declaration: {
      readonly class: string;
      readonly capabilities: readonly string[];
    } | null;
  };
  readonly fixtureRefs: ReadonlyArray<{ readonly id: string; readonly ref: string }>;
  readonly oracleRef: { readonly entryId: string; readonly ref: string };
  readonly evidenceRefs: readonly string[];
  readonly recordRef: string | null;
}

const ticketPath = z.string().regex(
  /^\.scratch\/strumentini-expansion-20261005\/issues\/\d+-[a-z0-9-]+\.md$/u,
  "ticket path must point to the expansion backlog",
);

export const functionalAuditEvidenceSchema = z.object({
  kind: z.enum(FUNCTIONAL_EVIDENCE_KINDS),
  ref: z.string().min(1),
  claim: z.string().min(1),
}).strict();

export const functionalAuditAssignmentSchema = z.object({
  toolId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  category: z.string().min(1),
  ownerTicket: ticketPath,
  status: z.literal("pending"),
  decision: z.null(),
}).strict();

export const functionalAuditAssignmentIndexSchema = z.object({
  schemaVersion: z.literal(1),
  assignments: z.array(functionalAuditAssignmentSchema).length(200),
}).strict();

const manifestRef = z.string().regex(/^src\/tools\/[a-z0-9]+(?:-[a-z0-9]+)*\/manifest\.ts$/u);

export const functionalAuditInventoryEntrySchema = z.object({
  toolId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  category: z.string().min(1),
  ownerTicket: ticketPath,
  status: z.enum(FUNCTIONAL_AUDIT_STATUSES),
  decision: z.enum(FUNCTIONAL_AUDIT_DECISIONS).nullable(),
  manifestRef,
  runtime: z.object({
    location: z.enum(["LOCAL", "REFERENCE", "REMOTE", "AI"]),
    network: z.enum(["forbidden", "reference-only", "required"]),
  }).strict(),
  result: z.object({
    ref: z.string().regex(/^src\/tools\/[a-z0-9]+(?:-[a-z0-9]+)*\/manifest\.ts#result$/u),
    declaration: z.object({
      class: z.string().min(1),
      capabilities: z.array(z.string().min(1)),
    }).strict().nullable(),
  }).strict(),
  fixtureRefs: z.array(z.object({ id: z.string().min(1), ref: z.string().min(1) }).strict()).min(1),
  oracleRef: z.object({
    entryId: z.string().min(1),
    ref: z.string().regex(/^quality\/oracles\/registry\.json#[a-z0-9-]+$/u),
  }).strict(),
  evidenceRefs: z.array(z.string().min(1)),
  recordRef: z.string().regex(/^quality\/functional-audit\/records\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/u).nullable(),
}).strict().superRefine((entry, ctx) => {
  const decided = entry.status !== "PENDING";
  if (!decided && entry.decision !== null) {
    ctx.addIssue({ code: "custom", path: ["decision"], message: "PENDING inventory entries cannot declare a decision" });
  }
  if (!decided && entry.recordRef !== null) {
    ctx.addIssue({ code: "custom", path: ["recordRef"], message: "PENDING inventory entries cannot point to a final record" });
  }
  if (!decided && entry.evidenceRefs.length > 0) {
    ctx.addIssue({ code: "custom", path: ["evidenceRefs"], message: "PENDING inventory entries cannot be promoted by loose evidence refs" });
  }
  if (decided && entry.decision === null) {
    ctx.addIssue({ code: "custom", path: ["decision"], message: "decided inventory entries require the final audit decision" });
  }
  if (decided && entry.recordRef === null) {
    ctx.addIssue({ code: "custom", path: ["recordRef"], message: "decided inventory entries require a final record" });
  }
  if (decided && entry.evidenceRefs.length === 0) {
    ctx.addIssue({ code: "custom", path: ["evidenceRefs"], message: "a tool cannot be verified/refused without concrete evidence refs" });
  }
  if (entry.status === "REFUSED" && entry.decision !== "REFUSED") {
    ctx.addIssue({ code: "custom", path: ["decision"], message: "REFUSED inventory status requires a REFUSED decision" });
  }
  if (entry.status === "VERIFIED" && entry.decision !== "ALREADY_COMPLETE" && entry.decision !== "UPGRADED") {
    ctx.addIssue({ code: "custom", path: ["decision"], message: "VERIFIED inventory status requires ALREADY_COMPLETE or UPGRADED" });
  }
});

export const functionalAuditInventorySchema = z.object({
  schemaVersion: z.literal(1),
  entries: z.array(functionalAuditInventoryEntrySchema).length(200),
}).strict();

const VISUAL_ONLY_EVIDENCE = /(?:\bresult[ -]?v2\b|\brender(?:er|ing)?\b|\bvisual\b|\bscreenshot\b|\blayout\b|\bstyle\b|\bcss\b|\bappearance\b)/iu;

function evidenceProvesFunctionality(evidence: FunctionalAuditEvidence): boolean {
  return !VISUAL_ONLY_EVIDENCE.test(evidence.ref) && !VISUAL_ONLY_EVIDENCE.test(evidence.claim);
}

export const functionalAuditRecordSchema = z.object({
  toolId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  category: z.string().min(1),
  ownerTicket: ticketPath,
  decision: z.enum(FUNCTIONAL_AUDIT_DECISIONS),
  expectedFunctionality: z.string().min(1),
  observedFunctionality: z.string().min(1),
  rationale: z.string().min(1),
  evidence: z.array(functionalAuditEvidenceSchema).min(1),
  childTickets: z.array(ticketPath),
}).strict().superRefine((record, ctx) => {
  if (record.decision === "UPGRADED" && record.childTickets.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["childTickets"],
      message: "UPGRADED records require the targeted implementation ticket that changed functionality",
    });
  }
  if (record.decision === "UPGRADED" && !record.evidence.some(evidenceProvesFunctionality)) {
    ctx.addIssue({
      code: "custom",
      path: ["evidence"],
      message: "visual-only or Result-v2-only evidence cannot prove a functional UPGRADED decision",
    });
  }
});

export interface FunctionalAuditAssignmentReport {
  readonly ok: boolean;
  readonly issues: readonly string[];
}

export function validateFunctionalAuditAssignments(
  catalog: readonly { readonly id: string; readonly category: string }[],
  assignments: readonly FunctionalAuditAssignment[],
): FunctionalAuditAssignmentReport {
  const issues: string[] = [];
  const catalogById = new Map(catalog.map((entry) => [entry.id, entry]));
  const seen = new Set<string>();

  for (const assignment of assignments) {
    const parsed = functionalAuditAssignmentSchema.safeParse(assignment);
    if (!parsed.success) {
      issues.push(
        "invalid functional-audit assignment " + assignment.toolId + ": "
        + parsed.error.issues.map((issue) => (issue.path.join(".") || "assignment") + ": " + issue.message).join("; "),
      );
      continue;
    }
    if (seen.has(assignment.toolId)) {
      issues.push("duplicate functional-audit assignment: " + assignment.toolId);
      continue;
    }
    seen.add(assignment.toolId);
    const current = catalogById.get(assignment.toolId);
    if (current === undefined) {
      issues.push("stale functional-audit assignment: " + assignment.toolId);
      continue;
    }
    if (current.category !== assignment.category) {
      issues.push(
        assignment.toolId + ": category mismatch " + assignment.category + " != " + current.category,
      );
    }
    if (assignment.decision !== null) {
      issues.push(assignment.toolId + ": assignment index must not infer a final audit decision");
    }
    if (assignment.status !== "pending") {
      issues.push(assignment.toolId + ": assignment index status must remain pending until a final record exists");
    }
  }

  for (const entry of catalog) {
    if (!seen.has(entry.id)) issues.push("missing functional-audit assignment: " + entry.id);
  }
  return { ok: issues.length === 0, issues };
}

export function validateFunctionalAuditRecords(
  catalog: readonly { readonly id: string; readonly category: string }[],
  assignments: readonly FunctionalAuditAssignment[],
  rawRecords: readonly unknown[],
  requireComplete = false,
): { readonly ok: boolean; readonly issues: readonly string[]; readonly records: readonly FunctionalAuditRecord[] } {
  const issues: string[] = [];
  const records: FunctionalAuditRecord[] = [];
  const assignmentById = new Map(assignments.map((entry) => [entry.toolId, entry]));
  const seen = new Set<string>();

  rawRecords.forEach((raw, index) => {
    const parsed = functionalAuditRecordSchema.safeParse(raw);
    if (!parsed.success) {
      issues.push(
        "record[" + String(index) + "]: "
        + parsed.error.issues.map((issue) => (issue.path.join(".") || "record") + ": " + issue.message).join("; "),
      );
      return;
    }
    const record = parsed.data;
    if (seen.has(record.toolId)) {
      issues.push("duplicate functional-audit record: " + record.toolId);
      return;
    }
    seen.add(record.toolId);
    const assignment = assignmentById.get(record.toolId);
    if (assignment === undefined) {
      issues.push("orphan functional-audit record: " + record.toolId);
      return;
    }
    if (assignment.category !== record.category) {
      issues.push(record.toolId + ": record category does not match assignment");
    }
    if (assignment.ownerTicket !== record.ownerTicket) {
      issues.push(record.toolId + ": record owner ticket does not match assignment");
    }
    records.push(record as FunctionalAuditRecord);
  });

  const catalogIds = new Set(catalog.map((entry) => entry.id));
  for (const record of records) {
    if (!catalogIds.has(record.toolId)) issues.push("record references tool outside current catalog: " + record.toolId);
  }
  if (requireComplete) {
    for (const assignment of assignments) {
      if (!seen.has(assignment.toolId)) issues.push("missing final functional-audit record: " + assignment.toolId);
    }
  }
  return { ok: issues.length === 0, issues, records };
}

export function validateFunctionalAuditInventory(
  catalog: ReadonlyArray<{
    readonly id: string;
    readonly category: string;
    readonly runtime: FunctionalAuditInventoryEntry["runtime"];
    readonly result?: { readonly class: string; readonly capabilities: readonly string[] };
    readonly gold: { readonly oracleEntryId: string; readonly fixtureFamilies: readonly string[] };
  }>,
  assignments: readonly FunctionalAuditAssignment[],
  entries: readonly FunctionalAuditInventoryEntry[],
  fixturePathById: ReadonlyMap<string, string>,
): { readonly ok: boolean; readonly issues: readonly string[] } {
  const issues: string[] = [];
  const catalogById = new Map(catalog.map((entry) => [entry.id, entry]));
  const assignmentById = new Map(assignments.map((entry) => [entry.toolId, entry]));
  const seen = new Set<string>();

  for (const entry of entries) {
    const parsed = functionalAuditInventoryEntrySchema.safeParse(entry);
    if (!parsed.success) {
      issues.push(
        "invalid functional-audit inventory entry " + entry.toolId + ": "
        + parsed.error.issues.map((issue) => (issue.path.join(".") || "entry") + ": " + issue.message).join("; "),
      );
      continue;
    }
    if (seen.has(entry.toolId)) {
      issues.push("duplicate functional-audit inventory entry: " + entry.toolId);
      continue;
    }
    seen.add(entry.toolId);
    const tool = catalogById.get(entry.toolId);
    if (tool === undefined) {
      issues.push("stale functional-audit inventory entry: " + entry.toolId);
      continue;
    }
    const assignment = assignmentById.get(entry.toolId);
    if (assignment === undefined) {
      issues.push("inventory entry has no original-200 assignment: " + entry.toolId);
      continue;
    }
    if (entry.category !== tool.category || entry.category !== assignment.category) issues.push(entry.toolId + ": inventory category mismatch");
    if (entry.ownerTicket !== assignment.ownerTicket) issues.push(entry.toolId + ": inventory owner ticket mismatch");
    const expectedManifest = `src/tools/${tool.id}/manifest.ts`;
    if (entry.manifestRef !== expectedManifest) issues.push(entry.toolId + ": stale manifest ref");
    if (entry.result.ref !== `${expectedManifest}#result`) issues.push(entry.toolId + ": stale result ref");
    if (entry.runtime.location !== tool.runtime.location || entry.runtime.network !== tool.runtime.network) issues.push(entry.toolId + ": stale runtime binding");
    const expectedDeclaration = tool.result === undefined ? null : { class: tool.result.class, capabilities: [...tool.result.capabilities] };
    if (JSON.stringify(entry.result.declaration) !== JSON.stringify(expectedDeclaration)) issues.push(entry.toolId + ": stale result declaration");
    if (entry.oracleRef.entryId !== tool.gold.oracleEntryId || entry.oracleRef.ref !== `quality/oracles/registry.json#${tool.gold.oracleEntryId}`) {
      issues.push(entry.toolId + ": stale oracle binding");
    }
    const expectedFixtures = tool.gold.fixtureFamilies.map((id) => ({ id, ref: fixturePathById.get(id) ?? "" }));
    if (expectedFixtures.some(({ ref }) => ref === "")) issues.push(entry.toolId + ": fixture family missing from canonical index");
    if (JSON.stringify(entry.fixtureRefs) !== JSON.stringify(expectedFixtures)) issues.push(entry.toolId + ": stale fixture binding");
    if (new Set(entry.evidenceRefs).size !== entry.evidenceRefs.length) issues.push(entry.toolId + ": duplicate evidence refs");
  }
  for (const tool of catalog) if (!seen.has(tool.id)) issues.push("missing functional-audit inventory entry: " + tool.id);
  return { ok: issues.length === 0, issues };
}
