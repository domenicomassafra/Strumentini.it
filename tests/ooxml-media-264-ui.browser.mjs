// Actual public Astro route, browser Blob downloads, Python independent reopens.
import { chromium } from "@playwright/test";
import { spawn, spawnSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { strict as assert } from "node:assert";
import { unzipSync } from "fflate";

const root = resolve(import.meta.dirname, "..");
const receiptDir = resolve(root, "tests/ooxml-media-receipts");
const base = "http://127.0.0.1:18487";
const server = spawn("python3", ["-m", "http.server", "18487", "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
let browser;
let checks = 0;
const artifacts = [];
try {
  for (let i = 0; i < 75; i++) {
    try { if ((await fetch(base)).ok) break; } catch { /* starting */ }
    await new Promise((ok) => setTimeout(ok, 125));
  }
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const outside = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(base) && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) outside.push(request.url());
  });
  for (const kind of ["docx", "pptx", "xlsx"]) {
    const sourcePath = resolve(root, "tests/ooxml-media-fixtures/embedded." + kind);
    const orig = new Uint8Array(await readFile(sourcePath));
    const response = await page.goto(base + "/tools/ooxml-media-compression/", { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200);
    await page.locator("[data-ooxml-source]").setInputFiles(sourcePath);
    assert.equal(await page.locator("[data-ooxml-jpeg]").isChecked(), false, "JPEG opt-in default");
    assert.equal(await page.locator("[data-ooxml-resize]").isChecked(), false, "Resize opt-in default");
    checks += 3;
    await page.locator("[data-ooxml-jpeg]").check();
    await page.locator("[data-ooxml-quality]").fill("0.65");
    await page.getByRole("button", { name: "Comprimi media Office" }).click();
    await page.locator("[data-ooxml-result]").waitFor({ timeout: 25_000 });
    const content = await page.locator("[data-ooxml-result]").innerText();
    assert.match(content, /Media modificati/u);
    assert.match(content, /Relazioni e Content Types/u);
    const action = page.getByRole("link", { name: /Scarica DOCX\/PPTX\/XLSX verificato/u });
    await action.waitFor();
    const pending = page.waitForEvent("download");
    await action.click();
    const download = await pending;
    const output = new Uint8Array(await readFile(await download.path()));
    assert(download.suggestedFilename().endsWith("." + kind));
    assert(output.byteLength < orig.byteLength);
    const before = unzipSync(orig);
    const after = unzipSync(output);
    assert.deepEqual(Object.keys(after).sort(), Object.keys(before).sort());
    for (const path of Object.keys(before).filter((p) => !p.includes("/media/"))) {
      assert.deepEqual(after[path], before[path], "Office XML/rels changed " + kind + ":" + path);
    }
    await mkdir(receiptDir, { recursive: true });
    const savedFile = resolve(receiptDir, "ui-downloaded." + kind);
    await writeFile(savedFile, output);
    const reopened = spawnSync("python3", [
      resolve(root, "tests/ooxml-media-264-independent-reopen.py"),
      savedFile, sourcePath,
    ], { cwd: root, encoding: "utf8", timeout: 10_000 });
    assert.equal(reopened.status, 0, "Independent Office reopen failed: " + (reopened.stderr || reopened.stdout));
    artifacts.push({
      type: kind, filename: download.suggestedFilename(), inputBytes: orig.byteLength,
      outputBytes: output.byteLength, savedBytes: orig.byteLength - output.byteLength,
      sha256: createHash("sha256").update(output).digest("hex"),
      independentOfficeReopen: reopened.stdout.trim(),
    });
    checks += 8;
  }
  assert.deepEqual(outside, [], "No offsite request or upload");
  checks++;
  await page.locator("[data-ooxml-result]").screenshot({ path: resolve(receiptDir, "ui-xlsx-result.png") });
  await writeFile(resolve(receiptDir, "ui-browser-264.json"), JSON.stringify({
    ticket: 264, route: "/tools/ooxml-media-compression/", browser: "Chromium",
    desktopViewport: "390x844", result: "PASS", checks, offsiteRequests: outside.length,
    jpegApproval: "explicitly checked for each real document", resizeApproval: "unchecked by default",
    artifacts, limitations: ["not a physical device", "no cross-browser encoder proof", "no Gold certification"],
  }, null, 2) + "\n");
  console.log("STR-264 PUBLIC Office UI smoke: PASS (" + checks + " checks; 3 actual Office files downloaded and independently reopened)");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
