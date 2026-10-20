import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type Browser, type Page } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const suppliedOrigin = process.env.IMAGE_RESIZE_ORIGIN?.replace(/\/$/u, "");
const origin = suppliedOrigin ?? "http://127.0.0.1:18175";
const server = suppliedOrigin === undefined
  ? spawn("python3", ["-m", "http.server", "18175", "--bind", "127.0.0.1", "--directory", "dist"], {
    cwd: root,
    stdio: "ignore",
  })
  : null;
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function waitForPage() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${origin}/tools/image-resize/`);
      if (response.ok) return;
    } catch {
      // The local static server can still be starting.
    }
    await sleep(100);
  }
  throw new Error("Image resize preview unavailable: run npm run build first.");
}

interface ImageArtifact { href: string; width: number; height: number; mime: string; bytes: number; signature: string }

async function inspectDownload(page: Page): Promise<ImageArtifact> {
  const link = page.locator(".result-panel a[download]");
  await link.waitFor();
  if (await link.count() !== 1) throw new Error("Expected exactly one verified download");
  const href = await link.getAttribute("href");
  if (!href?.startsWith("blob:")) throw new Error("Download must be a local blob");
  return page.evaluate(async (url) => {
    const response = await fetch(url);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const header = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
    const signature = Array.from(header).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    try {
      return { href: url, width: bitmap.width, height: bitmap.height, mime: blob.type, bytes: blob.size, signature };
    } finally {
      bitmap.close();
    }
  }, href);
}

function verifyArtifact(result: ImageArtifact, width: number, height: number, mime: "image/jpeg" | "image/webp") {
  const correctSignature = mime === "image/jpeg"
    ? result.signature.startsWith("ffd8ff")
    : result.signature.startsWith("52494646") && result.signature.slice(16, 24) === "57454250";
  if (result.width !== width || result.height !== height || result.mime !== mime || result.bytes === 0 || !correctSignature) {
    throw new Error(`Invalid verified artifact: ${JSON.stringify({ result, expected: [width, height, mime] })}`);
  }
}

async function verifyActualDownload(page: Page, expected: ImageArtifact) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator(".result-panel a[download]").click(),
  ]);
  const path = await download.path();
  if (path === null) throw new Error("No downloaded artifact path");
  const bytes = await readFile(path);
  if (bytes.length !== expected.bytes || bytes[0] !== (expected.mime === "image/jpeg" ? 0xff : 0x52)) {
    throw new Error("Downloaded file does not match the verified blob");
  }
}

let browser: Browser | null = null;
try {
  await waitForPage();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const response = await page.goto(`${origin}/tools/image-resize/`, { waitUntil: "networkidle" });
  if (response?.status() !== 200) throw new Error(`Resize page HTTP ${response?.status()}`);
  await page.locator("#image-resize-file").setInputFiles({
    name: "source.png",
    mimeType: "image/png",
    buffer: await readFile(resolve(root, "quality/fixtures/image-format-matrix/source.png")),
  });
  const estimate = page.locator("[data-resize-estimate]");
  await estimate.filter({ hasText: "Originale 2×2" }).waitFor();

  const panel = page.locator(".result-panel");
  async function resize(width: number, height: number, mime: "image/jpeg" | "image/webp", previousHref?: string) {
    await page.getByRole("button", { name: "Ridimensiona" }).click();
    const artifact = await inspectDownload(page);
    verifyArtifact(artifact, width, height, mime);
    if (previousHref === artifact.href) throw new Error("Previous output URL was reused");
    return artifact;
  }
  async function change(label: string, perform: () => Promise<unknown>, expectedEstimate: string, previous: ImageArtifact,
    width: number, height: number, mime: "image/jpeg" | "image/webp") {
    await perform();
    // Read immediately after the input event, before starting another resize.
    const state = await panel.getAttribute("data-state");
    const links = await panel.locator("a[download]").count();
    const details = await panel.locator('[data-result-slot="media-metrics"]').count();
    const actualEstimate = await estimate.innerText();
    if (state !== "idle" || links !== 0 || details !== 0 || !actualEstimate.includes(expectedEstimate)) {
      throw new Error(`${label}: stale artifact after input: ${JSON.stringify({ state, links, details, actualEstimate })}`);
    }
    return resize(width, height, mime, previous.href);
  }

  let current = await resize(2, 2, "image/jpeg");
  await verifyActualDownload(page, current);
  current = await change("larghezza", () => page.getByLabel("Larghezza").fill("1"), "Stima 1×1", current, 1, 1, "image/jpeg");
  await verifyActualDownload(page, current);
  current = await change("altezza", () => page.getByLabel("Altezza").fill("1"), "Stima 1×1", current, 1, 1, "image/jpeg");
  current = await change("lock on", () => page.getByLabel("Mantieni le proporzioni originali").check(), "Stima 1×1", current, 1, 1, "image/jpeg");
  current = await change("larghezza bloccata", () => page.getByLabel("Larghezza").fill("2"), "Stima 2×2", current, 2, 2, "image/jpeg");
  if (await page.getByLabel("Altezza").inputValue() !== "2") throw new Error("Aspect lock failed to derive height");
  current = await change("lock off", () => page.getByLabel("Mantieni le proporzioni originali").uncheck(), "Stima 2×2", current, 2, 2, "image/jpeg");
  current = await change("fit cover", () => page.getByLabel("Ritaglia per riempire").check(), "Stima 2×2 con ritaglio centrale", current, 2, 2, "image/jpeg");
  current = await change("no-upscale off", () => page.getByLabel("Non ingrandire oltre l'originale").uncheck(), "Stima 2×2", current, 2, 2, "image/jpeg");
  current = await change("formato", () => page.getByLabel("Formato di uscita").selectOption("image/webp"), "Stima 2×2", current, 2, 2, "image/webp");
  current = await change("qualità", () => page.getByLabel("Qualità").fill("0.78"), "Stima 2×2", current, 2, 2, "image/webp");
  current = await change("modalità percentuale", () => page.getByLabel("Percentuale", { exact: true }).check(), "Stima 1×1", current, 1, 1, "image/webp");
  current = await change("percentuale", () => page.getByLabel("Scala percentuale").fill("100"), "Stima 2×2", current, 2, 2, "image/webp");
  current = await change("modalità pixel", () => page.getByLabel("Dimensioni in pixel").check(), "Stima 2×2", current, 2, 2, "image/webp");
  current = await change("fit contain", () => page.getByLabel("Contieni nell'area").check(), "Stima 2×2 senza ritaglio", current, 2, 2, "image/webp");
  current = await change("no-upscale on", () => page.getByLabel("Non ingrandire oltre l'originale").check(), "Stima 2×2", current, 2, 2, "image/webp");
  current = await change("formato JPEG", () => page.getByLabel("Formato di uscita").selectOption("image/jpeg"), "Stima 2×2", current, 2, 2, "image/jpeg");
  current = await change("qualità JPEG", () => page.getByLabel("Qualità").fill("0.85"), "Stima 2×2", current, 2, 2, "image/jpeg");
  current = await change("altezza finale", () => page.getByLabel("Altezza").fill("1"), "Stima 1×1", current, 1, 1, "image/jpeg");
  await verifyActualDownload(page, current);
  console.log("IMAGE_RESIZE_STALE_RESULT_PASS: 17 modifiche, stima live, 0 download obsoleti, JPEG 2×2→1×1, WebP verificato");
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
