const output = document.querySelector("#result");

function heapBytes() {
  return typeof performance.memory?.usedJSHeapSize === "number" ? performance.memory.usedJSHeapSize : null;
}

async function measured(operation) {
  const start = performance.now();
  const startHeap = heapBytes();
  let peakHeap = startHeap;
  const timer = setInterval(() => {
    const current = heapBytes();
    if (current !== null && (peakHeap === null || current > peakHeap)) peakHeap = current;
  }, 10);
  try {
    const value = await operation();
    const endHeap = heapBytes();
    if (endHeap !== null && (peakHeap === null || endHeap > peakHeap)) peakHeap = endHeap;
    return {
      value,
      runtimeMs: performance.now() - start,
      startJsHeapBytes: startHeap,
      endJsHeapBytes: endHeap,
      peakJsHeapBytes: peakHeap,
      peakJsHeapDeltaBytes: startHeap !== null && peakHeap !== null ? peakHeap - startHeap : null,
    };
  } finally {
    clearInterval(timer);
  }
}

async function timedImport(loader) {
  const started = performance.now();
  const module = await loader();
  return { module, coldLoadMs: performance.now() - started };
}

async function fetchBlob(url, type) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
  return new Blob([await response.arrayBuffer()], { type });
}

async function runCase(id, family, operation) {
  try {
    const result = await operation();
    return { id, family, status: "PASS", ...result };
  } catch (error) {
    return {
      id,
      family,
      status: "FAIL",
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      stack: error instanceof Error ? error.stack ?? null : null,
    };
  }
}

async function browserCapabilities() {
  const videoProbe = typeof VideoDecoder !== "undefined"
    ? await VideoDecoder.isConfigSupported({ codec: "avc1.42001E", codedWidth: 320, codedHeight: 180 }).catch(() => ({ supported: false }))
    : null;
  const audioProbe = typeof AudioDecoder !== "undefined"
    ? await AudioDecoder.isConfigSupported({ codec: "mp4a.40.2", sampleRate: 48000, numberOfChannels: 1 }).catch(() => ({ supported: false }))
    : null;
  return {
    id: "browser-capabilities",
    family: "platform",
    status: "PASS",
    userAgent: navigator.userAgent,
    crossOriginIsolated: self.crossOriginIsolated === true,
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    deviceMemoryGiB: navigator.deviceMemory ?? null,
    apis: {
      webAssembly: typeof WebAssembly !== "undefined",
      worker: typeof Worker !== "undefined",
      createImageBitmap: typeof createImageBitmap === "function",
      offscreenCanvas: typeof OffscreenCanvas !== "undefined",
      videoDecoder: typeof VideoDecoder !== "undefined",
      videoEncoder: typeof VideoEncoder !== "undefined",
      audioDecoder: typeof AudioDecoder !== "undefined",
      audioEncoder: typeof AudioEncoder !== "undefined",
      offlineAudioContext: typeof OfflineAudioContext !== "undefined" || typeof webkitOfflineAudioContext !== "undefined",
    },
    codecProbes: { h264Decode: videoProbe?.supported === true, aacDecode: audioProbe?.supported === true },
  };
}

async function benchmarkHeic() {
  const { module, coldLoadMs } = await timedImport(() => import("libheif-js/libheif-wasm/libheif-bundle.mjs"));
  const bytes = new Uint8Array(await (await fetch("/corpus/sample.heic", { cache: "no-store" })).arrayBuffer());
  const run = await measured(async () => {
    const libheif = await module.default();
    const decoder = new libheif.HeifDecoder();
    const images = decoder.decode(bytes);
    if (images.length < 1) throw new Error("No HEIC image decoded");
    const image = images[0];
    const width = image.get_width();
    const height = image.get_height();
    const rgba = { data: new Uint8ClampedArray(width * height * 4), width, height };
    await new Promise((resolve, reject) => image.display(rgba, (displayData) => displayData ? resolve() : reject(new Error("HEIC display failed"))));
    return { width, height, rgbaBytes: rgba.data.byteLength, imageCount: images.length };
  });
  return { candidate: "libheif-js@1.23.5", coldLoadMs, ...run, value: run.value };
}

