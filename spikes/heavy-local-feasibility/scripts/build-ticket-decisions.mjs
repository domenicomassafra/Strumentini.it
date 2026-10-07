import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(root, "../..");
const evidenceDir = path.join(repoRoot, "quality/benchmarks/heavy-local-feasibility");

const [runtime, bundles, existingMatrix, corpus, pkijsPackage, fflatePackage] = await Promise.all([
  readFile(path.join(evidenceDir, "desktop-runtime.json"), "utf8").then(JSON.parse),
  readFile(path.join(evidenceDir, "bundle-sizes.json"), "utf8").then(JSON.parse),
  readFile(path.join(evidenceDir, "decision-matrix.json"), "utf8").then(JSON.parse),
  readFile(path.join(root, "public/corpus/manifest.json"), "utf8").then(JSON.parse),
  readFile(path.join(root, "node_modules/pkijs/package.json"), "utf8").then(JSON.parse),
  readFile(path.join(root, "node_modules/fflate/package.json"), "utf8").then(JSON.parse),
]);

const bundleById = new Map(bundles.candidates.map((item) => [item.id, item]));
const existingRowById = new Map(existingMatrix.rows.map((item) => [item.id, item]));
const corpusByName = new Map(corpus.files.map((item) => [item.name, item]));

function caseAcrossEngines(id) {
  return runtime.results.map((engine) => {
    const result = engine.payload?.results?.find((item) => item.id === id);
    return {
      engine: engine.engine,
      classification: engine.classification,
      status: result?.status ?? "NOT_RUN",
      candidate: result?.candidate ?? null,
      coldLoadMs: result?.coldLoadMs ?? null,
      runtimeMs: result?.runtimeMs ?? null,
      peakJsHeapDeltaBytes: result?.peakJsHeapDeltaBytes ?? null,
      value: result?.value ?? null,
      externalRequestsObserved: engine.externalRequests?.length ?? null,
    };
  });
}

function allDesktopPass(id) {
  const evidence = caseAcrossEngines(id);
  return evidence.length > 0 && evidence.every((item) => item.status === "PASS" && item.externalRequestsObserved === 0);
}

function compactExisting(id) {
  const row = existingRowById.get(id);
  if (!row) return null;
  return {
    package: row.package,
    version: row.version,
    license: row.license,
    decision: row.decision,
    securityAudit: row.securityAudit,
    lazyBundle: row.lazyBundle,
    runtime: row.runtime,
    cancellation: row.cancellation,
    fallback: row.fallback,
  };
}

const physicalMissing = runtime.physicalMobile.iosSafari.status !== "PASS" || runtime.physicalMobile.androidChrome.status !== "PASS";
const heicFixture = corpusByName.get("sample.heic");
const realIphoneHeicPresent = /iphone/iu.test(heicFixture?.provenance ?? "");
const chromeImage = caseAcrossEngines("image-native-modes").find((item) => item.engine === "chrome")?.value;
const webkitImage = caseAcrossEngines("image-native-modes").find((item) => item.engine === "webkit")?.value;
const cmsDesktopPass = allDesktopPass("cms-pkijs");
const archiveDesktopPass = allDesktopPass("archive-fflate");
const hostilePolicyPass = allDesktopPass("mail-epub-refusal-policy");
const officeDecisionPass = ["office-docx-extract", "office-docx-write", "office-docx-preview"].every(allDesktopPass)
  && existingRowById.get("xlsx")?.decision === "DENY"
  && existingRowById.get("pptxgenjs")?.decision === "DENY";
const ocrDesktopPass = allDesktopPass("ocr-tesseract-ita")
  && existingRowById.get("tesseract-js")?.decision === "SPIKE"
  && existingRowById.get("tesseract-ita")?.decision === "SPIKE";
const imageDecisionComplete = allDesktopPass("image-native-modes")
  && existingRowById.get("libheif-js")?.decision === "SPIKE";
const pdfDecisionComplete = allDesktopPass("pdf-large-200")
  && existingRowById.get("cantoo-pdf-lib")?.decision === "SPIKE"
  && existingRowById.get("pdfjs-dist")?.decision === "SPIKE";
