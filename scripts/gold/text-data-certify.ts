import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ToolModule } from "../../src/runtime/types";
import { currentEvidenceSourceFingerprint, currentRevision } from "../lib/current-revision";

type JsonRecord = Record<string, unknown>;
type ManifestLike = {
  id: string;
  runtime: { location: string; network: string };
  gold: { maintenanceClass: string; oracleEntryId: string; fixtureFamilies: readonly string[] };
};
type Candidate = { id: string; focusedTests: readonly string[] };

const candidates: readonly Candidate[] = [
  { id: "csv-splitter", focusedTests: ["tests/table-advanced-operations.test.ts"] },
  { id: "csv-to-sql", focusedTests: ["tests/table-advanced-operations.test.ts"] },
  { id: "fatturapa-batch-csv", focusedTests: ["tests/italy-public-routes.test.ts"] },
  { id: "fact-sensitive-text-diff", focusedTests: ["tests/text-expansion.test.ts"] },
  { id: "italian-gulpease-readability", focusedTests: ["tests/text-expansion.test.ts"] },
  { id: "mojibake-repair", focusedTests: ["tests/text-expansion.test.ts"] },
  { id: "pdf-copy-text-reflow", focusedTests: ["tests/text-expansion.test.ts"] },
  { id: "phone-link-hashtag-mention-extractor", focusedTests: ["tests/text-expansion.test.ts"] },
  { id: "semantic-text-chunker", focusedTests: ["tests/text-expansion.test.ts"] },
  { id: "stable-placeholder-anonymizer", focusedTests: ["tests/text-expansion.test.ts"] },
  { id: "table-compare", focusedTests: ["tests/table-advanced-operations.test.ts"] },
  { id: "text-markup-converter", focusedTests: ["tests/text-markup-conversion.test.ts"] },
  { id: "vcf-viewer-csv-export", focusedTests: ["tests/vcf-x509-tools.test.ts"] },
] as const;

if (candidates.length !== 13 || new Set(candidates.map(({ id }) => id)).size !== 13) throw new Error("text/data certification target must contain exactly 13 unique tools");

const boundedGapPatterns: Readonly<Record<string, readonly RegExp[]>> = {
  "cand-226": [/Legacy charset conversion.*intentionally unsupported.*raw properties/iu],
  "cand-228": [/Vendor-specific bulk loaders.*database execution.*outside scope/iu],
  "cand-229": [/bounded-memory claim applies to duplicate source\/input parsing buffers.*output storage/iu],
  "cand-230": [/duplicate keys.*intentionally does not guess pairings/iu],
  "cand-231": [/deterministic lexical punctuation\/whitespace policy rather than linguistic sentence understanding/iu],
  "cand-232": [/cannot determine whether a changed or unchanged token is factually correct/iu],
  "cand-233": [/not advertised as cryptographic anonymization/iu],
  "cand-234": [/Sentence tokenization conventions vary.*declares its punctuation and abbreviation policy/iu],
  "cand-235": [/Only the declared common UTF-8-as-Windows-1252 corruption direction is repaired automatically/iu],
  "cand-236": [/page-column reconstruction and dictionary-based dehyphenation.*intentionally outside.*text-only mode/iu],
  "cand-237": [/Phone matching is locale-neutral and conservative.*does not validate numbering-plan existence/iu],
  "cand-241": [
    /not a complete CommonMark or GFM parser.*explicitly outside the supported subset/iu,
    /named character references.*common named set.*unknown named references are preserved literally/iu,
    /Complex HTML table layout.*intentionally flattened or dropped with disclosure/iu,
  ],
  "cand-259": [/Simplified invoices.*reconciliation unavailable rather than inventing one/iu],
};

const root = resolve(import.meta.dirname, "../..");
const receiptRoot = resolve(root, "quality/receipts/text-data-certification");
const writeReceipts = process.argv.includes("--write");
const sha256 = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");
const isRecord = (value: unknown): value is JsonRecord => typeof value === "object" && value !== null && !Array.isArray(value);