async function benchmarkOcr() {
  const { module, coldLoadMs } = await timedImport(() => import("tesseract.js"));
  const blob = await fetchBlob("/corpus/ocr-it.png", "image/png");
  const progress = [];
  const run = await measured(async () => {
    const worker = await module.createWorker("ita", 1, {
      workerPath: `${location.origin}/tesseract/worker.min.js`,
      corePath: `${location.origin}/tesseract/core`,
      langPath: `${location.origin}/tesseract/lang`,
      cacheMethod: "none",
      logger: (entry) => {
        if (typeof entry?.progress === "number") progress.push({ status: entry.status, progress: entry.progress });
      },
    });
    try {
      const recognition = await worker.recognize(blob);
      const text = recognition.data.text.replace(/\s+/g, " ").trim();
      if (!/12345/u.test(text) || !/678[,.]90/u.test(text)) throw new Error(`OCR marker mismatch: ${text}`);
      return { text, confidence: recognition.data.confidence, progressEvents: progress.length };
    } finally {
      await worker.terminate();
    }
  });
  return { candidate: "tesseract.js@7.0.0 + ita@1.0.0", coldLoadMs, networkPolicy: "same-origin assets only", ...run, value: run.value };
}

async function benchmarkXlsx() {
  const { module, coldLoadMs } = await timedImport(() => import("xlsx"));
  const bytes = await (await fetch("/corpus/sample.xlsx", { cache: "no-store" })).arrayBuffer();
  const run = await measured(async () => {
    const workbook = module.read(bytes, { type: "array" });
    const rows = module.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
    const outputBytes = module.write(workbook, { type: "array", bookType: "xlsx", compression: true });
    if (rows[1]?.[0] !== "Consulenza") throw new Error("XLSX parse marker mismatch");
    return { rows: rows.length, outputBytes: outputBytes.byteLength };
  });
  return { candidate: "xlsx@0.18.5", coldLoadMs, ...run, value: run.value };
}

async function benchmarkDocxExtract() {
  const { module, coldLoadMs } = await timedImport(() => import("mammoth/mammoth.browser"));
  const bytes = await (await fetch("/corpus/sample.docx", { cache: "no-store" })).arrayBuffer();
  const run = await measured(async () => {
    const result = await module.default.extractRawText({ arrayBuffer: bytes });
    if (!result.value.includes("299,90")) throw new Error("DOCX extraction marker mismatch");
    return { text: result.value.trim(), messages: result.messages.length };
  });
  return { candidate: "mammoth@1.13.0", coldLoadMs, ...run, value: run.value };
}

async function benchmarkDocxWrite() {
  const { module, coldLoadMs } = await timedImport(() => import("docx"));
  const run = await measured(async () => {
    const doc = new module.Document({ sections: [{ children: [new module.Paragraph("Documento browser 12345")] }] });
    const blob = await module.Packer.toBlob(doc);
    if (blob.size < 1000) throw new Error("DOCX output unexpectedly small");
    return { outputBytes: blob.size };
  });
  return { candidate: "docx@9.8.1", coldLoadMs, ...run, value: run.value };
}

async function benchmarkDocxPreview() {
  const { module, coldLoadMs } = await timedImport(() => import("docx-preview"));
  const blob = await fetchBlob("/corpus/sample.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  const run = await measured(async () => {
    const container = document.createElement("div");
    document.body.append(container);
    try {
      await module.renderAsync(blob, container, undefined, { breakPages: true, renderHeaders: true, renderFooters: true });
      const text = container.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (!text.includes("299,90")) throw new Error("DOCX preview marker mismatch");
      return { textLength: text.length, renderedElements: container.querySelectorAll("*").length };
    } finally {
      container.remove();
    }
  });
  return { candidate: "docx-preview@0.4.1", coldLoadMs, ...run, value: run.value };
}

async function benchmarkPptxWrite() {
  const { module, coldLoadMs } = await timedImport(() => import("pptxgenjs"));
  const run = await measured(async () => {
    const presentation = new module.default();
    const slide = presentation.addSlide();
    slide.addText("Browser PPTX 12345", { x: 1, y: 1, w: 5, h: 0.5 });
    const blob = await presentation.write({ outputType: "blob" });
    if (!(blob instanceof Blob) || blob.size < 1000) throw new Error("PPTX output missing");
    return { outputBytes: blob.size };
  });
  return { candidate: "pptxgenjs@4.0.1", coldLoadMs, ...run, value: run.value };
}

