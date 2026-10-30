import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = 18190;
const suppliedOrigin = process.env.CONVERSION_MATRIX_ORIGIN?.replace(/\/$/u, "");
const origin = suppliedOrigin ?? `http://127.0.0.1:${port}`;
const server = suppliedOrigin === undefined
  ? spawn(resolve(root, "node_modules/.bin/astro"), ["dev", "--host", "127.0.0.1", "--port", String(port), "--force"], { cwd: root, stdio: "ignore" })
  : null;
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { const response = await fetch(origin); if (response.ok) return; } catch {}
    await sleep(100);
  }
  throw new Error(`conversion acceptance server did not start at ${origin}`);
}

const fixtureDir = resolve(root, "quality/fixtures/image-format-matrix");
const [png, jpg, heic, avif, gif, pdf] = await Promise.all([
  readFile(resolve(fixtureDir, "source.png")),
  readFile(resolve(fixtureDir, "source.jpg")),
  readFile(resolve(fixtureDir, "source.heic")),
  readFile(resolve(fixtureDir, "source.avif")),
  readFile(resolve(fixtureDir, "source.gif")),
  readFile(resolve(root, "quality/fixtures/pdf-gold/simple-2page.pdf")),
]);

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    const page = await context.newPage();
    await page.goto(origin, { waitUntil: "networkidle" });
    const result = await page.evaluate(async ({ pngBytes, jpgBytes, heicBytes, avifBytes, gifBytes, pdfBytes }) => {
      const image = await import("/src/engines/image/visual-tools.ts");
      const imageToPdf = (await import("/src/tools/images-to-pdf/module.ts")).default;
      const pdfToImages = (await import("/src/tools/pdf-to-images/module.ts")).default;
      const pdfEngine = await import("/src/engines/pdf/index.ts");
      const file = (bytes, name, type) => new File([Uint8Array.from(bytes)], name, { type });
      const pngSeed = file(pngBytes, "source.png", "image/png");
      const pngBitmap = await createImageBitmap(pngSeed);
      const seedCanvas = document.createElement("canvas");
      seedCanvas.width = pngBitmap.width;
      seedCanvas.height = pngBitmap.height;
      seedCanvas.getContext("2d").drawImage(pngBitmap, 0, 0);
      pngBitmap.close();
      const webpBlob = await new Promise((resolve, reject) => seedCanvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("WebP seed encode failed")), "image/webp", 0.92));
      const inputs = [
        ["jpg", file(jpgBytes, "source.jpg", "image/jpeg"), ["image/png", "image/webp"]],
        ["png", pngSeed, ["image/jpeg", "image/webp"]],
        ["webp", new File([webpBlob], "source.webp", { type: "image/webp" }), ["image/jpeg", "image/png"]],
        ["heic", file(heicBytes, "source.heic", "image/heic")],
        ["avif", file(avifBytes, "source.avif", "image/avif")],
        ["gif", file(gifBytes, "source.gif", "image/gif")],
      ];
      const conversions = [];
      for (const [id, source, outputs = ["image/jpeg", "image/png", "image/webp"]] of inputs) {
        for (const outputMime of outputs) {
          const converted = await image.convertImageFormatLocal({ file: source, mime: outputMime, quality: 0.9, background: "#ffffff" });
          const reopened = await createImageBitmap(converted.blob);
          conversions.push({ id, inputKind: converted.inputKind, decoder: converted.decoder, framePolicy: converted.framePolicy, outputMime: converted.outputMime, dimensions: [reopened.width, reopened.height], signature: Array.from(new Uint8Array(await converted.blob.slice(0, 12).arrayBuffer())) });
          reopened.close();
        }
      }
      const pngFile = file(pngBytes, "source.png", "image/png");
      const heicFile = file(heicBytes, "source.heic", "image/heic");
      const pdfResult = await imageToPdf.run({
        files: [pngFile, heicFile],
        background: "#ffffff",
        quality: 0.9,
        order: [2, 1],
        rotations: { 1: 90, 2: 180 },
        pageSize: "a4",
        orientation: "landscape",
        fit: "contain",
        marginMm: 12,
      }, { defaults: {} });
      const pdfArtifact = pdfResult.artifacts[0];
      const pdfInspection = pdfEngine.inspectPdfBytes(pdfArtifact.bytes);
      const contactResult = await imageToPdf.run({ files: [pngFile, heicFile], background: "#ffffff", quality: 0.9, compositionMode: "contact-sheet", contactSheetColumns: 2, pageSize: "a4", orientation: "portrait", fit: "contain", marginMm: 8 }, { defaults: {} });
      const contactInspection = pdfEngine.inspectPdfBytes(contactResult.artifacts[0].bytes);
      const rendered = await pdfToImages.run({ file: file(pdfBytes, "two-pages.pdf", "application/pdf"), pages: [2, 1], mime: "image/png", scale: 1, quality: 0.9 }, { defaults: {} });
      const renderDims = [];
      for (const artifact of rendered.artifacts.filter((item) => item.mime.startsWith("image/"))) {
        const bitmap = await createImageBitmap(artifact.blob);
        renderDims.push([bitmap.width, bitmap.height, artifact.mime, artifact.filename]);
        bitmap.close();
      }
      return {
        conversions,
        imageToPdf: { pageCount: pdfInspection.pageCount, pages: pdfInspection.pages.map((entry) => [entry.width, entry.height]), conversions: pdfResult.conversions, order: pdfResult.order, rotations: pdfResult.rotations, pageSize: pdfResult.pageSize, orientation: pdfResult.orientation, fit: pdfResult.fit, marginMm: pdfResult.marginMm, signature: new TextDecoder().decode(pdfArtifact.bytes.slice(0, 5)) },
        contactSheetPdf: { pageCount: contactInspection.pageCount, compositionMode: contactResult.compositionMode, columns: contactResult.contactSheetColumns, contactSheet: contactResult.contactSheet },
        pdfToImages: { selectedPages: rendered.selectedPages, pageCount: rendered.pageCount, renderer: rendered.renderer, dpi: rendered.effectiveDpi, scale: rendered.scale, quality: rendered.quality, renderedImageCount: rendered.renderedImageCount, failures: rendered.failures, dims: renderDims, zipIncluded: rendered.zipIncluded, zipEntries: rendered.zipEntries, artifactMimes: rendered.artifacts.map((entry) => entry.mime) },
      };
    }, { pngBytes: Array.from(png), jpgBytes: Array.from(jpg), heicBytes: Array.from(heic), avifBytes: Array.from(avif), gifBytes: Array.from(gif), pdfBytes: Array.from(pdf) });

    if (result.conversions.length !== 15 || result.conversions.some((item) => item.dimensions[0] !== 2 || item.dimensions[1] !== 2)) throw new Error(`image conversion matrix failed: ${JSON.stringify(result.conversions)}`);
    const requiredDirections = ["jpg:image/png", "jpg:image/webp", "png:image/jpeg", "png:image/webp", "webp:image/jpeg", "webp:image/png", "heic:image/jpeg", "heic:image/png", "heic:image/webp", "avif:image/jpeg", "avif:image/png", "avif:image/webp", "gif:image/jpeg", "gif:image/png", "gif:image/webp"];
    for (const direction of requiredDirections) {
      const [id, mime] = direction.split(":");
      if (!result.conversions.some((item) => item.id === id && item.outputMime === mime)) throw new Error(`missing conversion direction ${direction}: ${JSON.stringify(result.conversions)}`);
    }
    const heicResults = result.conversions.filter((item) => item.id === "heic");
    if (heicResults.length !== 3 || heicResults.some((item) => item.decoder !== "libheif-wasm")) throw new Error(`HEIC did not use local libheif decoder: ${JSON.stringify(heicResults)}`);
    const gifResults = result.conversions.filter((item) => item.id === "gif");
    if (gifResults.some((item) => item.framePolicy !== "first-frame-only")) throw new Error(`GIF frame policy is not explicit: ${JSON.stringify(gifResults)}`);
    if (result.imageToPdf.pageCount !== 2 || result.imageToPdf.signature !== "%PDF-" || JSON.stringify(result.imageToPdf.order) !== JSON.stringify([2, 1]) || result.imageToPdf.pageSize !== "a4" || result.imageToPdf.orientation !== "landscape" || result.imageToPdf.fit !== "contain" || result.imageToPdf.marginMm !== 12 || result.imageToPdf.pages.some((entry) => Math.abs(entry[0] - 841.89) > 0.02 || Math.abs(entry[1] - 595.28) > 0.02)) throw new Error(`PNG/HEIC to PDF layout failed: ${JSON.stringify(result.imageToPdf)}`);
    if (result.contactSheetPdf.pageCount !== 1 || result.contactSheetPdf.compositionMode !== "contact-sheet" || result.contactSheetPdf.columns !== 2 || result.contactSheetPdf.contactSheet?.sourceCount !== 2) throw new Error(`Contact-sheet PDF failed: ${JSON.stringify(result.contactSheetPdf)}`);
    if (result.pdfToImages.renderer !== "pdfjs-local-lazy" || result.pdfToImages.pageCount !== 2 || JSON.stringify(result.pdfToImages.selectedPages) !== JSON.stringify([2, 1]) || result.pdfToImages.dims.some((item) => item[0] !== 612 || item[1] !== 792 || item[2] !== "image/png") || result.pdfToImages.zipIncluded !== true || result.pdfToImages.zipEntries !== 2 || !result.pdfToImages.artifactMimes.includes("application/zip")) throw new Error(`PDF page rendering/ZIP failed: ${JSON.stringify(result.pdfToImages)}`);

    for (const route of ["image-format-conversion", "images-to-pdf", "pdf-to-images"]) {
      const routePage = await context.newPage();
      const requests = [];
      let capture = false;
      routePage.on("request", (request) => { if (capture) requests.push({ url: request.url(), method: request.method(), postData: request.postData() }); });
      const response = await routePage.goto(`${origin}/tools/${route}/`, { waitUntil: "networkidle" });
      if (response?.status() !== 200) throw new Error(`${route}: HTTP ${String(response?.status())}`);
      if (route === "images-to-pdf") {
        await routePage.locator('input[type="file"]').setInputFiles([resolve(fixtureDir, "source.png"), resolve(fixtureDir, "source.heic")]);
        await routePage.locator("[data-images-pdf-preview]").waitFor({ state: "visible", timeout: 10_000 });
      }
      capture = true;
      const overflow = await routePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      if (overflow) throw new Error(`${route}: horizontal overflow at 390px`);
      const bad = requests.filter((request) => !request.url.startsWith(origin) || request.method !== "GET" || (request.postData ?? "") !== "");
      if (bad.length > 0) throw new Error(`${route}: unexpected task request ${JSON.stringify(bad)}`);
      await routePage.close();
    }

    const evidence = { schemaVersion: 1, status: "PASS", conversionMatrix: result, routes: ["image-format-conversion", "images-to-pdf", "pdf-to-images"], locality: "no task-time external or non-GET requests", viewport: "390x844" };
    const evidenceDir = resolve(root, "quality/receipts/conversion-matrix");
    await mkdir(evidenceDir, { recursive: true });
    await writeFile(resolve(evidenceDir, "conversion-matrix-browser.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    const receiptDir = resolve(root, "quality/receipts/pdf");
    await mkdir(receiptDir, { recursive: true });
    await writeFile(resolve(receiptDir, "conversion-matrix-browser.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    console.log("Conversion matrix browser acceptance PASS");
  } finally {
    await browser.close();
  }
} finally {
  server?.kill("SIGTERM");
}
