/**
 * #371 offline, source-bound multilingual feasibility audit.
 *
 * This executable deliberately does not provide a production OCR service.
 * Missing English evidence is NO_GO: the installed Italian traineddata must
 * NEVER be relabelled as English or silently downloaded from a CDN.
 *
 * Run: ./node_modules/.bin/tsx scripts/ocr-language-audit-371.ts
 * Exit 2 is the expected result when production/multilingual gates are open.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { lstat, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

export type OcrLanguage371 = "ita" | "eng";
type Variant371 = "upright" | "grayscale" | "rotated-90-uncorrected";
type AuditState371 = "NOT_RUN" | "NO_GO" | "MEASURED_DESKTOP_ONLY";

export const OCR_371_SOURCE = {
  referenceDate: "2026-10-11",
  fixtureRelativePath: "spikes/heavy-local-feasibility/public/corpus/ocr-it.png",
  fixtureSha256: "1bfc71b54560679f6b6d0e8f978201b2ca27fdfcd84d47ef9344d41db0a2f27b",
  fixtureBytes: 14305,
  donorEvidenceSha256: "0f9200cabd3dc3bd2d89c2473c3836473008d8a997d13cfbcf78249f9ad0d9b4",
  fixtureProvenance: "1280x240 PNG rendered locally with Pillow + system Helvetica; contains fixed Italian invoice text",
  annotatedExpectedText: "Fattura numero 12345 - Totale euro 678,90",
  modelRelativePath: "node_modules/@tesseract.js-data/ita/4.0.0/ita.traineddata.gz",
  modelSha256: "21c1bfde62571d76b923e270bb2cde583ccc18fa8bfd83454c021b28d8b5cb5a",
  modelBytes: 6933830,
  engineName: "tesseract.js",
  engineVersion: "7.0.0",
  engineLicense: "Apache-2.0",
  coreVersion: "7.0.0",
  modelPackageName: "@tesseract.js-data/ita",
  modelPackageVersion: "1.0.0",
  modelPackageLicense: "MIT",
  upstreamModelLicense: "Apache-2.0",
  // Exact Node worker entrypoint shipped by the locally installed
  // tesseract.js@7.0.0 donor. package.json version alone is not proof of the
  // executable script used to produce OCR/quality observations.
  workerRelativePath: "node_modules/tesseract.js/src/worker-script/node/index.js",
  workerBytes: 771,
  workerSha256: "a973c23ce067bc752c0bf602297eac843098e531ac03f3ea34cdf694326a6d02",
} as const;

export interface RecognitionWorker371 {
  recognize(image: Buffer): Promise<{ data: { text: string; confidence: number } }>;
  terminate(): Promise<unknown>;
}

export type WorkerFactory371 = (
  language: OcrLanguage371,
  workerOptions: Record<string, unknown>,
) => Promise<RecognitionWorker371>;

export interface AuditOptions371 {
  root?: string;
  spike?: string;
  languages?: readonly OcrLanguage371[];
  createWorker?: WorkerFactory371;
  /** Negative test seam. A contradictory license assertion must fail closed. */
  requiredUpstreamLicense?: string;
}

export interface OcrCase371 {
  variant: Variant371;
  sourceSha256: string;
  inputBytes: number;
  imageWidth: number;
  imageHeight: number;
  exact: boolean;
  characterErrorRate: number;
  wordErrorRate: number;
  confidence: number;
  confidenceMeaning: "UNCALIBRATED_TESSERACT_SCORE";
  elapsedMs: number;
  rssBeforeBytes: number;
  rssAfterBytes: number;
  sampledRssMaxBytes: number;
}

export interface OcrLanguageResult371 {
  state: AuditState371;
  measured: boolean;
  caseCount: number;
  reasons: string[];
  modelSha256: string | null;
  sourceSha256: string | null;
  cases: OcrCase371[];
  memory: {
    rssBeforeWorkerBytes: number;
    rssAfterWorkerInitBytes: number;
    rssAfterWorkerTerminationBytes: number;
    sampledProcessRssMaxBytes: number;
    workerInitElapsedMs: number;
  } | null;
}