async function benchmarkPdfMutation() {
  const { module, coldLoadMs } = await timedImport(() => import("@cantoo/pdf-lib"));
  const bytes = await (await fetch("/corpus/sample.pdf", { cache: "no-store" })).arrayBuffer();
  const run = await measured(async () => {
    const doc = await module.PDFDocument.load(bytes);
    const pages = doc.getPages();
    pages[0].setRotation(module.degrees(90));
    const outputBytes = await doc.save();
    if (pages.length !== 3 || outputBytes.byteLength < 500) throw new Error("PDF mutation mismatch");
    return { pages: pages.length, outputBytes: outputBytes.byteLength };
  });
  return { candidate: "@cantoo/pdf-lib@2.11.1", coldLoadMs, ...run, value: run.value };
}

async function benchmarkPdfRender() {
  const { module, coldLoadMs } = await timedImport(() => import("pdfjs-dist"));
  module.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();
  const bytes = new Uint8Array(await (await fetch("/corpus/sample.pdf", { cache: "no-store" })).arrayBuffer());
  const run = await measured(async () => {
    const loadingTask = module.getDocument({ data: bytes });
    const doc = await loadingTask.promise;
    try {
      const page = await doc.getPage(1);
      const text = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, canvasContext: canvas.getContext("2d"), viewport }).promise;
      const joined = text.items.map((item) => "str" in item ? item.str : "").join(" ");
      if (!joined.includes("PDF-1-12345")) throw new Error("PDF text marker mismatch");
      return { pages: doc.numPages, width: canvas.width, height: canvas.height, textLength: joined.length };
    } finally {
      await loadingTask.destroy();
    }
  });
  return { candidate: "pdfjs-dist@6.4.299", coldLoadMs, ...run, value: run.value };
}

async function benchmarkMediaBunny() {
  const { module, coldLoadMs } = await timedImport(() => import("mediabunny"));
  const mp4 = await fetchBlob("/corpus/sample.mp4", "video/mp4");
  const wav = await fetchBlob("/corpus/sample.wav", "audio/wav");
  const run = await measured(async () => {
    const videoInput = new module.Input({ formats: module.ALL_FORMATS, source: new module.BlobSource(mp4) });
    const audioInput = new module.Input({ formats: module.ALL_FORMATS, source: new module.BlobSource(wav) });
    try {
      const [videoTrack, audioTrack, videoDuration, wavDuration] = await Promise.all([
        videoInput.getPrimaryVideoTrack(),
        videoInput.getPrimaryAudioTrack(),
        videoInput.getDurationFromMetadata(),
        audioInput.getDurationFromMetadata(),
      ]);
      if (videoTrack === null || audioTrack === null) throw new Error("MP4 tracks not detected");
      return {
        videoDuration,
        wavDuration,
        videoWidth: await videoTrack.getDisplayWidth(),
        videoHeight: await videoTrack.getDisplayHeight(),
        audioSampleRate: await audioTrack.getSampleRate(),
      };
    } finally {
      videoInput.dispose();
      audioInput.dispose();
    }
  });
  return { candidate: "mediabunny@1.61.3", coldLoadMs, ...run, value: run.value };
}

async function benchmarkMp4Box() {
  const { module, coldLoadMs } = await timedImport(() => import("mp4box"));
  const bytes = await (await fetch("/corpus/sample.mp4", { cache: "no-store" })).arrayBuffer();
  const run = await measured(async () => {
    const info = await new Promise((resolve, reject) => {
      const file = module.createFile();
      const input = bytes.slice(0);
      input.fileStart = 0;
      file.onError = reject;
      file.onReady = resolve;
      file.appendBuffer(input);
      file.flush();
    });
    if (!info.videoTracks?.length || !info.audioTracks?.length) throw new Error("MP4Box tracks missing");
    return { duration: info.duration / info.timescale, videoTracks: info.videoTracks.length, audioTracks: info.audioTracks.length };
  });
  return { candidate: "mp4box@2.4.1", coldLoadMs, ...run, value: run.value };
}

async function benchmarkNativeAudioDsp() {
  const Context = globalThis.OfflineAudioContext ?? globalThis.webkitOfflineAudioContext;
  if (Context === undefined) throw new Error("OfflineAudioContext unavailable");
  const run = await measured(async () => {
    const sampleRate = 48000;
    const frames = sampleRate * 2;
    const context = new Context(1, frames, sampleRate);
    const oscillator = new OscillatorNode(context, { frequency: 440 });
    const gain = new GainNode(context, { gain: 0.5 });
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(0);
    oscillator.stop(2);
    const rendered = await context.startRendering();
    const channel = rendered.getChannelData(0);
    let sum = 0;
    for (let index = 0; index < channel.length; index += 1) sum += channel[index] * channel[index];
    return { frames: channel.length, rms: Math.sqrt(sum / channel.length) };
  });
  return { candidate: "Web Audio OfflineAudioContext", coldLoadMs: 0, ...run, value: run.value };
}