function assertBoundedOracle(oracleId: string, oracle: JsonRecord): void {
  const expected = boundedGapPatterns[oracleId];
  if (expected === undefined) throw new Error(`${oracleId}: no explicit bounded-gap policy`);
  const gaps = Array.isArray(oracle.unresolved_gaps) ? oracle.unresolved_gaps.filter((value): value is string => typeof value === "string") : [];
  if (gaps.length !== expected.length) throw new Error(`${oracleId}: unresolved gap count changed (${gaps.length} != ${expected.length})`);
  const matched = new Set<number>();
  for (const gap of gaps) {
    const index = expected.findIndex((pattern) => pattern.test(gap));
    if (index < 0) throw new Error(`${oracleId}: unbounded or changed oracle gap: ${gap}`);
    matched.add(index);
  }
  if (matched.size !== expected.length) throw new Error(`${oracleId}: bounded-gap policy is not one-to-one with oracle gaps`);
}

function assertObjectSubset(actual: unknown, expected: JsonRecord, label: string): void {
  if (!isRecord(actual)) throw new Error(`${label}: result is not an object`);
  for (const [key, value] of Object.entries(expected)) {
    if (!Object.is(actual[key], value)) throw new Error(`${label}.${key}: expected ${JSON.stringify(value)}, got ${JSON.stringify(actual[key])}`);
  }
}

async function loadToolModule(id: string): Promise<ToolModule> {
  const imported = await import(pathToFileURL(resolve(root, `src/tools/${id}/module.ts`)).href) as { default?: ToolModule };
  if (imported.default === undefined) throw new Error(`${id}: module default export missing`);
  return imported.default;
}

async function runTool(id: string, input: unknown): Promise<unknown> {
  return (await loadToolModule(id)).run(input, { defaults: {} });
}

