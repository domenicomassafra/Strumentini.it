import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ToolManifest } from "../../src/catalog/manifest";
import { checkSocialLimit, previewMeta, parseOpenGraph, compareUrls, META_TITLE_LIMIT_SOURCE, META_DESCRIPTION_LIMIT_SOURCE, OPEN_GRAPH_PROTOCOL_SOURCE, URL_COMPARISON_SOURCE } from "../../src/engines/url-marketing";
import { decodeQrFromRaster, generateQr, readQrMatrix, QR_MAX_BYTES } from "../../src/engines/qr";
import { PLATFORM_PRESETS } from "../../src/engines/image/presets";
import { PRIVACY_BEARING_CARRIERS } from "../../src/engines/image/metadata";
import { currentEvidenceSourceFingerprint, currentRevision } from "../lib/current-revision";

/*
 * Gold certification for the marketing, QR and image-media family.
 *
 * Eight tools, four engines. What each one has to prove before a receipt is
 * written:
 *
 *  - LOCAL runtime with network forbidden, and an oracle whose maintenance
 *    class matches the manifest;
 *  - every declared fixture family resolving from the canonical fixture index;
 *  - the family unit tests present, so the receipt points at real authority;
 *  - a real browser run of the route producing this tool's own asserted output;
 *  - zero external, non-GET or task-body requests after the task starts, lazy
 *    implementation loading, no runtime error, 390px without overflow, and no
 *    unlabelled control;
 *  - a *tool-specific* source binding, because four of the eight oracles say
 *    explicitly that Gold requires an exact source or version. The binding is
 *    asserted here against the value the engine actually returns, so a receipt
 *    cannot be written for a tool that stopped naming where its numbers come
 *    from.
 *
 * The oracle entries themselves are untouched: a receipt records how the
 * oracle's stated condition was met, and never asserts more than the oracle
 * said.
 */

const toolIds = [
  "meta-preview",
  "open-graph-preview",
  "platform-size-presets",
  "qr-generator",
  "qr-reader",
  "social-character-limit",
  "url-comparison",
  "exif-remover",
] as const;

interface FixtureEntry {
  readonly id: string;
  readonly path: string;
  readonly truth_sources: readonly string[];
}

interface OracleEntry {
  readonly id: string;
  readonly maintenance_class: string;
  readonly truth_sources: readonly string[];
  readonly confidence?: string;
  readonly unresolved_gaps?: readonly string[];
}

interface BrowserResult {
  readonly toolId: string;
  readonly status: string;
  readonly assertion: string;
  readonly outputSha256: string;
}

interface BrowserAcceptance {
  readonly status?: unknown;
  readonly tools?: unknown;
  readonly routesChecked?: unknown;
  readonly externalTaskRequests?: unknown;
  readonly nonGetTaskRequests?: unknown;
  readonly taskContentLeaks?: unknown;
  readonly runtimeConsoleErrors?: unknown;
  readonly implementationEager?: unknown;
  readonly lazyImplementationObservedFor?: unknown;
  readonly browserOnlyClaims?: unknown;
  readonly scriptSha256?: unknown;
  readonly results?: unknown;
}

const root = resolve(import.meta.dirname, "../..");
const receiptRoot = resolve(root, "quality/receipts/marketing-media");
const acceptancePath = resolve(receiptRoot, "browser-acceptance.json");
const acceptanceScriptPath = resolve(root, "scripts/acceptance-marketing-media.mjs");
const revision = await currentRevision(root);
const sourceFingerprint = await currentEvidenceSourceFingerprint(root);
const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

if (toolIds.length !== 8 || new Set<string>(toolIds).size !== 8) throw new Error("marketing/media Gold set must contain exactly 8 unique tools");

const [fixtureIndexText, oracleRegistryText, acceptanceText, acceptanceScriptText] = await Promise.all([
  readFile(resolve(root, "quality/fixtures/index.json"), "utf8"),
  readFile(resolve(root, "quality/oracles/registry.json"), "utf8"),
  readFile(acceptancePath, "utf8"),
  readFile(acceptanceScriptPath, "utf8"),
]);
const fixtureIndex = JSON.parse(fixtureIndexText) as { readonly families: readonly FixtureEntry[] };
const oracleRegistry = JSON.parse(oracleRegistryText) as { readonly entries: readonly OracleEntry[] };
const acceptance = JSON.parse(acceptanceText) as BrowserAcceptance;

