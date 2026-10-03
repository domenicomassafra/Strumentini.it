import { chromium, webkit } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = 18129;
const origin = `http://127.0.0.1:${port}`;
const browserTarget = process.env.IMAGE_RESIZE_BROWSER ?? "chrome";
const server = spawn(
  "python3",
  ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"],
  { cwd: root, stdio: "ignore" },
);
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

try {
  await sleep(500);
  const browser = browserTarget === "webkit"
    ? await webkit.launch({ headless: true })
    : await chromium.launch({
      executablePath: browserTarget === "edge"
        ? "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
        : "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      headless: true,
    });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const scriptsBefore = [];
  const scriptsAfter = [];
  const requestsAfter = [];
  let started = false;
  let delayedLazyScript = false;
  page.on("request", (request) => {
    if (request.resourceType() === "script") {
      (started ? scriptsAfter : scriptsBefore).push(request.url());
    }
    if (started) {
      requestsAfter.push({
        url: request.url(),
        method: request.method(),
        postData: request.postData(),
      });
    }
  });

  const response = await page.goto(`${origin}/tools/image-resize/`, { waitUntil: "networkidle" });
  if (response?.status() !== 200) throw new Error(`image resize route returned ${response?.status()}`);
  await page.locator('[data-tool-page][data-runtime="LOCAL"]').waitFor();
  const webpEncodeSupported = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL("image/webp").startsWith("data:image/webp");
  });
  if (!webpEncodeSupported) {
    await page.getByText("La codifica WebP non è disponibile in questo browser; JPEG resta completamente locale.", { exact: true }).waitFor();
    const webpDisabled = await page.locator('option[value="image/webp"]').evaluate((option) => option.disabled);
    if (!webpDisabled) {
      throw new Error("WebP capability probe failed to disable unsupported output option");
    }
  }

  await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 1200;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("2D context unavailable");
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#111827");
    gradient.addColorStop(1, "#f59e0b");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolveBlob, reject) =>
      canvas.toBlob((value) => value ? resolveBlob(value) : reject(new Error("PNG fixture encode failed")), "image/png"),
    );
    const file = new File([blob], "synthetic-local.png", { type: "image/png" });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const input = document.querySelector("#image-resize-file");
    if (!(input instanceof HTMLInputElement)) throw new Error("file input missing");
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });

  await page.getByLabel("Larghezza").fill("800");
  await page.getByLabel("Altezza").fill("800");
  await page.getByLabel("Ritaglia per riempire").check();
  const primaryMime = webpEncodeSupported ? "image/webp" : "image/jpeg";
  await page.getByLabel("Formato di uscita").selectOption(primaryMime);

  await page.route("**/*.js", async (route) => {
    if (started && !delayedLazyScript) {
      delayedLazyScript = true;
      await sleep(250);
    }
    await route.continue();
  });

  started = true;
  await page.getByRole("button", { name: "Ridimensiona" }).click();
  await page.getByRole("button", { name: /^(?:Cancel|Annulla)$/u }).waitFor();
  await page.getByRole("button", { name: /^(?:Cancel|Annulla)$/u }).click();
  const cancelledAlert = page.getByRole("alert");
  await cancelledAlert.waitFor();
  if (!/annullata/u.test(await cancelledAlert.innerText())) {
    throw new Error("Cancelled operation did not surface a recoverable cancellation state");
  }
  if (!delayedLazyScript) throw new Error("Cancellation test did not exercise the lazy implementation load");

  await page.getByRole("button", { name: "Ridimensiona" }).click();
  await page.getByText("800×800", { exact: true }).waitFor();
  await page.getByRole("link", { name: "Scarica" }).waitFor();

  if (scriptsAfter.length === 0) {
    throw new Error("Expected lazy image implementation script after the first operation");
  }
  const external = requestsAfter.filter((request) => !request.url.startsWith(origin) && !request.url.startsWith("blob:"));
  if (external.length > 0) throw new Error(`Unexpected external request: ${JSON.stringify(external)}`);
  const contentLeaks = requestsAfter.filter((request) =>
    request.method !== "GET" || /synthetic-local|image\/png|1600|1200/u.test(request.postData ?? ""),
  );
  if (contentLeaks.length > 0) throw new Error(`Image task content appeared in requests: ${JSON.stringify(contentLeaks)}`);

  const href = await page.getByRole("link", { name: "Scarica" }).getAttribute("href");
  if (!href?.startsWith("blob:")) throw new Error("Download does not use a local blob URL");
  const decoded = await page.evaluate(async (url) => {
    const blob = await fetch(url).then((res) => res.blob());
    const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    const bitmap = await createImageBitmap(blob);
    const result = {
      width: bitmap.width,
      height: bitmap.height,
      type: blob.type,
      size: blob.size,
      riff: new TextDecoder().decode(bytes.subarray(0, 4)),
      webp: new TextDecoder().decode(bytes.subarray(8, 12)),
      signatureHex: [...bytes.subarray(0, 3)].map((value) => value.toString(16).padStart(2, "0")).join(""),
    };
    bitmap.close();
    return result;
  }, href);
  if (decoded.width !== 800 || decoded.height !== 800 || decoded.type !== primaryMime) {
    throw new Error(`Independent output decode failed: ${JSON.stringify(decoded)}`);
  }
  if (primaryMime === "image/webp" && (decoded.riff !== "RIFF" || decoded.webp !== "WEBP")) {
    throw new Error(`WebP signature mismatch: ${JSON.stringify(decoded)}`);
  }
  if (primaryMime === "image/jpeg" && decoded.signatureHex !== "ffd8ff") {
    throw new Error(`JPEG signature mismatch: ${JSON.stringify(decoded)}`);
  }
  const memoryPreflightText = await page.getByText(/stimati per l'elaborazione decodificata/u).innerText();

  await page.getByLabel("Contieni nell'area").check();
  await page.getByLabel("Formato di uscita").selectOption("image/jpeg");
  await page.getByRole("button", { name: "Ridimensiona" }).click();
  await page.getByText("800×600", { exact: true }).waitFor();
  const jpegHref = await page.getByRole("link", { name: "Scarica" }).getAttribute("href");
  if (!jpegHref?.startsWith("blob:")) throw new Error("JPEG download does not use a local blob URL");
  const decodedJpeg = await page.evaluate(async (url) => {
    const blob = await fetch(url).then((res) => res.blob());
    const bytes = new Uint8Array(await blob.slice(0, 3).arrayBuffer());
    const bitmap = await createImageBitmap(blob);
    const result = {
      width: bitmap.width,
      height: bitmap.height,
      type: blob.type,
      size: blob.size,
      signatureHex: [...bytes].map((value) => value.toString(16).padStart(2, "0")).join(""),
    };
    bitmap.close();
    return result;
  }, jpegHref);
  if (
    decodedJpeg.width !== 800 ||
    decodedJpeg.height !== 600 ||
    decodedJpeg.type !== "image/jpeg" ||
    decodedJpeg.signatureHex !== "ffd8ff"
  ) {
    throw new Error(`JPEG independent output verification failed: ${JSON.stringify(decodedJpeg)}`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflow) throw new Error("Mobile viewport has horizontal overflow");
  const fileInput = page.locator("#image-resize-file");
  if (!(await fileInput.isVisible())) throw new Error("Mobile Files/Photos input is not visible");

  await page.getByRole("button", { name: /^(?:Reset|Reimposta)$/u }).click();
  await page.getByText("Il risultato locale verificato apparirà qui.").waitFor();

  const corruptPng = await readFile(
    resolve(root, "quality/fixtures/image-metadata/corrupt-truncated.png"),
  );
  await page.locator("#image-resize-file").setInputFiles({
    name: "corrupt-truncated.png",
    mimeType: "image/png",
    buffer: corruptPng,
  });
  await page.getByRole("button", { name: "Ridimensiona" }).click();
  const corruptAlert = page.getByRole("alert");
  await corruptAlert.waitFor();
  if (!/danneggiata|incompleta/u.test(await corruptAlert.innerText())) {
    throw new Error("Corrupt image did not produce the recoverable decode error");
  }

  const oversizedPngHeader = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(oversizedPngHeader, 0);
  oversizedPngHeader.writeUInt32BE(13, 8);
  oversizedPngHeader.write("IHDR", 12, "ascii");
  oversizedPngHeader.writeUInt32BE(9000, 16);
  oversizedPngHeader.writeUInt32BE(9000, 20);
  await page.locator("#image-resize-file").setInputFiles({
    name: "oversized.png",
    mimeType: "image/png",
    buffer: oversizedPngHeader,
  });
  await page.getByRole("button", { name: "Ridimensiona" }).click();
  const oversizedAlert = page.getByRole("alert");
  await oversizedAlert.waitFor();
  if (!/limite locale di sicurezza|dimensioni più piccole/u.test(await oversizedAlert.innerText())) {
    throw new Error("Oversized decoded dimensions were not rejected before decode");
  }

  const receipt = {
    schemaVersion: 1,
    browser: browserTarget,
    route: "/tools/image-resize/",
    syntheticInput: { width: 1600, height: 1200, type: "image/png" },
    verifiedOutputs: {
      cover: decoded,
      jpegContain: decodedJpeg,
    },
    capabilities: {
      canvasWebpEncode: webpEncodeSupported,
    },
    memoryPreflightText,
    cancellation: "PASS",
    corruptDecode: "PASS",
    oversizedPredecode: "PASS",
    lazyScriptsAfterAction: scriptsAfter.length,
    taskContentNetworkRequests: 0,
    externalRequests: 0,
    mobileViewport: { width: 390, height: 844, horizontalOverflow: false, fileInputVisible: true },
    physicalDeviceThresholds: {
      iosSafari: "NOT_RUN",
      androidChrome: "NOT_RUN",
    },
  };
  await mkdir(resolve(root, "quality/receipts/image-resize"), { recursive: true });
  await writeFile(
    resolve(root, `quality/receipts/image-resize/browser-${browserTarget}.json`),
    `${JSON.stringify(receipt, null, 2)}\n`,
    "utf8",
  );
  await browser.close();
  console.log(
    `image resize acceptance PASS [${browserTarget}]: output=${decoded.width}x${decoded.height} ${decoded.type}, local requests only, cancel/corrupt/oversized/mobile PASS`,
  );
} finally {
  server.kill("SIGTERM");
}