async function replayFixtures(toolId: string): Promise<number> {
  if (["csv-to-sql", "csv-splitter", "table-compare"].includes(toolId)) {
    const fixture = JSON.parse(await readFile(resolve(root, "quality/fixtures/csv-advanced-ops/vectors.json"), "utf8")) as JsonRecord;
    if (toolId === "csv-to-sql") {
      const vector = (fixture.sql as JsonRecord[])[0]!;
      for (const dialect of ["postgresql", "mysql", "sqlite"] as const) {
        const actual = await runTool(toolId, {
          text: vector.csv,
          dialect,
          tableName: vector.table_name,
          nullTokens: vector.null_tokens,
          emptyAsNull: vector.empty_as_null,
          includeCreateTable: true,
        });
        if (!isRecord(actual) || typeof actual.output !== "string") throw new Error(`${toolId}: ${dialect} fixture output missing`);
        if (!actual.output.includes("00123") || !actual.output.includes("O''Reilly") || !actual.output.includes("NULL")) throw new Error(`${toolId}: ${dialect} fixture quoting/null policy mismatch`);
        if (dialect === "postgresql" && !actual.output.includes('CREATE TABLE "order""book"')) throw new Error(`${toolId}: PostgreSQL identifier quoting mismatch`);
        if (dialect === "mysql" && !actual.output.includes("CREATE TABLE `order\"book`")) throw new Error(`${toolId}: MySQL identifier quoting mismatch`);
        if (dialect === "sqlite" && !actual.output.includes('CREATE TABLE "order""book"')) throw new Error(`${toolId}: SQLite identifier quoting mismatch`);
      }
      return 3;
    }
    if (toolId === "csv-splitter") {
      const vector = (fixture.split as JsonRecord[])[0]!;
      const actual = await runTool(toolId, { text: vector.csv, mode: vector.mode, rowsPerChunk: vector.rows_per_chunk });
      assertObjectSubset(actual, { rowCount: vector.expected_data_rows, delimiter: vector.expected_delimiter, recordSeparator: vector.expected_record_separator }, toolId);
      if (!isRecord(actual) || !Array.isArray(actual.chunks) || actual.chunks.length !== 2) throw new Error(`${toolId}: expected two chunks`);
      const counts = actual.chunks.map((entry) => isRecord(entry) ? entry.rowCount : undefined);
      if (JSON.stringify(counts) !== JSON.stringify([2, 1])) throw new Error(`${toolId}: row chunk counts mismatch`);
      return 1;
    }
    const vector = (fixture.compare as JsonRecord[])[0]!;
    const actual = await runTool(toolId, {
      leftText: vector.left,
      rightText: vector.right,
      leftKeyColumns: vector.key_columns,
      rightKeyColumns: vector.key_columns,
      leftCompareColumns: vector.compare_columns,
      rightCompareColumns: vector.compare_columns,
      caseSensitive: vector.case_sensitive,
      nullTokens: vector.null_tokens,
      emptyAsNull: vector.empty_as_null,
    });
    const expected = vector.expected as JsonRecord;
    if (!isRecord(actual)) throw new Error(`${toolId}: compare output missing`);
    const observed = {
      added_rows: actual.addedRows,
      removed_rows: actual.removedRows,
      changed_rows: actual.changedRows,
      changed_cells: Array.isArray(actual.changedCells) ? actual.changedCells.length : -1,
      ambiguous_keys: Array.isArray(actual.ambiguousKeys) ? actual.ambiguousKeys.length : -1,
    };
    assertObjectSubset(observed, expected, toolId);
    return 1;
  }

  if (["semantic-text-chunker", "fact-sensitive-text-diff", "stable-placeholder-anonymizer", "italian-gulpease-readability", "mojibake-repair", "pdf-copy-text-reflow", "phone-link-hashtag-mention-extractor"].includes(toolId)) {
    const fixture = JSON.parse(await readFile(resolve(root, "quality/fixtures/text-expansion/vectors.json"), "utf8")) as JsonRecord;
    if (toolId === "semantic-text-chunker") {
      const vector = (fixture.chunker as JsonRecord[])[0]!;
      const actual = await runTool(toolId, { text: vector.input, targetCharacters: vector.target_characters, overlapCharacters: vector.overlap_characters });
      if (!isRecord(actual) || actual.exactRoundTrip !== vector.expect_exact_roundtrip || actual.restored !== vector.input) throw new Error(`${toolId}: exact round-trip fixture failed`);
      return 1;
    }
    if (toolId === "fact-sensitive-text-diff") {
      const vector = (fixture.fact_diff as JsonRecord[])[0]!;
      const actual = await runTool(toolId, { before: vector.before, after: vector.after });
      if (!isRecord(actual) || !isRecord(actual.priorityChanges)) throw new Error(`${toolId}: priority changes missing`);
      const entries = [...((actual.priorityChanges.removed as JsonRecord[] | undefined) ?? []), ...((actual.priorityChanges.added as JsonRecord[] | undefined) ?? [])];
      const kinds = new Set(entries.map((entry) => entry.kind));
      for (const kind of vector.expected_kinds as string[]) if (!kinds.has(kind)) throw new Error(`${toolId}: expected ${kind} marker missing`);
      if (typeof actual.limitation !== "string" || !/does not verify factual truth/iu.test(actual.limitation)) throw new Error(`${toolId}: no-truth limitation missing`);
      return 1;
    }
    if (toolId === "stable-placeholder-anonymizer") {
      const vector = (fixture.placeholder as JsonRecord[])[0]!;
      const anonymized = await runTool(toolId, { text: vector.text, mode: "anonymize", entities: vector.entities });
      if (!isRecord(anonymized) || typeof anonymized.output !== "string" || !Array.isArray(anonymized.mapping) || anonymized.output.includes("Mario Rossi")) throw new Error(`${toolId}: anonymize fixture failed`);
      const restored = await runTool(toolId, { text: anonymized.output, mode: "restore", mapping: anonymized.mapping });
      if (!isRecord(restored) || restored.output !== vector.text) throw new Error(`${toolId}: restore fixture failed`);
      let refused = false;
      try {
        await runTool(toolId, { text: anonymized.output.replace(String((anonymized.mapping[0] as JsonRecord).placeholder), "[mutated]"), mode: "restore", mapping: anonymized.mapping });
      } catch { refused = true; }
      if (!refused) throw new Error(`${toolId}: mutated mapping did not fail closed`);
      return 1;
    }
    if (toolId === "italian-gulpease-readability") {
      const vector = (fixture.gulpease as JsonRecord[])[0]!;
      const actual = await runTool(toolId, { text: vector.text });
      assertObjectSubset(actual, { letters: vector.letters, words: vector.words, sentences: vector.sentences, score: vector.score }, toolId);
      return 1;
    }
    if (toolId === "mojibake-repair") {
      const vector = (fixture.mojibake as JsonRecord[])[0]!;
      const actual = await runTool(toolId, { text: vector.input });
      assertObjectSubset(actual, { accepted: true, output: vector.output }, toolId);
      const second = await runTool(toolId, { text: vector.output });
      if (!isRecord(second) || second.output !== vector.output || second.changed !== false) throw new Error(`${toolId}: second-pass idempotence failed`);
      return 1;
    }
    if (toolId === "pdf-copy-text-reflow") {
      let count = 0;
      for (const vector of fixture.pdf_reflow as JsonRecord[]) {
        const actual = await runTool(toolId, { text: vector.input });
        if (!isRecord(actual) || actual.output !== vector.output) throw new Error(`${toolId}: ${String(vector.name)} output mismatch`);
        if (typeof vector.ambiguity_count === "number" && (!Array.isArray(actual.hyphenationAmbiguities) || actual.hyphenationAmbiguities.length !== vector.ambiguity_count)) throw new Error(`${toolId}: ambiguity count mismatch`);
        count += 1;
      }
      return count;
    }
    if (toolId === "phone-link-hashtag-mention-extractor") {
      const vector = (fixture.extractor as JsonRecord[])[0]!;
      const actual = await runTool(toolId, { text: vector.input });
      if (!isRecord(actual) || !Array.isArray(actual.matches)) throw new Error(`${toolId}: matches missing`);
      const kinds = actual.matches.map((entry) => isRecord(entry) ? entry.kind : undefined);
      if (JSON.stringify(kinds) !== JSON.stringify(vector.expected_types)) throw new Error(`${toolId}: match types/order mismatch`);
      for (const entry of actual.matches) {
        if (!isRecord(entry) || typeof entry.start !== "number" || typeof entry.end !== "number" || typeof entry.original !== "string" || String(vector.input).slice(entry.start, entry.end) !== entry.original) throw new Error(`${toolId}: source span mismatch`);
      }
      return 1;
    }
  }

  if (toolId === "text-markup-converter") {
    const fixture = JSON.parse(await readFile(resolve(root, "quality/fixtures/text-markup-conversion/vectors.json"), "utf8")) as { vectors: JsonRecord[] };
    let count = 0;
    for (const vector of fixture.vectors) {
      const actual = await runTool(toolId, { mode: vector.mode, text: vector.input });
      if (!isRecord(actual) || actual.output !== vector.expected_output) throw new Error(`${toolId}: ${String(vector.id)} exact output mismatch`);
      for (const token of (vector.must_not_contain_preview as string[] | undefined) ?? []) if (String(actual.previewHtml).includes(token)) throw new Error(`${toolId}: ${String(vector.id)} unsafe preview token survived: ${token}`);
      if (typeof vector.expected_dropped_contains === "string" && (!Array.isArray(actual.droppedConstructs) || !actual.droppedConstructs.some((entry) => typeof entry === "string" && entry.includes(String(vector.expected_dropped_contains))))) throw new Error(`${toolId}: ${String(vector.id)} disclosure missing`);
      count += 1;
    }
    return count;
  }

  if (toolId === "vcf-viewer-csv-export") {
    const fixture = JSON.parse(await readFile(resolve(root, "quality/fixtures/vcard-rfc6350/vectors.json"), "utf8")) as { vectors: JsonRecord[] };
    const vector = fixture.vectors[0]!;
    const actual = await runTool(toolId, { text: vector.vcf });
    if (!isRecord(actual) || !Array.isArray(actual.contacts) || typeof actual.csv !== "string") throw new Error(`${toolId}: parse result missing`);
    const expected = vector.expected as JsonRecord;
    if (actual.contacts.length !== expected.contacts) throw new Error(`${toolId}: contact count mismatch`);
    const first = actual.contacts[0] as JsonRecord;
    if (!Array.isArray(first.phones) || first.phones.length !== expected.first_phones || !Array.isArray(first.emails) || first.emails.length !== expected.first_emails) throw new Error(`${toolId}: repeated values mismatch`);
    if (!Array.isArray(first.notes) || first.notes[0] !== expected.first_note) throw new Error(`${toolId}: folded note mismatch`);
    if (!Array.isArray(first.unsupported) || !first.unsupported.some((entry) => isRecord(entry) && entry.name === expected.unsupported_name)) throw new Error(`${toolId}: unsupported property missing`);
    if (!actual.csv.includes(`"${String(expected.csv_formula_cell)}"`)) throw new Error(`${toolId}: formula-safe CSV cell missing`);
    return 1;
  }

  if (toolId === "fatturapa-batch-csv") {
    const ordinary = await readFile(resolve(root, "quality/fixtures/italy-2026-consumers/fatturapa-ordinary-anonymized.xml"), "utf8");
    const simplified = await readFile(resolve(root, "quality/fixtures/italy-2026-consumers/fatturapa-simplified-anonymized.xml"), "utf8");
    const hostile = ordinary.replace("<p:FatturaElettronica", '<!DOCTYPE invoice [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>\n<p:FatturaElettronica');
    const namedBlob = (text: string, name: string) => Object.assign(new Blob([text], { type: "application/xml" }), { name });
    const actual = await runTool(toolId, { files: [namedBlob(ordinary, "ordinary.xml"), namedBlob(simplified, "simple.xml"), namedBlob(hostile, "hostile.xml")] });
    assertObjectSubset(actual, { fileCount: 3, invoiceRowCount: 3, okFileCount: 2, errorFileCount: 1, completeExport: true }, toolId);
    if (!isRecord(actual) || !Array.isArray(actual.rows) || typeof actual.csv !== "string") throw new Error(`${toolId}: batch rows/CSV missing`);
    const ordinaryRow = actual.rows.find((row) => isRecord(row) && row.filename === "ordinary.xml") as JsonRecord | undefined;
    if (ordinaryRow?.transmissionFormat !== "FPR12" || ordinaryRow?.documentTotal !== "122.00" || ordinaryRow?.representedGrandTotal !== "122.00" || ordinaryRow?.totalsReconciliation !== "matched") throw new Error(`${toolId}: ordinary total reconciliation mismatch`);
    const simpleRow = actual.rows.find((row) => isRecord(row) && row.filename === "simple.xml") as JsonRecord | undefined;
    if (simpleRow?.transmissionFormat !== "FSM10" || simpleRow?.totalsReconciliation !== "unavailable") throw new Error(`${toolId}: simplified bounded reconciliation policy mismatch`);
    if (!actual.csv.startsWith("filename,fileStatus,bodyIndex,schemaFamily,transmissionFormat,xsdVersion")) throw new Error(`${toolId}: canonical CSV header missing`);
    return 3;
  }

  throw new Error(`${toolId}: no fixture replay adapter`);
}