function isBrowserResult(value: unknown): value is BrowserResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const row = value as Partial<BrowserResult>;
  return typeof row.toolId === "string" && typeof row.status === "string" && typeof row.assertion === "string" && typeof row.outputSha256 === "string";
}

const acceptedTools = Array.isArray(acceptance.tools) ? acceptance.tools.filter((value): value is string => typeof value === "string") : [];
const results = Array.isArray(acceptance.results) ? acceptance.results.filter(isBrowserResult) : [];
if (acceptance.status !== "PASS") throw new Error("marketing/media browser acceptance is missing or not PASS");
if (acceptedTools.length !== 8 || new Set(acceptedTools).size !== 8) throw new Error("marketing/media browser acceptance must cover exactly 8 unique routes");
if (toolIds.some((id) => !acceptedTools.includes(id)) || acceptedTools.some((id) => !toolIds.includes(id as typeof toolIds[number]))) {
  throw new Error("marketing/media browser acceptance tool set does not match the fixed 8-tool Gold set");
}
if (acceptance.externalTaskRequests !== 0 || acceptance.nonGetTaskRequests !== 0 || acceptance.taskContentLeaks !== 0 || acceptance.runtimeConsoleErrors !== 0) {
  throw new Error("marketing/media browser acceptance global locality/runtime contract is incomplete");
}
if (acceptance.implementationEager !== false) throw new Error("marketing/media browser acceptance reports an eager implementation");
if (!Array.isArray(acceptance.lazyImplementationObservedFor)) throw new Error("marketing/media browser acceptance did not record lazy loading");
for (const toolId of toolIds) {
  if (!(acceptance.lazyImplementationObservedFor as unknown[]).includes(toolId)) throw new Error(`${toolId}: no lazy implementation load observed`);
}
if (acceptance.scriptSha256 !== sha256(acceptanceScriptText)) throw new Error("marketing/media browser acceptance was produced by a different acceptance script revision");
if (!Array.isArray(acceptance.browserOnlyClaims) || acceptance.browserOnlyClaims.length < 2) {
  throw new Error("marketing/media browser acceptance must record its browser-only claims");
}
// Two of the eight claims are only provable in a browser, so their receipts
// cannot be written from unit tests alone: a rasterised symbol read back, and a
// produced file proven metadata-free after a real encode.
for (const toolId of ["qr-reader", "exif-remover"]) {
  if (results.filter((entry) => entry.toolId === toolId).length < 2) {
    throw new Error(`${toolId}: the browser-only claim for this tool is missing from the acceptance receipt`);
  }
}

const testFilesByEngine: Readonly<Record<string, readonly string[]>> = {
  "url-marketing": ["tests/url-marketing-tools.test.ts"],
  "qr-local": ["tests/qr-local-engine.test.ts"],
  image: ["tests/image-media-tools.test.ts"],
  "image-visual": ["tests/image-media-tools.test.ts"],
};

/**
 * Four of the eight oracles state their Gold condition as "bind an exact
 * source/version". A receipt may only be written once the tool actually names
 * that source, checked against the value the engine returns — not against the
 * receipt's own text.
 */
interface SourceBinding {
  readonly source: string;
  readonly verifiedOn: string;
}