export interface OcrAuditResult371 {
  ticket: 371;
  decision: "NO_GO";
  measuredScope: "NODE_DESKTOP_SINGLE_HOST";
  sourceDate: string;
  engine: string;
  host: { platform: NodeJS.Platform; arch: string; nodeVersion: string };
  languages: Record<OcrLanguage371, OcrLanguageResult371>;
  qualityComparableItEn: false;
  physicalIosAndroid: "NOT_RUN";
  activeCancellation: "NOT_RUN";
  exactWasmNativeMemoryPeak: "NOT_MEASURED";
  rssMethod: "NODE_PROCESS_RSS_SAMPLED_DURING_RECOGNITION_NOT_EXACT_WASM_PEAK";
  donorAlternatives: {
    nativeTesseractCli: "NOT_MEASURED";
    macosVision: "NOT_MEASURED";
    commercialVendor: "NO_GO_NO_LOCAL_LICENSE_OR_COMPARABLE_CORPUS";
  };
  productionBlockers: string[];
}

function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalized(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

function distance371<T>(expected: readonly T[], actual: readonly T[]): number {
  let previous = Array.from({ length: actual.length + 1 }, (_, index) => index);
  for (let index = 0; index < expected.length; index++) {
    const current = [index + 1];
    for (let other = 0; other < actual.length; other++) {
      current.push(Math.min(
        current[other]! + 1,
        previous[other + 1]! + 1,
        previous[other]! + (expected[index] === actual[other] ? 0 : 1),
      ));
    }
    previous = current;
  }
  return previous[actual.length]!;
}

export function characterErrorRate371(expected: string, actual: string): number {
  const baseline = Array.from(expected);
  const observed = Array.from(actual);
  return distance371(baseline, observed) / Math.max(1, baseline.length);
}

function wordErrorRate371(expected: string, actual: string): number {
  const baseline = expected ? expected.split(" ") : [];
  const observed = actual ? actual.split(" ") : [];
  return distance371(baseline, observed) / Math.max(1, baseline.length);
}

function refused371(reasons: string[]): OcrLanguageResult371 {
  return { state: "NO_GO", measured: false, caseCount: 0, reasons,
    modelSha256: null, sourceSha256: null, cases: [], memory: null };
}

async function readPinnedSizedFile371(path: string, expectedBytes: number): Promise<Buffer | null> {
  try {
    // Guard size and symlink before loading binary data from disk. The result
    // is still SHA-checked; an equal-sized replacement cannot pass.
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size !== expectedBytes) return null;
    return await readFile(path);
  } catch {
    return null;
  }
}

