import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ToolManifest } from "../../src/catalog/manifest";
import type { ToolModule } from "../../src/runtime/types";
import {
  bpmFromTapTimes,
  chooseSupportedRecorderMimeType,
  italianVoices,
  pauseRecordingClock,
  recordingDurationMs,
  resumeRecordingClock,
  startRecordingClock,
} from "../../src/engines/browser-audio";
import { encodeCode128B, encodeEan13 } from "../../src/engines/barcode";
import { createZip, inspectZip } from "../../src/engines/file-privacy";
import { simulateColorVisionRgba, type ColorVisionSimulationMode } from "../../src/engines/image/visual-tools";
import { createSimplePdf } from "../../src/engines/pdf";
import { parseSubtitles, subtitleTranscript } from "../../src/engines/text-writing";
import { currentEvidenceSourceFingerprint, currentRevision } from "../lib/current-revision";

interface OracleEntry {
  readonly id: string;
  readonly maintenance_class: string;
  readonly truth_sources: readonly string[];
  readonly confidence?: string;
  readonly unresolved_gaps?: readonly string[];
}

interface FixtureEntry {
  readonly id: string;
  readonly path: string;
  readonly truth_sources: readonly string[];
}

interface ToolSpec {
  readonly id: string;
  readonly browserReceipt: string;
  readonly testFiles: readonly string[];
}

const root = resolve(import.meta.dirname, "../..");
const receiptRoot = resolve(root, "quality/receipts/certification-frontier");
const bundleReceiptPath = "quality/receipts/certification-frontier/bundle-isolation.json";
const promotable: readonly ToolSpec[] = [
  { id: "ai-code-fence-bundle", browserReceipt: "quality/receipts/file-certification-frontier/browser-acceptance.json", testFiles: ["tests/file-privacy-engine.test.ts", "tests/file-privacy-modules.test.ts"] },
  { id: "file-size-analyzer", browserReceipt: "quality/receipts/file-certification-frontier/browser-acceptance.json", testFiles: ["tests/file-privacy-engine.test.ts", "tests/file-privacy-modules.test.ts"] },
  { id: "fatturapa-reader", browserReceipt: "quality/receipts/italy-2026-consumers/browser-acceptance.json", testFiles: ["tests/italy-2026-consumers.test.ts", "tests/italy-public-routes.test.ts"] },
  { id: "pdf-multi-text-search", browserReceipt: "quality/receipts/pdf-search-markdown/browser-acceptance.json", testFiles: ["tests/pdf-search-markdown-upgrades.test.ts"] },
  { id: "pdf-to-markdown", browserReceipt: "quality/receipts/pdf-search-markdown/browser-acceptance.json", testFiles: ["tests/pdf-search-markdown-upgrades.test.ts"] },
  { id: "color-blindness-image-simulation", browserReceipt: "quality/receipts/color-vision-simulation/browser-acceptance.json", testFiles: ["tests/color-vision-simulation.test.ts"] },
  { id: "barcode-generator", browserReceipt: "quality/receipts/barcode/browser-acceptance.json", testFiles: ["tests/barcode-generator.test.ts"] },
  { id: "audio-generator", browserReceipt: "quality/receipts/browser-audio/browser-acceptance.json", testFiles: ["tests/browser-audio-utilities.test.ts"] },
  { id: "browser-text-to-speech", browserReceipt: "quality/receipts/browser-audio/browser-acceptance.json", testFiles: ["tests/browser-audio-utilities.test.ts"] },
  { id: "subtitle-srt-vtt-transform", browserReceipt: "quality/receipts/subtitle-transform/browser-acceptance.json", testFiles: ["tests/subtitle-transform.test.ts"] },
] as const;
const microphone: ToolSpec = {
  id: "microphone-recorder",
  browserReceipt: "quality/receipts/microphone-recorder/browser-acceptance.json",
  testFiles: ["tests/browser-audio-utilities.test.ts"],
};