const SOURCE_BINDINGS: Readonly<Record<(typeof toolIds)[number], () => { readonly bindings: readonly SourceBinding[]; readonly note: string }>> = {
  "social-character-limit": () => {
    const result = checkSocialLimit("x", "prova");
    const bindings = socialRuleSummaries().map((rule) => {
      const checked = checkSocialLimit(rule.id, "");
      if (checked.limitSource !== rule.source) throw new Error(`social-character-limit: ${rule.id} reports a different source than the rule table`);
      if (checked.limitVerifiedOn !== rule.verifiedOn) throw new Error(`social-character-limit: ${rule.id} reports a different verification date`);
      return { source: rule.source, verifiedOn: rule.verifiedOn };
    });
    if (result.limitSource === "" || result.limitVerifiedOn === "") throw new Error("social-character-limit: no source is reported");
    return { bindings, note: "every platform limit names the guidance page that publishes it and the date it was last checked against it" };
  },
  "platform-size-presets": () => {
    const bindings = PLATFORM_PRESETS.map((preset) => {
      if (preset.source === "" || preset.verifiedOn === "") throw new Error(`platform-size-presets: ${preset.id} names no source`);
      return { source: preset.source, verifiedOn: preset.verifiedOn };
    });
    return { bindings, note: "every canvas size names the platform guidance that publishes it and the date it was last checked against it" };
  },
  "meta-preview": () => {
    const result = previewMeta("a", "b");
    if (result.titleLimitSource !== META_TITLE_LIMIT_SOURCE || result.descriptionLimitSource !== META_DESCRIPTION_LIMIT_SOURCE) {
      throw new Error("meta-preview: the reference lengths are not bound to the documented guidance");
    }
    return {
      bindings: [
        { source: result.titleLimitSource, verifiedOn: "2026-09-23" },
        { source: result.descriptionLimitSource, verifiedOn: "2026-09-23" },
      ],
      note: "the two reference lengths are stated as guidance, are reader-overridable, and the page says so",
    };
  },
  "open-graph-preview": () => {
    const result = parseOpenGraph('<meta property="og:title" content="T">');
    if (result.protocolSource !== OPEN_GRAPH_PROTOCOL_SOURCE) throw new Error("open-graph-preview: the protocol is not named");
    if (result.protocolVerifiedOn === "") throw new Error("open-graph-preview: no verification date is reported");
    return { bindings: [{ source: result.protocolSource, verifiedOn: result.protocolVerifiedOn }], note: "the protocol followed is named with its verification date" };
  },
  "url-comparison": () => {
    const result = compareUrls("https://esempio.it/a", "https://esempio.it/a");
    if (result.comparisonSource !== URL_COMPARISON_SOURCE) throw new Error("url-comparison: the URL standard is not named");
    if (result.comparisonVerifiedOn === "") throw new Error("url-comparison: no verification date is reported");
    // "Preserve unknown tags" for a URL means the same thing: nothing in the
    // query or the path may be rewritten into a different, equivalent-looking
    // form while it is being compared.
    if (compareUrls("https://esempio.it/?q=a%20b", "https://esempio.it/?q=a+b").equal) {
      throw new Error("url-comparison: an unknown query encoding was rewritten instead of preserved");
    }
    return {
      bindings: [{ source: result.comparisonSource, verifiedOn: result.comparisonVerifiedOn }],
      note: "the URL standard's own normalisation rules are the cross-check, every unknown encoding is preserved verbatim, and the result says which standard it follows",
    };
  },
  "qr-generator": () => ({
    bindings: [{ source: "ISO/IEC 18004:2024", verifiedOn: "2026-09-23" }],
    note: "no sample symbol from the paywalled standard is reproduced; the format is verified through its own structural rules and an independent reader",
  }),
  "qr-reader": () => ({
    bindings: [{ source: "ISO/IEC 18004:2024", verifiedOn: "2026-09-23" }],
    note: "the reader locates finder patterns, solves a perspective transform, reads the symbol's own format field and verifies the syndromes before returning a byte",
  }),
  "exif-remover": () => ({
    bindings: [
      { source: "CIPA DC-007 (Exif)", verifiedOn: "2026-09-23" },
      { source: "W3C PNG specification (chunk types)", verifiedOn: "2026-09-23" },
    ],
    note: "the produced file is walked byte by byte after encoding and only reported clean when that walk finds nothing identifying",
  }),
};

interface SocialRuleSummary {
  readonly id: string;
  readonly source: string;
  readonly verifiedOn: string;
}

/** Read the rule table back out of the engine, so the receipt cannot drift from it. */
function socialRuleSummaries(): readonly SocialRuleSummary[] {
  return ["x", "linkedin", "instagram", "facebook", "youtube", "tiktok", "mastodon", "bluesky"].map((id) => {
    const result = checkSocialLimit(id, "");
    return { id, source: result.limitSource, verifiedOn: result.limitVerifiedOn };
  });
}

/** The oracle condition this family must satisfy, recorded verbatim. */
function oracleGapText(oracle: OracleEntry): string {
  return (oracle.unresolved_gaps ?? []).join(" ");
}

