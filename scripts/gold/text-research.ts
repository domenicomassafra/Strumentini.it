import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ToolManifest } from "../../src/catalog/manifest";
import {
  compareLists,
  dedupeLines,
  diffText,
  MAX_DIFF_CELLS,
  parseListText,
  TEXT_LIST_ENGINE_VERSION,
} from "../../src/engines/text-list";
import {
  normalizeDoi,
  normalizeIsbn,
  RESEARCH_REFERENCE_ENGINE_VERSION,
} from "../../src/engines/research-reference";
import { doiIsbnNormalizerManifest } from "../../src/tools/doi-isbn-normalizer/manifest";
import { listCompareManifest } from "../../src/tools/list-compare/manifest";
import { textDiffManifest } from "../../src/tools/text-diff/manifest";
import { currentEvidenceSourceFingerprint, currentRevision } from "../lib/current-revision";

const root = resolve(import.meta.dirname, "../..");
const revision = await currentRevision(root);
const sourceFingerprint = await currentEvidenceSourceFingerprint(root);
const receiptRoot = resolve(root, "quality/receipts/text-research");

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function readJson<T>(path: string): Promise<{ text: string; value: T }> {
  const text = await readFile(path, "utf8");
  return { text, value: JSON.parse(text) as T };
}

interface FixtureEntry {
  id: string;
  path: string;
  truth_sources: string[];
}

interface FixtureIndex {
  schema_version: number;
  families: FixtureEntry[];
}

interface OracleEntry {
  id: string;
  candidate: string;
  truth_sources: string[];
}

interface OracleRegistry {
  schema_version: number;
  entries: OracleEntry[];
}

const fixtureIndexData = await readJson<FixtureIndex>(resolve(root, "quality/fixtures/index.json"));
const oracleRegistryData = await readJson<OracleRegistry>(resolve(root, "quality/oracles/registry.json"));
const issues: string[] = [];

function fixtureEntry(id: string): FixtureEntry {
  const entry = fixtureIndexData.value.families.find((candidate) => candidate.id === id);
  if (entry === undefined) throw new Error(`fixture index missing ${id}`);
  return entry;
}

function oracleEntry(id: string): OracleEntry {
  const entry = oracleRegistryData.value.entries.find((candidate) => candidate.id === id);
  if (entry === undefined) throw new Error(`oracle registry missing ${id}`);
  return entry;
}

function checkLocalManifest(manifest: ToolManifest) {
  if (manifest.runtime.location !== "LOCAL" || manifest.runtime.network !== "forbidden") {
    issues.push(`${manifest.id}: Gold requires LOCAL + network=forbidden`);
  }
  if (manifest.aliases.length === 0 || manifest.jobs.length === 0) {
    issues.push(`${manifest.id}: searchable aliases/jobs are required`);
  }
  for (const fixtureId of manifest.gold.fixtureFamilies) {
    try {
      fixtureEntry(fixtureId);
    } catch (error) {
      issues.push(error instanceof Error ? error.message : String(error));
    }
  }
  try {
    oracleEntry(manifest.gold.oracleEntryId);
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
  }
}

for (const manifest of [listCompareManifest, textDiffManifest, doiIsbnNormalizerManifest]) {
  checkLocalManifest(manifest);
}

const listFixture = await readJson<{
  schema_version: number;
  vectors: Array<{
    a: string[];
    b: string[];
    dedupe_a?: string[];
    intersection: string[];
    difference_a_minus_b: string[];
  }>;
}>(resolve(root, fixtureEntry("list-set-ops").path));

let listExactVectors = 0;
for (const vector of listFixture.value.vectors) {
  const comparison = compareLists(vector.a, vector.b, "exact");
  if (JSON.stringify(comparison.intersection) !== JSON.stringify(vector.intersection)) {
    issues.push(`list intersection fixture mismatch: ${JSON.stringify(vector)}`);
  }
  if (JSON.stringify(comparison.onlyLeft) !== JSON.stringify(vector.difference_a_minus_b)) {
    issues.push(`list difference fixture mismatch: ${JSON.stringify(vector)}`);
  }
  if (vector.dedupe_a !== undefined && JSON.stringify(dedupeLines(vector.a)) !== JSON.stringify(vector.dedupe_a)) {
    issues.push(`list dedupe fixture mismatch: ${JSON.stringify(vector)}`);
  }
  listExactVectors += 1;
}

const unicodeFixture = await readJson<{
  schema_version: number;
  vectors: Array<{ form: string; input: string; expected: string }>;
}>(resolve(root, fixtureEntry("unicode-normalization").path));
const nfcVector = unicodeFixture.value.vectors.find(({ form }) => form === "NFC");
if (nfcVector === undefined || dedupeLines([nfcVector.input, nfcVector.expected], "nfc").length !== 1) {
  issues.push("list NFC equality did not collapse the canonical Unicode fixture");
}
if (JSON.stringify(parseListText("a\r\nb\r\n")) !== JSON.stringify(["a", "b"])) {
  issues.push("list CRLF parsing fixture failed");
}

