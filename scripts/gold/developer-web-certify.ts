import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ToolManifest } from "../../src/catalog/manifest";
import { developerWebEngineVersion, runDeveloperWebTool, type DeveloperWebToolId } from "../../src/engines/developer-web";
import { base64CodecManifest } from "../../src/tools/base64-codec/manifest";
import { cronExplainerManifest } from "../../src/tools/cron-explainer/manifest";
import { cronNextRunManifest } from "../../src/tools/cron-next-run/manifest";
import { hashGeneratorManifest } from "../../src/tools/hash-generator/manifest";
import { hmacGeneratorManifest } from "../../src/tools/hmac-generator/manifest";
import { htmlEntityCodecManifest } from "../../src/tools/html-entity-codec/manifest";
import { httpStatusReferenceManifest } from "../../src/tools/http-status-reference/manifest";
import { jsonFormatterManifest } from "../../src/tools/json-formatter/manifest";
import { jsonPathManifest } from "../../src/tools/json-path-playground/manifest";
import { jsonYamlConverterManifest } from "../../src/tools/json-yaml-converter/manifest";
import { jwtInspectorManifest } from "../../src/tools/jwt-inspector/manifest";
import { mimeTypeLookupManifest } from "../../src/tools/mime-type-lookup/manifest";
import { queryStringEditorManifest } from "../../src/tools/query-string-editor/manifest";
import { regexTesterManifest } from "../../src/tools/regex-tester/manifest";
import { tomlFormatterManifest } from "../../src/tools/toml-formatter/manifest";
import { unixTimestampManifest } from "../../src/tools/unix-timestamp/manifest";
import { urlCodecManifest } from "../../src/tools/url-codec/manifest";
import { userAgentParserManifest } from "../../src/tools/user-agent-parser/manifest";
import { uuidGeneratorManifest } from "../../src/tools/uuid-generator/manifest";
import { yamlFormatterManifest } from "../../src/tools/yaml-formatter/manifest";
import { currentEvidenceSourceFingerprint, currentRevision } from "../lib/current-revision";

interface GoldVector {
  readonly tool_id: DeveloperWebToolId;
  readonly input: Record<string, unknown>;
  readonly expected: Record<string, unknown>;
}

interface FixtureEntry {
  readonly id: string;
  readonly path: string;
  readonly truth_sources: readonly string[];
}

interface OracleEntry {
  readonly id: string;
  readonly maintenance_class: string;
  readonly truth_sources: readonly string[];
}

const root = resolve(import.meta.dirname, "../..");
const receiptRoot = resolve(root, "quality/receipts/developer-web");
const revision = await currentRevision(root);
const sourceFingerprint = await currentEvidenceSourceFingerprint(root);
const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const manifests: readonly ToolManifest[] = [
  jsonFormatterManifest, yamlFormatterManifest, tomlFormatterManifest, jsonYamlConverterManifest, urlCodecManifest,
  htmlEntityCodecManifest, base64CodecManifest, jwtInspectorManifest, uuidGeneratorManifest, hashGeneratorManifest,
  hmacGeneratorManifest, regexTesterManifest, cronExplainerManifest, cronNextRunManifest, unixTimestampManifest,
  httpStatusReferenceManifest, mimeTypeLookupManifest, userAgentParserManifest, queryStringEditorManifest, jsonPathManifest,
];

const [fixtureIndexText, oracleRegistryText, goldFixtureText, engineIndexText, structuredText, cryptoText, referenceText, acceptanceText, testsText] = await Promise.all([
  readFile(resolve(root, "quality/fixtures/index.json"), "utf8"),
  readFile(resolve(root, "quality/oracles/registry.json"), "utf8"),
  readFile(resolve(root, "quality/fixtures/developer-web-gold/vectors.json"), "utf8"),
  readFile(resolve(root, "src/engines/developer-web/index.ts"), "utf8"),
  readFile(resolve(root, "src/engines/developer-web/structured-data.ts"), "utf8"),
  readFile(resolve(root, "src/engines/developer-web/encoding-crypto.ts"), "utf8"),
  readFile(resolve(root, "src/engines/developer-web/web-reference.ts"), "utf8"),
  readFile(resolve(receiptRoot, "browser-acceptance.json"), "utf8"),
  readFile(resolve(root, "tests/developer-web-engine.test.ts"), "utf8"),
]);
const fixtureIndex = JSON.parse(fixtureIndexText) as { families: FixtureEntry[] };
const registry = JSON.parse(oracleRegistryText) as { entries: OracleEntry[] };
const goldFixture = JSON.parse(goldFixtureText) as { tool_vectors: GoldVector[] };
const acceptance = JSON.parse(acceptanceText) as { status?: unknown; tools?: unknown };
if (acceptance.status !== "PASS" || !Array.isArray(acceptance.tools)) throw new Error("developer-web browser acceptance is missing or not PASS");
if (goldFixture.tool_vectors.length !== 20 || new Set(goldFixture.tool_vectors.map((vector) => vector.tool_id)).size !== 20) throw new Error("developer-web Gold fixture must contain exactly one vector per tool");

