import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileHashManifest } from "../../src/tools/file-hash/manifest";
import { hashBlobIncremental, hashBlobWithWebCrypto } from "../../src/engines/file-hash";
import { currentEvidenceSourceFingerprint, currentRevision } from "../lib/current-revision";

const root = resolve(import.meta.dirname, "../..");
const revision = await currentRevision(root);
const sourceFingerprint = await currentEvidenceSourceFingerprint(root);
const readText = (path: string) => readFile(resolve(root, path), "utf8");
const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

const [fixtureIndexText, registryText, knownText, fileHashText, engineText, manifestText] = await Promise.all([
  readText("quality/fixtures/index.json"),
  readText("quality/oracles/registry.json"),
  readText("quality/fixtures/sha2-known-answers/vectors.json"),
  readText("quality/fixtures/file-hash/vectors.json"),
  readText("src/engines/file-hash/index.ts"),
  readText("src/tools/file-hash/manifest.ts"),
]);

const fixtureIndex = JSON.parse(fixtureIndexText) as {
  schema_version: number;
  families: Array<{ id: string; path: string; truth_sources: string[] }>;
};
const registry = JSON.parse(registryText) as {
  schema_version: number;
  entries: Array<{ id: string; candidate: string; truth_sources: string[] }>;
};
const known = JSON.parse(knownText) as {
  schema_version: number;
  vectors: Array<{ algorithm: string; input_utf8: string; digest_hex: string }>;
};
const fileHash = JSON.parse(fileHashText) as {
  schema_version: number;
  artifact_utf8: string;
  sha256: string;
  chunk_sizes: number[];
};

const issues: string[] = [];
if (fileHashManifest.runtime.location !== "LOCAL" || fileHashManifest.runtime.network !== "forbidden") {
  issues.push("manifest must remain LOCAL with network forbidden");
}
const oracle = registry.entries.find((entry) => entry.id === fileHashManifest.gold.oracleEntryId);
if (oracle === undefined) issues.push(`missing oracle ${fileHashManifest.gold.oracleEntryId}`);
for (const family of fileHashManifest.gold.fixtureFamilies) {
  if (!fixtureIndex.families.some((entry) => entry.id === family)) issues.push(`missing fixture family ${family}`);
}

let knownAnswerCount = 0;
let webCryptoCrossChecks = 0;
for (const vector of known.vectors.filter((item) => item.algorithm === "SHA-256")) {
  const blob = new Blob([new TextEncoder().encode(vector.input_utf8)]);
  const result = await hashBlobIncremental(blob);
  if (result.digestHex !== vector.digest_hex) issues.push(`known answer mismatch for ${JSON.stringify(vector.input_utf8)}`);
  const oracleDigest = await hashBlobWithWebCrypto(blob, { maxBytes: 1024 * 1024 });
  if (oracleDigest !== vector.digest_hex) issues.push(`Web Crypto mismatch for ${JSON.stringify(vector.input_utf8)}`);
  knownAnswerCount += 1;
  webCryptoCrossChecks += 1;
}

const chunkBlob = new Blob([new TextEncoder().encode(fileHash.artifact_utf8)]);
for (const chunkSize of fileHash.chunk_sizes) {
  const result = await hashBlobIncremental(chunkBlob, { chunkSize });
  if (result.digestHex !== fileHash.sha256) issues.push(`chunk-size mismatch at ${chunkSize}`);
}

if (issues.length > 0) {
  console.error(issues.join("\n"));
  process.exit(1);
}

const receipt = {
  schemaVersion: 1,
  toolId: fileHashManifest.id,
  status: "GOLD",
  revision,
  sourceFingerprint,
  runtime: fileHashManifest.runtime,
  algorithm: "SHA-256",
  implementation: { package: "hash-wasm", version: "4.12.0", mode: "incremental-worker" },
  oracle: { package: "Web Crypto", boundedMaxBytes: 1048576 },
  oracleEntryId: fileHashManifest.gold.oracleEntryId,
  fixtureFamilies: fileHashManifest.gold.fixtureFamilies,
  knownAnswerCount,
  webCryptoCrossChecks,
  chunkSizesVerified: fileHash.chunk_sizes,
  fixtureIndexSchemaVersion: fixtureIndex.schema_version,
  oracleRegistrySchemaVersion: registry.schema_version,
  truthSources: oracle?.truth_sources ?? [],
  identities: {
    manifestSha256: sha256(manifestText),
    engineSha256: sha256(engineText),
    sha2FixtureSha256: sha256(knownText),
    fileHashFixtureSha256: sha256(fileHashText),
    fixtureIndexSha256: sha256(fixtureIndexText),
    oracleRegistrySha256: sha256(registryText),
  },
};

const receiptDir = resolve(root, "quality/receipts/file-hash");
await mkdir(receiptDir, { recursive: true });
await writeFile(resolve(receiptDir, "gold.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
console.log(`file-hash Gold PASS: ${knownAnswerCount} known answers, ${fileHash.chunk_sizes.length} chunk sizes`);