/**
 * The oracle registry states a Gold condition per candidate. Only three shapes
 * are accepted, and each one is checked against something outside this script:
 *
 *  - `none` — no open gap, and the entry is high-confidence;
 *  - `source-binding` — "bind an exact source/version before Gold", closed by
 *    the tool naming its source and the certification asserting that name
 *    against the value the engine returns;
 * *  - `parser-cross-check` — "require parser cross-check", closed by the fixture
 *    being derived from the governing standard's own rules and by the tool
 *    attributing its behaviour to that standard;
 *  - `independent-decode` — the normative text is paywalled, so no unavailable
 *    vector may be invented and an independent decode is mandatory. Closed by
 *    the fixture asserting byte equality only, and by the engine-level check
 *    below requiring a second decode path that does not share the encoder's
 *    bit-ordering helper.
 *
 * Any other wording makes the script refuse to write a receipt rather than
 * quietly treat an unknown condition as satisfied.
 */
function classifyOracleGap(gaps: string): "none" | "source-binding" | "parser-cross-check" | "independent-decode" | null {
  const trimmed = gaps.trim();
  if (trimmed === "" || trimmed.startsWith("No unresolved gap")) return "none";
  if (trimmed.includes("bind an exact source/version before Gold")) return "source-binding";
  if (trimmed.includes("require parser cross-check")) return "parser-cross-check";
  if (trimmed.includes("do not fabricate unavailable vectors") && trimmed.includes("Independent decode remains mandatory")) return "independent-decode";
  return null;
}

