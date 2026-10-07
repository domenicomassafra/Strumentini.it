import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ToolManifest } from "../../src/catalog/manifest";
import {
  extractPdfImages,
  extractPdfText,
  inspectPdfBytes,
} from "../../src/engines/pdf";
import type { ToolExecutionContext, ToolModule } from "../../src/runtime/types";
import { currentEvidenceSourceFingerprint, currentRevision } from "../lib/current-revision";

interface GoldVector { readonly tool_id: string; readonly input: Record<string, unknown>; readonly expected: unknown; }
interface FixtureEntry { readonly id: string; readonly path: string; readonly truth_sources: readonly string[]; }
interface OracleEntry { readonly id: string; readonly maintenance_class: string; readonly truth_sources: readonly string[]; readonly confidence?: string; readonly unresolved_gaps?: readonly string[]; }

const toolIds = [
  "pdf-merge", "pdf-split", "pdf-page-reorder", "pdf-rotate", "pdf-page-delete-extract", "images-to-pdf", "pdf-to-images", "pdf-text-extraction", "pdf-metadata-inspector", "pdf-metadata-remover", "pdf-page-size-inspector", "pdf-page-count-verifier", "pdf-password-check-remove", "pdf-flatten", "pdf-form-inspector", "pdf-link-extractor", "pdf-image-extractor", "pdf-compare-lite", "pdf-compression-lite", "document-handoff-manifest",
] as const;
const root = resolve(import.meta.dirname, "../..");
const fixtureDir = resolve(root, "quality/fixtures/pdf-gold");
const receiptRoot = resolve(root, "quality/receipts/pdf");
const revision = await currentRevision(root);
const sourceFingerprint = await currentEvidenceSourceFingerprint(root);
const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const context: ToolExecutionContext = { defaults: {} };

const [fixtureIndexText, oracleRegistryText, goldFixtureText, engineIndexText, engineParserText, engineWriterText, acceptanceText, conversionAcceptanceText, unitTestsText] = await Promise.all([
  readFile(resolve(root, "quality/fixtures/index.json"), "utf8"),
  readFile(resolve(root, "quality/oracles/registry.json"), "utf8"),
  readFile(resolve(fixtureDir, "vectors.json"), "utf8"),
  readFile(resolve(root, "src/engines/pdf/index.ts"), "utf8"),
  readFile(resolve(root, "src/engines/pdf/parser.ts"), "utf8"),
  readFile(resolve(root, "src/engines/pdf/writer.ts"), "utf8"),
  readFile(resolve(receiptRoot, "browser-acceptance.json"), "utf8"),
  readFile(resolve(receiptRoot, "conversion-matrix-browser.json"), "utf8"),
  readFile(resolve(root, "tests/pdf-document-tools.test.ts"), "utf8"),
]);
const fixtureIndex = JSON.parse(fixtureIndexText) as { families: FixtureEntry[] };
const registry = JSON.parse(oracleRegistryText) as { entries: OracleEntry[] };
const goldFixture = JSON.parse(goldFixtureText) as { tool_vectors: GoldVector[] };
const acceptance = JSON.parse(acceptanceText) as { status?: unknown; tools?: unknown };
const conversionAcceptance = JSON.parse(conversionAcceptanceText) as {
  status?: unknown;
  conversionMatrix?: {
    pdfToImages?: unknown;
  };
};
if (acceptance.status !== "PASS" || !Array.isArray(acceptance.tools)) throw new Error("pdf browser acceptance is missing or not PASS");
if (conversionAcceptance.status !== "PASS" || conversionAcceptance.conversionMatrix?.pdfToImages === undefined) throw new Error("PDF conversion-matrix browser acceptance is missing or not PASS");
if (goldFixture.tool_vectors.length !== toolIds.length || new Set(goldFixture.tool_vectors.map((vector) => vector.tool_id)).size !== toolIds.length) throw new Error("pdf Gold fixture does not cover every promoted tool exactly once");