function assertExpected(toolId: string, actual: unknown, expected: Record<string, unknown>) {
  if (typeof actual !== "object" || actual === null || Array.isArray(actual)) throw new Error(`${toolId}: result is not an object`);
  const record = actual as Record<string, unknown>;
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (JSON.stringify(record[key]) !== JSON.stringify(expectedValue)) throw new Error(`${toolId}: ${key} mismatch; expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(record[key])}`);
  }
}

await mkdir(receiptRoot, { recursive: true });
for (const manifest of manifests) {
  const toolId = manifest.id as DeveloperWebToolId;
  const oracle = registry.entries.find((entry) => entry.id === manifest.gold.oracleEntryId);
  if (oracle === undefined) throw new Error(`${toolId}: missing oracle ${manifest.gold.oracleEntryId}`);
  if (oracle.maintenance_class !== manifest.gold.maintenanceClass) throw new Error(`${toolId}: maintenance class mismatch`);
  if (!manifest.gold.fixtureFamilies.includes("developer-web-gold")) throw new Error(`${toolId}: shared Gold fixture not declared`);
  if (!(acceptance.tools as unknown[]).includes(toolId)) throw new Error(`${toolId}: browser acceptance missing`);
  const vector = goldFixture.tool_vectors.find((entry) => entry.tool_id === toolId);
  if (vector === undefined) throw new Error(`${toolId}: exact Gold vector missing`);
  assertExpected(toolId, await runDeveloperWebTool(toolId, vector.input), vector.expected);
  const fixtureRecords = manifest.gold.fixtureFamilies.map((id) => {
    const entry = fixtureIndex.families.find((candidate) => candidate.id === id);
    if (entry === undefined) throw new Error(`${toolId}: fixture family missing from index: ${id}`);
    return entry;
  });
  const fixtureIdentities = Object.fromEntries(await Promise.all(fixtureRecords.map(async (entry) => [
    `fixture:${entry.id}:sha256`, sha256(await readFile(resolve(root, entry.path))),
  ])));
  const manifestText = await readFile(resolve(root, `src/tools/${toolId}/manifest.ts`), "utf8");
  const receipt = {
    schemaVersion: 1,
    status: "GOLD",
    revision,
    sourceFingerprint,
    toolId,
    runtime: manifest.runtime,
    maintenanceClass: manifest.gold.maintenanceClass,
    engineVersion: developerWebEngineVersion,
    oracleEntryId: manifest.gold.oracleEntryId,
    fixtureFamilies: manifest.gold.fixtureFamilies,
    exactVectors: 1,
    truthSources: [...new Set([...oracle.truth_sources, ...fixtureRecords.flatMap((entry) => entry.truth_sources)])].sort(),
    resolvedFixtures: fixtureRecords.map((entry) => ({ id: entry.id, path: entry.path })),
    propertyChecks: ["local-only runtime", "bounded parser/operation policy", "tool-specific standards fixture remains bound"],
    identities: {
      manifestSha256: sha256(manifestText),
      engineIndexSha256: sha256(engineIndexText),
      structuredDataSha256: sha256(structuredText),
      encodingCryptoSha256: sha256(cryptoText),
      webReferenceSha256: sha256(referenceText),
      fixtureIndexSha256: sha256(fixtureIndexText),
      oracleRegistrySha256: sha256(oracleRegistryText),
      browserAcceptanceSha256: sha256(acceptanceText),
      unitTestsSha256: sha256(testsText),
      ...fixtureIdentities,
    },
  };
  await writeFile(resolve(receiptRoot, `${toolId}.gold.json`), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`Gold PASS: ${toolId}, exact end-to-end vector + standards fixture + browser evidence`);
}