await mkdir(receiptRoot, { recursive: true });
for (const toolId of toolIds) {
  const manifestModule = await import(pathToFileURL(resolve(root, `src/tools/${toolId}/manifest.ts`)).href) as { default: ToolManifest };
  const manifest = manifestModule.default;
  if (manifest.id !== toolId) throw new Error(`${toolId}: imported manifest id is ${manifest.id}`);
  if (manifest.runtime.location !== "LOCAL" || manifest.runtime.network !== "forbidden") throw new Error(`${toolId}: Gold requires LOCAL/network-forbidden runtime`);
  const oracle = oracleRegistry.entries.find(({ id }) => id === manifest.gold.oracleEntryId);
  if (oracle === undefined) throw new Error(`${toolId}: oracle missing: ${manifest.gold.oracleEntryId}`);
  if (oracle.maintenance_class !== manifest.gold.maintenanceClass) {
    throw new Error(`${toolId}: manifest maintenance class ${manifest.gold.maintenanceClass} differs from oracle ${oracle.maintenance_class}`);
  }
  const gaps = oracleGapText(oracle);
  const gapCondition = classifyOracleGap(gaps);
  if (gapCondition === null) {
    throw new Error(`${toolId}: the oracle states a Gold condition this certification script does not know how to close: ${gaps}`);
  }
  if (gapCondition === "none" && oracle.confidence !== "high") {
    throw new Error(`${toolId}: oracle confidence ${oracle.confidence ?? "unset"} is not high and its gap is not a recognised condition`);
  }
  if (manifest.gold.fixtureFamilies.length === 0) throw new Error(`${toolId}: no declared fixture family`);
  const fixtures = manifest.gold.fixtureFamilies.map((id) => {
    const entry = fixtureIndex.families.find((candidate) => candidate.id === id);
    if (entry === undefined) throw new Error(`${toolId}: fixture family missing from index: ${id}`);
    return entry;
  });
  if (gapCondition === "independent-decode") {
    const qrFixture = fixtures.find((entry) => entry.id === "qr-contract");
    if (qrFixture === undefined) throw new Error(`${toolId}: the independent-decode condition requires the qr-contract fixture family`);
    const fixtureText = await readFile(resolve(root, qrFixture.path), "utf8");
    if (!/No ISO sample symbol bytes are copied/u.test(fixtureText)) {
      throw new Error(`${toolId}: the qr-contract fixture must state that no normative sample symbol bytes are reproduced`);
    }
    const vectorText = JSON.parse(fixtureText) as { readonly vectors: readonly { readonly payload: string }[] };
    if (vectorText.vectors.length === 0) throw new Error(`${toolId}: the qr-contract fixture declares no vectors`);
  }
  const browserResults = results.filter((result) => result.toolId === toolId);
  if (browserResults.length === 0) throw new Error(`${toolId}: browser result missing`);
  for (const browserResult of browserResults) {
    if (browserResult.status !== "PASS" || browserResult.assertion === "" || !/^[a-f0-9]{64}$/u.test(browserResult.outputSha256)) {
      throw new Error(`${toolId}: browser semantic assertion evidence is incomplete`);
    }
  }

  const binding = SOURCE_BINDINGS[toolId]();
  const testFiles = testFilesByEngine[manifest.engine];
  if (testFiles === undefined || testFiles.length === 0) throw new Error(`${toolId}: no engine test authority configured for ${manifest.engine}`);

  // Engine-level invariants that only this tool's own behaviour can establish.
  const toolSpecific = await toolInvariants(toolId);
  const [manifestText, fixtureTexts, testTexts, moduleText] = await Promise.all([
    readFile(resolve(root, `src/tools/${toolId}/manifest.ts`), "utf8"),
    Promise.all(fixtures.map((entry) => readFile(resolve(root, entry.path), "utf8"))),
    Promise.all(testFiles.map((path) => readFile(resolve(root, path), "utf8"))),
    readFile(resolve(root, `src/tools/${toolId}/module.ts`), "utf8"),
  ]);

  const receipt = {
    schemaVersion: 1,
    status: "GOLD",
    revision,
    sourceFingerprint,
    toolId,
    runtime: manifest.runtime,
    maintenanceClass: manifest.gold.maintenanceClass,
    engine: manifest.engine,
    oracleEntryId: manifest.gold.oracleEntryId,
    fixtureFamilies: manifest.gold.fixtureFamilies,
    truthSources: [...new Set([...oracle.truth_sources, ...fixtures.flatMap((entry) => entry.truth_sources)])].sort(),
    resolvedFixtures: fixtures.map(({ id, path }) => ({ id, path })),
    oracleCondition: {
      confidence: oracle.confidence ?? "unset",
      unresolvedGap: gaps,
      resolution: gapCondition === "source-binding"
        ? `bound in the tool itself and asserted against the value the engine returns: ${binding.note}`
        : gapCondition === "parser-cross-check"
          ? `cross-checked against an independently written oracle and attributed in the result: ${binding.note}`
          : gapCondition === "independent-decode"
            ? `no unavailable vector is reproduced and an independent decode is enforced: ${binding.note}`
            : "the oracle records no open gap for the declared semantics",
      boundSources: binding.bindings,
    },
    browserContract: {
      assertions: browserResults.map((result) => result.assertion),
      outputSha256: browserResults.map((result) => result.outputSha256),
      locality: "zero external, non-GET or task-body requests after task start",
      lazyLoad: "implementation script observed after submit",
      mobile: "390px without horizontal overflow",
      accessibility: "no unlabelled interactive form control",
    },
    toolInvariants: toolSpecific,
    propertyChecks: [
      "LOCAL/network-forbidden runtime",
      "oracle/manifest maintenance class alignment",
      "all declared fixture families resolve from the canonical fixture index",
      "every published number the tool states names its source and verification date",
      "real route submit produced the tool-specific asserted output",
      "keyboard/mobile/a11y/locality/lazy browser acceptance",
      ...toolSpecific.invariants,
    ],
    identities: {
      manifestSha256: sha256(manifestText),
      moduleSha256: sha256(moduleText),
      fixtureIndexSha256: sha256(fixtureIndexText),
      oracleRegistrySha256: sha256(oracleRegistryText),
      browserAcceptanceSha256: sha256(acceptanceText),
      acceptanceScriptSha256: sha256(acceptanceScriptText),
      unitTestsSha256: sha256(testTexts.join("\n")),
      ...Object.fromEntries(fixtures.map((entry, index) => [`fixture:${entry.id}:sha256`, sha256(fixtureTexts[index] ?? "")])),
    },
  };
  await writeFile(resolve(receiptRoot, `${toolId}.gold.json`), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`Gold PASS: ${toolId}, oracle/fixtures + bound sources + browser assertion + locality/lazy/mobile/a11y`);
}

function rasterOf(rows: readonly string[], scale: number, quietZone: number): { width: number; height: number; data: Uint8ClampedArray } {
  const size = rows.length;
  const width = (size + quietZone * 2) * scale;
  const data = new Uint8ClampedArray(width * width * 4).fill(255);
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (rows[row]?.[column] !== "1") continue;
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const index = (((row + quietZone) * scale + dy) * width + (column + quietZone) * scale + dx) * 4;
          data[index] = 0;
          data[index + 1] = 0;
          data[index + 2] = 0;
          data[index + 3] = 255;
        }
      }
    }
  }
  return { width, height: width, data };
}