async function preflightItalian371(root: string, spike: string, requiredUpstreamLicense: string): Promise<{
  fixture: Buffer;
  modelPath: string;
  workerPath: string;
} | { error: string }> {
  const metadata = OCR_371_SOURCE;
  const fixture = await readPinnedSizedFile371(resolve(root, metadata.fixtureRelativePath), metadata.fixtureBytes);
  if (fixture === null && !existsSync(resolve(root, metadata.fixtureRelativePath))) {
    return { error: "IT_ANNOTATED_FIXTURE_MISSING" };
  }
  if (fixture === null || digest(fixture) !== metadata.fixtureSha256) {
    return { error: "IT_FIXTURE_SHA256_CHANGED" };
  }
  const modelPath = resolve(spike, metadata.modelRelativePath);
  if (!existsSync(modelPath)) return { error: "IT_LOCAL_MODEL_MISSING" };
  const model = await readPinnedSizedFile371(modelPath, metadata.modelBytes);
  if (model === null || digest(model) !== metadata.modelSha256) {
    return { error: "IT_LOCAL_MODEL_SHA256_CHANGED" };
  }
  // Check both package-level and upstream traineddata rights, plus bundled
  // distribution notices, before executing any worker.
  if (requiredUpstreamLicense !== metadata.upstreamModelLicense) return { error: "IT_MODEL_LICENSE_UNVERIFIED" };
  let packageJson: {
    name?: string; version?: string; license?: string;
  };
  let engineJson: { name?: string; version?: string; license?: string };
  let coreJson: { name?: string; version?: string; license?: string };
  let manifest: { files?: { name?: string; sha256?: string; provenance?: string }[] };
  let receipts: {
    licensePolicy?: Record<string, string>;
    artifacts?: { path: string; bytes: number; sha256: string }[];
  };
  try {
    packageJson = JSON.parse(await readFile(resolve(spike, "node_modules/@tesseract.js-data/ita/package.json"), "utf8"));
    engineJson = JSON.parse(await readFile(resolve(spike, "node_modules/tesseract.js/package.json"), "utf8"));
    coreJson = JSON.parse(await readFile(resolve(spike, "node_modules/tesseract.js-core/package.json"), "utf8"));
    manifest = JSON.parse(await readFile(resolve(root, "spikes/heavy-local-feasibility/public/corpus/manifest.json"), "utf8"));
    const donorEvidence = await readFile(resolve(root, "quality/reference-data/ocr/246-local-assets-evidence.json"));
    if (digest(donorEvidence) !== metadata.donorEvidenceSha256) {
      return { error: "IT_MODEL_LICENSE_UNVERIFIED" };
    }
    receipts = JSON.parse(donorEvidence.toString("utf8"));
  } catch {
    return { error: "IT_PROVENANCE_OR_LICENSE_RECORD_MISSING" };
  }
  if (packageJson.name !== metadata.modelPackageName || packageJson.version !== metadata.modelPackageVersion
    || packageJson.license !== metadata.modelPackageLicense
    || engineJson.name !== metadata.engineName || engineJson.version !== metadata.engineVersion
    || engineJson.license !== metadata.engineLicense
    || coreJson.name !== "tesseract.js-core"
    || coreJson.version !== metadata.coreVersion || coreJson.license !== metadata.engineLicense) {
    return { error: "IT_ENGINE_OR_MODEL_PACKAGE_LICENSE_MISMATCH" };
  }
  if (!manifest.files?.some((file) => file.name === "ocr-it.png"
    && file.sha256 === metadata.fixtureSha256
    && file.provenance === metadata.fixtureProvenance)) {
    return { error: "IT_CORPUS_ANNOTATION_UNVERIFIED" };
  }
  if (receipts.licensePolicy?.[`tesseract.js@${metadata.engineVersion}`] !== metadata.engineLicense
    || receipts.licensePolicy?.[`tesseract.js-core@${metadata.coreVersion}`] !== metadata.engineLicense
    || !receipts.licensePolicy?.[`${metadata.modelPackageName}@${metadata.modelPackageVersion}`]?.includes("Apache-2.0")
    || !receipts.artifacts?.some((artifact) => artifact.path === "public/ocr-246/lang/ita.traineddata.gz"
      && artifact.sha256 === `sha256:${metadata.modelSha256}` && artifact.bytes === metadata.modelBytes)) {
    return { error: "IT_MODEL_LICENSE_UNVERIFIED" };
  }
  for (const notice of ["public/ocr-246/lang/NPM-PACKAGE-MIT.LICENSE",
    "public/ocr-246/lang/UPSTREAM-APACHE-2.0.LICENSE",
    "public/ocr-246/vendor/tesseract-js-APACHE-2.0.LICENSE",
    "public/ocr-246/core/tesseract-core-APACHE-2.0.LICENSE"]) {
    const receipt = receipts.artifacts?.find((item) => item.path === notice);
    if (!receipt) return { error: "IT_MODEL_LICENSE_UNVERIFIED" };
    try {
      const bytes = await readFile(resolve(root, notice));
      if (bytes.length !== receipt.bytes || `sha256:${digest(bytes)}` !== receipt.sha256) {
        return { error: "IT_MODEL_LICENSE_UNVERIFIED" };
      }
    } catch {
      return { error: "IT_MODEL_LICENSE_UNVERIFIED" };
    }
  }
  const workerPath = resolve(spike, metadata.workerRelativePath);
  if (!existsSync(workerPath)) return { error: "IT_LOCAL_WORKER_MISSING" };
  const workerSource = await readPinnedSizedFile371(workerPath, metadata.workerBytes);
  if (workerSource === null || digest(workerSource) !== metadata.workerSha256) {
    return { error: "IT_LOCAL_WORKER_SHA256_CHANGED" };
  }
  const dimensions = await sharp(fixture).metadata().catch(() => null);
  if (!dimensions || dimensions.format !== "png"
    || dimensions.width !== 1280 || dimensions.height !== 240
    || dimensions.width * dimensions.height > 2_000_000) {
    return { error: "IT_FIXTURE_IMAGE_GEOMETRY_INVALID" };
  }
  return { fixture, modelPath, workerPath };
}

