/** #273 actual public consumer path + independent Pillow decode of its download. Run after npm run build. */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const directory = mkdtempSync(join(tmpdir(), "str273-ui-"));
const origin = "http://127.0.0.1:18273";
const server = spawn("python3", ["-m", "http.server", "18273", "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
const python = process.env.PYTHON ?? "python3";
const oracle = resolve(root, "scripts/acceptance-gif-animation-273.py");
const pillow = (...args: string[]) => {
  const result = spawnSync(python, [oracle, ...args], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
};

async function ready() {
  for (let tries = 0; tries < 100; tries++) {
    try { if ((await fetch(origin)).ok) return; } catch { /* Starting. */ }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw Error("static preview did not start");
}

let browser;
try {
  pillow("make", directory);
  await ready();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const external: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(origin) && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) external.push(request.url());
  });
  assert.equal((await page.goto(`${origin}/tools/image-format-conversion/`, { waitUntil: "networkidle" }))?.status(), 200);
  const animated = page.locator("[data-gif-animation-273]");
  await expect(animated.getByRole("button", { name: "Ricrea GIF animata in locale" })).toBeDisabled();
  const original = join(directory, "disposal-offset-loop.gif");
  await animated.locator('input[type="file"]').setInputFiles(original);
  const action = animated.getByRole("button", { name: "Ricrea GIF animata in locale" });
  await expect(action).toBeEnabled();
  await action.click();
  await expect(animated.locator("[data-gif-animation-result]")).toContainText("6 frame", { timeout: 20_000 });
  await expect(animated.locator("[data-gif-animation-result]")).toContainText("trasparenza → bianco");
  const downloading = page.waitForEvent("download");
  await animated.getByRole("link", { name: "Scarica GIF animata verificata" }).click();
  const downloaded = readFileSync(await (await downloading).path());
  assert.equal(downloaded.toString("ascii", 0, 6), "GIF89a");
  const output = join(directory, "browser-export.gif");
  writeFileSync(output, downloaded);
  assert.match(pillow("compare", original, output), /PILLOW_EXTERNAL_DECODE_PASS/u);

  // Static input is never relabeled as an animation or downloaded with the previous result.
  await animated.locator('input[type="file"]').setInputFiles(resolve(root, "quality/fixtures/image-format-matrix/source.gif"));
  await expect(animated.locator("[data-gif-animation-result]")).toHaveCount(0);
  await action.click();
  await expect(animated.getByRole("alert")).toContainText("statico");
  await expect(animated.getByRole("link", { name: "Scarica GIF animata verificata" })).toHaveCount(0);
  assert.deepEqual(external, [], "no network upload or offsite request");
  console.log("PASS STR-273 Chromium consumer GIF→GIF animated, Pillow verified downloaded frames/disposal/offset/delay/loop, static GIF refused, local-only");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  rmSync(directory, { recursive: true, force: true });
}