const propertySource = ["a", "b", "b", "c", "é", "e\u0301"];
const once = dedupeLines(propertySource, "nfc");
if (JSON.stringify(dedupeLines(once, "nfc")) !== JSON.stringify(once)) {
  issues.push("list dedupe idempotence failed");
}
const propertyOther = ["b", "d", "e\u0301"];
const forward = compareLists(propertySource, propertyOther, "nfc");
const reverse = compareLists(propertyOther, propertySource, "nfc");
const normalizedSet = (values: readonly string[]) => [...new Set(values.map((value) => value.normalize("NFC")))].sort();
if (JSON.stringify(normalizedSet(forward.intersection)) !== JSON.stringify(normalizedSet(reverse.intersection))) {
  issues.push("list intersection commutativity failed under NFC set semantics");
}
const otherKeys = new Set(propertyOther.map((value) => value.normalize("NFC")));
if (!forward.onlyLeft.every((value) => !otherKeys.has(value.normalize("NFC")))) {
  issues.push("list difference contains an element from the subtracting set");
}

const diffFixture = await readJson<{
  schema_version: number;
  vectors: Array<{
    before: string;
    after: string;
    expected_ops: Array<{ op: "equal" | "delete" | "insert"; text: string }>;
  }>;
}>(resolve(root, fixtureEntry("text-diff").path));

let diffExactVectors = 0;
for (const vector of diffFixture.value.vectors) {
  const operations = diffText(vector.before, vector.after);
  const actual = operations.map(({ kind, text }) => ({
    op: kind === "remove" ? "delete" : kind === "add" ? "insert" : "equal",
    text,
  }));
  if (JSON.stringify(actual) !== JSON.stringify(vector.expected_ops)) {
    issues.push(`text-diff fixture mismatch: ${JSON.stringify(vector)}`);
  }
  const reconstructedAfter = operations
    .filter(({ kind }) => kind !== "remove")
    .map(({ text }) => text)
    .join("");
  if (reconstructedAfter !== vector.after.replace(/\r\n|\r/gu, "\n")) {
    issues.push(`text-diff reconstruction mismatch: ${JSON.stringify(vector)}`);
  }
  diffExactVectors += 1;
}
const oversized = Array.from({ length: 1_001 }, (_, index) => `line-${index}`).join("\n");
try {
  diffText(oversized, oversized);
  issues.push("text-diff safety guard did not reject an oversized LCS matrix");
} catch (error) {
  if (!(error instanceof Error) || error.message !== "DIFF_TOO_LARGE") {
    issues.push(`text-diff safety guard returned the wrong failure: ${String(error)}`);
  }
}
if (diffText("a\r\nb\r\n", "a\nb\n").some(({ kind }) => kind !== "equal")) {
  issues.push("text-diff CRLF/LF normalization fixture failed");
}

const doiFixture = await readJson<{
  schema_version: number;
  vectors: Array<{ input: string; normalized: string; url: string }>;
}>(resolve(root, fixtureEntry("doi").path));
let doiExactVectors = 0;
for (const vector of doiFixture.value.vectors) {
  const actual = normalizeDoi(vector.input);
  if (!actual.valid || actual.normalized !== vector.normalized || actual.url !== vector.url) {
    issues.push(`DOI fixture mismatch: ${JSON.stringify(vector)} -> ${JSON.stringify(actual)}`);
  } else if (normalizeDoi(actual.normalized).valid === false) {
    issues.push(`DOI normalized value is not idempotently valid: ${actual.normalized}`);
  }
  doiExactVectors += 1;
}

const isbnFixture = await readJson<{
  schema_version: number;
  vectors: Array<{
    input: string;
    kind: "ISBN-10" | "ISBN-13";
    digits?: string;
    valid: boolean;
    isbn13?: string;
    reason?: string;
  }>;
}>(resolve(root, fixtureEntry("isbn").path));
let isbnExactVectors = 0;
for (const vector of isbnFixture.value.vectors) {
  const actual = normalizeIsbn(vector.input);
  if (actual.kind !== vector.kind || actual.valid !== vector.valid) {
    issues.push(`ISBN fixture kind/valid mismatch: ${JSON.stringify(vector)} -> ${JSON.stringify(actual)}`);
  }
  if (vector.digits !== undefined && (!("digits" in actual) || actual.digits !== vector.digits)) {
    issues.push(`ISBN fixture digits mismatch: ${JSON.stringify(vector)} -> ${JSON.stringify(actual)}`);
  }
  if (vector.isbn13 !== undefined && (!("isbn13" in actual) || actual.isbn13 !== vector.isbn13)) {
    issues.push(`ISBN fixture conversion mismatch: ${JSON.stringify(vector)} -> ${JSON.stringify(actual)}`);
  }
  if (vector.reason !== undefined && (!("reason" in actual) || actual.reason !== vector.reason)) {
    issues.push(`ISBN fixture reason mismatch: ${JSON.stringify(vector)} -> ${JSON.stringify(actual)}`);
  }
  isbnExactVectors += 1;
}