async function runItalian371(
  root: string, spike: string, factory: WorkerFactory371 | undefined, requiredUpstreamLicense: string,
): Promise<OcrLanguageResult371> {
  const ready = await preflightItalian371(root, spike, requiredUpstreamLicense);
  if ("error" in ready) return refused371([ready.error]);
  const localFactory: WorkerFactory371 = factory ?? (async (language, options) => {
    // createRequire reads the installed local donor. Explicit absolute worker
    // and language paths keep Tesseract's optional CDN defaults unreachable.
    const requireInstalled = createRequire(resolve(spike, "package.json"));
    const tesseract = requireInstalled("tesseract.js") as { createWorker: (
      lang: string, oem: number, opts: Record<string, unknown>,
    ) => Promise<RecognitionWorker371> };
    return tesseract.createWorker(language, 1, options);
  });
  const reasons: string[] = [];
  const cases: OcrCase371[] = [];
  let worker: RecognitionWorker371 | undefined;
  const rssBeforeWorkerBytes = process.memoryUsage().rss;
  let rssAfterWorkerInitBytes = rssBeforeWorkerBytes;
  let sampledProcessRssMaxBytes = rssBeforeWorkerBytes;
  let workerInitElapsedMs = 0;
  const memorySampler = setInterval(() => {
    sampledProcessRssMaxBytes = Math.max(sampledProcessRssMaxBytes, process.memoryUsage().rss);
  }, 20);
  memorySampler.unref();
  try {
    const inputs: { variant: Variant371; image: Buffer; width: number; height: number }[] = [
      { variant: "upright", image: ready.fixture, width: 1280, height: 240 },
      { variant: "grayscale", image: await sharp(ready.fixture).greyscale().png().toBuffer(), width: 1280, height: 240 },
      { variant: "rotated-90-uncorrected", image: await sharp(ready.fixture).rotate(90).png().toBuffer(), width: 240, height: 1280 },
    ];
    const dimensionsAreValid = inputs.every((input) => input.image.length <= 5 * 1024 * 1024
      && input.width * input.height <= 2_000_000);
    if (!dimensionsAreValid) return refused371(["IT_BOUNDED_CASE_EXCEEDED"]);
    const workerStarted = performance.now();
    worker = await localFactory("ita", {
      workerPath: ready.workerPath,
      langPath: dirname(ready.modelPath),
      cacheMethod: "none",
      gzip: true,
      workerBlobURL: false,
    });
    workerInitElapsedMs = Math.round((performance.now() - workerStarted) * 10) / 10;
    rssAfterWorkerInitBytes = process.memoryUsage().rss;
    const baseline = normalized(OCR_371_SOURCE.annotatedExpectedText);
    for (const input of inputs) {
      const rssBeforeBytes = process.memoryUsage().rss;
      let sampledRssMaxBytes = rssBeforeBytes;
      const started = performance.now();
      const sampler = setInterval(() => {
        sampledRssMaxBytes = Math.max(sampledRssMaxBytes, process.memoryUsage().rss);
      }, 20);
      sampler.unref();
      try {
        const recognized = (await worker.recognize(input.image)).data;
        const text = normalized(recognized.text);
        if (text.length > 4096 || !Number.isFinite(recognized.confidence)
          || recognized.confidence < 0 || recognized.confidence > 100) {
          reasons.push("IT_OCR_RESULT_UNTRUSTED");
          break;
        }
        const rssAfterBytes = process.memoryUsage().rss;
        cases.push({
          variant: input.variant, sourceSha256: OCR_371_SOURCE.fixtureSha256,
          inputBytes: input.image.length, imageWidth: input.width, imageHeight: input.height,
          exact: text === baseline,
          characterErrorRate: characterErrorRate371(baseline, text),
          wordErrorRate: wordErrorRate371(baseline, text),
          confidence: recognized.confidence, confidenceMeaning: "UNCALIBRATED_TESSERACT_SCORE",
          elapsedMs: Math.round((performance.now() - started) * 10) / 10,
          rssBeforeBytes, rssAfterBytes,
          sampledRssMaxBytes: Math.max(sampledRssMaxBytes, rssAfterBytes),
        });
      } finally {
        clearInterval(sampler);
      }
    }
  } catch {
    reasons.push("IT_LOCAL_WORKER_OR_RECOGNITION_FAILED");
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        reasons.push("IT_WORKER_TERMINATION_FAILED");
      }
    }
    clearInterval(memorySampler);
  }
  const measured = reasons.length === 0 && cases.length === 3;
  const rssAfterWorkerTerminationBytes = process.memoryUsage().rss;
  return {
    state: measured ? "MEASURED_DESKTOP_ONLY" : "NO_GO",
    measured, caseCount: cases.length, reasons,
    modelSha256: OCR_371_SOURCE.modelSha256,
    sourceSha256: OCR_371_SOURCE.fixtureSha256, cases,
    memory: {
      rssBeforeWorkerBytes, rssAfterWorkerInitBytes, rssAfterWorkerTerminationBytes,
      sampledProcessRssMaxBytes: Math.max(sampledProcessRssMaxBytes,
        rssAfterWorkerInitBytes, rssAfterWorkerTerminationBytes),
      workerInitElapsedMs,
    },
  };
}

