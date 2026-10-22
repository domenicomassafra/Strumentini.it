/** STR-417: compiled browser AES-256 round-trip; recheck outputs with Poppler.
 * Runs against the already-open MiniPC automation-browser CDP. Does not launch Chrome.
 */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const port = 18417;
const base = `http://127.0.0.1:${port}`;
const password = "legit-STR417-browser";
const original = fileURLToPath(new URL("../quality/fixtures/pdf-gold/simple-2page.pdf", import.meta.url));
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
let browser, context, page, temp;
const offsite = [], exceptions = [];

async function download(name) {
  const link = page.locator('[data-result-class="pdf"] a').filter({ hasText: `Scarica ${name}` }).first();
  await link.waitFor({ timeout: 30_000 });
  const [item] = await Promise.all([page.waitForEvent("download"), link.click()]);
  return await readFile(await item.path());
}

async function setInput(bytes) {
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "locale.pdf", mimeType: "application/pdf", buffer: bytes,
  });
}

async function waitHydrated() {
  await page.waitForFunction(() => [...document.querySelectorAll("astro-island")].some((island) =>
    island.getAttribute("component-url")?.includes("PdfPasswordCheckRemoveTool") && !island.hasAttribute("ssr")), null, { timeout: 20_000 });
}

try {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (server.exitCode !== null) throw Error("Compiled server exited");
    try { const response = await fetch(base + "/tools/pdf-password-check-remove/"); if (response.ok) break; }
    catch { /* Waiting for the local static server. */ }
    if (attempt === 39) throw Error("Compiled server did not start");
    await new Promise((resolveDone) => setTimeout(resolveDone, 150));
  }
  browser = await chromium.connectOverCDP(process.env.PDF417_CDP_URL ?? "http://127.0.0.1:17629");
  context = await browser.newContext({ acceptDownloads: true, viewport: { width: 390, height: 844 } });
  page = await context.newPage();
  page.on("pageerror", (error) => exceptions.push(error.message));
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith(base) && !url.startsWith("blob:") && !url.startsWith("data:")) offsite.push(url);
  });
  assert.equal((await page.goto(base + "/tools/pdf-password-check-remove/", { waitUntil: "networkidle" })).status(), 200);
  await waitHydrated();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), "no horizontal overflow at 390px");
  const mode = page.locator("select").filter({ has: page.locator('option[value="protect"]') });
  await setInput(await readFile(original));
  await mode.selectOption("protect");
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Proteggi con AES-256" }).click();
  const encrypted = await download("protetto-aes256.pdf");
  temp = await mkdtemp(join(tmpdir(), "pdf417-browser-"));
  const encryptedFile = join(temp, "locked.pdf");
  await writeFile(encryptedFile, encrypted);
  const info = execFileSync("pdfinfo", ["-upw", password, encryptedFile], { encoding: "utf8" });
  assert.match(info, /Pages:\s+2/u);
  assert.match(info, /algorithm:AES-256/u);
  assert.match(execFileSync("pdftotext", ["-upw", password, encryptedFile, "-"], { encoding: "utf8" }), /alpha[\s\S]*beta/u);
  assert.throws(() => execFileSync("pdfinfo", ["-upw", "sbagliata", encryptedFile], { stdio: "ignore" }));

  await setInput(encrypted);
  await mode.selectOption("remove");
  await page.locator('input[type="password"]').fill("sbagliata");
  await page.getByRole("button", { name: "Sblocca o copia PDF" }).click();
  await page.getByText(/Password PDF non corretta/u).first().waitFor({ timeout: 30_000 });
  assert.equal(await page.locator('[data-result-class="pdf"]').count(), 0, "wrong password never produces output");
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sblocca o copia PDF" }).click();
  const decrypted = await download("sbloccato.pdf");
  const decryptedFile = join(temp, "unlocked.pdf");
  await writeFile(decryptedFile, decrypted);
  const unlockedInfo = execFileSync("pdfinfo", [decryptedFile], { encoding: "utf8" });
  assert.match(unlockedInfo, /Pages:\s+2/u);
  assert.match(unlockedInfo, /Encrypted:\s+no/u);
  assert.match(execFileSync("pdftotext", [decryptedFile, "-"], { encoding: "utf8" }), /alpha[\s\S]*beta/u);
  assert.deepEqual(exceptions, []);
  assert.deepEqual(offsite, []);
  console.log("STR417_COMPILED_BROWSER_PASS", JSON.stringify({
    inputBytes: (await readFile(original)).length, encryptedBytes: encrypted.length,
    decryptedBytes: decrypted.length, pages: 2, cipher: "AES-256",
    incorrectPassword: "REJECTED", offsiteRequests: offsite.length,
    browser: "existing MiniPC automation Chrome", physicalMobile: "NOT_RUN",
  }));
} finally {
  await page?.close().catch(() => undefined);
  await context?.close().catch(() => undefined);
  await browser?.close().catch(() => undefined);
  if (temp) await rm(temp, { recursive: true, force: true });
  server.kill("SIGTERM");
}
