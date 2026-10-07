import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ToolManifest } from "../../src/catalog/manifest";
import type { ToolModule } from "../../src/runtime/types";
import { currentEvidenceSourceFingerprint, currentRevision } from "../lib/current-revision";

type JsonRecord = Record<string, unknown>;

interface Candidate {
  readonly id: string;
  readonly focusedTests: readonly string[];
}

const candidates: readonly Candidate[] = [
  { id: "base-converter", focusedTests: ["tests/developer-network-numeric.test.ts"] },
  { id: "chmod-permission-helper", focusedTests: ["tests/developer-network-numeric.test.ts"] },
  { id: "cidr-calculator", focusedTests: ["tests/developer-network-numeric.test.ts"] },
  { id: "connection-device-info", focusedTests: ["tests/browser-diagnostics.test.ts"] },
  { id: "css-design-helper", focusedTests: ["tests/css-design-helper.test.ts"] },
  { id: "css-minifier", focusedTests: ["tests/developer-minifiers.test.ts"] },
  { id: "html-minifier", focusedTests: ["tests/developer-minifiers.test.ts"] },
  { id: "json-repair", focusedTests: ["tests/developer-structured-data.test.ts"] },
  { id: "json-structural-diff", focusedTests: ["tests/developer-structured-data.test.ts"] },
  { id: "json-type-schema-inference", focusedTests: ["tests/developer-structured-data.test.ts"] },
  { id: "keyboard-event-diagnostic", focusedTests: ["tests/browser-diagnostics.test.ts"] },
  { id: "password-pin-passphrase-generator", focusedTests: ["tests/password-security-tools.test.ts"] },
  { id: "password-strength-estimator", focusedTests: ["tests/password-security-tools.test.ts"] },
  { id: "random-picker-team-coupon-generator", focusedTests: ["tests/random-utilities.test.ts"] },
  { id: "sitemap-xml-generator", focusedTests: ["tests/sitemap-xml-generator.test.ts"] },
  { id: "x509-csr-inspector", focusedTests: ["tests/vcf-x509-tools.test.ts"] },
  { id: "xml-formatter-validator", focusedTests: ["tests/developer-structured-data.test.ts"] },
] as const;

if (candidates.length !== 17 || new Set(candidates.map(({ id }) => id)).size !== 17) throw new Error("developer/web operations certification target must contain exactly 17 unique tools");