const boundedGapPatterns: Readonly<Record<string, readonly RegExp[]>> = {
  "cand-244": [/model-based simulation.*not a measurement/iu, /complete dichromacy endpoints.*interpolation.*outside/iu],
  "cand-246": [/limited to printable ASCII Code Set B/iu, /does not certify printer resolution.*print-quality grade/iu, /does not prove.*GTIN allocation/iu],
  "cand-247": [/Background scheduling precision.*browser and platform controlled/iu],
  "cand-248": [/platform may use a remote speech service/iu],
  "cand-249": [/SRT has no single normative standard.*strict common subset/iu, /WebVTT cue settings.*outside this supported subset/iu],
  "cand-250": [/Opaque formats remain intentionally unexplained/iu],
  "cand-251": [/Filename hints intentionally support a bounded explicit convention/iu],
  "cand-253": [/OCR remains unavailable.*no OCR result is fabricated/iu],
  "cand-254": [/Visual reading order.*styles are intentionally outside this export mode/iu],
  "cand-255": [/bounded human-readable field subset.*does not claim full XSD validation/iu],
};
const physicalGapPattern = /Physical iOS and Android permission and recorder behavior.*ticket 229/iu;

const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const filePart = (value: Uint8Array): ArrayBuffer => Uint8Array.from(value).buffer as ArrayBuffer;
const json = async <T>(path: string): Promise<{ value: T; text: string }> => {
  const text = await readFile(resolve(root, path), "utf8");
  return { value: JSON.parse(text) as T, text };
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertObjectSubset(actual: unknown, expected: Record<string, unknown>, context: string): void {
  assert(typeof actual === "object" && actual !== null && !Array.isArray(actual), `${context}: result is not an object`);
  const record = actual as Record<string, unknown>;
  for (const [key, value] of Object.entries(expected)) {
    assert(JSON.stringify(record[key]) === JSON.stringify(value), `${context}: ${key} mismatch; expected ${JSON.stringify(value)}, got ${JSON.stringify(record[key])}`);
  }
}

function browserReceiptCovers(receipt: Record<string, unknown>, toolId: string): boolean {
  if (receipt.status !== "PASS") return false;
  if (receipt.acceptanceToolId === toolId || receipt.tool === toolId || receipt.route === `/tools/${toolId}/`) return true;
  if (Array.isArray(receipt.tools) && receipt.tools.includes(toolId)) return true;
  if (Array.isArray(receipt.results) && receipt.results.some((item) => typeof item === "object" && item !== null && ((item as Record<string, unknown>).toolId === toolId || (item as Record<string, unknown>).id === toolId))) return true;
  if (Array.isArray(receipt.cases)) {
    if (toolId === "pdf-multi-text-search" && receipt.cases.some((item) => typeof item === "object" && item !== null && (item as Record<string, unknown>).name === "ticket248-search")) return true;
    if (toolId === "pdf-to-markdown" && receipt.cases.some((item) => typeof item === "object" && item !== null && (item as Record<string, unknown>).name === "ticket252-markdown")) return true;
  }
  return false;
}

function assertBoundedOracle(oracle: OracleEntry, toolId: string): string[] {
  assert(oracle.confidence === "high", `${toolId}: oracle ${oracle.id} confidence is not high`);
  const gaps = [...(oracle.unresolved_gaps ?? [])];
  const patterns = boundedGapPatterns[oracle.id];
  assert(patterns !== undefined, `${toolId}: oracle ${oracle.id} has no explicit bounded-gap policy`);
  assert(gaps.length === patterns.length, `${toolId}: oracle ${oracle.id} gap count changed from ${patterns.length} to ${gaps.length}`);
  for (const gap of gaps) assert(patterns.some((pattern) => pattern.test(gap)), `${toolId}: unrecognised oracle gap: ${gap}`);
  for (const pattern of patterns) assert(gaps.some((gap) => pattern.test(gap)), `${toolId}: expected bounded oracle gap is missing: ${String(pattern)}`);
  return gaps;
}

async function directCheck(toolId: string, module: ToolModule): Promise<string[]> {
  if (toolId === "ai-code-fence-bundle") {
    const fixture = (await json<{ vectors: Array<{ input: string; expectedPaths: string[] }> }>("quality/fixtures/ai-code-fence-bundle/vectors.json")).value;
    const vector = fixture.vectors[0]!;
    const output = await module.run({ text: vector.input }, { defaults: {} }) as { blob: Blob; preview: Array<{ path: string }>; compression: string };
    assert(output.compression === "store", "ai-code-fence-bundle: ZIP is not STORE");
    assert(JSON.stringify(output.preview.map(({ path }) => path)) === JSON.stringify(vector.expectedPaths), "ai-code-fence-bundle: preview paths differ from fixture");
    const inspected = await inspectZip({ files: [new File([await output.blob.arrayBuffer()], "bundle.zip", { type: "application/zip" })] });
    assert(JSON.stringify((inspected.entries as Array<{ path: string }>).map(({ path }) => path)) === JSON.stringify(vector.expectedPaths), "ai-code-fence-bundle: ZIP entries differ from preview");
    return ["fixture code-fence paths exact", "STORE ZIP central-directory paths equal preview"];
  }
  if (toolId === "file-size-analyzer") {
    const bytes = await readFile(resolve(root, "quality/fixtures/image-metadata/synthetic-2x3-rgba-text.png"));
    const image = await module.run({ files: [new File([filePart(bytes)], "fixture.png", { type: "image/png" })] }, { defaults: {} }) as Record<string, unknown>;
    assert(image.kind === "image" && image.estimatedSavingsBytes === null && image.sourceMutation === "none", "file-size-analyzer: image scope mismatch");
    const created = await createZip({ files: [new File(["a"], "small.txt"), new File(["abcdefghij"], "large.txt")] });
    const zip = await module.run({ files: [new File([await (created.blob as Blob).arrayBuffer()], "bundle.zip", { type: "application/zip" })] }, { defaults: {} }) as Record<string, unknown>;
    assert(zip.kind === "zip" && zip.estimatedSavingsBytes === null && zip.sourceMutation === "none", "file-size-analyzer: ZIP scope mismatch");
    return ["image and ZIP drivers observed", "sourceMutation=none", "no guessed savings"];
  }
  if (toolId === "fatturapa-reader") {
    const fixture = (await json<{ fatturaPa: { ordinaryExpected: Record<string, string>; simplifiedExpected: Record<string, string> } }>("quality/fixtures/italy-2026-consumers/vectors.json")).value;
    const ordinaryBytes = await readFile(resolve(root, "quality/fixtures/italy-2026-consumers/fatturapa-ordinary-anonymized.xml"));
    const ordinary = await module.run({ file: new File([ordinaryBytes], "ordinary.xml", { type: "application/xml" }) }, { defaults: {} }) as { transmissionFormat: string; xsdVersion: string; bodies: Array<{ number: string; documentTotal: string }> };
    assert(ordinary.transmissionFormat === fixture.fatturaPa.ordinaryExpected.format && ordinary.xsdVersion === fixture.fatturaPa.ordinaryExpected.xsdVersion && ordinary.bodies[0]?.number === fixture.fatturaPa.ordinaryExpected.number && ordinary.bodies[0]?.documentTotal === fixture.fatturaPa.ordinaryExpected.documentTotal, "fatturapa-reader: ordinary fixture mismatch");
    const simplifiedBytes = await readFile(resolve(root, "quality/fixtures/italy-2026-consumers/fatturapa-simplified-anonymized.xml"));
    const simplified = await module.run({ file: new File([simplifiedBytes], "simplified.xml", { type: "application/xml" }) }, { defaults: {} }) as { transmissionFormat: string; xsdVersion: string; bodies: Array<{ number: string }> };
    assert(simplified.transmissionFormat === fixture.fatturaPa.simplifiedExpected.format && simplified.xsdVersion === fixture.fatturaPa.simplifiedExpected.xsdVersion && simplified.bodies[0]?.number === fixture.fatturaPa.simplifiedExpected.number, "fatturapa-reader: simplified fixture mismatch");
    return ["ordinary FPR12/XSD 1.2.3 fixture exact", "simplified FSM10/XSD 1.0.2 fixture exact"];
  }
  if (toolId === "pdf-multi-text-search") {
    const good = createSimplePdf(["alpha first", "second alpha"]);
    const noText = createSimplePdf([""]);
    const result = await module.run({ files: [new File([filePart(good)], "good.pdf", { type: "application/pdf" }), new File([filePart(noText)], "scan.pdf", { type: "application/pdf" }), new File(["not a pdf"], "bad.pdf", { type: "application/pdf" })], query: "alpha", contextCharacters: 6, maxResults: 10 }, { defaults: {} }) as { matches: unknown[]; files: Array<{ status: string }> };
    assert(result.matches.length === 2 && JSON.stringify(result.files.map(({ status }) => status)) === JSON.stringify(["matches", "no-text", "unreadable"]), "pdf-multi-text-search: state/provenance contract mismatch");
    return ["mixed PDF states isolated", "no-text and unreadable kept explicit", "OCR not fabricated"];
  }
  if (toolId === "pdf-to-markdown") {
    const source = createSimplePdf(["# heading *literal*", "page [two] <tag>"]);
    const result = await module.run({ file: new File([filePart(source)], "report.pdf", { type: "application/pdf" }) }, { defaults: {} }) as { status: string; markdown: string; losses: string[] };
    assert(result.status === "converted" && result.markdown.includes('strumentini-pdf-page file="report.pdf" page="1"') && result.markdown.includes("\\# heading \\*literal\\*"), "pdf-to-markdown: provenance/escaping mismatch");
    assert(/tabelle.*colonne multiple/iu.test(result.losses.join(" ")) && /immagini/iu.test(result.losses.join(" ")), "pdf-to-markdown: declared losses missing");
    return ["page provenance exact", "Markdown metacharacters escaped", "layout/image losses explicit"];
  }
  if (toolId === "color-blindness-image-simulation") {
    const fixture = (await json<{ vectors: Array<{ name: string; mode: ColorVisionSimulationMode; input: number[]; expected: number[] }> }>("quality/fixtures/color-vision-simulation/vectors.json")).value;
    for (const vector of fixture.vectors) assert(JSON.stringify([...simulateColorVisionRgba(new Uint8ClampedArray(vector.input), vector.mode)]) === JSON.stringify(vector.expected), `color simulation mismatch: ${vector.name}`);
    return [`${fixture.vectors.length} exact independently transcribed RGBA vectors`, "alpha preserved"];
  }
  if (toolId === "barcode-generator") {
    const fixture = (await json<{ ean13: Array<Record<string, unknown>>; code128b: Array<Record<string, unknown>>; refusals: Array<{ input: string }> }>("quality/fixtures/barcode-linear/vectors.json")).value;
    const ean = fixture.ean13.find(({ id }) => id === "gs1-isbn-example")!;
    const eanResult = module.run({ format: "ean13", mode: "generate", value: ean.payload12 }, { defaults: {} }) as { value: string; checksum: number };
    assert(eanResult.value === ean.expected_value13 && eanResult.checksum === ean.expected_check_digit, "barcode-generator: EAN fixture mismatch");
    const code = fixture.code128b.find(({ id }) => id === "ascii-ab12")!;
    const codeResult = module.run({ format: "code128b", value: code.text }, { defaults: {} }) as { checksum: number; codewords: number[] };
    assert(codeResult.checksum === code.expected_checksum && JSON.stringify(codeResult.codewords) === JSON.stringify(code.expected_codewords), "barcode-generator: Code128B fixture mismatch");
    for (const refusal of fixture.refusals) {
      let refused = false;
      try { encodeCode128B(refusal.input); } catch { refused = true; }
      assert(refused, `barcode-generator: unsupported input accepted: ${JSON.stringify(refusal.input)}`);
    }
    assert(encodeEan13(String(ean.payload12), "generate").value === ean.expected_value13, "barcode-generator: direct EAN engine mismatch");
    return ["EAN-13 known vector exact", "Code128B exact codewords/checksum", "out-of-scope character classes refused"];
  }
  if (toolId === "audio-generator") {
    const fixture = (await json<{ audio: Array<Record<string, unknown>>; tapTimesMs: number[]; expectedBpm: number }>("quality/fixtures/browser-audio-utilities/vectors.json")).value;
    for (const settings of fixture.audio) assertObjectSubset(module.run(settings, { defaults: {} }), settings, "audio-generator");
    assert(bpmFromTapTimes(fixture.tapTimesMs) === fixture.expectedBpm, "audio-generator: tap BPM mismatch");
    return ["bounded tone/metronome/noise settings exact", "tap-tempo arithmetic exact", "real browser start/stop acceptance"];
  }
  if (toolId === "browser-text-to-speech") {
    const fixture = (await json<{ speech: { rate: number; pitch: number } }>("quality/fixtures/browser-audio-utilities/vectors.json")).value;
    const result = module.run({ text: "Ciao", ...fixture.speech }, { defaults: {} }) as Record<string, unknown>;
    assertObjectSubset(result, { textLength: 4, ...fixture.speech }, "browser-text-to-speech");
    assert(italianVoices([{ voiceURI: "it", name: "IT", lang: "it-IT" }, { voiceURI: "en", name: "EN", lang: "en-US" }]).map(({ voiceURI }) => voiceURI).join(",") === "it", "browser-text-to-speech: Italian voice filter mismatch");
    return ["text/rate/pitch bounds exact", "Italian runtime voice filter exact", "platform remote-service limitation disclosed"];
  }
  if (toolId === "subtitle-srt-vtt-transform") {
    const fixture = (await json<{ cases: Array<{ format: "srt" | "vtt"; input: string; cue_count: number; transcript: string }>; invalid_cases: Array<{ format: "srt" | "vtt"; input: string; error: string }> }>("quality/fixtures/subtitle-transform/vectors.json")).value;
    for (const vector of fixture.cases) {
      const parsed = parseSubtitles(vector.input, vector.format);
      assert(parsed.cues.length === vector.cue_count && subtitleTranscript(parsed.cues) === vector.transcript, `subtitle fixture mismatch: ${vector.format}`);
    }
    for (const vector of fixture.invalid_cases) {
      let message = "";
      try { parseSubtitles(vector.input, vector.format); } catch (error) { message = error instanceof Error ? error.message : String(error); }
      assert(message.includes(vector.error), `subtitle invalid fixture did not fail as expected: ${vector.error}`);
    }
    return ["SRT/WebVTT bounded subset fixtures exact", "invalid settings/timing fail closed", "complete browser downloads verified"];
  }
  throw new Error(`${toolId}: no direct certification check`);
}

async function microphoneCheck(module: ToolModule): Promise<string[]> {
  const fixture = (await json<{ microphoneRecorder: { supportedMimeTypes: string[]; eventTimesMs: { start: number; pause: number; resume: number; stop: number }; expectedActiveDurationMs: number; blobType: string } }>("quality/fixtures/browser-audio-utilities/vectors.json")).value.microphoneRecorder;
  const selected = chooseSupportedRecorderMimeType((mime) => fixture.supportedMimeTypes.includes(mime));
  assert(selected === fixture.blobType, "microphone-recorder: fixture MIME selection mismatch");
  let clock = startRecordingClock(fixture.eventTimesMs.start);
  clock = pauseRecordingClock(clock, fixture.eventTimesMs.pause);
  clock = resumeRecordingClock(clock, fixture.eventTimesMs.resume);
  assert(recordingDurationMs(clock, fixture.eventTimesMs.stop) === fixture.expectedActiveDurationMs, "microphone-recorder: active duration mismatch");
  assert(typeof module.run === "function", "microphone-recorder: module missing");
  return ["runtime MIME preference fixture exact", "pause/resume active duration exact", "desktop mock browser lifecycle verified; physical iOS/Android intentionally not inferred"];
}

const [{ value: registry, text: registryText }, { value: fixtureIndex, text: fixtureIndexText }, { value: bundleReceipt, text: bundleText }] = await Promise.all([
  json<{ entries: OracleEntry[] }>("quality/oracles/registry.json"),
  json<{ families: FixtureEntry[] }>("quality/fixtures/index.json"),
  json<Record<string, unknown>>(bundleReceiptPath),
]);
assert(bundleReceipt.status === "PASS" && Array.isArray(bundleReceipt.tools), "certification frontier bundle receipt is missing or not PASS");
const revision = await currentRevision(root);
const sourceFingerprint = await currentEvidenceSourceFingerprint(root);
await mkdir(receiptRoot, { recursive: true });

for (const spec of promotable) {
  const manifestImport = await import(pathToFileURL(resolve(root, `src/tools/${spec.id}/manifest.ts`)).href) as { default: ToolManifest };
  const moduleImport = await import(pathToFileURL(resolve(root, `src/tools/${spec.id}/module.ts`)).href) as { default: ToolModule };
  const manifest = manifestImport.default;
  assert(manifest.id === spec.id, `${spec.id}: manifest ID mismatch`);
  assert(manifest.runtime.location === "LOCAL" && manifest.runtime.network === "forbidden", `${spec.id}: Gold requires LOCAL/network-forbidden runtime`);
  const oracle = registry.entries.find(({ id }) => id === manifest.gold.oracleEntryId);
  assert(oracle !== undefined, `${spec.id}: oracle ${manifest.gold.oracleEntryId} missing`);
  assert(oracle.maintenance_class === manifest.gold.maintenanceClass, `${spec.id}: maintenance class mismatch`);
  const boundedScopeGaps = assertBoundedOracle(oracle, spec.id);
  const fixtures = manifest.gold.fixtureFamilies.map((id) => {
    const fixture = fixtureIndex.families.find((entry) => entry.id === id);
    assert(fixture !== undefined, `${spec.id}: fixture family missing: ${id}`);
    return fixture;
  });
  const browser = await json<Record<string, unknown>>(spec.browserReceipt);
  assert(browserReceiptCovers(browser.value, spec.id), `${spec.id}: browser receipt missing PASS coverage: ${spec.browserReceipt}`);
  assert((bundleReceipt.tools as unknown[]).includes(spec.id), `${spec.id}: bundle isolation receipt missing tool`);
  const directChecks = await directCheck(spec.id, moduleImport.default);
  const [manifestText, ...testTexts] = await Promise.all([
    readFile(resolve(root, `src/tools/${spec.id}/manifest.ts`), "utf8"),
    ...spec.testFiles.map((path) => readFile(resolve(root, path), "utf8")),
  ]);
  const fixtureIdentities = Object.fromEntries(await Promise.all(fixtures.map(async (fixture) => [`fixture:${fixture.id}:sha256`, sha256(await readFile(resolve(root, fixture.path)))])));
  const receipt = {
    schemaVersion: 1,
    status: "GOLD",
    goldEligible: true,
    revision,
    sourceFingerprint,
    toolId: spec.id,
    runtime: manifest.runtime,
    maintenanceClass: manifest.gold.maintenanceClass,
    oracleEntryId: manifest.gold.oracleEntryId,
    fixtureFamilies: manifest.gold.fixtureFamilies,
    boundedScopeGaps,
    scopePolicy: "Every canonical unresolved oracle gap is matched against a tool-specific bounded-scope policy. Unknown/new gap wording fails certification.",
    truthSources: [...new Set([...oracle.truth_sources, ...fixtures.flatMap(({ truth_sources }) => truth_sources)])].sort(),
    directChecks,
    propertyChecks: ["local-only public runtime", "canonical oracle confidence high", "all oracle gaps classified as bounded exclusions", "fixture replay", "real browser locality/mobile acceptance", "route bundle isolated from home initial JS"],
    identities: {
      manifestSha256: sha256(manifestText),
      oracleRegistrySha256: sha256(registryText),
      fixtureIndexSha256: sha256(fixtureIndexText),
      browserAcceptanceSha256: sha256(browser.text),
      bundleIsolationSha256: sha256(bundleText),
      unitTestsSha256: sha256(testTexts.join("\n")),
      ...fixtureIdentities,
    },
  };
  await writeFile(resolve(receiptRoot, `${spec.id}.gold.json`), `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(`Gold PASS: ${spec.id} (bounded scope + fixture replay + browser + bundle evidence)`);
}

{
  const spec = microphone;
  const manifestImport = await import(pathToFileURL(resolve(root, `src/tools/${spec.id}/manifest.ts`)).href) as { default: ToolManifest };
  const moduleImport = await import(pathToFileURL(resolve(root, `src/tools/${spec.id}/module.ts`)).href) as { default: ToolModule };
  const manifest = manifestImport.default;
  const oracle = registry.entries.find(({ id }) => id === manifest.gold.oracleEntryId);
  assert(oracle !== undefined && oracle.confidence === "high", "microphone-recorder: oracle missing/not high confidence");
  assert(oracle.maintenance_class === manifest.gold.maintenanceClass, "microphone-recorder: maintenance class mismatch");
  const gaps = [...(oracle.unresolved_gaps ?? [])];
  assert(gaps.length === 1 && physicalGapPattern.test(gaps[0]!), `microphone-recorder: expected literal physical-device blocker changed: ${gaps.join(" | ")}`);
  const browser = await json<Record<string, unknown>>(spec.browserReceipt);
  assert(browser.value.status === "PASS" && browser.value.goldPromotion === "BLOCKED_PHYSICAL_DEVICE_EVIDENCE", "microphone-recorder: automated browser receipt missing/blocker not explicit");
  assert((bundleReceipt.tools as unknown[]).includes(spec.id), "microphone-recorder: bundle isolation receipt missing tool");
  const directChecks = await microphoneCheck(moduleImport.default);
  const [manifestText, testText] = await Promise.all([
    readFile(resolve(root, `src/tools/${spec.id}/manifest.ts`), "utf8"),
    readFile(resolve(root, spec.testFiles[0]!), "utf8"),
  ]);
  const receipt = {
    schemaVersion: 1,
    status: "PARTIAL",
    goldEligible: false,
    revision,
    sourceFingerprint,
    toolId: spec.id,
    runtime: manifest.runtime,
    maintenanceClass: manifest.gold.maintenanceClass,
    oracleEntryId: manifest.gold.oracleEntryId,
    fixtureFamilies: manifest.gold.fixtureFamilies,
    unresolvedGaps: gaps,
    blocker: "PHYSICAL_DEVICE_EVIDENCE_MISSING",
    physicalAcceptance: { iosSafari: "MISSING", androidChrome: "MISSING" },
    directChecks,
    identities: {
      manifestSha256: sha256(manifestText),
      oracleRegistrySha256: sha256(registryText),
      fixtureIndexSha256: sha256(fixtureIndexText),
      browserAcceptanceSha256: sha256(browser.text),
      bundleIsolationSha256: sha256(bundleText),
      unitTestsSha256: sha256(testText),
    },
  };
  await writeFile(resolve(receiptRoot, "microphone-recorder.partial.json"), `${JSON.stringify(receipt, null, 2)}\n`);
  console.log("PARTIAL expected: microphone-recorder remains blocked on physical iOS Safari + Android Chrome evidence");
}
