import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = 18161;
const suppliedOrigin = process.env.IMAGE_UPGRADE_ACCEPTANCE_ORIGIN?.replace(/\/$/u, "");
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
  throw new Error(`image upgrade acceptance server did not become ready at ${origin}`);
}

const transparentBuffer = await readFile(resolve(root, "quality/fixtures/image-metadata/transparent-2x2-rgba.png"));
const opaqueBuffer = await readFile(resolve(root, "quality/fixtures/image-metadata/synthetic-1x1-rgb.png"));
const rgbaBuffer = await readFile(resolve(root, "quality/fixtures/image-metadata/synthetic-2x3-rgba-text.png"));
const exifBuffer = await readFile(resolve(root, "quality/fixtures/image-metadata-segments/with-exif.png"));

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const enginePage = await context.newPage();
  await enginePage.goto(origin, { waitUntil: "networkidle" });

  const engine = await enginePage.evaluate(async ({ transparent, opaque, rgba, exif }) => {
    const image = await import("/src/engines/image/visual-tools.ts");
    const metadata = await import("/src/engines/image/strip-metadata.ts");
    const makeFile = (bytes, name, type) => new File([Uint8Array.from(bytes)], name, { type });
    const transparentPng = makeFile(transparent, "transparent.png", "image/png");
    const opaquePng = makeFile(opaque, "opaque.png", "image/png");
    const rgbaPng = makeFile(rgba, "rgba.png", "image/png");
    const exifPng = makeFile(exif, "with-exif.png", "image/png");

    let missingBackground = "";
    try {
      await image.convertImageFormatLocal({ file: transparentPng, mime: "image/jpeg", quality: 0.82 });
    } catch (error) {
      missingBackground = error instanceof Error ? error.message : String(error);
    }
    const flattened = await image.convertImageFormatLocal({ file: transparentPng, mime: "image/jpeg", quality: 0.82, background: "#123456" });

    const jpegSeed = await image.convertImageFormatLocal({ file: opaquePng, mime: "image/jpeg", quality: 0.86, background: "#ffffff" });
    const webpSeed = await image.convertImageFormatLocal({ file: opaquePng, mime: "image/webp", quality: 0.86 });
    const jpegFile = new File([jpegSeed.blob], "seed.jpg", { type: "image/jpeg" });
    const webpFile = new File([webpSeed.blob], "seed.webp", { type: "image/webp" });
    const directions = [
      ["png-jpeg", opaquePng, "image/jpeg"],
      ["png-webp", opaquePng, "image/webp"],
      ["jpeg-png", jpegFile, "image/png"],
      ["jpeg-webp", jpegFile, "image/webp"],
      ["webp-png", webpFile, "image/png"],
      ["webp-jpeg", webpFile, "image/jpeg"],
    ];
    const matrix = [];
    for (const [id, source, mime] of directions) {
      const result = await image.convertImageFormatLocal({ file: source, mime, quality: 0.83, ...(mime === "image/jpeg" ? { background: "#ffffff" } : {}) });
      const bytes = new Uint8Array(await result.blob.slice(0, 16).arrayBuffer());
      const reopened = await createImageBitmap(result.blob);
      matrix.push({
        id,
        outputMime: result.outputMime,
        width: result.width,
        height: result.height,
        reopened: [reopened.width, reopened.height],
        verification: result.verification,
        signature: Array.from(bytes),
        lossy: result.lossy,
        lossNote: result.lossNote,
      });
      reopened.close();
    }

    const stripped = await metadata.stripImageMetadataLocal({ file: exifPng });
    const compare = await image.compareImagesLocal({ first: transparentPng, second: rgbaPng, threshold: 0, alignmentPolicy: "top-left-overlap-no-stretch" });
    const contact = await image.createContactSheetLocal({ files: [rgbaPng, opaquePng], columns: 2, cellWidth: 80, cellHeight: 80, ordering: "filename-asc" });
    const icons = await image.createIconSizesLocal({ file: opaquePng, sizes: [64, 16, 32, 16] });
    const platform = await image.createPlatformImageExportLocal({ file: rgbaPng, presetId: "instagram-square" });

    return {
      missingBackground,
      flattened: {
        outputMime: flattened.outputMime,
        alphaPolicy: flattened.alphaPolicy,
        background: flattened.background,
        sourceHadAlpha: flattened.sourceHadAlpha,
        verification: flattened.verification,
      },
      matrix,
      stripped: {
        metadataFree: stripped.metadataFree,
        before: stripped.metadataGroups.before.map((group) => group.carrier),
        removed: stripped.metadataGroups.removed.map((group) => group.carrier),
        retained: stripped.metadataGroups.retained.map((group) => group.carrier),
        outputSegments: stripped.outputInventory.segments.length,
        fidelity: stripped.fidelity,
      },
      compare: {
        sameDimensions: compare.sameDimensions,
        alignmentPolicy: compare.alignmentPolicy,
        compared: [compare.comparedWidth, compare.comparedHeight],
        unmatchedPixels: compare.unmatchedPixels,
        sampledPixels: compare.sampledPixels,
        maxSampledPixels: compare.maxSampledPixels,
        threshold: compare.threshold,
        algorithm: compare.algorithm,
        diffType: compare.diffBlob.type,
      },
      contact: {
        ordering: contact.ordering,
        names: contact.sourceItems.map((item) => item.name),
        dimensions: [contact.width, contact.height],
        outputMime: contact.outputMime,
        verification: contact.verification,
      },
      icons: {
        sizes: icons.items.map((item) => item.size),
        filenames: icons.items.map((item) => item.filename),
        dimensions: icons.items.map((item) => [item.width, item.height]),
        types: icons.items.map((item) => item.outputMime),
        verified: icons.items.every((item) => item.verification.signature && item.verification.decoded && item.verification.dimensions),
        zipCompression: icons.zipCompression,
        zipEntries: icons.zipEntries,
        zipVerified: icons.zipVerified,
      },
      platform: {
        preset: platform.preset.id,
        source: platform.source,
        output: [platform.width, platform.height],
        outputMime: platform.outputMime,
        filename: platform.filename,
        verification: platform.verification,
      },
    };
  }, {
    transparent: Array.from(transparentBuffer),
    opaque: Array.from(opaqueBuffer),
    rgba: Array.from(rgbaBuffer),
    exif: Array.from(exifBuffer),
  });

  if (!engine.missingBackground.includes("JPEG_ALPHA_BACKGROUND_REQUIRED")) throw new Error(`transparent JPEG did not require explicit background: ${engine.missingBackground}`);
  if (engine.flattened.alphaPolicy !== "flattened-on-background" || engine.flattened.background !== "#123456" || engine.flattened.sourceHadAlpha !== true) throw new Error(`wrong JPEG alpha policy: ${JSON.stringify(engine.flattened)}`);
  if (!engine.flattened.verification.signature || !engine.flattened.verification.decoded || !engine.flattened.verification.dimensions) throw new Error("flattened JPEG verification incomplete");
  if (engine.matrix.length !== 6 || engine.matrix.some((entry) => entry.reopened[0] !== entry.width || entry.reopened[1] !== entry.height || !entry.verification.signature || !entry.verification.decoded || !entry.verification.dimensions || entry.lossNote.length < 20)) throw new Error(`conversion matrix verification failed: ${JSON.stringify(engine.matrix)}`);
  if (!engine.stripped.metadataFree || engine.stripped.outputSegments !== 0 || !engine.stripped.before.includes("exif") || !engine.stripped.removed.includes("exif") || engine.stripped.retained.length !== 0 || !engine.stripped.fidelity.decodedRgbaExact) throw new Error(`metadata before/after proof failed: ${JSON.stringify(engine.stripped)}`);
  if (engine.compare.alignmentPolicy !== "top-left-overlap-no-stretch" || engine.compare.sampledPixels > engine.compare.maxSampledPixels || engine.compare.diffType !== "image/png" || !engine.compare.algorithm.includes("no stretch")) throw new Error(`compare policy failed: ${JSON.stringify(engine.compare)}`);
  if (engine.contact.ordering !== "filename-asc" || JSON.stringify(engine.contact.names) !== JSON.stringify(["opaque.png", "rgba.png"]) || engine.contact.outputMime !== "image/png" || !engine.contact.verification.decoded) throw new Error(`contact-sheet ordering/verification failed: ${JSON.stringify(engine.contact)}`);
  if (JSON.stringify(engine.icons.sizes) !== JSON.stringify([16, 32, 64]) || engine.icons.zipCompression !== "store" || !engine.icons.zipVerified || JSON.stringify(engine.icons.zipEntries) !== JSON.stringify(engine.icons.filenames) || !engine.icons.verified) throw new Error(`favicon batch/ZIP contract failed: ${JSON.stringify(engine.icons)}`);
  if (engine.platform.preset !== "instagram-square" || JSON.stringify(engine.platform.output) !== JSON.stringify([1080, 1080]) || engine.platform.outputMime !== "image/png" || !engine.platform.verification.decoded) throw new Error(`platform export contract failed: ${JSON.stringify(engine.platform)}`);

  const taskRequests = [];
  const comparePage = await context.newPage();
  let capture = false;
  comparePage.on("request", (request) => {
    if (capture) taskRequests.push({ url: request.url(), method: request.method(), postData: request.postData() });
  });
  const response = await comparePage.goto(`${origin}/tools/image-compare-slider/`, { waitUntil: "networkidle" });
  if (response?.status() !== 200) throw new Error(`image compare route returned ${response?.status()}`);
  await comparePage.locator('[data-tool-page="image-compare-slider"][data-runtime="LOCAL"][data-network="forbidden"]').waitFor();
  capture = true;
  await comparePage.getByLabel("Immagine A").setInputFiles({ name: "transparent.png", mimeType: "image/png", buffer: transparentBuffer });
  await comparePage.getByLabel("Immagine B").setInputFiles({ name: "rgba.png", mimeType: "image/png", buffer: rgbaBuffer });
  await comparePage.getByRole("button", { name: "Confronta immagini", exact: true }).click();
  await comparePage.getByText(/Dimensioni diverse:/u).waitFor();
  const slider = comparePage.getByLabel("Posizione slider confronto");
  const beforeSlider = Number(await slider.inputValue());
  await slider.focus();
  await slider.press("ArrowRight");
  const afterSlider = Number(await slider.inputValue());
  if (!(afterSlider > beforeSlider)) throw new Error("compare range did not respond to keyboard ArrowRight");
  await comparePage.getByRole("button", { name: "Mostra A", exact: true }).click();
  if (Number(await slider.inputValue()) !== 0) throw new Error("keyboard alternative button did not expose image A");
  await comparePage.getByRole("button", { name: "Mostra B", exact: true }).click();
  if (Number(await slider.inputValue()) !== 100) throw new Error("keyboard alternative button did not expose image B");
  await comparePage.getByRole("button", { name: "Overlay", exact: true }).click();
  const overlay = comparePage.getByLabel("Opacità overlay immagine B");
  await overlay.focus();
  const beforeOverlay = Number(await overlay.inputValue());
  await overlay.press("ArrowLeft");
  if (!(Number(await overlay.inputValue()) < beforeOverlay)) throw new Error("overlay opacity did not respond to keyboard");
  await comparePage.getByRole("button", { name: "Diff", exact: true }).click();
  await comparePage.getByAltText("Differenza assoluta RGB nell'area sovrapposta").waitFor();
  const overflow390 = await comparePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflow390) throw new Error("image compare route horizontally overflows at 390px");

  const conversionPage = await context.newPage();
  const conversionResponse = await conversionPage.goto(`${origin}/tools/image-format-conversion/`, { waitUntil: "networkidle" });
  if (conversionResponse?.status() !== 200) throw new Error(`image conversion route returned ${conversionResponse?.status()}`);
  await conversionPage.locator('article[data-tool-page="image-format-conversion"] input[type="file"]').first().setInputFiles({ name: "transparent.png", mimeType: "image/png", buffer: transparentBuffer });
  await conversionPage.getByLabel("Formato di uscita").selectOption("image/jpeg");
  await conversionPage.locator('article[data-tool-page="image-format-conversion"] input[type="color"]').last().fill("#123456");
  await conversionPage.getByRole("button", { name: "Esegui in locale", exact: true }).click();
  await conversionPage.getByText(/flattened-on-background/u).waitFor();
  await conversionPage.getByText(/#123456/u).waitFor();
  const conversionOverflow = await conversionPage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (conversionOverflow) throw new Error("image conversion route horizontally overflows at 390px");

  const faviconPage = await context.newPage();
  const faviconResponse = await faviconPage.goto(`${origin}/tools/favicon-app-icon-size-generator/`, { waitUntil: "networkidle" });
  if (faviconResponse?.status() !== 200) throw new Error(`favicon route returned ${faviconResponse?.status()}`);
  await faviconPage.getByLabel("Immagine sorgente").setInputFiles({ name: "opaque.png", mimeType: "image/png", buffer: opaqueBuffer });
  await faviconPage.getByLabel("Dimensioni quadrate · px").fill("64,16,32,16");
  await faviconPage.getByRole("button", { name: "Genera icone verificate", exact: true }).click();
  await faviconPage.getByText("dimensione crescente", { exact: true }).waitFor();
  const rows = faviconPage.locator('[aria-label="Varianti incluse nel ZIP"] tbody tr');
  if (await rows.count() !== 3) throw new Error("favicon preview list does not contain exactly the deduplicated variants");
  const rowText = await rows.allTextContents();
  if (!rowText[0]?.includes("16×16") || !rowText[1]?.includes("32×32") || !rowText[2]?.includes("64×64")) throw new Error(`favicon preview order is not deterministic: ${JSON.stringify(rowText)}`);
  const [zipDownload] = await Promise.all([faviconPage.waitForEvent("download"), faviconPage.getByRole("button", { name: /Scarica ZIP con 3 varianti/u }).click()]);
  if (!zipDownload.suggestedFilename().endsWith("-favicon-app-icons.zip")) throw new Error(`unexpected ZIP filename: ${zipDownload.suggestedFilename()}`);
  const zipPath = await zipDownload.path();
  if (zipPath === null) throw new Error("favicon ZIP download has no local path");
  const zipBytes = await readFile(zipPath);
  if (zipBytes[0] !== 0x50 || zipBytes[1] !== 0x4b) throw new Error("favicon ZIP download does not have a ZIP signature");
  const faviconOverflow = await faviconPage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (faviconOverflow) throw new Error("favicon route horizontally overflows at 390px");

  const unsafeRequests = taskRequests.filter((request) => {
    const local = request.url.startsWith(origin) || request.url.startsWith("blob:") || request.url.startsWith("data:");
    return !local || request.method !== "GET" || (request.postData ?? "") !== "";
  });
  if (unsafeRequests.length > 0) throw new Error(`image compare emitted external/write/body requests: ${JSON.stringify(unsafeRequests)}`);

  const receipt = {
    schemaVersion: 1,
    status: "PASS",
    matrix: engine.matrix.map(({ id, outputMime, width, height, lossy }) => ({ id, outputMime, width, height, lossy })),
    alphaToJpeg: { missingBackgroundRefused: true, explicitBackground: engine.flattened.background, verified: true },
    metadata: engine.stripped,
    compare: { ...engine.compare, keyboardSlider: true, keyboardOverlay: true, buttonsExposeBoth: true, mobile390: true },
    contactSheet: engine.contact,
    favicon: { ...engine.icons, mobile390: true, downloadedZipSignature: "PK" },
    platform: engine.platform,
    network: "LOCAL route; after task start only same-origin GET assets and no task-content request bodies",
  };
  const receiptDir = resolve(root, "quality/receipts/image-upgrade-cluster");
  await mkdir(receiptDir, { recursive: true });
  await writeFile(resolve(receiptDir, "browser-acceptance.json"), `${JSON.stringify(receipt, null, 2)}\n`);
  await browser.close();
  console.log("image upgrade cluster acceptance PASS: conversion matrix + alpha policy, EXIF reinspection/pixels, compare keyboard/390px, deterministic verified exports + STORE ZIP");
} finally {
  server?.kill("SIGTERM");
}
