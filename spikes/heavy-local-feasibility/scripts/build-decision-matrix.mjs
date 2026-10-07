import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { candidates } from "./candidates.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(root, "../..");
const outputDir = path.join(repoRoot, "quality/benchmarks/heavy-local-feasibility");

const [packageReceipt, auditReceipt, bundleReceipt, runtimeReceipt, corpusReceipt] = await Promise.all([
  readFile(path.join(outputDir, "package-metadata.json"), "utf8").then(JSON.parse),
  readFile(path.join(outputDir, "npm-audit.json"), "utf8").then(JSON.parse),
  readFile(path.join(outputDir, "bundle-sizes.json"), "utf8").then(JSON.parse),
  readFile(path.join(outputDir, "desktop-runtime.json"), "utf8").then(JSON.parse),
  readFile(path.join(root, "public/corpus/manifest.json"), "utf8").then(JSON.parse),
]);

const runtimeCaseByCandidate = {
  "libheif-js": "heic-libheif",
  "tesseract-js": "ocr-tesseract-ita",
  "tesseract-ita": "ocr-tesseract-ita",
  xlsx: "office-xlsx",
  mammoth: "office-docx-extract",
  docx: "office-docx-write",
  "docx-preview": "office-docx-preview",
  pptxgenjs: "office-pptx-write",
  "cantoo-pdf-lib": "pdf-cantoo-mutate",
  "pdfjs-dist": "pdfjs-render",
  mediabunny: "media-mediabunny-inspect",
  mp4box: "video-mp4box-inspect",
};