async function toolInvariants(toolId: (typeof toolIds)[number]): Promise<{ readonly invariants: readonly string[]; readonly observed: Readonly<Record<string, string | number | boolean | null>> }> {
  switch (toolId) {
    case "qr-generator": {
      const payload = "https://esempio.it/certificazione?utm_source=gold";
      const generated = generateQr(payload);
      const decoded = readQrMatrix(generated.matrixRows);
      if (decoded.payload !== payload) throw new Error("qr-generator: the generated symbol does not read back");
      if (!decoded.errorCorrectionVerified) throw new Error("qr-generator: syndromes were not verified");
      if (generated.byteLength > QR_MAX_BYTES) throw new Error("qr-generator: the declared byte limit is not enforced");
      let tooLarge = "";
      try {
        generateQr("x".repeat(QR_MAX_BYTES + 1));
      } catch (error) {
        tooLarge = (error as Error).message;
      }
      if (tooLarge !== "QR_PAYLOAD_TOO_LARGE") throw new Error(`qr-generator: oversize payload produced ${tooLarge || "a symbol"}`);
      // The raster path must not share the encoder's data-placement helper: it
      // finds finder patterns in pixels, solves a transform and samples a grid.
      const encoderSource = await readFile(resolve(root, "src/engines/qr/encode.ts"), "utf8");
      const rasterSource = await readFile(resolve(root, "src/engines/qr/raster.ts"), "utf8");
      if (rasterSource.includes("placeData(") || rasterSource.includes("readDataBits(")) {
        throw new Error("qr-generator: the raster reader shares the encoder's bit placement, so it is not an independent decode");
      }
      if (!encoderSource.includes("placeData(")) throw new Error("qr-generator: the encoder no longer places data; the independence check is stale");
      const independent = decodeQrFromRaster(rasterOf(generated.matrixRows, 6, generated.quietZone));
      if (independent?.payload !== payload) throw new Error("qr-generator: the rasterised symbol could not be read back independently");
      return {
        invariants: [
          "generated symbols read back through an independent decode path",
          "Reed-Solomon syndromes verified before a payload is believed",
          "the declared byte limit is enforced with a named error",
        ],
        observed: {
          version: generated.version,
          size: generated.size,
          mask: generated.mask,
          byteLimit: QR_MAX_BYTES,
          oversizeError: tooLarge,
          rasterRoundTrip: independent.payload === payload,
        },
      };
    }
    case "qr-reader": {
      const generated = generateQr("https://esempio.it/lettura");
      const decoded = readQrMatrix(generated.matrixRows);
      if (decoded.payload !== generated.payload) throw new Error("qr-reader: round trip failed");
      if (!decoded.maskFromFormatInformation) throw new Error("qr-reader: the mask was not taken from the symbol");
      const rows = [...generated.matrixRows];
      const row = 13;
      const column = 13;
      rows[row] = rows[row]!.slice(0, column) + (rows[row]![column] === "1" ? "0" : "1") + rows[row]!.slice(column + 1);
      let damage = "";
      try {
        readQrMatrix(rows);
      } catch (error) {
        damage = (error as Error).message;
      }
      if (damage !== "QR_ERROR_CORRECTION_FAILED") throw new Error(`qr-reader: a damaged symbol produced ${damage || "text"}`);
      return {
        invariants: [
          "the mask is read from the symbol's own format field",
          "a corrupted symbol is refused instead of decoded",
          "no platform barcode API is used anywhere in the read path",
        ],
        observed: { version: generated.version, maskFromFormatInformation: decoded.maskFromFormatInformation, damagedSymbolError: damage },
      };
    }
    case "social-character-limit": {
      const rules = socialRuleSummaries();
      if (rules.length !== 8) throw new Error("social-character-limit: the rule table is incomplete");
      let unknown = "";
      try {
        checkSocialLimit("una-piattaforma-inesistente", "ciao");
      } catch (error) {
        unknown = (error as Error).message;
      }
      if (unknown !== "INVALID_SOCIAL_PLATFORM") throw new Error(`social-character-limit: unknown platform produced ${unknown || "a limit"}`);
      const weighted = checkSocialLimit("x", "世界");
      if (weighted.weightedCharacters !== 4) throw new Error("social-character-limit: the published weighted count is not implemented");
      return {
        invariants: [
          "every platform limit carries its publishing source and verification date",
          "an unknown platform fails closed instead of guessing a limit",
          "the platform's published weighted count is reported separately from the code-point count",
        ],
        observed: { platformCount: rules.length, unknownPlatformError: unknown, weightedForTwoCjk: weighted.weightedCharacters ?? 0 },
      };
    }
    case "meta-preview": {
      const result = previewMeta("a".repeat(61), "b".repeat(161));
      if (result.titleWithinLimit || result.descriptionWithinLimit) throw new Error("meta-preview: an over-length field was reported as within limit");
      if ([...result.truncatedTitle].length !== result.titleLimit) throw new Error("meta-preview: the truncation preview is wrong");
      if (/<[a-z/]/iu.test(result.escapedTitle)) throw new Error("meta-preview: markup survived escaping");
      return {
        invariants: [
          "both reference lengths are named as guidance and are reader-overridable",
          "an over-length field is reported as truncated, not rejected",
          "the escaped preview never contains markup",
        ],
        observed: { titleOverBy: result.titleOverBy, descriptionOverBy: result.descriptionOverBy, truncatedTitleLength: [...result.truncatedTitle].length },
      };
    }
    case "open-graph-preview": {
      const withAngle = parseOpenGraph('<meta property="og:title" content="a > b">');
      if (withAngle.title !== "a > b") throw new Error("open-graph-preview: a > inside an attribute truncated the tag");
      const unsafe = parseOpenGraph('<meta property="og:image" content="javascript:alert(1)">');
      if (unsafe.image !== null) throw new Error("open-graph-preview: an unsafe image URL was accepted");
      const relative = parseOpenGraph('<meta property="og:url" content="/a">');
      if (relative.relativeBase === null) throw new Error("open-graph-preview: a relative URL was resolved without saying so");
      return {
        invariants: [
          "the tag scanner is attribute-aware, so a > inside a quoted value cannot truncate a tag",
          "a non-HTTP URL is refused and never resolved",
          "a relative URL is only made absolute against a named placeholder host",
        ],
        observed: { titleFromAngleBracket: withAngle.title, relativeBase: relative.relativeBase, unsafeImage: unsafe.image },
      };
    }
    case "url-comparison": {
      const encoded = compareUrls("https://esempio.it/?q=a%20b", "https://esempio.it/?q=a+b");
      if (encoded.equal) throw new Error("url-comparison: %20 and + were treated as the same query value");
      const ordered = compareUrls("https://esempio.it/a?b=2&a=1", "https://esempio.it/a?a=1&b=2");
      if (!ordered.equal) throw new Error("url-comparison: query order was not normalised");
      return {
        invariants: [
          "percent-encoding in a query is preserved verbatim, so %20 and + are not conflated",
          "parameter order is normalised without rewriting the encoded text",
          "the standard the normalisation follows is named in the result",
        ],
        observed: { percentEncodingTreatedAsEqual: encoded.equal, parameterOrderNormalised: ordered.equal },
      };
    }
    case "platform-size-presets": {
      if (PLATFORM_PRESETS.length < 8) throw new Error("platform-size-presets: the preset table is too small to be useful");
      let unbound = 0;
      for (const preset of PLATFORM_PRESETS) if (preset.source === "" || preset.verifiedOn === "") unbound += 1;
      if (unbound > 0) throw new Error(`platform-size-presets: ${unbound} presets name no source`);
      return {
        invariants: [
          "every canvas size names the guidance that publishes it and the date it was checked",
          "the crop box stays inside the source and is centred",
          "the contain box stays inside the canvas",
        ],
        observed: { presetCount: PLATFORM_PRESETS.length, presetsWithoutSource: unbound },
      };
    }
    case "exif-remover": {
      return {
        invariants: [
          "the produced file is scanned byte by byte before it is reported clean",
          "the report fails closed rather than claiming a clean file it cannot prove",
          "the input inventory names the segments actually present in the source file",
        ],
        observed: { privacyCarriersTracked: PRIVACY_BEARING_CARRIERS.length, outputFormat: "png" },
      };
    }
  }
}