const [registryText, fixtureIndexText] = await Promise.all([
  readFile(resolve(root, "quality/oracles/registry.json"), "utf8"),
  readFile(resolve(root, "quality/fixtures/index.json"), "utf8"),
]);
const registry = JSON.parse(registryText) as { entries: JsonRecord[] };
const fixtureIndex = JSON.parse(fixtureIndexText) as { families: JsonRecord[] };
const sourceFingerprint = await currentEvidenceSourceFingerprint(root);
const revision = await currentRevision(root);
const promotable: string[] = [];
const blocked: Array<{ id: string; reasons: string[] }> = [];
await mkdir(receiptRoot, { recursive: true });

for (const candidate of candidates) {
  const reasons: string[] = [];
  let manifest: ManifestLike | undefined;
  try {
    const imported = await import(pathToFileURL(resolve(root, `src/tools/${candidate.id}/manifest.ts`)).href) as { default?: ManifestLike };
    manifest = imported.default;
    if (manifest?.id !== candidate.id) reasons.push("MANIFEST_IMPORT_INVALID");
  } catch (error) {
    reasons.push(`MANIFEST_IMPORT_FAILED:${error instanceof Error ? error.message : String(error)}`);
  }
  const oracle = manifest === undefined ? undefined : registry.entries.find((entry) => entry.id === manifest!.gold.oracleEntryId);
  if (oracle === undefined) reasons.push("ORACLE_MISSING");
  if (oracle?.confidence !== "high") reasons.push("ORACLE_NOT_HIGH_CONFIDENCE");
  if (manifest !== undefined && oracle?.maintenance_class !== manifest.gold.maintenanceClass) reasons.push(`MAINTENANCE_CLASS_MISMATCH:${manifest.gold.maintenanceClass}!=${String(oracle?.maintenance_class)}`);
  if (manifest !== undefined && (manifest.runtime.location !== "LOCAL" || manifest.runtime.network !== "forbidden")) reasons.push("LOCAL_NETWORK_POLICY_INVALID");
  if (oracle !== undefined && manifest !== undefined) {
    try { assertBoundedOracle(manifest.gold.oracleEntryId, oracle); } catch (error) { reasons.push(`BOUNDED_GAP_POLICY_FAILED:${error instanceof Error ? error.message : String(error)}`); }
  }

  const fixtureRecords = manifest === undefined ? [] : manifest.gold.fixtureFamilies.map((id) => fixtureIndex.families.find((entry) => entry.id === id));
  if (fixtureRecords.some((entry) => entry === undefined)) reasons.push("FIXTURE_INDEX_BINDING_MISSING");
  for (const testPath of candidate.focusedTests) {
    try { await readFile(resolve(root, testPath)); } catch { reasons.push(`FOCUSED_TEST_MISSING:${testPath}`); }
  }
  const browserPath = `quality/receipts/text-data-certification/browser/${candidate.id}.json`;
  const browserText = await readFile(resolve(root, browserPath), "utf8").catch(() => "");
  const browser = browserText === "" ? undefined : JSON.parse(browserText) as JsonRecord;
  if (browser?.status !== "PASS" || browser.subjectToolId !== candidate.id || !isRecord(browser.result) || browser.result.status !== "PASS") reasons.push("PER_TOOL_BROWSER_EVIDENCE_MISSING_OR_NOT_PASS");
  if (browser !== undefined && browser.sourceFingerprint !== sourceFingerprint) reasons.push("BROWSER_ACCEPTANCE_SOURCE_FINGERPRINT_STALE");
  if (isRecord(browser?.result) && (browser.result.externalRequests !== 0 || browser.result.nonGetRequests !== 0 || browser.result.taskBodyLeaks !== 0 || browser.result.runtimeErrors !== 0 || browser.result.horizontalOverflow !== false || browser.result.unlabeledControls !== 0)) reasons.push("BROWSER_POLICY_ASSERTION_FAILED");

  let replayCount = 0;
  if (reasons.length === 0) {
    try { replayCount = await replayFixtures(candidate.id); } catch (error) { reasons.push(`FIXTURE_REPLAY_FAILED:${error instanceof Error ? error.message : String(error)}`); }
  }
  if (replayCount < 1 && reasons.length === 0) reasons.push("FIXTURE_REPLAY_EMPTY");

  if (reasons.length > 0 || manifest === undefined || oracle === undefined) {
    blocked.push({ id: candidate.id, reasons });
    console.log(`Gold BLOCKED: ${candidate.id}: ${reasons.join(" | ")}`);
    continue;
  }
  promotable.push(candidate.id);
  console.log(`Gold-ready PASS: ${candidate.id}, ${replayCount} fixture replay(s)`);
  if (!writeReceipts) continue;

  const resolvedFixtures = manifest.gold.fixtureFamilies.map((id) => fixtureIndex.families.find((entry) => entry.id === id)!);
  const fixtureIdentities = Object.fromEntries(await Promise.all(resolvedFixtures.map(async (entry) => {
    const id = String(entry.id);
    const path = String(entry.path);
    return [`fixture:${id}:sha256`, sha256(await readFile(resolve(root, path)))] as const;
  })));
  const focusedTestsText = (await Promise.all(candidate.focusedTests.map((path) => readFile(resolve(root, path), "utf8")))).join("\n");
  const manifestText = await readFile(resolve(root, `src/tools/${candidate.id}/manifest.ts`), "utf8");
  const moduleText = await readFile(resolve(root, `src/tools/${candidate.id}/module.ts`), "utf8");
  const receiptPath = `quality/receipts/text-data-certification/${candidate.id}.gold.json`;
  const receipt = {
    schemaVersion: 1,
    status: "GOLD",
    goldEligible: true,
    receiptPath,
    revision,
    sourceFingerprint,
    toolId: candidate.id,
    runtime: manifest.runtime,
    maintenanceClass: manifest.gold.maintenanceClass,
    oracleEntryId: manifest.gold.oracleEntryId,
    fixtureFamilies: manifest.gold.fixtureFamilies,
    exactVectors: replayCount,
    boundedOracleGaps: oracle.unresolved_gaps,
    truthSources: [...new Set([...(oracle.truth_sources as string[]), ...resolvedFixtures.flatMap((entry) => Array.isArray(entry.truth_sources) ? entry.truth_sources.filter((value): value is string => typeof value === "string") : [])])].sort(),
    resolvedFixtures: resolvedFixtures.map((entry) => ({ id: String(entry.id), path: String(entry.path) })),
    focusedTests: candidate.focusedTests,
    propertyChecks: [
      "LOCAL runtime with network forbidden",
      "high-confidence oracle and exact explicit bounded-gap policy",
      "manifest maintenance class matches oracle",
      "fixture replay through the public tool module",
      "per-tool semantic browser assertion at 390px",
      "zero external/non-GET/task-body requests after browser task start",
      "keyboard submit and accessible form controls",
      "focused semantic/refusal-boundary tests bound by content identity",
    ],
    identities: {
      manifestSha256: sha256(manifestText),
      moduleSha256: sha256(moduleText),
      oracleRegistrySha256: sha256(registryText),
      fixtureIndexSha256: sha256(fixtureIndexText),
      browserAcceptanceSha256: sha256(browserText),
      browserAcceptanceSourceFingerprint: String(browser?.sourceFingerprint ?? ""),
      focusedTestsSha256: sha256(focusedTestsText),
      ...fixtureIdentities,
    },
  };
  await writeFile(resolve(root, receiptPath), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
}

console.log(`text/data Gold gate: ${promotable.length} promotable, ${blocked.length} blocked${writeReceipts ? ", promotable receipts written" : ", check-only"}`);
console.log(`promotable: ${promotable.join(", ")}`);
if (blocked.length > 0) console.log(`blocked: ${blocked.map(({ id, reasons }) => `${id} [${reasons.join("; ")}]`).join(", ")}`);
if (blocked.length > 0) process.exitCode = 1;