const candidateDetails = {
  "libheif-js": {
    formats: ["HEIC", "HEIF"],
    cancellation: { status: "NEEDS_WORKER_TERMINATION", note: "Decode API has no AbortSignal seam; downstream path must own it in a worker and terminate on cancel/resource breach." },
    reason: "Current browser-local decode works on the real HEIC fixture across all desktop engines, but transfer/memory cost and genuine mobile memory behavior remain open.",
  },
  heic2any: {
    formats: ["HEIC", "HEIF", "JPEG", "PNG"],
    cancellation: { status: "UNPROVEN", note: "No cancellation acceptance was run because this stale wrapper was not shortlisted for execution." },
    reason: "Package is stale relative to the maintained libheif-js substrate and adds another wrapper without solving mobile/memory acceptance.",
  },
  "tesseract-js": {
    formats: ["PNG/JPEG raster input", "Italian OCR text"],
    cancellation: { status: "PARTIAL", note: "Worker lifecycle is explicit and terminate() is used for cleanup; mid-recognition cancel/restart still belongs to ticket 101." },
    reason: "Italian OCR succeeded from same-origin worker/core/language assets with no external network. Full WASM/native memory and physical mobile thresholds remain open.",
  },
  "tesseract-ita": {
    formats: ["Italian traineddata"],
    cancellation: { status: "N_A", note: "Data asset; cancellation belongs to the Tesseract worker." },
    reason: "Required local language asset for the observed OCR path; no independent production promotion from the engine.",
  },
  xlsx: {
    formats: ["XLSX parse", "XLSX write"],
    cancellation: { status: "NONE", note: "Synchronous parse/write surface requires worker isolation for any future bounded use." },
    reason: "The latest npm package used by the spike has high-severity prototype-pollution and ReDoS advisories with no npm fix available; production use is denied.",
  },
  mammoth: {
    formats: ["DOCX semantic text/HTML extraction"],
    cancellation: { status: "NONE", note: "No direct AbortSignal; future use needs worker termination and document-size limits." },
    reason: "Semantic DOCX extraction works locally across desktop engines, with external file access disabled by default. It is not a Word-fidelity renderer.",
  },
  docx: {
    formats: ["DOCX generation"],
    cancellation: { status: "NONE", note: "Generation has no direct AbortSignal; worker ownership is required for larger documents." },
    reason: "Browser DOCX generation works, but observed JS heap growth is material even for the tiny corpus and mobile thresholds are unmeasured.",
  },
  "docx-preview": {
    formats: ["DOCX browser preview"],
    cancellation: { status: "NONE", note: "Render API has no tested cancel seam; worker/off-main-thread feasibility remains downstream work." },
    reason: "The fixture renders across desktop engines, but the project documents its parse structure as unstable and this result does not establish Word-faithful rendering.",
  },
  pptxgenjs: {
    formats: ["PPTX generation"],
    cancellation: { status: "NONE", note: "No cancellation acceptance because dependency audit already blocks promotion." },
    reason: "The browser output path works, but the installed graph contains high-severity image-size DoS advisories. Denied pending a clean dependency graph and separate fidelity tests.",
  },
  "cantoo-pdf-lib": {
    formats: ["PDF load", "page mutation", "PDF save"],
    cancellation: { status: "NONE", note: "Object-model mutation has no direct AbortSignal; worker termination plus corrupt/large corpus limits are required." },
    reason: "Maintained fork performs the bounded mutation fixture quickly, but hostile/corrupt corpus and physical mobile memory acceptance are still open.",
  },
  "pdfjs-dist": {
    formats: ["PDF text extraction", "PDF page rendering"],
    cancellation: { status: "AVAILABLE_NOT_STRESS_TESTED", note: "LoadingTask.destroy()/render task cancellation exist; this tranche validates cleanup but not forced mid-render termination." },
    reason: "Render/text fixture succeeds in all desktop engines after using the v6 loading-task cleanup contract; the dedicated worker is large and mobile acceptance remains open.",
  },
  mediabunny: {
    formats: ["MP4/MOV/WebM/MKV/HLS/WAV/MP3/Ogg/ADTS/FLAC/MPEG-TS inspection/conversion surface", "WebCodecs-backed codecs"],
    cancellation: { status: "PARTIAL", note: "Input.dispose() provides an explicit lifecycle seam; conversion cancellation and worker ownership still require dedicated acceptance." },
    reason: "MP4 and WAV inspection succeeds locally, and current desktop engines expose the tested H.264/AAC WebCodecs decode configs. Codec coverage on real mobile devices is not inferred from desktop.",
  },
  mp4box: {
    formats: ["MP4/ISO-BMFF inspection", "segmentation/sample extraction APIs"],
    cancellation: { status: "MANUAL", note: "Progressive parser can be abandoned/worker-terminated; no end-to-end cancellation acceptance was run." },
    reason: "The full build correctly inspects the real H.264/AAC MP4; the smaller simple build failed on this fixture, so only the full build is represented by the passing benchmark.",
  },
  "ffmpeg-wasm": {
    formats: ["FFmpeg browser orchestration"],
    cancellation: { status: "NOT_BENCHMARKED", note: "Controller was not executed because its required core is denied under current dependency policy." },
    reason: "The controller alone does not provide codecs; the current official core dependency is GPL and outside the repository's allowed production license posture.",
  },
  "ffmpeg-core": {
    formats: ["FFmpeg WASM codecs/transcoding"],
    cancellation: { status: "NOT_BENCHMARKED", note: "Denied before runtime benchmarking." },
    reason: "GPL-2.0-or-later conflicts with the repository dependency license gate; unpacked payload is also about 64.7 MB.",
  },
  lamejs: {
    formats: ["MP3 encoding"],
    cancellation: { status: "NOT_BENCHMARKED", note: "Denied before runtime benchmarking." },
    reason: "Package is stale and LGPL-licensed, while the preferred 2026 media path is browser-native/WebCodecs-backed where supported. No reason to add this separate encoder now.",
  },
};

const packageById = new Map(packageReceipt.packages.map((item) => [item.id, item]));
const bundleById = new Map(bundleReceipt.candidates.map((item) => [item.id, item]));
const chrome = runtimeReceipt.results.find((item) => item.engine === "chrome");
const realDesktopEngines = runtimeReceipt.results.filter((item) => ["chrome", "edge"].includes(item.engine));
const tesseractRuntimeFiles = bundleReceipt.runtimeAssetGroups?.tesseract?.files ?? [];
const tesseractRuntimeByFile = new Map(tesseractRuntimeFiles.map((item) => [item.file, item]));
const observedTesseractRuntimeFiles = (chrome?.localRequests ?? [])
  .map((url) => new URL(url).pathname.match(/^\/tesseract\/(.+)$/u)?.[1] ?? null)
  .filter(Boolean)
  .map((file) => tesseractRuntimeByFile.get(file))
  .filter(Boolean);
const observedTesseractCoreFiles = observedTesseractRuntimeFiles.filter((item) => item.file !== "lang/ita.traineddata.gz");
const observedTesseractLanguageFiles = observedTesseractRuntimeFiles.filter((item) => item.file === "lang/ita.traineddata.gz");