async function benchmarkCmsPkijs() {
  const [{ module: asn1js, coldLoadMs: asn1LoadMs }, { module: pkijs, coldLoadMs: pkijsLoadMs }] = await Promise.all([
    timedImport(() => import("asn1js")),
    timedImport(() => import("pkijs")),
  ]);
  const read = async (name) => new Uint8Array(await (await fetch(`/corpus/${name}`, { cache: "no-store" })).arrayBuffer());
  const parseContentInfo = (bytes) => {
    const parsed = asn1js.fromBER(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    if (parsed.offset === -1) throw new Error("ASN.1 parse rejected CMS bytes");
    return new pkijs.ContentInfo({ schema: parsed.result });
  };
  const run = await measured(async () => {
    const valid = parseContentInfo(await read("sample.p7m"));
    if (valid.contentType !== "1.2.840.113549.1.7.2") throw new Error(`Unexpected CMS type ${valid.contentType}`);
    const signed = new pkijs.SignedData({ schema: valid.content });
    const payload = signed.encapContentInfo.eContent?.valueBlock?.valueHexView;
    const payloadText = payload === undefined ? "" : new TextDecoder().decode(payload);
    if (!payloadText.includes("P7M payload locale 12345")) throw new Error("CMS payload extraction marker mismatch");
    const certificate = signed.certificates?.find((item) => item instanceof pkijs.Certificate);
    const subject = certificate?.subject?.typesAndValues?.map((item) => String(item.value?.valueBlock?.value ?? "")).filter(Boolean) ?? [];
    if (!subject.some((value) => value.includes("Strumentini Feasibility"))) throw new Error("CMS certificate metadata missing expected fixture subject");

    let corruptRejected = false;
    try { parseContentInfo(await read("sample-corrupt.p7m")); } catch { corruptRejected = true; }
    if (!corruptRejected) throw new Error("Truncated CMS fixture was unexpectedly accepted");

    const unsupported = parseContentInfo(await read("sample-unsupported-cms.der"));
    const unsupportedRejected = unsupported.contentType !== "1.2.840.113549.1.7.2";
    if (!unsupportedRejected) throw new Error("Non-SignedData CMS fixture was unexpectedly accepted as P7M SignedData");
    return {
      payloadBytes: payload?.byteLength ?? 0,
      certificateCount: signed.certificates?.length ?? 0,
      signerCount: signed.signerInfos.length,
      subject,
      corruptRejected,
      unsupportedContentType: unsupported.contentType,
      unsupportedRejected,
      trustChainStatus: "NOT_EVALUATED",
    };
  });
  return { candidate: "pkijs@3.4.1 + asn1js@3.0.10", coldLoadMs: asn1LoadMs + pkijsLoadMs, ...run, value: run.value };
}

async function benchmarkArchiveFflate() {
  const { module, coldLoadMs } = await timedImport(() => import("fflate"));
  const read = async (name) => new Uint8Array(await (await fetch(`/corpus/${name}`, { cache: "no-store" })).arrayBuffer());
  const run = await measured(async () => {
    const [zipBytes, gzipBytes, unsafeZipBytes, corruptZipBytes, corruptGzipBytes] = await Promise.all([
      read("sample.zip"), read("sample.gz"), read("sample-unsafe-path.zip"), read("sample-corrupt.zip"), read("sample-corrupt.gz"),
    ]);
    const zip = module.unzipSync(zipBytes);
    const payload = zip["safe/payload.txt"];
    const gunzipped = module.gunzipSync(gzipBytes);
    if (payload === undefined || !new TextDecoder().decode(payload).includes("archive payload 12345")) throw new Error("ZIP marker mismatch");
    if (!new TextDecoder().decode(gunzipped).includes("archive payload 12345")) throw new Error("GZIP marker mismatch");
    const unsafeNames = Object.keys(module.unzipSync(unsafeZipBytes)).filter((name) => /(^|\/)\.\.(\/|$)|^\//u.test(name));
    let corruptZipRejected = false;
    let corruptGzipRejected = false;
    try { module.unzipSync(corruptZipBytes); } catch { corruptZipRejected = true; }
    try { module.gunzipSync(corruptGzipBytes); } catch { corruptGzipRejected = true; }
    return {
      zipInputBytes: zipBytes.byteLength,
      gzipInputBytes: gzipBytes.byteLength,
      expandedBytes: payload.byteLength,
      zipExpansionRatio: payload.byteLength / zipBytes.byteLength,
      gzipExpansionRatio: gunzipped.byteLength / gzipBytes.byteLength,
      unsafeNames,
      corruptZipRejected,
      corruptGzipRejected,
      cancellation: "SYNC_API_REQUIRES_OUTER_WORKER_TERMINATION_OR_STREAMING_WRAPPER",
    };
  });
  return { candidate: "fflate@0.8.3", coldLoadMs, ...run, value: run.value };
}

async function benchmarkNativeImageModes() {
  const blob = await fetchBlob("/corpus/sample-animated.gif", "image/gif");
  const run = await measured(async () => {
    const bitmap = await createImageBitmap(blob);
    const gif = { width: bitmap.width, height: bitmap.height, frameCount: null, imageDecoder: typeof ImageDecoder !== "undefined" };
    bitmap.close();
    if (typeof ImageDecoder !== "undefined") {
      const decoder = new ImageDecoder({ data: await blob.arrayBuffer(), type: "image/gif" });
      try {
        await decoder.tracks.ready;
        gif.frameCount = decoder.tracks.selectedTrack?.frameCount ?? null;
      } finally {
        decoder.close();
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 4;
    const context = canvas.getContext("2d");
    context.fillStyle = "#ff0000";
    context.fillRect(0, 0, 4, 4);
    const encode = async (type) => await new Promise((resolve) => canvas.toBlob((value) => resolve(value === null ? null : { type: value.type, bytes: value.size }), type, 0.8));
    return {
      gif,
      encoders: {
        jpeg: await encode("image/jpeg"),
        webp: await encode("image/webp"),
        png: await encode("image/png"),
        avif: await encode("image/avif"),
      },
      svgOptimizer: "NO_BROWSER_NATIVE_OPTIMIZER",
    };
  });
  return { candidate: "browser-native image decode/canvas encode", coldLoadMs: 0, ...run, value: run.value };
}

async function benchmarkLargePdf() {
  const [{ module: pdfLib, coldLoadMs: mutationLoadMs }, { module: pdfjs, coldLoadMs: renderLoadMs }] = await Promise.all([
    timedImport(() => import("@cantoo/pdf-lib")),
    timedImport(() => import("pdfjs-dist")),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();
  const bytes = new Uint8Array(await (await fetch("/corpus/sample-200.pdf", { cache: "no-store" })).arrayBuffer());
  const run = await measured(async () => {
    const mutationDoc = await pdfLib.PDFDocument.load(bytes);
    if (mutationDoc.getPageCount() !== 200) throw new Error("200-page mutation corpus page count mismatch");
    mutationDoc.getPage(199).setRotation(pdfLib.degrees(90));
    const saved = await mutationDoc.save();

    const loadingTask = pdfjs.getDocument({ data: bytes.slice() });
    const renderDoc = await loadingTask.promise;
    try {
      if (renderDoc.numPages !== 200) throw new Error("200-page render corpus page count mismatch");
      const page = await renderDoc.getPage(200);
      const text = await page.getTextContent();
      const joined = text.items.map((item) => "str" in item ? item.str : "").join(" ");
      if (!joined.includes("LARGE-PDF-200-12345")) throw new Error("200-page PDF text marker mismatch");
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const renderTask = page.render({ canvas, canvasContext: canvas.getContext("2d"), viewport });
      renderTask.cancel();
      let cancellationObserved = false;
      try { await renderTask.promise; } catch (error) { cancellationObserved = /cancel/u.test(String(error?.name ?? error)) || /cancel/u.test(String(error?.message ?? error)); }
      return { pages: 200, inputBytes: bytes.byteLength, savedBytes: saved.byteLength, cancellationObserved };
    } finally {
      await loadingTask.destroy();
    }
  });
  return { candidate: "@cantoo/pdf-lib@2.11.1 + pdfjs-dist@6.4.299", coldLoadMs: mutationLoadMs + renderLoadMs, ...run, value: run.value };
}

async function benchmarkLargeMediaInspection() {
  const { module, coldLoadMs } = await timedImport(() => import("mediabunny"));
  const mp4 = await fetchBlob("/corpus/sample-10s-720p.mp4", "video/mp4");
  const run = await measured(async () => {
    const input = new module.Input({ formats: module.ALL_FORMATS, source: new module.BlobSource(mp4) });
    try {
      const [track, duration] = await Promise.all([input.getPrimaryVideoTrack(), input.getDurationFromMetadata()]);
      if (track === null) throw new Error("Large MP4 video track missing");
      return { bytes: mp4.size, duration, width: await track.getDisplayWidth(), height: await track.getDisplayHeight(), cancellationSeam: "Input.dispose()" };
    } finally {
      input.dispose();
    }
  });
  return { candidate: "mediabunny@1.61.3", coldLoadMs, ...run, value: run.value };
}

async function benchmarkRefusedDocumentFormats() {
  const { module: archive, coldLoadMs } = await timedImport(() => import("fflate"));
  const run = await measured(async () => {
    const eml = await (await fetch("/corpus/hostile.eml", { cache: "no-store" })).text();
    const epubBytes = new Uint8Array(await (await fetch("/corpus/hostile.epub", { cache: "no-store" })).arrayBuffer());
    const msgBytes = new Uint8Array(await (await fetch("/corpus/unsupported.msg", { cache: "no-store" })).arrayBuffer());
    const epub = archive.unzipSync(epubBytes);
    const epubHtml = new TextDecoder().decode(epub["OEBPS/content.xhtml"] ?? new Uint8Array());
    const activePattern = /<(?:script|iframe|object|embed)\b|(?:src|href)\s*=\s*["']https?:\/\//iu;
    const emlRejectedForActiveContent = activePattern.test(eml);
    const epubRejectedForActiveContent = activePattern.test(epubHtml);
    const msgCompoundFileSignature = msgBytes.length >= 8 && [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((value, index) => msgBytes[index] === value);
    if (!emlRejectedForActiveContent || !epubRejectedForActiveContent || !msgCompoundFileSignature) throw new Error("Hostile/refusal corpus marker mismatch");
    return {
      eml: { decision: "REFUSE", activeContentDetected: emlRejectedForActiveContent, parser: null },
      epub: { decision: "REFUSE", activeContentDetected: epubRejectedForActiveContent, parser: null },
      msg: { decision: "REFUSE", compoundFileSignatureDetected: msgCompoundFileSignature, parser: null },
      policy: "REJECT_BEFORE_RENDER_OR_EXTERNAL_RESOURCE_RESOLUTION",
    };
  });
  return { candidate: "no approved EML/MSG/EPUB parser; fflate used only to expose hostile EPUB fixture bytes", coldLoadMs, ...run, value: run.value };
}

const cases = [
  browserCapabilities(),
  runCase("heic-libheif", "heic", benchmarkHeic),
  runCase("ocr-tesseract-ita", "ocr", benchmarkOcr),
  runCase("office-xlsx", "office", benchmarkXlsx),
  runCase("office-docx-extract", "office", benchmarkDocxExtract),
  runCase("office-docx-write", "office", benchmarkDocxWrite),
  runCase("office-docx-preview", "office", benchmarkDocxPreview),
  runCase("office-pptx-write", "office", benchmarkPptxWrite),
  runCase("pdf-cantoo-mutate", "pdf", benchmarkPdfMutation),
  runCase("pdfjs-render", "pdf", benchmarkPdfRender),
  runCase("media-mediabunny-inspect", "audio-video", benchmarkMediaBunny),
  runCase("video-mp4box-inspect", "video", benchmarkMp4Box),
  runCase("audio-native-dsp", "audio", benchmarkNativeAudioDsp),
  runCase("cms-pkijs", "cms", benchmarkCmsPkijs),
  runCase("archive-fflate", "archive", benchmarkArchiveFflate),
  runCase("image-native-modes", "image", benchmarkNativeImageModes),
  runCase("pdf-large-200", "pdf", benchmarkLargePdf),
  runCase("video-large-inspect", "video", benchmarkLargeMediaInspection),
  runCase("mail-epub-refusal-policy", "mail-ebook", benchmarkRefusedDocumentFormats),
];

const results = await Promise.all(cases);
const payload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  userAgent: navigator.userAgent,
  memoryMeasurement: "performance.memory JS heap checkpoints/polling only; excludes WASM linear memory, decoded native surfaces and full browser RSS",
  results,
};
window.__STRUMENTINI_HEAVY_FEASIBILITY__ = payload;
output.textContent = JSON.stringify(payload, null, 2);
document.documentElement.dataset.feasibilityState = "complete";