const expectedBlocked = new Set<string>();
const root = resolve(import.meta.dirname, "../..");
const writeReceipts = process.argv.includes("--write");
const acceptancePath = "quality/receipts/developer-web-operations/browser-acceptance.json";
const receiptRoot = resolve(root, "quality/receipts/developer-web-operations");
const sha256 = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");
const isRecord = (value: unknown): value is JsonRecord => typeof value === "object" && value !== null && !Array.isArray(value);

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertSubset(actual: unknown, expected: unknown, path = "result"): void {
  if (Array.isArray(expected)) {
    assert(Array.isArray(actual), `${path}: expected array`);
    assert(actual.length >= expected.length, `${path}: array shorter than expected`);
    expected.forEach((item, index) => assertSubset(actual[index], item, `${path}[${index}]`));
    return;
  }
  if (isRecord(expected)) {
    assert(isRecord(actual), `${path}: expected object`);
    for (const [key, value] of Object.entries(expected)) {
      assert(key in actual, `${path}.${key}: missing`);
      assertSubset(actual[key], value, `${path}.${key}`);
    }
    return;
  }
  assert(Object.is(actual, expected), `${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function oracleGapIsExpected(toolId: string, gap: string): boolean {
  const patterns: Readonly<Record<string, readonly RegExp[]>> = {
    "base-converter": [/fractional|floating-point/iu, /intentionally outside/iu],
    "chmod-permission-helper": [/ACL|umask|file-type|mutation/iu, /out of scope/iu],
    "cidr-calculator": [/zone identifiers/iu, /intentionally outside/iu],
    "connection-device-info": [/no unresolved gap/iu],
    "css-design-helper": [/intentionally covers/iu, /outside scope/iu],
    "css-minifier": [/future CSS|Raw/iu, /refus/iu],
    "html-minifier": [/advanced mode/iu, /opt-in|explicit/iu],
    "json-repair": [/single quotes|unquoted keys|missing delimiters|semantic reconstruction/iu, /refus/iu],
    "json-structural-diff": [/duplicate JSON members/iu, /caveat|ambigu/iu],
    "json-type-schema-inference": [/one example|optional|semantic formats/iu, /states? (?:these|the) limits/iu],
    "keyboard-event-diagnostic": [/no unresolved gap/iu],
    "password-pin-passphrase-generator": [/WebCrypto/iu, /does not estimate entropy/iu],
    "password-strength-estimator": [/heuristic|cracking-time|breach|user context|reuse/iu],
    "random-picker-team-coupon-generator": [/seeded|cryptographically secure|reproducibility/iu],
    "sitemap-xml-generator": [/one sitemap|sitemap index|splitting/iu, /outside/iu],
    "x509-csr-inspector": [/bounded subset|chain building|revocation|hostname|private key/iu, /outside scope/iu],
    "xml-formatter-validator": [/DTD|entities|schema/iu, /unsupported|outside/iu],
  };
  const allowed = patterns[toolId] ?? [];
  if (allowed.length === 0) return gap.trim() === "";
  return allowed.some((pattern) => pattern.test(gap));
}

async function loadModule(toolId: string): Promise<ToolModule> {
  const imported = await import(pathToFileURL(resolve(root, `src/tools/${toolId}/module.ts`)).href) as { default?: ToolModule };
  if (imported.default === undefined) throw new Error("module default export missing");
  return imported.default;
}

async function replay(toolId: string, fixtureById: ReadonlyMap<string, JsonRecord>): Promise<number> {
  const fixture = async (id: string): Promise<JsonRecord> => {
    const record = fixtureById.get(id);
    if (record === undefined) throw new Error(`fixture family missing: ${id}`);
    const path = record.path;
    if (typeof path !== "string") throw new Error(`fixture path missing: ${id}`);
    return JSON.parse(await readFile(resolve(root, path), "utf8")) as JsonRecord;
  };
  const module = await loadModule(toolId);
  const run = (input: JsonRecord) => module.run(input, { defaults: {} });

  if (toolId === "cidr-calculator") {
    const data = await fixture("developer-network-numeric");
    const vector = (data.cidr as JsonRecord[])[0]!;
    const actual = await run({ cidr: vector.input });
    assertSubset(actual, vector.expected);
    return 1;
  }
  if (toolId === "base-converter") {
    const data = await fixture("developer-network-numeric");
    const vector = (data.baseConversion as JsonRecord[])[0]!;
    const actual = await run({ value: vector.value, fromBase: vector.fromBase, toBase: vector.toBase });
    assertSubset(actual, { output: vector.expected, decimal: "255", exact: true });
    return 1;
  }
  if (toolId === "chmod-permission-helper") {
    const data = await fixture("developer-network-numeric");
    const vector = (data.chmod as JsonRecord[])[1]!;
    const actual = await run({ permissions: vector.input });
    assertSubset(actual, { octal: vector.expectedOctal, symbolic: vector.expectedSymbolic, specialBits: { setuid: true } });
    return 1;
  }
  if (toolId === "connection-device-info") {
    const data = await fixture("browser-diagnostics");
    const vector = (data.connection_device as JsonRecord[])[0]!;
    const actual = await run(vector.input as JsonRecord);
    assertSubset(actual, vector.expected);
    return 1;
  }
  if (toolId === "keyboard-event-diagnostic") {
    const data = await fixture("browser-diagnostics");
    const vector = (data.keyboard_event as JsonRecord[])[0]!;
    const actual = await run(vector.input as JsonRecord);
    assertSubset(actual, vector.expected);
    return 1;
  }
  if (toolId === "css-design-helper") {
    const data = await fixture("css-design-helper");
    const vector = (data.vectors as JsonRecord[])[0]!;
    const actual = await run(vector.input as JsonRecord);
    assertSubset(actual, { css: vector.css });
    return 1;
  }
  if (toolId === "css-minifier") {
    const data = await fixture("developer-minifiers");
    const vector = (data.css as JsonRecord[])[0]!;
    const actual = await run({ text: vector.input });
    assertSubset(actual, { output: vector.expected, valid: true });
    return 1;
  }
  if (toolId === "html-minifier") {
    const data = await fixture("developer-minifiers");
    const vector = (data.html as JsonRecord[]).find((entry) => entry.mode === "advanced")!;
    const actual = await run({ text: vector.input, mode: vector.mode });
    assertSubset(actual, { output: vector.expected, valid: true, mode: "advanced" });
    return 1;
  }
  if (toolId === "json-repair") {
    const data = await fixture("developer-structured-data");
    const vector = (data.json_repair as JsonRecord[])[0]!;
    const actual = await run({ text: vector.input });
    assert(isRecord(actual), "json-repair result must be an object");
    assert(typeof actual.repaired === "string", "json-repair repaired text missing");
    assertSubset(JSON.parse(actual.repaired), (vector.expected as JsonRecord).value);
    const reasons = Array.isArray(actual.edits) ? actual.edits.map((entry) => isRecord(entry) ? entry.reason : undefined) : [];
    assertSubset(reasons, (vector.expected as JsonRecord).edit_reasons);
    return 1;
  }
  if (toolId === "json-structural-diff") {
    const data = await fixture("developer-structured-data");
    const vector = (data.json_diff as JsonRecord[])[0]!;
    const actual = await run({ leftJson: vector.left, rightJson: vector.right });
    assert(isRecord(actual) && Array.isArray(actual.differences), "json diff differences missing");
    const kinds = actual.differences.map((entry) => isRecord(entry) ? entry.kind : undefined);
    for (const expected of stringArray(vector.expected_kinds)) assert(kinds.includes(expected), `json diff kind missing: ${expected}`);
    return 1;
  }
  if (toolId === "json-type-schema-inference") {
    const data = await fixture("developer-structured-data");
    const vector = (data.json_inference as JsonRecord[])[0]!;
    const actual = await run({ json: vector.input, typeName: vector.root_name, mode: "both" });
    assert(isRecord(actual), "json inference result must be an object");
    assert(actual.sourceExampleValidatesSchema === true, "json inference example/schema self-validation failed");
    assert(typeof actual.typescript === "string" && actual.typescript.includes('"__proto__"'), "json inference poison key missing from safe TypeScript output");
    assert(typeof actual.schemaJson === "string" && actual.schemaJson.includes('"__proto__"'), "json inference poison key missing from schema output");
    return 1;
  }
  if (toolId === "xml-formatter-validator") {
    const data = await fixture("developer-structured-data");
    let checked = 0;
    for (const vector of data.xml as JsonRecord[]) {
      const validated = await run({ text: vector.input, mode: "validate", indent: 2 });
      assertSubset(validated, { valid: true, externalEntities: "disabled" });
      if (typeof vector.pretty === "string") assertSubset(await run({ text: vector.input, mode: "prettify", indent: 2 }), { output: vector.pretty, externalEntities: "disabled" });
      if (typeof vector.minified === "string") assertSubset(await run({ text: vector.input, mode: "minify", indent: 2 }), { output: vector.minified, externalEntities: "disabled" });
      checked += 1;
    }
    for (const malformed of ['<root a="1" a="2"/>', "<root>&#0;</root>", "<root>&#x110000;</root>", "<root>bad]]>text</root>", `<root>${String.fromCharCode(1)}</root>`]) {
      let refused = false;
      try {
        await run({ text: malformed, mode: "validate", indent: 2 });
      } catch {
        refused = true;
      }
      assert(refused, `xml formatter accepted malformed W3C boundary: ${malformed}`);
      checked += 1;
    }
    return checked;
  }
  if (toolId === "password-pin-passphrase-generator") {
    const actual = await run({ mode: "password", length: 32, lowercase: true, uppercase: true, digits: true, symbols: true });
    assert(isRecord(actual) && typeof actual.secret === "string", "password generator secret missing");
    assert(actual.secret.length === 32, "password generator length mismatch");
    assert(/[a-z]/u.test(actual.secret) && /[A-Z]/u.test(actual.secret) && /[0-9]/u.test(actual.secret) && /[^A-Za-z0-9]/u.test(actual.secret), "password generator requested character sets not all represented");
    return 1;
  }
  if (toolId === "password-strength-estimator") {
    const data = await fixture("password-security");
    let checked = 0;
    for (const vector of data.vectors as JsonRecord[]) {
      const actual = await run({ password: vector.password });
      const repeated = await run({ password: vector.password });
      assert(JSON.stringify(actual) === JSON.stringify(repeated), "password estimator is not deterministic");
      assert(isRecord(actual) && Array.isArray(actual.factors), "password estimator factors missing");
      const codes = actual.factors.map((entry) => isRecord(entry) ? entry.code : undefined);
      for (const code of stringArray(vector.expected_factor_codes)) assert(codes.includes(code), `password estimator factor missing: ${code}`);
      if (typeof vector.expected_min_score === "number") assert(typeof actual.score === "number" && actual.score >= vector.expected_min_score, "password estimator minimum score fixture failed");
      if (typeof vector.expected_max_score === "number") assert(typeof actual.score === "number" && actual.score <= vector.expected_max_score, "password estimator maximum score fixture failed");
      checked += 1;
    }
    return checked;
  }
  if (toolId === "random-picker-team-coupon-generator") {
    const data = await fixture("random-utilities");
    const vector = (data.cases as JsonRecord[]).find((entry) => entry.id === "duplicate-picker-tickets")!;
    const input = { ...(vector.input as JsonRecord), mode: vector.mode };
    const first = await run(input);
    const second = await run(input);
    assert(JSON.stringify(second) === JSON.stringify(first), "seeded random picker is not reproducible");
    assert(isRecord(first) && Array.isArray(first.picks), "random picker output missing");
    assert(first.picks.length === 4, "random picker expected four tickets");
    assert(first.picks.filter((entry) => isRecord(entry) && entry.label === "Ada").length === 2, "random picker duplicate labels did not remain separate tickets");
    return 1;
  }
  if (toolId === "sitemap-xml-generator") {
    const data = await fixture("sitemap-xml");
    const vector = (data.vectors as JsonRecord[]).find((entry) => entry.id === "optional-metadata")!;
    const actual = await run({ text: vector.input });
    assertSubset(actual, { entries: vector.expected_entries, metadataCounts: vector.expected_metadata_counts, host: "example.com" });
    return 1;
  }
  if (toolId === "x509-csr-inspector") {
    const data = await fixture("x509-csr-rfc");
    const expected = data.certificate as JsonRecord;
    const pem = await readFile(resolve(root, "quality/fixtures/x509-csr-rfc/sample-cert.pem"), "utf8");
    const actual = await run({ data: pem });
    assert(isRecord(actual), "x509 result must be an object");
    assert(typeof actual.subject === "string" && actual.subject.includes(String(expected.subject_contains)), "x509 subject fixture mismatch");
    assertSubset(actual, { serialNumber: expected.serial, san: expected.sans, sha256Fingerprint: expected.sha256_fingerprint, publicKey: { algorithm: expected.public_key_algorithm, bits: expected.public_key_bits } });
    return 1;
  }
  throw new Error(`${toolId}: fixture replay adapter missing`);
}

const [registryText, fixtureIndexText, acceptanceText] = await Promise.all([
  readFile(resolve(root, "quality/oracles/registry.json"), "utf8"),
  readFile(resolve(root, "quality/fixtures/index.json"), "utf8"),
  readFile(resolve(root, acceptancePath), "utf8").catch(() => ""),
]);
const registry = JSON.parse(registryText) as { entries: JsonRecord[] };
const fixtureIndex = JSON.parse(fixtureIndexText) as { families: JsonRecord[] };
const fixtureById = new Map(fixtureIndex.families.filter(isRecord).map((entry) => [String(entry.id), entry]));
const acceptance = acceptanceText === "" ? undefined : JSON.parse(acceptanceText) as JsonRecord;
const sourceFingerprint = await currentEvidenceSourceFingerprint(root);
const revision = await currentRevision(root);
const browserTools = new Set(stringArray(acceptance?.tools));
const browserResults = new Map<string, JsonRecord>((Array.isArray(acceptance?.results) ? acceptance.results : []).filter(isRecord).map((entry) => [String(entry.toolId), entry]));

const promotable: string[] = [];
const blocked: Array<{ id: string; reasons: string[] }> = [];
await mkdir(receiptRoot, { recursive: true });

for (const candidate of candidates) {
  const reasons: string[] = [];
  const manifestModule = await import(pathToFileURL(resolve(root, `src/tools/${candidate.id}/manifest.ts`)).href) as { default?: ToolManifest };
  const manifest = manifestModule.default;
  if (manifest === undefined || manifest.id !== candidate.id) reasons.push("MANIFEST_IMPORT_INVALID");
  const oracle = manifest === undefined ? undefined : registry.entries.find((entry) => entry.id === manifest.gold.oracleEntryId);
  if (oracle === undefined) reasons.push("ORACLE_MISSING");
  if (oracle?.confidence !== "high") reasons.push(`ORACLE_NOT_HIGH_CONFIDENCE:${String(oracle?.confidence ?? "missing")}`);
  if (manifest !== undefined && oracle?.maintenance_class !== manifest.gold.maintenanceClass) reasons.push(`MAINTENANCE_CLASS_MISMATCH:${String(manifest.gold.maintenanceClass)}!=${String(oracle?.maintenance_class)}`);
  for (const gap of stringArray(oracle?.unresolved_gaps)) if (!oracleGapIsExpected(candidate.id, gap)) reasons.push(`UNEXPECTED_ORACLE_GAP:${gap}`);
  if (acceptance?.status !== "PASS") reasons.push("BROWSER_ACCEPTANCE_MISSING_OR_NOT_PASS");
  if (acceptance?.sourceFingerprint !== sourceFingerprint) reasons.push("BROWSER_ACCEPTANCE_SOURCE_FINGERPRINT_STALE");
  const browserResult = browserResults.get(candidate.id);
  if (!browserTools.has(candidate.id) || browserResult?.status !== "PASS") reasons.push("PER_TOOL_BROWSER_EVIDENCE_MISSING");
  if (manifest !== undefined && browserResult?.oracleEntryId !== manifest.gold.oracleEntryId) reasons.push("BROWSER_ORACLE_BINDING_MISMATCH");
  if (browserResult?.componentAbsentFromHome !== true) reasons.push("ROUTE_COMPONENT_ISOLATION_MISSING");

  const fixtureRecords = manifest === undefined ? [] : manifest.gold.fixtureFamilies.map((id) => fixtureById.get(id));
  if (fixtureRecords.some((entry) => entry === undefined)) reasons.push("FIXTURE_INDEX_BINDING_MISSING");
  for (const testPath of candidate.focusedTests) {
    try { await readFile(resolve(root, testPath)); } catch { reasons.push(`FOCUSED_TEST_MISSING:${testPath}`); }
  }

  let replayCount = 0;
  if (reasons.length === 0 && manifest !== undefined) {
    try { replayCount = await replay(candidate.id, fixtureById); }
    catch (error) { reasons.push(`FIXTURE_REPLAY_FAILED:${error instanceof Error ? error.message : String(error)}`); }
  }

  if (reasons.length > 0 || manifest === undefined || oracle === undefined) {
    blocked.push({ id: candidate.id, reasons });
    console.log(`Gold BLOCKED: ${candidate.id}: ${reasons.join(" | ")}`);
    continue;
  }

  promotable.push(candidate.id);
  console.log(`Gold-ready PASS: ${candidate.id}`);
  if (!writeReceipts) continue;

  const resolvedFixtures = manifest.gold.fixtureFamilies.map((id) => fixtureById.get(id)!);
  const fixtureIdentities = Object.fromEntries(await Promise.all(resolvedFixtures.map(async (entry) => {
    const id = String(entry.id);
    const path = String(entry.path);
    return [`fixture:${id}:sha256`, sha256(await readFile(resolve(root, path)))] as const;
  })));
  const focusedTestsText = (await Promise.all(candidate.focusedTests.map((path) => readFile(resolve(root, path), "utf8")))).join("\n");
  const manifestText = await readFile(resolve(root, `src/tools/${candidate.id}/manifest.ts`), "utf8");
  const moduleText = await readFile(resolve(root, `src/tools/${candidate.id}/module.ts`), "utf8");
  const receiptPath = `quality/receipts/developer-web-operations/${candidate.id}.gold.json`;
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
    fixtureReplayCount: replayCount,
    truthSources: [...new Set([
      ...stringArray(oracle.truth_sources),
      ...resolvedFixtures.flatMap((entry) => stringArray(entry.truth_sources)),
    ])].sort(),
    resolvedFixtures: resolvedFixtures.map((entry) => ({ id: String(entry.id), path: String(entry.path) })),
    propertyChecks: [
      "oracle confidence is high and every unresolved-gap string matches this tool's explicitly reviewed bounded-scope pattern",
      "manifest maintenance class matches oracle registry",
      "fixture/property replay passes through the public tool module",
      "per-tool browser action produces semantic domain output",
      "task execution has zero unexpected external/non-GET/body-bearing requests",
      "task execution leaves local/session storage and visible URL unchanged",
      "390px viewport has no horizontal overflow and exercised controls have accessible names",
      "built route component is absent from home HTML, proving the tool implementation is not in the home eager surface",
      "focused semantic/refusal tests are bound by identity",
    ],
    identities: {
      manifestSha256: sha256(manifestText),
      moduleSha256: sha256(moduleText),
      oracleRegistrySha256: sha256(registryText),
      fixtureIndexSha256: sha256(fixtureIndexText),
      browserAcceptanceSha256: sha256(acceptanceText),
      browserAcceptanceSourceFingerprint: String(acceptance?.sourceFingerprint ?? ""),
      focusedTestsSha256: sha256(focusedTestsText),
      ...fixtureIdentities,
    },
  };
  await writeFile(resolve(root, receiptPath), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
}

const unexpectedBlocked = blocked.filter(({ id }) => !expectedBlocked.has(id));
const unexpectedlyPromoted = promotable.filter((id) => expectedBlocked.has(id));
const missingExpectedBlocked = [...expectedBlocked].filter((id) => !blocked.some((entry) => entry.id === id));
console.log(`developer/web operations Gold gate: ${promotable.length} promotable, ${blocked.length} blocked${writeReceipts ? ", promotable receipts written" : ", check-only (no Gold receipts written)"}`);
console.log(`promotable: ${promotable.join(", ")}`);
console.log(`blocked: ${blocked.map(({ id, reasons }) => `${id} [${reasons.join("; ")}]`).join(", ")}`);
if (unexpectedBlocked.length > 0 || unexpectedlyPromoted.length > 0 || missingExpectedBlocked.length > 0) {
  if (unexpectedBlocked.length > 0) console.error(`unexpected blocked tools: ${unexpectedBlocked.map(({ id }) => id).join(", ")}`);
  if (unexpectedlyPromoted.length > 0) console.error(`expected-blocked tools unexpectedly promoted: ${unexpectedlyPromoted.join(", ")}`);
  if (missingExpectedBlocked.length > 0) console.error(`expected blocked tools missing from blocked list: ${missingExpectedBlocked.join(", ")}`);
  process.exitCode = 1;
}
