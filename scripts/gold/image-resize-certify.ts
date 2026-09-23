import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { imageResizeManifest } from "../../src/tools/image-resize/manifest";
import { validatePhysicalImageReceipt } from "../lib/image-resize-physical";

const root = resolve(import.meta.dirname, "../..");

interface OracleEntry {
  id: string;
  candidate: string;
}

interface FixtureEntry {
  id: string;
  path: string;
}

interface OracleRegistry {
  entries: OracleEntry[];
}

interface FixtureIndex {
  families: FixtureEntry[];
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(() => true, () => false);
}

async function readJsonIfExists(path: string): Promise<unknown | null> {
  if (!(await exists(path))) return null;
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validBrowserReceipt(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    value.cancellation === "PASS" &&
    value.corruptDecode === "PASS" &&
    value.oversizedPredecode === "PASS" &&
    value.externalRequests === 0 &&
    value.taskContentNetworkRequests === 0 &&
    isRecord(value.verifiedOutputs)
  );
}

const registryPath = resolve(root, "quality/oracles/registry.json");
const fixtureIndexPath = resolve(root, "quality/fixtures/index.json");
const enginePaths = [
  "src/engines/image/policy.ts",
  "src/engines/image/format.ts",
  "src/tools/image-resize/module.ts",
];
const registryText = await readFile(registryPath, "utf8");
const fixtureIndexText = await readFile(fixtureIndexPath, "utf8");
const registry = JSON.parse(registryText) as OracleRegistry;
const fixtureIndex = JSON.parse(fixtureIndexText) as FixtureIndex;
const oracle = registry.entries.find((entry) => entry.id === imageResizeManifest.gold.oracleEntryId);
const fixtures = imageResizeManifest.gold.fixtureFamilies.map((id) =>
  fixtureIndex.families.find((entry) => entry.id === id),
);
const resolvedFixtures = fixtures.filter((entry): entry is FixtureEntry => entry !== undefined);

const issues = [];
if (imageResizeManifest.runtime.location !== "LOCAL" || imageResizeManifest.runtime.network !== "forbidden") {
  issues.push("image-resize must remain LOCAL with network forbidden");
}
if (!oracle) issues.push(`oracle missing: ${imageResizeManifest.gold.oracleEntryId}`);
if (fixtures.some((entry) => !entry)) issues.push("one or more declared image fixture families are missing");

const iosPath = resolve(root, "quality/receipts/image-resize/ios-safari-physical.json");
const androidPath = resolve(root, "quality/receipts/image-resize/android-chrome-physical.json");
const chromePath = resolve(root, "quality/receipts/image-resize/browser-chrome.json");
const edgePath = resolve(root, "quality/receipts/image-resize/browser-edge.json");
const webkitPath = resolve(root, "quality/receipts/image-resize/browser-webkit.json");
const bundlePath = resolve(root, "quality/receipts/image-resize/bundle.json");
const [iosReceipt, androidReceipt, chromeReceipt, edgeReceipt, webkitReceipt, bundleReceipt] = await Promise.all([
  readJsonIfExists(iosPath),
  readJsonIfExists(androidPath),
  readJsonIfExists(chromePath),
  readJsonIfExists(edgePath),
  readJsonIfExists(webkitPath),
  readJsonIfExists(bundlePath),
]);
const iosIssues = iosReceipt === null ? ["receipt missing"] : validatePhysicalImageReceipt(iosReceipt, "ios-safari");
const androidIssues = androidReceipt === null ? ["receipt missing"] : validatePhysicalImageReceipt(androidReceipt, "android-chrome");
const iosPass = iosIssues.length === 0;
const androidPass = androidIssues.length === 0;
const physicalAcceptanceComplete = iosPass && androidPass;
const desktopAutomationComplete =
  validBrowserReceipt(chromeReceipt) &&
  validBrowserReceipt(edgeReceipt) &&
  isRecord(bundleReceipt) &&
  bundleReceipt.implementationEager === false;
if (!desktopAutomationComplete) {
  issues.push("Chrome/Edge browser acceptance and lazy bundle receipts must pass before certification");
}

const identities = Object.fromEntries(
  await Promise.all(enginePaths.map(async (relative) => [
    relative,
    sha256(await readFile(resolve(root, relative), "utf8")),
  ])),
);

const receipt = {
  schemaVersion: 1,
  toolId: imageResizeManifest.id,
  status: issues.length > 0 ? "BLOCKED" : physicalAcceptanceComplete ? "GOLD" : "PARTIAL",
  goldEligible: issues.length === 0 && physicalAcceptanceComplete,
  runtime: imageResizeManifest.runtime,
  maintenanceClass: imageResizeManifest.gold.maintenanceClass,
  oracleEntryId: imageResizeManifest.gold.oracleEntryId,
  oracleCandidate: oracle?.candidate ?? null,
  fixtureFamilies: imageResizeManifest.gold.fixtureFamilies,
  resolvedFixtures: resolvedFixtures.map((entry) => ({ id: entry.id, path: entry.path })),
  automatedChecks: issues.length === 0 ? "PASS" : "FAIL",
  desktopAutomation: {
    chrome: validBrowserReceipt(chromeReceipt) ? "PASS" : "MISSING_OR_INVALID",
    edge: validBrowserReceipt(edgeReceipt) ? "PASS" : "MISSING_OR_INVALID",
    lazyBundle: isRecord(bundleReceipt) && bundleReceipt.implementationEager === false
      ? "PASS"
      : "MISSING_OR_INVALID",
  },
  supplementaryAutomation: {
    playwrightWebkit: validBrowserReceipt(webkitReceipt) ? "PASS" : webkitReceipt === null ? "MISSING" : "INVALID",
    note: "Playwright WebKit is a Safari-like regression lane only; it never substitutes for the required physical iOS Safari receipt.",
  },
  physicalAcceptance: {
    iosSafari: iosPass ? "PASS" : iosReceipt === null ? "MISSING" : "INVALID",
    androidChrome: androidPass ? "PASS" : androidReceipt === null ? "MISSING" : "INVALID",
    requirement: "Actual physical/remote iOS Safari and Android Chrome memory thresholds before Gold publication",
    iosIssues: iosPass ? [] : iosIssues,
    androidIssues: androidPass ? [] : androidIssues,
  },
  issues,
  identities: {
    ...identities,
    oracleRegistrySha256: sha256(registryText),
    fixtureIndexSha256: sha256(fixtureIndexText),
  },
};

await mkdir(resolve(root, "quality/receipts/image-resize"), { recursive: true });
await writeFile(
  resolve(root, "quality/receipts/image-resize/certification.json"),
  `${JSON.stringify(receipt, null, 2)}\n`,
  "utf8",
);

if (issues.length > 0) {
  console.error(issues.join("\n"));
  process.exit(1);
}
console.log(
  physicalAcceptanceComplete
    ? "Image Resize Gold PASS: automated + iOS Safari + Android Chrome physical acceptance present"
    : "Image Resize PARTIAL: automated certification PASS; physical iOS Safari and Android Chrome thresholds still required",
);