function runtimeEvidence(candidateId) {
  const caseId = runtimeCaseByCandidate[candidateId];
  if (!caseId) return { status: "NOT_BENCHMARKED", caseId: null };
  const representative = chrome?.payload?.results?.find((item) => item.id === caseId);
  const engineResults = runtimeReceipt.results.map((engine) => ({
    engine: engine.engine,
    classification: engine.classification,
    status: engine.payload?.results?.find((item) => item.id === caseId)?.status ?? "NOT_RUN",
  }));
  return {
    status: representative?.status ?? "NOT_RUN",
    caseId,
    representativeBrowser: chrome?.label ?? null,
    coldLoadMs: representative?.coldLoadMs ?? null,
    runtimeMs: representative?.runtimeMs ?? null,
    peakJsHeapDeltaBytes: representative?.peakJsHeapDeltaBytes ?? null,
    memoryScope: "JS heap observation only on Chromium performance.memory; excludes WASM linear memory, native decoded surfaces and browser process RSS.",
    allObservedDesktopPass: engineResults.every((item) => item.status === "PASS"),
    engines: engineResults,
  };
}

function auditEvidence(packageName) {
  const finding = auditReceipt.vulnerabilities?.[packageName];
  if (!finding) return { status: "PASS", severity: null, advisories: [] };
  const advisories = (finding.via ?? []).filter((entry) => typeof entry === "object").map((entry) => ({ title: entry.title, severity: entry.severity, url: entry.url, range: entry.range }));
  return { status: "FAIL", severity: finding.severity, advisories, effects: finding.effects ?? [], fixAvailable: finding.fixAvailable ?? null };
}

function licenseEvidence(license) {
  const normalized = String(license ?? "").toUpperCase();
  if (["AGPL-", "GPL-", "SSPL-", "BUSL-", "UNLICENSED"].some((prefix) => normalized.startsWith(prefix))) {
    return { status: "DENY", note: "Matches the repository's disallowed dependency license prefixes." };
  }
  if (normalized.startsWith("LGPL-")) {
    return { status: "REVIEW", note: "Not blocked by the current prefix gate, but redistribution/linking obligations require an explicit packaging review before production adoption." };
  }
  return { status: "PASS", note: "Does not match the repository's current disallowed dependency license prefixes." };
}

const rows = candidates.map((candidate) => {
  const pkg = packageById.get(candidate.id);
  const bundle = bundleById.get(candidate.id);
  const details = candidateDetails[candidate.id];
  const runtime = runtimeEvidence(candidate.id);
  const audit = auditEvidence(candidate.package);
  const license = licenseEvidence(pkg?.license);
  let lazyBundle = bundle
    ? { rawBytes: bundle.lazyRawBytes, gzipBytes: bundle.lazyGzipBytes, emittedAssets: bundle.assets }
    : { rawBytes: null, gzipBytes: null, emittedAssets: [], note: "Candidate was metadata-reviewed but intentionally not installed/executed in this tranche." };
  if (candidate.id === "tesseract-js" && bundle) {
    lazyBundle = {
      rawBytes: bundle.lazyRawBytes + observedTesseractCoreFiles.reduce((sum, item) => sum + item.rawBytes, 0),
      gzipBytes: bundle.lazyGzipBytes + observedTesseractCoreFiles.reduce((sum, item) => sum + item.gzipBytes, 0),
      emittedAssets: bundle.assets,
      runtimeAssets: observedTesseractCoreFiles,
      note: "Observed Chrome path: JS entry plus same-origin worker and the selected runtime core wrapper. Italian language data is reported separately on tesseract-ita.",
    };
  } else if (candidate.id === "tesseract-ita") {
    lazyBundle = {
      rawBytes: observedTesseractLanguageFiles.reduce((sum, item) => sum + item.rawBytes, 0),
      gzipBytes: observedTesseractLanguageFiles.reduce((sum, item) => sum + item.gzipBytes, 0),
      emittedAssets: [],
      runtimeAssets: observedTesseractLanguageFiles,
      note: "Italian traineddata is already gzip-compressed; gzipBytes here is a second gzip measurement for consistency, while the rawBytes value is the actual .traineddata.gz asset size served by the spike.",
    };
  }
  return {
    id: candidate.id,
    family: candidate.family,
    package: candidate.package,
    version: pkg?.version ?? candidate.version,
    role: candidate.role,
    formats: details.formats,
    decision: candidate.decision,
    productionAllowed: false,
    decisionReason: details.reason,
    license: pkg?.license ?? null,
    licenseGate: license,
    npmUnpackedBytes: pkg?.unpackedBytes ?? null,
    securityAudit: audit,
    lazyBundle,
    runtime,
    cancellation: details.cancellation,
    locality: {
      mode: "LOCAL_ONLY",
      externalRequestsObserved: realDesktopEngines.reduce((sum, engine) => sum + (engine.externalRequests?.length ?? 0), 0),
      offlineBoundary: "No automatic remote/server fallback. A capability/resource failure becomes an explicit unsupported/limit state.",
    },
    mobile: {
      iosSafari: runtimeReceipt.physicalMobile.iosSafari,
      androidChrome: runtimeReceipt.physicalMobile.androidChrome,
      promotionGate: "BLOCKED_UNTIL_GENUINE_PHYSICAL_RECEIPTS",
    },
    fallback: candidate.fallback,
  };
});