const audioDecisionComplete = allDesktopPass("audio-native-dsp")
  && existingRowById.get("mediabunny")?.decision === "SPIKE"
  && existingRowById.get("ffmpeg-core")?.decision === "DENY"
  && existingRowById.get("lamejs")?.decision === "DENY";
const videoDecisionComplete = allDesktopPass("video-large-inspect")
  && existingRowById.get("mediabunny")?.decision === "SPIKE"
  && existingRowById.get("mp4box")?.decision === "SPIKE"
  && existingRowById.get("ffmpeg-core")?.decision === "DENY";

const tickets = [
  {
    ticket: 267,
    title: "P7M CMS parser feasibility spike",
    decision: "REFUSE",
    ticketClosureEligible: cmsDesktopPass,
    reason: "PKIjs is a viable bounded parser candidate, but this spike refuses production promotion until full/mobile memory acceptance exists. The refusal still establishes a truthful local fallback boundary without claiming certificate trust-chain validity.",
    selectedCandidate: {
      package: "pkijs",
      version: pkijsPackage.version,
      license: pkijsPackage.license,
      companion: "asn1js@3.0.10",
      lazyBundle: bundleById.get("pkijs-cms") ?? null,
    },
    capabilities: {
      envelopeParse: cmsDesktopPass ? "PROVEN_DESKTOP" : "FAILED",
      payloadExtraction: cmsDesktopPass ? "PROVEN_DESKTOP" : "FAILED",
      certificateMetadata: cmsDesktopPass ? "PROVEN_DESKTOP" : "FAILED",
      trustChainValidity: "REFUSE_NOT_EVALUATED",
    },
    fixtures: ["sample.p7m", "sample-corrupt.p7m", "sample-unsupported-cms.der"].map((name) => corpusByName.get(name)),
    runtime: caseAcrossEngines("cms-pkijs"),
    remainingEvidence: physicalMissing
      ? ["Physical iOS Safari and Android Chrome memory/runtime evidence is absent; therefore no production parser promotion is authorized."]
      : [],
  },
  {
    ticket: 268,
    title: "Image codec and SVG optimizer feasibility spike",
    decision: "REFUSE",
    ticketClosureEligible: imageDecisionComplete,
    reason: "The feasibility matrix is complete, but this lane refuses new codec/optimizer production promotion. Browser-native JPEG/PNG remain bounded existing paths; HEIC stays a libheif spike and cannot be promoted without the required real-iPhone plus physical-mobile evidence.",
    modes: {
      jpegEncode: "IMPLEMENT_BROWSER_NATIVE_BOUNDED",
      webpEncode: webkitImage?.encoders?.webp?.type === "image/webp" ? "IMPLEMENT_BROWSER_NATIVE_BOUNDED" : "REFUSE_AS_UNIFORM_NATIVE_PATH",
      pngEncode: "IMPLEMENT_BROWSER_NATIVE_BOUNDED",
      jpegWebpAdvancedCodecControls: "REFUSE_NO_VETTED_UNIFORM_CODEC_PATH",
      pngOptimization: "REFUSE_NO_VETTED_OPTIMIZER",
      svgOptimization: "REFUSE_NO_BROWSER_NATIVE_OPTIMIZER",
      heicDecode: "SPIKE_LIBHEIF_JS_1_23_5",
      avifEncode: chromeImage?.encoders?.avif?.type === "image/avif" ? "SPIKE" : "REFUSE_AS_UNIFORM_NATIVE_PATH",
      animatedGifDecode: chromeImage?.gif?.frameCount > 1 ? "SPIKE_DESKTOP_PROVEN" : "REFUSE",
      animatedGifWriteOptimize: "REFUSE_UNPROVEN",
    },
    evidence: {
      nativeModes: caseAcrossEngines("image-native-modes"),
      libheif: compactExisting("libheif-js"),
      heicFixture,
      animatedGifFixture: corpusByName.get("sample-animated.gif"),
      realIphoneHeicPresent,
      initialSpikeBundleGzipBytes: bundles.initial.gzipBytes,
    },
    remainingEvidence: [
      "Required real-iPhone HEIC fixture is absent; current HEIC was synthesized from a PNG with macOS sips.",
      ...(physicalMissing ? ["Genuine iOS Safari and Android Chrome codec/memory receipts are absent."] : []),
    ],
  },
  {
    ticket: 269,
    title: "Advanced PDF renderer and mutation feasibility spike",
    decision: "REFUSE",
    ticketClosureEligible: pdfDecisionComplete,
    reason: "The feasibility matrix is complete: existing in-house operations stay preferred, bounded mutation/render candidates remain spikes, and fidelity-sensitive advanced capabilities are refused. No new advanced PDF dependency is production-promoted without physical-mobile memory evidence.",
    capabilities: {
      existingInHouseOperations: "KEEP",
      boundedMutation: "SPIKE_CANTOO_PDF_LIB_2_11_1",
      renderAndText: "SPIKE_PDFJS_DIST_6_4_299",
      encryption: "REFUSE_UNPROVEN",
      irreversibleRedaction: "REFUSE_UNPROVEN",
      repair: "REFUSE_UNPROVEN",
      pdfA: "REFUSE_UNPROVEN",
      richConversion: "REFUSE_UNPROVEN",
    },
    evidence: {
      mutation: compactExisting("cantoo-pdf-lib"),
      renderer: compactExisting("pdfjs-dist"),
      large200Page: caseAcrossEngines("pdf-large-200"),
      fixture: corpusByName.get("sample-200.pdf"),
    },
    remainingEvidence: [
      ...(physicalMissing ? ["Required mobile case/memory evidence is absent on physical iOS Safari and Android Chrome."] : []),
      "No fidelity corpus yet proves encryption, destructive redaction, repair, PDF/A, or rich conversion claims.",
    ],
  },
  {
    ticket: 270,
    title: "Office spreadsheet parser writer and renderer feasibility spike",
    decision: "REFUSE",
    ticketClosureEligible: officeDecisionPass,
    reason: "The feasibility decision is complete: bounded DOCX semantic/generation/preview candidates are measured, while the current XLSX/PPTX choices and faithful Office rendering are explicitly refused. Missing physical-mobile/fidelity evidence is retained as the reason no Office stack is promoted.",
    capabilities: {
      xlsxParseWrite: "REFUSE_XLSX_0_18_5_SECURITY_AUDIT",
      docxSemanticExtract: "SPIKE_MAMMOTH_1_13_0",
      docxGenerate: "SPIKE_DOCX_9_8_1",
      docxPreview: "SPIKE_NON_FIDELITY_DOCX_PREVIEW_0_4_1",
      pptxGenerate: "REFUSE_PPTXGENJS_4_0_1_SECURITY_AUDIT",
      faithfulOfficeRender: "REFUSE_UNPROVEN",
      csvToXlsx: "REFUSE_UNTIL_CLEAN_XLSX_WRITER_SELECTED",
      macrosActiveContent: "REFUSE",
      externalLinkedContent: "REFUSE_AUTOMATIC_FETCH_OR_RENDER",
    },
    evidence: {
      xlsx: compactExisting("xlsx"),
      mammoth: compactExisting("mammoth"),
      docx: compactExisting("docx"),
      docxPreview: compactExisting("docx-preview"),
      pptx: compactExisting("pptxgenjs"),
    },
    remainingEvidence: [
      ...(physicalMissing ? ["Genuine mobile memory/runtime evidence is absent."] : []),
      "No corpus establishes faithful Word/PowerPoint layout rendering; preview remains explicitly non-fidelity.",
    ],
  },
  {
    ticket: 271,
    title: "OCR engine feasibility spike",
    decision: "REFUSE",
    ticketClosureEligible: ocrDesktopPass,
    reason: "The feasibility decision is complete: Italian OCR and same-origin assets are proven on the desktop corpus, but production promotion is refused because physical-mobile and complete WASM/native-memory evidence is absent. Searchable-PDF composition remains a separate integration concern.",
    capabilities: {
      italianRasterOcr: "SPIKE_TESSERACT_JS_7_0_0",
      languageData: "LOCAL_SAME_ORIGIN_ITA_1_0_0",
      offlineCaching: "LOCAL_ASSET_PATH_PROVEN_CACHE_POLICY_NOT_PROMOTED",
      searchablePdfTextLayer: "REFUSE_IN_OCR_ENGINE_SPIKE_SEPARATE_INTEGRATION",
    },
    evidence: {
      engine: compactExisting("tesseract-js"),
      language: compactExisting("tesseract-ita"),
      runtime: caseAcrossEngines("ocr-tesseract-ita"),
      fixture: corpusByName.get("ocr-it.png"),
    },
    remainingEvidence: [
      ...(physicalMissing ? ["Required physical mobile OCR behavior is not measured."] : []),
      "WASM/native memory remains outside performance.memory JS-heap accounting.",
    ],
  },
  {
    ticket: 272,
    title: "Archive codec feasibility spike",
    decision: "REFUSE",
    ticketClosureEligible: archiveDesktopPass,
    reason: "fflate is a small clean ZIP/GZIP candidate, but the measured unsafe path exposure, high expansion ratios, synchronous API and missing physical-mobile resource evidence justify refusing production promotion in this feasibility ticket. 7z and RAR are separately refused because no maintained approved local codec was proven.",
    capabilities: {
      zipDeflate: "REFUSE_PROMOTION_FFLATE_0_8_3_REQUIRES_SECURITY_RESOURCE_WRAPPER",
      gzip: "REFUSE_PROMOTION_FFLATE_0_8_3_REQUIRES_SECURITY_RESOURCE_WRAPPER",
      sevenZip: "REFUSE_NO_APPROVED_LOCAL_CODEC_PROVEN",
      rar: "REFUSE_NO_APPROVED_LOCAL_CODEC_PROVEN",
    },
    selectedCandidate: {
      package: "fflate",
      version: fflatePackage.version,
      license: fflatePackage.license,
      lazyBundle: bundleById.get("fflate") ?? null,
    },
    requiredWrapperIfReopened: [
      "Reject absolute, parent-traversal and normalized-outside-target entry paths before writing.",
      "Bound entry count, per-entry bytes, cumulative expanded bytes and expansion ratio before/while materializing output.",
      "Run synchronous codec work in the shared terminable worker or adopt a bounded streaming API so cancel/resource breach stops computation.",
    ],
    evidence: {
      runtime: caseAcrossEngines("archive-fflate"),
      fixtures: ["sample.zip", "sample.gz", "sample-unsafe-path.zip", "sample-corrupt.zip", "sample-corrupt.gz"].map((name) => corpusByName.get(name)),
    },
    remainingEvidence: physicalMissing
      ? ["Physical mobile archive cost is not measured; this is one reason current promotion is refused."]
      : [],
  },
  {
    ticket: 273,
    title: "Audio codec and DSP feasibility spike",
    decision: "REFUSE",
    ticketClosureEligible: audioDecisionComplete,
    reason: "The feasibility matrix is complete: Web Audio DSP and media inspection remain measured spikes, exact codec support stays runtime-gated, and the available ffmpeg/lame baselines are refused. Production promotion is refused until representative physical iOS/Android evidence exists.",
    capabilities: {
      webAudioDsp: "SPIKE_DESKTOP_PROVEN",
      wavInspection: "SPIKE_MEDIABUNNY_1_61_3",
      codecDecodeEncode: "RUNTIME_WEBCODECS_CAPABILITY_GATED",
      ffmpegWasmTranscode: "REFUSE_CURRENT_CORE_LICENSE",
      standaloneMp3Encoder: "REFUSE_LAMEJS_BASELINE",
    },
    evidence: {
      dsp: caseAcrossEngines("audio-native-dsp"),
      media: compactExisting("mediabunny"),
      ffmpeg: compactExisting("ffmpeg-core"),
      lamejs: compactExisting("lamejs"),
      fixture: corpusByName.get("sample.wav"),
    },
    remainingEvidence: ["Physical iOS Safari and Android Chrome behavior is explicitly required and remains NOT_RUN."],
  },
  {
    ticket: 274,
    title: "Video codec and media-processing feasibility spike",
    decision: "REFUSE",
    ticketClosureEligible: videoDecisionComplete,
    reason: "The feasibility matrix is complete: Mediabunny/MP4Box inspection remain spikes, WebCodecs transcoding stays exact-capability gated, and the current ffmpeg.wasm core is refused. Production promotion is refused until representative physical mobile memory/cancellation evidence exists.",
    capabilities: {
      mp4Inspection: "SPIKE_MEDIABUNNY_1_61_3",
      isoBmffInspection: "SPIKE_MP4BOX_2_4_1",
      webCodecsTranscode: "SPIKE_ONLY_WHEN_EXACT_CONFIG_PROBE_PASSES",
      ffmpegWasmTranscode: "REFUSE_CURRENT_CORE_LICENSE",
    },
    evidence: {
      media: compactExisting("mediabunny"),
      mp4box: compactExisting("mp4box"),
      ffmpeg: compactExisting("ffmpeg-core"),
      largeInspection: caseAcrossEngines("video-large-inspect"),
      fixture: corpusByName.get("sample-10s-720p.mp4"),
    },
    remainingEvidence: [
      ...(physicalMissing ? ["Genuine physical iOS Safari and Android Chrome evidence is absent."] : []),
      "No production-approved general transcode dependency exists; exact WebCodecs encode/decode support remains runtime capability-gated.",
    ],
  },
  {
    ticket: 275,
    title: "EML MSG and EPUB parser feasibility spike",
    decision: "REFUSE",
    ticketClosureEligible: hostilePolicyPass,
    reason: "No maintained approved local EML/MSG/EPUB parser is installed or evidenced in this spike. The safe decision is to refuse all three rather than ship a catalog-count dependency; hostile HTML/remote-resource fixtures are detected without rendering or network resolution.",
    capabilities: {
      eml: "REFUSE_NO_APPROVED_PARSER",
      msg: "REFUSE_NO_APPROVED_PARSER",
      epub: "REFUSE_NO_APPROVED_PARSER",
      activeRemoteContentPolicy: "REJECT_BEFORE_RENDER_OR_EXTERNAL_RESOURCE_RESOLUTION",
    },
    evidence: {
      runtime: caseAcrossEngines("mail-epub-refusal-policy"),
      fixtures: ["hostile.eml", "hostile.epub", "unsupported.msg"].map((name) => corpusByName.get(name)),
    },
    remainingEvidence: [],
  },
];

