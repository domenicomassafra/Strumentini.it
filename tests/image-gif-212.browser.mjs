import { chromium } from "@playwright/test";
import { readFile, realpath, unlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = 18612;
const origin = `http://127.0.0.1:${port}`;
// The isolated worker worktree uses the main checkout's node_modules symlink.
// Permit only that dependency location during this throwaway browser acceptance.
const dependencyDir = await realpath(resolve(root, "node_modules"));
const temporaryConfig = resolve(root, ".scratch", `gif-212-${process.pid}.config.mjs`);
await writeFile(temporaryConfig, `import base from "../astro.config.mjs";\nexport default { ...base, vite: { ...base.vite, server: { fs: { allow: [${JSON.stringify(root)}, ${JSON.stringify(dependencyDir)}] } } } };\n`);
const server = spawn(resolve(root, "node_modules/.bin/astro"), ["dev", "--host", "127.0.0.1", "--port", String(port), "--config", `.scratch/gif-212-${process.pid}.config.mjs`, "--force"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
let serverLog = "";
for (const stream of [server.stdout, server.stderr]) stream.on("data", (chunk) => { serverLog = (serverLog + String(chunk)).slice(-8000); });
const animatedPath = resolve(root, "spikes/heavy-local-feasibility/public/corpus/sample-animated.gif");
const stillPath = resolve(root, "quality/fixtures/image-format-matrix/source.gif");
const avifPath = resolve(root, "quality/fixtures/image-format-matrix/source.avif");

try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* not serving yet */ }
    await new Promise((done) => setTimeout(done, 125));
  }
  if (!ready) throw new Error(`Local browser fixture server did not start: ${serverLog}`);

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    const page = await context.newPage();
    const requests = [];
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("request", (request) => requests.push({ method: request.method(), url: request.url() }));
    await page.goto(`${origin}/tools/image-format-conversion/`, { waitUntil: "networkidle" });

    const animated = new Uint8Array(await readFile(animatedPath));
    const still = new Uint8Array(await readFile(stillPath));
    const avif = new Uint8Array(await readFile(avifPath));
    const inspected = await page.evaluate(async ({ animated, still, avif }) => {
      const { convertImageFormatLocal } = await import("/src/engines/image/visual-tools.ts");
      const toFile = (bytes, name, type) => new File([Uint8Array.from(bytes)], name, { type });
      const pixelData = (bitmap) => {
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(bitmap, 0, 0);
        return context.getImageData(0, 0, canvas.width, canvas.height).data;
      };
      const inspect = async (bytes, name, type) => {
        const source = toFile(bytes, name, type);
        const result = await convertImageFormatLocal({ file: source, mime: "image/png" });
        const outputSignature = Array.from(new Uint8Array(await result.blob.slice(0, 8).arrayBuffer()));
        const sourceBitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
        const outputBitmap = await createImageBitmap(result.blob);
        const a = pixelData(sourceBitmap);
        const b = pixelData(outputBitmap);
        const exact = a.length === b.length && a.every((value, index) => value === b[index]);
        const dimensions = [outputBitmap.width, outputBitmap.height];
        sourceBitmap.close();
        outputBitmap.close();
        return { kind: result.inputKind, framePolicy: result.framePolicy, decoder: result.decoder, gifSource: result.gifSource, lossNote: result.lossNote, signature: outputSignature, dimensions, pixelsExact: exact, alphaPolicy: result.alphaPolicy, verification: result.verification };
      };
      return {
        animated: await inspect(animated, "sample-animated.gif", "image/gif"),
        still: await inspect(still, "source.gif", "image/gif"),
        avif: await inspect(avif, "source.avif", "image/avif"),
      };
    }, { animated: Array.from(animated), still: Array.from(still), avif: Array.from(avif) });
    const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
    for (const [key, entry, expected] of [["animated", inspected.animated, 64], ["still", inspected.still, 2], ["avif", inspected.avif, 2]]) {
      if (JSON.stringify(entry.signature) !== JSON.stringify(pngSignature) || JSON.stringify(entry.dimensions) !== JSON.stringify([expected, expected]) || !entry.pixelsExact || !entry.verification.signature || !entry.verification.decoded) throw new Error(`${key}: output signature, dimensions or first decoded frame differs: ${JSON.stringify(entry)}`);
    }
    if (inspected.animated.gifSource?.frameCount !== 4 || JSON.stringify(inspected.animated.gifSource.frameDelaysCentiseconds) !== "[25,25,25,25]" || inspected.animated.gifSource.transparentFrameCount !== 3 || inspected.animated.framePolicy !== "first-frame-only" || !inspected.animated.lossNote.includes("animation and frame timings are lost")) throw new Error(`GIF animated policy differs: ${JSON.stringify(inspected.animated)}`);
    if (inspected.still.gifSource?.frameCount !== 1 || inspected.still.gifSource.animated !== false || inspected.still.gifSource.transparentFrameCount !== 1) throw new Error(`GIF still policy differs: ${JSON.stringify(inspected.still)}`);
    if (inspected.avif.decoder !== "browser" || inspected.avif.gifSource !== undefined) throw new Error(`AVIF capability gate changed: ${JSON.stringify(inspected.avif)}`);

    await page.locator('input[type="file"]').setInputFiles(animatedPath);
    await page.getByRole("button", { name: "Esegui in locale" }).click();
    try {
      await page.getByText("GIF originale", { exact: true }).waitFor({ timeout: 15000 });
    } catch (error) {
      console.error("Conversion route after submit:", (await page.locator("body").innerText()).slice(-3500));
      console.error("Browser errors:", errors, "island:", await page.locator("astro-island").evaluateAll((islands) => islands.map((item) => ({ component: item.getAttribute("component-url"), hydrated: item.hasAttribute("ssr"), html: item.outerHTML.slice(0, 100) }))));
      throw error;
    }
    const originalText = await page.locator('[data-result-slot="media-metrics"]').innerText();
    if (!originalText.includes("4 frame") || !originalText.includes("100 centesimi") || !originalText.includes("animazione non esportata")) throw new Error(`Misleading UI details: ${originalText}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (overflow) throw new Error("Conversion UI overflows at 390px");
    const badRequests = requests.filter((request) => !request.url.startsWith(origin) || request.method !== "GET");
    if (badRequests.length) throw new Error(`Unexpected external or non-GET requests: ${JSON.stringify(badRequests)}`);
    console.log(JSON.stringify({ status: "PASS", browser: "Chromium desktop", viewport: "390x844", conversion: { animated: inspected.animated.gifSource, still: inspected.still.gifSource, avifDecoder: inspected.avif.decoder }, dimensionsAndPixelsExact: true, signature: "PNG", ui: "4 frames, 100 centiseconds, animation discarded", noExternalRequests: true }));
  } finally {
    await browser.close();
  }
} finally {
  server.kill("SIGTERM");
  await unlink(temporaryConfig);
}