export async function auditOcrLanguages371(options: AuditOptions371 = {}): Promise<OcrAuditResult371> {
  const root = options.root ?? resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const spike = options.spike ?? resolve(root, "spikes/heavy-local-feasibility");
  const requested = new Set(options.languages ?? ["ita", "eng"]);
  const languages: Record<OcrLanguage371, OcrLanguageResult371> = {
    ita: { ...refused371(["NOT_REQUESTED"]), state: "NOT_RUN" },
    eng: { ...refused371(["NOT_REQUESTED"]), state: "NOT_RUN" },
  };
  if (requested.has("ita")) {
    languages.ita = await runItalian371(root, spike, options.createWorker, options.requiredUpstreamLicense ?? "Apache-2.0");
  }
  if (requested.has("eng")) {
    // Merely finding an arbitrary eng.traineddata somewhere is insufficient:
    // no pinned package/version/hash, corpus or redistribution decision exists.
    languages.eng = refused371(["EN_MODEL_UNPINNED", "EN_CORPUS_UNANNOTATED",
      "EN_LICENSE_AND_DISTRIBUTION_UNVERIFIED"]);
  }
  return {
    ticket: 371, decision: "NO_GO", measuredScope: "NODE_DESKTOP_SINGLE_HOST",
    sourceDate: OCR_371_SOURCE.referenceDate,
    engine: `${OCR_371_SOURCE.engineName}@${OCR_371_SOURCE.engineVersion}`,
    host: { platform: process.platform, arch: process.arch, nodeVersion: process.versions.node },
    languages, qualityComparableItEn: false,
    physicalIosAndroid: "NOT_RUN", activeCancellation: "NOT_RUN",
    exactWasmNativeMemoryPeak: "NOT_MEASURED",
    rssMethod: "NODE_PROCESS_RSS_SAMPLED_DURING_RECOGNITION_NOT_EXACT_WASM_PEAK",
    donorAlternatives: {
      nativeTesseractCli: "NOT_MEASURED", macosVision: "NOT_MEASURED",
      commercialVendor: "NO_GO_NO_LOCAL_LICENSE_OR_COMPARABLE_CORPUS",
    },
    productionBlockers: [
      "English versioned model/license/hashes and source-bound English OCR corpus absent",
      "No comparable independently annotated IT/EN real scanned corpus",
      "Native/WASM peak memory and physical iOS Safari/Android Chrome performance unverified",
      "Mobile privacy/runtime/network and in-flight cancellation not measured for multilingual OCR",
      "Native Vision/commercial donor license, portability, cost and measured quality unavailable",
      "Existing production refusal #271 stays in force",
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  auditOcrLanguages371().then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    // NO_GO is a deliberate failing acceptance outcome, never a green gate.
    process.exitCode = 2;
  }).catch((error: unknown) => {
    process.stderr.write(`OCR371_AUDIT_FAILED: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  });
}