const receipt = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  scope: "Tickets 267-275 feasibility decisions; no dependency in this isolated spike is production-promoted by this receipt.",
  networkPolicy: "The desktop benchmark aborts every non-loopback browser request before transmission.",
  physicalMobile: runtime.physicalMobile,
  memoryScope: "Measured peak values are Chromium JS-heap deltas only; WASM/native decoded surfaces, GPU memory and total process RSS remain outside the measurement.",
  initialSpikeBundle: bundles.initial,
  tickets,
  umbrella34: {
    decision: tickets.every((ticket) => ticket.ticketClosureEligible) ? "READY_FOR_REVIEW" : "BLOCKED",
    blockers: tickets.filter((ticket) => !ticket.ticketClosureEligible).map((ticket) => ticket.ticket),
    physicalPromotionRule: "No physical mobile result is inferred from desktop Chrome/Edge/Firefox/WebKit or viewport/device emulation.",
  },
};

await mkdir(evidenceDir, { recursive: true });
const output = path.join(evidenceDir, "ticket-decisions-267-275.json");
await writeFile(output, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  output,
  decisions: tickets.map((ticket) => ({ ticket: ticket.ticket, decision: ticket.decision, ticketClosureEligible: ticket.ticketClosureEligible })),
  umbrella34: receipt.umbrella34,
}, null, 2));
