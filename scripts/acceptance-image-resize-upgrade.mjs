import { chromium, webkit } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const origin = (process.env.IMAGE_RESIZE_ORIGIN ?? "http://localhost:4331").replace(/\/$/u, "");
const browserTarget = process.env.IMAGE_RESIZE_BROWSER ?? "chrome";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const browser = browserTarget === "webkit"
  ? await webkit.launch({ headless: true })
  : await chromium.launch({
    executablePath: browserTarget === "edge"
      ? "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
      : "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });

async function decodeDownload(page) {
  const href = await page.getByRole("link", { name: "Scarica" }).getAttribute("href");
  if (!href?.startsWith("blob:")) throw new Error("Image Resize download is not a local blob URL");
  return page.evaluate(async (url) => {
    const blob = await fetch(url).then((response) => response.blob());
    const bitmap = await createImageBitmap(blob);
    try {
      return { width: bitmap.width, height: bitmap.height, type: blob.type, bytes: blob.size };
    } finally {
      bitmap.close();
    }
  }, href);
}

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const response = await page.goto(`${origin}/tools/image-resize/`, { waitUntil: "networkidle" });
  if (response?.status() !== 200) throw new Error(`image resize route returned ${response?.status()}`);

  await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 1200;
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("2D context unavailable");
    context.fillStyle = "#374151";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolveBlob, reject) =>
      canvas.toBlob((value) => value ? resolveBlob(value) : reject(new Error("fixture encode failed")), "image/png"),
    );
    const file = new File([blob], "upgrade-314.png", { type: "image/png" });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const input = document.querySelector("#image-resize-file");
    if (!(input instanceof HTMLInputElement)) throw new Error("file input missing");
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });

  const estimate = page.locator("[data-resize-estimate]");
  await estimate.filter({ hasText: "Originale 1600×1200" }).waitFor();

  await page.getByLabel("Mantieni le proporzioni originali").check();
  await page.getByLabel("Larghezza").fill("1000");
  if (await page.getByLabel("Altezza").inputValue() !== "750") {
    throw new Error("aspect lock did not derive 1000×750");
  }
  await page.getByLabel("Mantieni le proporzioni originali").uncheck();

  await page.getByLabel("Larghezza").fill("800");
  await page.getByLabel("Altezza").fill("800");
  await page.getByLabel("Ritaglia per riempire").check();
  await estimate.filter({ hasText: "Stima 800×800 con ritaglio centrale" }).waitFor();
  const webpOption = page.locator('option[value="image/webp"]');
  const canEncodeWebp = !(await webpOption.isDisabled());
  await page.getByLabel("Formato di uscita").selectOption(canEncodeWebp ? "image/webp" : "image/jpeg");
  await page.getByRole("button", { name: "Ridimensiona" }).click();
  await page.getByText("800×800", { exact: true }).waitFor();
  const cover = await decodeDownload(page);
  if (cover.width !== 800 || cover.height !== 800 || cover.type !== (canEncodeWebp ? "image/webp" : "image/jpeg")) {
    throw new Error(`cover output mismatch: ${JSON.stringify(cover)}`);
  }

  await page.getByLabel("Contieni nell'area").check();
  await page.getByLabel("Percentuale").check();
  await page.getByLabel("Scala percentuale").fill("50");
  await page.getByLabel("Formato di uscita").selectOption("image/jpeg");
  await estimate.filter({ hasText: "Stima 800×600 senza ritaglio" }).waitFor();
  await page.getByRole("button", { name: "Ridimensiona" }).click();
  await page.getByText("800×600", { exact: true }).waitFor();
  const percent = await decodeDownload(page);
  if (percent.width !== 800 || percent.height !== 600 || percent.type !== "image/jpeg") {
    throw new Error(`percent output mismatch: ${JSON.stringify(percent)}`);
  }

  await page.getByLabel("Scala percentuale").fill("125");
  await estimate.filter({ hasText: "Stima 1600×1200 senza ritaglio · ingrandimento bloccato" }).waitFor();
  await page.getByRole("button", { name: "Ridimensiona" }).click();
  await page.getByText("1600×1200", { exact: true }).waitFor();
  const noUpscale = await decodeDownload(page);
  if (noUpscale.width !== 1600 || noUpscale.height !== 1200 || noUpscale.type !== "image/jpeg") {
    throw new Error(`no-upscale output mismatch: ${JSON.stringify(noUpscale)}`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    fileInputVisible: document.querySelector("#image-resize-file") instanceof HTMLInputElement,
  }));
  if (mobile.horizontalOverflow || !mobile.fileInputVisible) {
    throw new Error(`mobile layout regression: ${JSON.stringify(mobile)}`);
  }

  const sourcePaths = [
    "src/engines/image/policy.ts",
    "src/tools/image-resize/module.ts",
    "src/tools/image-resize/types.ts",
    "src/components/tools/image-resize/ImageResizeTool.tsx",
  ];
  const identities = Object.fromEntries(await Promise.all(sourcePaths.map(async (path) => [
    path,
    sha256(await readFile(resolve(root, path), "utf8")),
  ])));
  const receipt = {
    schemaVersion: 1,
    ticket: 314,
    status: "PASS",
    browser: browserTarget,
    route: "/tools/image-resize/",
    source: { width: 1600, height: 1200, type: "image/png" },
    verifiedOutputs: { cover, percent, noUpscale },
    controls: {
      aspectLock: "PASS",
      percent: "PASS",
      liveDimensionEstimate: "PASS",
      containVsCoverCropPreview: "PASS",
      noUpscale: "PASS",
      outputFormatChoice: canEncodeWebp ? "JPEG_AND_WEBP" : "JPEG_WITH_WEBP_UNAVAILABLE",
    },
    mobile: { width: 390, height: 844, ...mobile },
    physicalDeviceEvidence: "NOT_CLAIMED",
    identities,
  };
  await mkdir(resolve(root, "quality/receipts/image-resize"), { recursive: true });
  await writeFile(
    resolve(root, `quality/receipts/image-resize/upgrade-314-${browserTarget}.json`),
    `${JSON.stringify(receipt, null, 2)}\n`,
    "utf8",
  );
  console.log(`image resize ticket 314 browser PASS [${browserTarget}]: cover + percent + aspect-lock + no-upscale + live estimate + 390px`);
} finally {
  await browser.close();
}