if (issues.length > 0) {
  console.error(issues.join("\n"));
  process.exit(1);
}

await mkdir(receiptRoot, { recursive: true });

async function writeReceipt(options: {
  manifest: ToolManifest;
  manifestPath: string;
  enginePath: string;
  engineVersion: string;
  fixtureIds: string[];
  oracleIds: string[];
  exactVectors: number;
  propertyChecks: string[];
}) {
  const manifestText = await readFile(resolve(root, options.manifestPath), "utf8");
  const engineText = await readFile(resolve(root, options.enginePath), "utf8");
  const resolvedFixtures = await Promise.all(options.fixtureIds.map(async (id) => {
    const entry = fixtureEntry(id);
    const text = await readFile(resolve(root, entry.path), "utf8");
    return { id, path: entry.path, sha256: sha256(text), schemaVersion: (JSON.parse(text) as { schema_version?: number }).schema_version ?? null };
  }));
  const truthSources = [...new Set([
    ...options.oracleIds.flatMap((id) => oracleEntry(id).truth_sources),
    ...options.fixtureIds.flatMap((id) => fixtureEntry(id).truth_sources),
  ])].sort();
  const receipt = {
    schemaVersion: 1,
    toolId: options.manifest.id,
    status: "GOLD",
    revision,
    sourceFingerprint,
    runtime: options.manifest.runtime,
    maintenanceClass: options.manifest.gold.maintenanceClass,
    oracleEntryIds: options.oracleIds,
    fixtureFamilies: options.fixtureIds,
    exactVectors: options.exactVectors,
    propertyChecks: options.propertyChecks,
    engineVersion: options.engineVersion,
    limits: options.manifest.id === "text-diff" ? { maxLcsCells: MAX_DIFF_CELLS } : undefined,
    truthSources,
    resolvedFixtures,
    fixtureIndexSchemaVersion: fixtureIndexData.value.schema_version,
    oracleRegistrySchemaVersion: oracleRegistryData.value.schema_version,
    identities: {
      manifestSha256: sha256(manifestText),
      engineSha256: sha256(engineText),
      fixtureIndexSha256: sha256(fixtureIndexData.text),
      oracleRegistrySha256: sha256(oracleRegistryData.text),
    },
  };
  await writeFile(resolve(receiptRoot, `${options.manifest.id}.gold.json`), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`Gold PASS: ${options.manifest.id}, ${options.exactVectors} exact vector(s)`);
}

await writeReceipt({
  manifest: listCompareManifest,
  manifestPath: "src/tools/list-compare/manifest.ts",
  enginePath: "src/engines/text-list/index.ts",
  engineVersion: TEXT_LIST_ENGINE_VERSION,
  fixtureIds: ["list-set-ops", "unicode-normalization", "whitespace-normalization"],
  oracleIds: ["cand-009", "cand-010", "cand-011"],
  exactVectors: listExactVectors,
  propertyChecks: ["dedupe idempotence", "intersection commutativity under NFC set semantics", "difference exclusion", "CRLF/LF parsing"],
});

await writeReceipt({
  manifest: textDiffManifest,
  manifestPath: "src/tools/text-diff/manifest.ts",
  enginePath: "src/engines/text-list/index.ts",
  engineVersion: TEXT_LIST_ENGINE_VERSION,
  fixtureIds: ["text-diff", "whitespace-normalization"],
  oracleIds: ["cand-013"],
  exactVectors: diffExactVectors,
  propertyChecks: ["after reconstruction", "CRLF/LF equivalence", "1,000,000-cell LCS guard"],
});

await writeReceipt({
  manifest: doiIsbnNormalizerManifest,
  manifestPath: "src/tools/doi-isbn-normalizer/manifest.ts",
  enginePath: "src/engines/research-reference/index.ts",
  engineVersion: RESEARCH_REFERENCE_ENGINE_VERSION,
  fixtureIds: ["doi", "isbn"],
  oracleIds: ["cand-181", "cand-183"],
  exactVectors: doiExactVectors + isbnExactVectors,
  propertyChecks: ["DOI normalization idempotence", "ISBN-10/13 check digits", "ISBN-10 to 978 ISBN-13 conversion", "no metadata resolution"],
});