function assertExpected(toolId: string, actual: unknown, expected: unknown, path = "result"): void {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length < expected.length) throw new Error(`${toolId}: ${path} array mismatch`);
    expected.forEach((item, index) => assertExpected(toolId, actual[index], item, `${path}[${index}]`));
    return;
  }
  if (typeof expected === "object" && expected !== null) {
    if (typeof actual !== "object" || actual === null || Array.isArray(actual)) throw new Error(`${toolId}: ${path} object mismatch`);
    const record = actual as Record<string, unknown>;
    for (const [key, value] of Object.entries(expected as Record<string, unknown>)) {
      if (!(key in record)) throw new Error(`${toolId}: ${path}.${key} missing`);
      assertExpected(toolId, record[key], value, `${path}.${key}`);
    }
    return;
  }
  if (!Object.is(actual, expected)) throw new Error(`${toolId}: ${path} mismatch; expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function oracleHasNoOpenGap(oracle: OracleEntry): boolean {
  return oracle.confidence === "high" && (oracle.unresolved_gaps ?? []).every((gap) => /^No unresolved gap\b/iu.test(gap));
}

function artifactBytes(output: unknown, toolId: string, index = 0): Uint8Array {
  const record = output as { artifacts?: readonly { bytes?: unknown }[] };
  const bytes = record.artifacts?.[index]?.bytes;
  if (!(bytes instanceof Uint8Array)) throw new Error(`${toolId}: artifact ${index} has no bytes`);
  return bytes;
}

async function assertOutputBytes(toolId: string, output: unknown): Promise<void> {
  switch (toolId) {
    case "pdf-merge": {
      if (inspectPdfBytes(artifactBytes(output, toolId)).pageCount !== 6) throw new Error(`${toolId}: re-inspected merge is not 6 pages`);
      return;
    }
    case "pdf-split": {
      const record = output as { artifacts?: readonly { bytes?: unknown }[] };
      const counts = (record.artifacts ?? []).map((artifact) => inspectPdfBytes(artifact.bytes as Uint8Array).pageCount);
      if (counts.join(",") !== "1,2") throw new Error(`${toolId}: re-inspected split is not [1,2] pages`);
      return;
    }
    case "pdf-page-reorder": {
      const texts = (await extractPdfText(artifactBytes(output, toolId))).map((page) => page.text);
      if (texts.join("|") !== "three|one|two") throw new Error(`${toolId}: re-inspected order is not three|one|two`);
      return;
    }
    case "pdf-rotate": {
      if (inspectPdfBytes(artifactBytes(output, toolId)).pages[0]?.rotation !== 90) throw new Error(`${toolId}: re-inspected rotation is not 90`);
      return;
    }
    case "pdf-page-delete-extract": {
      if (inspectPdfBytes(artifactBytes(output, toolId)).pageCount !== 2) throw new Error(`${toolId}: re-inspected delete is not 2 pages`);
      return;
    }
    case "images-to-pdf": {
      const bytes = artifactBytes(output, toolId);
      const inspection = inspectPdfBytes(bytes);
      if (inspection.images[0]?.mime !== "image/jpeg") throw new Error(`${toolId}: re-inspected output has no embedded JPEG`);
      const tiny = new Uint8Array(await readFile(resolve(fixtureDir, "tiny.jpg")));
      const extracted = await extractPdfImages(bytes);
      const extractedBytes = extracted[0]?.bytes;
      if (!(extractedBytes instanceof Uint8Array) || sha256(extractedBytes) !== sha256(tiny)) throw new Error(`${toolId}: round-trip JPEG bytes do not match the embedded source`);
      return;
    }
    case "pdf-image-extractor": {
      const bytes = artifactBytes(output, toolId);
      const tiny = new Uint8Array(await readFile(resolve(fixtureDir, "tiny.jpg")));
      if (sha256(bytes) !== sha256(tiny)) throw new Error(`${toolId}: extracted JPEG bytes do not match the embedded source`);
      return;
    }
    case "pdf-metadata-remover": {
      const inspection = inspectPdfBytes(artifactBytes(output, toolId));
      if (inspection.metadata.title !== null || inspection.pageCount !== 2) throw new Error(`${toolId}: re-inspected output still carries metadata or lost pages`);
      return;
    }
    case "pdf-flatten": {
      const inspection = inspectPdfBytes(artifactBytes(output, toolId));
      if (inspection.links.length !== 0 || inspection.forms.length !== 0) throw new Error(`${toolId}: re-inspected output still carries links or forms`);
      return;
    }
    case "pdf-compression-lite": {
      const bytes = artifactBytes(output, toolId);
      if (inspectPdfBytes(bytes).pageCount !== 2) throw new Error(`${toolId}: re-inspected output lost pages`);
      if ((await extractPdfText(bytes)).map((page) => page.text).join("|") !== "alpha|beta") throw new Error(`${toolId}: re-inspected text changed`);
      return;
    }
    case "document-handoff-manifest": {
      const record = output as { manifest?: { files?: readonly { sha256?: unknown }[] } };
      const simple3 = new Uint8Array(await readFile(resolve(fixtureDir, "simple-3page.pdf")));
      if (record.manifest?.files?.[0]?.sha256 !== sha256(simple3)) throw new Error(`${toolId}: manifest digest does not match the fixture bytes`);
      return;
    }
    default:
      return;
  }
}

const toBlob = (bytes: Uint8Array) => new Blob([bytes.slice().buffer as ArrayBuffer]);
async function fixtureBlob(name: string): Promise<Blob> {
  return toBlob(new Uint8Array(await readFile(resolve(fixtureDir, name))));
}

function resolveInput(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  return (async () => {
    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (key === "$fixture" && typeof value === "string") output.file = await fixtureBlob(value);
      else if (key === "$fixtures" && Array.isArray(value)) output.files = await Promise.all(value.map((name) => fixtureBlob(String(name))));
      else if (key === "$first" && typeof value === "string") output.first = await fixtureBlob(value);
      else if (key === "$second" && typeof value === "string") output.second = await fixtureBlob(value);
      else output[key] = value;
    }
    return output;
  })();
}

await mkdir(receiptRoot, { recursive: true });
for (const toolId of toolIds) {
  const manifestModule = await import(pathToFileURL(resolve(root, `src/tools/${toolId}/manifest.ts`)).href) as { default: ToolManifest };
  const moduleImport = await import(pathToFileURL(resolve(root, `src/tools/${toolId}/module.ts`)).href) as { default: ToolModule };
  const manifest = manifestModule.default;
  const oracle = registry.entries.find((entry) => entry.id === manifest.gold.oracleEntryId);
  if (oracle === undefined || !oracleHasNoOpenGap(oracle)) throw new Error(`${toolId}: oracle is not high-confidence with zero unresolved gaps`);
  if (oracle.maintenance_class !== manifest.gold.maintenanceClass) throw new Error(`${toolId}: maintenance class mismatch`);
  if (!manifest.gold.fixtureFamilies.includes("pdf-gold")) throw new Error(`${toolId}: shared Gold fixture not declared`);
  if (!(acceptance.tools as unknown[]).includes(toolId)) throw new Error(`${toolId}: browser acceptance missing`);
  const vector = goldFixture.tool_vectors.find((entry) => entry.tool_id === toolId);
  if (vector === undefined) throw new Error(`${toolId}: exact Gold vector missing`);
  const output = toolId === "pdf-to-images"
    ? conversionAcceptance.conversionMatrix?.pdfToImages
    : await moduleImport.default.run(await resolveInput(vector.input), context);
  if (output === undefined) throw new Error(`${toolId}: exact vector did not produce evidence`);
  assertExpected(toolId, output, vector.expected);
  if (toolId !== "pdf-to-images") await assertOutputBytes(toolId, output);
  const fixtureRecords = manifest.gold.fixtureFamilies.map((id) => {
    const entry = fixtureIndex.families.find((candidate) => candidate.id === id);
    if (entry === undefined) throw new Error(`${toolId}: fixture family missing from index: ${id}`);
    return entry;
  });
  const fixtureIdentities = Object.fromEntries(await Promise.all(fixtureRecords.map(async (entry) => [`fixture:${entry.id}:sha256`, sha256(await readFile(resolve(root, entry.path)))])));
  const binaryIdentities = Object.fromEntries(await Promise.all(
    ["annotated.pdf", "simple-3page.pdf", "simple-2page.pdf", "simple-2page-changed.pdf", "jpeg-1page.pdf", "encrypted-mark.pdf", "tiny.jpg", "page-scoped-images-metadata.pdf"].map(async (name) => [`fixture:pdf-gold:${name}:sha256`, sha256(await readFile(resolve(fixtureDir, name)))]),
  ));
  const manifestText = await readFile(resolve(root, `src/tools/${toolId}/manifest.ts`), "utf8");
  const receipt = {
    schemaVersion: 1,
    status: "GOLD",
    revision,
    sourceFingerprint,
    toolId,
    runtime: manifest.runtime,
    maintenanceClass: manifest.gold.maintenanceClass,
    engineVersion: "pdf-engine-v1",
    oracleEntryId: manifest.gold.oracleEntryId,
    fixtureFamilies: manifest.gold.fixtureFamilies,
    exactVectors: 1,
    truthSources: [...new Set([...oracle.truth_sources, ...fixtureRecords.flatMap((entry) => entry.truth_sources)])].sort(),
    resolvedFixtures: fixtureRecords.map((entry) => ({ id: entry.id, path: entry.path })),
    propertyChecks: ["local-only runtime", "high-confidence oracle with no open semantic gap", "tool-specific PDF/document fixture remains bound", "exact public-module vector plus re-inspected output bytes or exact browser raster evidence", "keyboard/mobile/a11y/locality/lazy browser acceptance"],
    identities: {
      manifestSha256: sha256(manifestText),
      pdfEngineIndexSha256: sha256(engineIndexText),
      pdfEngineParserSha256: sha256(engineParserText),
      pdfEngineWriterSha256: sha256(engineWriterText),
      fixtureIndexSha256: sha256(fixtureIndexText),
      oracleRegistrySha256: sha256(oracleRegistryText),
      browserAcceptanceSha256: sha256(acceptanceText),
      conversionMatrixBrowserAcceptanceSha256: sha256(conversionAcceptanceText),
      unitTestsSha256: sha256(unitTestsText),
      ...fixtureIdentities,
      ...binaryIdentities,
    },
  };
  await writeFile(resolve(receiptRoot, `${toolId}.gold.json`), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`Gold PASS: ${toolId}, exact vector + re-inspected bytes + per-tool browser evidence`);
}
