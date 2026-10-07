import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = 18162;
const suppliedOrigin = process.env.IMAGE_ADVANCED_ACCEPTANCE_ORIGIN?.replace(/\/$/u, "");
const origin = suppliedOrigin ?? `http://127.0.0.1:${port}`;
const server = suppliedOrigin === undefined
  ? spawn(resolve(root, "node_modules/.bin/astro"), ["dev", "--host", "127.0.0.1", "--port", String(port)], { cwd: root, stdio: "ignore" })
  : null;
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
    }
    await sleep(100);
  }
  throw new Error(`advanced image acceptance server did not become ready at ${origin}`);
}

const fixtureDir = resolve(root, "quality/fixtures/image-metadata");
const fixtureNames = [
  "workspace-base-4x4.png",
  "workspace-overlay-red-2x2.png",
  "workspace-stitch-a-8x6.png",
  "workspace-stitch-b-8x6.png",
  "workspace-stitch-ambiguous-8x6.png",
  "workspace-slice-10x4.png",
  "workspace-document-8x6.png",
];
const fixtureBuffers = Object.fromEntries(await Promise.all(fixtureNames.map(async (name) => [name, await readFile(resolve(fixtureDir, name))])));

function payload(name) {
  return { name, mimeType: "image/png", buffer: fixtureBuffers[name] };
}

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const enginePage = await context.newPage();
  await enginePage.goto(origin, { waitUntil: "networkidle" });

  const engine = await enginePage.evaluate(async (fixtures) => {
    const advanced = await import("/src/engines/image/advanced-workspace.ts");
    const operations = await import("/src/engines/image/operations.ts");
    const visual = await import("/src/engines/image/visual.ts");
    const file = (name) => new File([Uint8Array.from(fixtures[name])], name, { type: "image/png" });
    const imageData = (input) => operations.imageDataFromFile(visual.assertFile(input));
    const base = file("workspace-base-4x4.png");
    const overlay = file("workspace-overlay-red-2x2.png");
    const stitchA = file("workspace-stitch-a-8x6.png");
    const stitchB = file("workspace-stitch-b-8x6.png");
    const ambiguous = file("workspace-stitch-ambiguous-8x6.png");
    const sliceSource = file("workspace-slice-10x4.png");
    const document = file("workspace-document-8x6.png");

    const watermark = await advanced.composeWatermarkLocal({
      file: base,
      overlayFile: overlay,
      text: "",
      opacity: 1,
      scale: 1,
      rotationDegrees: 0,
      xPercent: 50,
      yPercent: 50,
    });
    const beforeWatermark = await imageData(base);
    const afterWatermark = await imageData(new File([watermark.blob], "watermark.png", { type: "image/png" }));
    let changedBytes = 0;
    for (let index = 0; index < beforeWatermark.data.length; index += 1) if (beforeWatermark.data[index] !== afterWatermark.data[index]) changedBytes += 1;

    const compose = await advanced.composeImageCollectionLocal({ files: [stitchB, stitchA], mode: "horizontal", gap: 2, background: "#ffffff" });
    const sliced = await advanced.sliceImageLocal({ file: sliceSource, count: 3, direction: "horizontal" });
    const suggestion = await advanced.suggestScreenshotOverlapLocal({ first: stitchA, second: stitchB, direction: "vertical" });
    const ambiguousSuggestion = await advanced.suggestScreenshotOverlapLocal({ first: ambiguous, second: ambiguous, direction: "vertical" });
    const stitched = await advanced.stitchScreenshotsLocal({ first: stitchA, second: stitchB, direction: "vertical", overlap: suggestion.suggestedOverlap, crossOffset: 0 });

    const documentFrame = await imageData(document);
    const corners = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: documentFrame.width - 1, y: 0 },
      bottomRight: { x: documentFrame.width - 1, y: documentFrame.height - 1 },
      bottomLeft: { x: 0, y: documentFrame.height - 1 },
    };
    const perspective = await advanced.straightenPerspectiveLocal({ file: document, corners });
    const perspectiveFrame = await imageData(new File([perspective.blob], "perspective.png", { type: "image/png" }));
    const perspectiveExact = perspectiveFrame.width === documentFrame.width
      && perspectiveFrame.height === documentFrame.height
      && perspectiveFrame.data.every((value, index) => value === documentFrame.data[index]);

    return {
      watermark: {
        changedBytes,
        dimensions: [watermark.width, watermark.height],
        sourceBytes: watermark.sourceBytes,
        outputBytes: watermark.outputBytes,
        alphaPolicy: watermark.alphaPolicy,
        colorSpacePolicy: watermark.colorSpacePolicy,
        privacyClaim: watermark.privacyClaim,
        previewExportIdentity: watermark.previewExportIdentity,
      },
      compose: {
        dimensions: [compose.width, compose.height],
        outputBytes: compose.outputBytes,
        names: compose.items.map((item) => item.name),
        sourceBytes: compose.items.map((item) => item.sourceBytes),
      },
      sliced: {
        widths: sliced.items.map((item) => item.width),
        heights: sliced.items.map((item) => item.height),
        names: sliced.items.map((item) => item.filename),
        bytes: sliced.items.map((item) => item.outputBytes),
        zipEntries: sliced.zipEntries,
        zipVerified: sliced.zipVerified,
        zipCompression: sliced.zipCompression,
      },
      stitch: {
        suggestedOverlap: suggestion.suggestedOverlap,
        confidence: suggestion.confidence,
        confidenceMargin: suggestion.confidenceMargin,
        ambiguous: suggestion.ambiguous,
        ambiguousFixtureFlag: ambiguousSuggestion.ambiguous,
        dimensions: [stitched.width, stitched.height],
        order: stitched.order,
        overlap: stitched.overlap,
        manualCorrection: stitched.manualCorrection,
      },
      perspective: {
        dimensions: [perspective.width, perspective.height],
        sourceDimensions: [perspective.sourceWidth, perspective.sourceHeight],
        exactIdentityPixels: perspectiveExact,
        sampling: perspective.sampling,
        boundary: perspective.boundary,
      },
    };
  }, Object.fromEntries(Object.entries(fixtureBuffers).map(([name, bytes]) => [name, Array.from(bytes)])));

  if (engine.watermark.changedBytes < 1 || engine.watermark.previewExportIdentity !== "same-rendered-png-blob" || engine.watermark.privacyClaim !== "visual-overlay-not-redaction") throw new Error(`watermark contract failed: ${JSON.stringify(engine.watermark)}`);
  if (engine.watermark.sourceBytes < 1 || engine.watermark.outputBytes < 1 || !engine.watermark.alphaPolicy.includes("PNG") || !engine.watermark.colorSpacePolicy.includes("sRGB")) throw new Error(`watermark provenance failed: ${JSON.stringify(engine.watermark)}`);
  if (JSON.stringify(engine.compose.dimensions) !== JSON.stringify([18, 6]) || JSON.stringify(engine.compose.names) !== JSON.stringify(["workspace-stitch-b-8x6.png", "workspace-stitch-a-8x6.png"]) || engine.compose.outputBytes < 1 || engine.compose.sourceBytes.some((value) => value < 1)) throw new Error(`compose contract failed: ${JSON.stringify(engine.compose)}`);
  if (JSON.stringify(engine.sliced.widths) !== JSON.stringify([4, 3, 3]) || JSON.stringify(engine.sliced.heights) !== JSON.stringify([4, 4, 4]) || JSON.stringify(engine.sliced.zipEntries) !== JSON.stringify(engine.sliced.names) || engine.sliced.bytes.some((value) => value < 1) || !engine.sliced.zipVerified || engine.sliced.zipCompression !== "store") throw new Error(`slice/ZIP contract failed: ${JSON.stringify(engine.sliced)}`);
  if (engine.stitch.suggestedOverlap < 1 || engine.stitch.ambiguous || !engine.stitch.ambiguousFixtureFlag || !engine.stitch.manualCorrection || engine.stitch.overlap !== engine.stitch.suggestedOverlap || JSON.stringify(engine.stitch.order) !== JSON.stringify(["workspace-stitch-a-8x6.png", "workspace-stitch-b-8x6.png"])) throw new Error(`stitch contract failed: ${JSON.stringify(engine.stitch)}`);
  if (!engine.perspective.exactIdentityPixels || engine.perspective.sampling !== "inverse-homography-bilinear-rgba" || JSON.stringify(engine.perspective.dimensions) !== JSON.stringify(engine.perspective.sourceDimensions)) throw new Error(`perspective contract failed: ${JSON.stringify(engine.perspective)}`);

  const taskRequests = [];
  const trackedPage = async (route) => {
    const page = await context.newPage();
    let capture = false;
    page.on("request", (request) => {
      if (capture) taskRequests.push({ url: request.url(), method: request.method(), postData: request.postData() });
    });
    const response = await page.goto(`${origin}${route}`, { waitUntil: "networkidle" });
    if (response?.status() !== 200) throw new Error(`${route} returned ${response?.status()}`);
    capture = true;
    return page;
  };

  const screenshotPage = await trackedPage("/tools/screenshot-border-background-helper/");
  await screenshotPage.getByLabel("Modalità workspace screenshot").selectOption("watermark");
  await screenshotPage.getByLabel("Immagine base").setInputFiles(payload("workspace-base-4x4.png"));
  await screenshotPage.getByLabel(/Overlay immagine/u).setInputFiles(payload("workspace-overlay-red-2x2.png"));
  await screenshotPage.getByLabel(/Testo watermark/u).fill("");
  const xRange = screenshotPage.getByLabel("Posizione X overlay");
  const beforeX = Number(await xRange.inputValue());
  await xRange.focus();
  await xRange.press("ArrowLeft");
  if (!(Number(await xRange.inputValue()) < beforeX)) throw new Error("watermark position range did not respond to keyboard");
  await screenshotPage.getByRole("button", { name: "Aggiorna anteprima / prepara export", exact: true }).click();
  await screenshotPage.getByAltText("Anteprima esatta watermark e overlay").waitFor();
  await screenshotPage.getByText(/Dimensione file/u).waitFor();

  await screenshotPage.getByLabel("Modalità workspace screenshot").selectOption("stitch");
  await screenshotPage.getByLabel(/Screenshot 1/u).setInputFiles(payload("workspace-stitch-a-8x6.png"));
  await screenshotPage.getByLabel(/Screenshot 2/u).setInputFiles(payload("workspace-stitch-b-8x6.png"));
  await screenshotPage.getByRole("button", { name: "Analizza overlap", exact: true }).click();
  await screenshotPage.getByAltText("Anteprima overlay della zona di overlap suggerita").waitFor();
  await screenshotPage.getByRole("button", { name: "Usa questo overlap nel campo manuale", exact: true }).click();
  const appliedOverlap = Number(await screenshotPage.getByLabel("Overlap manuale").inputValue());
  if (appliedOverlap < 1) throw new Error("stitch suggestion was not copied into manual overlap");
  await screenshotPage.getByRole("button", { name: "Esporta con correzione manuale", exact: true }).click();
  await screenshotPage.getByAltText("Screenshot stitched con overlap manuale").waitFor();
  await screenshotPage.getByRole("button", { name: "Fallback: nessun overlap", exact: true }).click();
  if (Number(await screenshotPage.getByLabel("Overlap manuale").inputValue()) !== 0) throw new Error("stitch no-overlap fallback did not set zero");
  if (await screenshotPage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) throw new Error("screenshot workspace overflows at 390px");

  const contactPage = await trackedPage("/tools/contact-sheet-generator/");
  await contactPage.getByLabel("Modalità composizione immagini").selectOption("compose");
  await contactPage.getByLabel("Aggiungi immagini").setInputFiles([payload("workspace-stitch-a-8x6.png"), payload("workspace-stitch-b-8x6.png")]);
  await contactPage.getByRole("button", { name: "Su", exact: true }).nth(1).click();
  await contactPage.getByRole("button", { name: "Genera composizione nell'ordine mostrato", exact: true }).click();
  await contactPage.getByAltText("Preview esatta composizione immagini").waitFor();
  const composeRows = await contactPage.locator('[aria-label="Ordine composizione effettivo"] tbody tr').allTextContents();
  if (!composeRows[0]?.includes("workspace-stitch-b-8x6.png") || !composeRows[0]?.includes("8×6")) throw new Error(`compose UI order/dimensions mismatch: ${JSON.stringify(composeRows)}`);

  await contactPage.getByLabel("Modalità composizione immagini").selectOption("slice");
  await contactPage.getByLabel("Immagine da dividere").setInputFiles(payload("workspace-slice-10x4.png"));
  await contactPage.getByLabel("Numero slice").fill("3");
  await contactPage.getByRole("button", { name: "Genera preview list e ZIP STORE", exact: true }).click();
  const sliceRows = contactPage.locator('[aria-label="Preview slice incluse nel ZIP"] tbody tr');
  await sliceRows.first().waitFor();
  if (await sliceRows.count() !== 3) throw new Error("slice UI preview did not contain exactly 3 outputs");
  const [zipDownload] = await Promise.all([contactPage.waitForEvent("download"), contactPage.getByRole("link", { name: /Scarica ZIP con 3 slice/u }).click()]);
  const zipPath = await zipDownload.path();
  if (zipPath === null) throw new Error("slice ZIP download has no local path");
  const zipBytes = await readFile(zipPath);
  if (zipBytes[0] !== 0x50 || zipBytes[1] !== 0x4b) throw new Error("slice ZIP download does not have PK signature");
  if (await contactPage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) throw new Error("contact/compose workspace overflows at 390px");

  const perspectivePage = await trackedPage("/tools/image-crop/");
  await perspectivePage.locator('article[data-tool-page="image-crop"] input[type="file"]').first().setInputFiles(payload("workspace-document-8x6.png"));
  await perspectivePage.getByRole("button", { name: "Prospettiva documento", exact: true }).click();
  const boundary = perspectivePage.locator('[data-perspective-boundary="true"]');
  await boundary.waitFor();
  const topLeftX = perspectivePage.getByLabel("topLeft X");
  const beforeCorner = Number(await topLeftX.inputValue());
  await boundary.focus();
  await boundary.press("ArrowRight");
  if (!(Number(await topLeftX.inputValue()) > beforeCorner)) throw new Error("perspective corner did not respond to keyboard ArrowRight");
  await perspectivePage.getByRole("button", { name: "Esporta prospettiva PNG verificata", exact: true }).click();
  await perspectivePage.locator('[data-result-class="image"]').last().waitFor();
  if (await perspectivePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) throw new Error("perspective workspace overflows at 390px");

  const unsafeRequests = taskRequests.filter((request) => {
    const local = request.url.startsWith(origin) || request.url.startsWith("blob:") || request.url.startsWith("data:");
    return !local || request.method !== "GET" || (request.postData ?? "") !== "";
  });
  if (unsafeRequests.length > 0) throw new Error(`advanced image workspace emitted external/write/body requests: ${JSON.stringify(unsafeRequests)}`);

  const receipt = {
    schemaVersion: 1,
    status: "PASS",
    tickets: [298, 299, 301, 302],
    engine,
    browser: {
      viewport: "390x844",
      watermarkKeyboard: true,
      watermarkExactBlobPreview: true,
      stitchSuggestionPreview: true,
      stitchManualCorrection: true,
      stitchZeroOverlapFallback: true,
      composeReorderPreview: true,
      slicePreviewZipDownload: true,
      perspectiveKeyboardCornerControl: true,
      noHorizontalOverflow: true,
    },
    network: "LOCAL routes; after task start only same-origin GET/blob/data requests and no task-content request bodies",
  };
  const receiptDir = resolve(root, "quality/receipts/image-advanced-workspace");
  await mkdir(receiptDir, { recursive: true });
  await writeFile(resolve(receiptDir, "browser-acceptance.json"), `${JSON.stringify(receipt, null, 2)}\n`);
  await browser.close();
  console.log("advanced image workspace acceptance PASS: watermark, compose/slice ZIP, safe stitching, perspective, 390px keyboard/local checks");
} finally {
  server?.kill("SIGTERM");
}