const familyRecommendations = [
  {
    family: "heic",
    decision: "SPIKE",
    recommendedStack: "Feature-detect native image decode first; libheif-js 1.23.5 as a lazy worker-owned fallback candidate only after mobile memory/license-packaging acceptance.",
    refusalFallback: "If native decode is absent and the libheif worker exceeds capability/resource gates, return an explicit unsupported/limit state. Do not upload the image.",
  },
  {
    family: "ocr",
    decision: "SPIKE",
    recommendedStack: "Tesseract.js 7.0.0 with same-origin tesseract.js-core and @tesseract.js-data/ita assets, isolated in a terminable worker.",
    refusalFallback: "Refuse OCR when worker/WASM/capability or file-size/pixel preflight fails. Searchable-PDF composition remains a separate PDF/OCR integration ticket.",
  },
  {
    family: "office",
    decision: "MIXED_SPIKE_DENY",
    recommendedStack: "Mammoth for semantic DOCX extraction, docx for bounded generation, docx-preview only as a non-fidelity preview experiment. No XLSX/PPTX production library is approved by this refresh.",
    refusalFallback: "Deny xlsx 0.18.5 and pptxgenjs 4.0.1 on current audit evidence. Refuse claims of faithful Office rendering/conversion until ticket 270 supplies a clean audited stack and fidelity corpus.",
  },
  {
    family: "pdf",
    decision: "SPIKE",
    recommendedStack: "Keep existing in-house PDF operations in production; evaluate @cantoo/pdf-lib 2.11.1 for mutation and pdfjs-dist 6.4.299 for lazy render/text behind worker/corpus limits.",
    refusalFallback: "Do not expose advanced editing/render claims where hostile/corrupt corpus, cancellation or mobile memory gates are still open.",
  },
  {
    family: "audio",
    decision: "SPIKE",
    recommendedStack: "Web Audio for bounded DSP and Mediabunny/WebCodecs for supported local containers/codecs. Treat actual encode/decode support as a runtime capability, not a browser-name assumption.",
    refusalFallback: "Deny lamejs as the new baseline and refuse formats/codecs unsupported by the local capability matrix; no server transcoding fallback.",
  },
  {
    family: "video",
    decision: "SPIKE",
    recommendedStack: "Mediabunny 1.61.3 is the primary inspection/container candidate; mp4box 2.4.1 remains a smaller MP4-specific alternate. Transcoding must stay WebCodecs/capability-gated.",
    refusalFallback: "Deny the current ffmpeg.wasm production path because its official core is GPL under the repository's dependency policy. Refuse unsupported transcodes locally instead of silently uploading media.",
  },
];

const receipt = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  policy: {
    promotedPaths: 0,
    rule: "No candidate is production-approved from desktop evidence alone. Any future ALLOW requires clean security/license gates, measured full memory/cancellation behavior, and genuine iOS Safari + Android Chrome receipts when the operation is in the heavy mobile scope.",
    physicalEvidenceRule: runtimeReceipt.physicalMobile.note,
  },
  corpus: corpusReceipt,
  browserMatrix: runtimeReceipt.results.map((engine) => ({
    engine: engine.engine,
    label: engine.label,
    classification: engine.classification,
    status: engine.status,
    externalRequestsObserved: engine.externalRequests?.length ?? null,
    userAgent: engine.payload?.userAgent ?? null,
  })),
  physicalMobile: runtimeReceipt.physicalMobile,
  ocrRuntimeAssets: bundleReceipt.runtimeAssetGroups?.tesseract ?? null,
  rows,
  familyRecommendations,
};

await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, "decision-matrix.json"), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify({
  output: path.join(outputDir, "decision-matrix.json"),
  rows: rows.length,
  decisions: Object.fromEntries([...new Set(rows.map((row) => row.decision))].map((decision) => [decision, rows.filter((row) => row.decision === decision).length])),
  promotedPaths: receipt.policy.promotedPaths,
}, null, 2));
