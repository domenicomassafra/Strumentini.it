// True public UI browser acceptance. Desktop Chromium with a 390x844 mobile
// viewport; reported heap snapshots are NOT physical mobile-device or peak data.
import { chromium } from "@playwright/test";
import { spawn, spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { strict as assert } from "node:assert";
import { unzipSync } from "fflate";

const root = resolve(import.meta.dirname, "..");
const evidenceRoot = resolve(root, "tests/ooxml-68-receipts");
const url = "http://127.0.0.1:18488";
const server = spawn("python3", ["-m", "http.server", "18488", "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
const modes = [
  { kind: "docx", profile: "conservative", jpeg: true, resize: false, changed: 2 },
  { kind: "pptx", profile: "balanced", jpeg: true, resize: false, changed: 2 },
  { kind: "xlsx", profile: "compact", jpeg: true, resize: true, changed: 2 },
];
let browser;
const artifacts = [];
let checks = 0;
try {
  await mkdir(evidenceRoot, { recursive: true });
  for (let i = 0; i < 75; i++) {
    try { if ((await fetch(url)).ok) break; } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const requests = [];
  const pageErrors = [];
  page.on("request", (req) => {
    if (!req.url().startsWith(url) && !req.url().startsWith("blob:") && !req.url().startsWith("data:")) requests.push(req.url());
  });
  page.on("pageerror", (err) => pageErrors.push(err.message));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const snapshot = async () => {
    const data = await cdp.send("Performance.getMetrics");
    const values = Object.fromEntries(data.metrics.filter((m) => ["JSHeapUsedSize", "JSHeapTotalSize"].includes(m.name)).map((m) => [m.name, m.value]));
    return values;
  };

  for (const { kind, profile, jpeg, resize, changed } of modes) {
    const source = resolve(root, `tests/ooxml-68-corpus/complex.${kind}`);
    const oldBytes = new Uint8Array(await readFile(source));
    assert.equal((await page.goto(url + "/tools/ooxml-media-compression/", { waitUntil: "domcontentloaded" }))?.status(), 200);
    // Astro SSR can display a file input before Preact's change handler exists.
    // Wait for the client island to finish hydration or file selection is lost.
    await page.waitForFunction(() => document.querySelector("astro-island:has([data-ooxml-source])")?.hasAttribute("ssr") === false);
    await page.locator("[data-ooxml-source]").setInputFiles(source);
    const preview = page.locator("[data-ooxml-preflight]");
    await preview.waitFor({ timeout: 15_000 });
    const before = await preview.innerText();
    for (const label of ["Immagini e media", "XML e relazioni", "Font incorporati", "Altri componenti"]) assert(before.includes(label));
    assert(before.includes("Intestazioni e directory ZIP"));
    assert.equal(await page.locator("[data-ooxml-jpeg]").isChecked(), false);
    assert.equal(await page.locator("[data-ooxml-webp]").isChecked(), false);
    assert.equal(await page.locator("[data-ooxml-resize]").isChecked(), false);
    const heapBefore = await snapshot();
    await page.locator("[data-ooxml-profile]").selectOption(profile);
    if (jpeg) await page.locator("[data-ooxml-jpeg]").check();
    if (resize) {
      await page.locator("[data-ooxml-resize]").check();
      await page.locator("[data-ooxml-max-dimension]").fill("160");
    }
    await page.getByRole("button", { name: "Comprimi media Office" }).click();
    const result = page.locator("[data-ooxml-result]");
    await result.waitFor({ timeout: 30_000 });
    const resultText = await result.innerText();
    assert(resultText.includes("Gruppi ZIP prima e dopo"));
    assert(resultText.includes("Risparmio netto"));
    assert(resultText.includes("Media modificati"));
    assert(resultText.includes("Relazioni e Content Types"));
    assert(resultText.includes(String(changed)));
    const download = page.getByRole("link", { name: /Scarica DOCX\/PPTX\/XLSX verificato/u });
    const pending = page.waitForEvent("download");
    await download.click();
    const link = await pending;
    const downloaded = new Uint8Array(await readFile(await link.path()));
    assert(link.suggestedFilename().endsWith("." + kind));
    assert(downloaded.length < oldBytes.length);
    const beforeMembers = unzipSync(oldBytes);
    const afterMembers = unzipSync(downloaded);
    assert.deepEqual(Object.keys(beforeMembers).sort(), Object.keys(afterMembers).sort());
    for (const [part, bytes] of Object.entries(beforeMembers)) {
      if (part.includes("/media/")) continue;
      assert.deepEqual(afterMembers[part], bytes, `Edited OOXML structural part: ${part}`);
    }
    const filename = resolve(evidenceRoot, `result-${profile}.${kind}`);
    await writeFile(filename, downloaded);
    const independent = spawnSync("python3", [resolve(root, "tests/ooxml-68-independent-reopen.py"), source, filename], {
      cwd: root, encoding: "utf8", timeout: 10_000,
    });
    assert.equal(independent.status, 0, independent.stderr || independent.stdout);
    const heapAfter = await snapshot();
    artifacts.push({
      fileType: kind, profile, jpegApproval: jpeg, resizeApproval: resize,
      sourceBytes: oldBytes.byteLength, resultBytes: downloaded.byteLength,
      savedBytes: oldBytes.byteLength - downloaded.byteLength,
      savingsPercent: +((oldBytes.byteLength - downloaded.byteLength) / oldBytes.byteLength * 100).toFixed(2),
      sha256: createHash("sha256").update(downloaded).digest("hex"),
      independentReopen: independent.stdout.trim(),
      chromiumDesktopEmulatedMobileViewportHeapBytes: { before: heapBefore, after: heapAfter },
    });
    checks += 20;
  }
  // Net savings cannot be invented by selecting a profile. The DOCX source's
  // PNG alone has no package-level savings in desktop Chromium on this corpus.
  // Re-run without lossy approval and confirm safe original package fallback.
  const originalDocxPath = resolve(root, "tests/ooxml-68-corpus/complex.docx");
  const originalDocx = new Uint8Array(await readFile(originalDocxPath));
  await page.goto(url + "/tools/ooxml-media-compression/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("astro-island:has([data-ooxml-source])")?.hasAttribute("ssr") === false);
  await page.locator("[data-ooxml-source]").setInputFiles(originalDocxPath);
  await page.locator("[data-ooxml-preflight]").waitFor();
  await page.locator("[data-ooxml-profile]").selectOption("conservative");
  assert.equal(await page.locator("[data-ooxml-jpeg]").isChecked(), false);
  assert.equal(await page.locator("[data-ooxml-webp]").isChecked(), false);
  assert.equal(await page.locator("[data-ooxml-resize]").isChecked(), false);
  await page.getByRole("button", { name: "Comprimi media Office" }).click();
  await page.locator("[data-ooxml-result]").waitFor();
  const unchanged = await page.locator("[data-ooxml-result]").innerText();
  assert(unchanged.toLowerCase().includes("nessuna modifica utile") && unchanged.includes("0,0%"));
  const pendingUnchanged = page.waitForEvent("download");
  await page.getByRole("link", { name: /Scarica DOCX\/PPTX\/XLSX verificato/u }).click();
  const noOpDownload = await pendingUnchanged;
  assert.deepEqual(new Uint8Array(await readFile(await noOpDownload.path())), originalDocx);
  checks += 5;
  assert.deepEqual(requests, [], "No offsite requests for media or relationships");
  assert.deepEqual(pageErrors, [], "No JavaScript exceptions");
  checks += 2;
  await page.locator("[data-ooxml-result]").screenshot({ path: resolve(evidenceRoot, "mobile-viewport-no-op-result.png") });
  const receipt = {
    ticket: 68, result: "PASS", checks, route: "/tools/ooxml-media-compression/",
    browser: "Playwright Chromium desktop, headless", browserVersion: browser.version(),
    viewport: { width: 390, height: 844 }, device: "DESKTOP mobile viewport emulation; not a physical mobile device",
    memory: "CDP point-in-time JS heap snapshots only; no physical RAM, peak memory, or device thermal proof",
    externalRequests: requests.length, pageErrors: pageErrors.length,
    artifacts, noGoldClaim: true,
    gaps: ["No real iOS/Android physical-memory trace", "No physical Office application rendering/diff", "No all-browser/WebP encoder certification"],
  };
  await writeFile(resolve(evidenceRoot, "browser-68.json"), JSON.stringify(receipt, null, 2) + "\n");
  console.log(`STR-68 UI browser and independent DOCX/PPTX/XLSX reopen: PASS (${checks} checks)`);
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
