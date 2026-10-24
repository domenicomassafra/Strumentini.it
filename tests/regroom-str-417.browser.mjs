/** STR-417: compiled browser AES-256 round-trip, reopened with independent PDF.js.
 * The static server runs on Studio; reverse SSH forwards MiniPC browser loopback.
 * Connects to the existing automation-browser CDP; does not launch Chrome.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const root = resolve(import.meta.dirname, "..");
const port = 18417;
const base = `http://127.0.0.1:${port}`;
const password = "legit-STR417-browser";
const original = fileURLToPath(new URL("../quality/fixtures/pdf-gold/simple-2page.pdf", import.meta.url));
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
const tunnel = spawn("ssh", ["-N", "-o", "BatchMode=yes", "-o", "ExitOnForwardFailure=yes",
  "-R", `127.0.0.1:${port}:127.0.0.1:${port}`, "minipc"], { stdio: "ignore" });
let browser, context, page;
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

async function readWithIndependentParser(bytes, credential) {
  const task = getDocument({ data: Uint8Array.from(bytes), ...(credential ? { password: credential } : {}), useSystemFonts: true });
  try {
    const pdf = await task.promise;
    const pages = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const content = await (await pdf.getPage(number)).getTextContent();
      pages.push(content.items.flatMap((item) => "str" in item ? [item.str] : []).join(" "));
    }
    return pages;
  } finally {
    await task.destroy();
  }
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
  let response;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (tunnel.exitCode !== null) throw new Error("MiniPC reverse SSH forwarding failed");
    try {
      response = await page.goto(base + "/tools/pdf-password-check-remove/", { waitUntil: "networkidle", timeout: 4_000 });
      if (response?.status() === 200) break;
    } catch { /* Reverse forwarding may still be starting. */ }
    if (attempt === 39) throw new Error("Compiled route unreachable from MiniPC automation browser");
    await new Promise((resolveDone) => setTimeout(resolveDone, 150));
  }
  assert.equal(response?.status(), 200);
  await waitHydrated();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), "no horizontal overflow at 390px");
  const mode = page.locator("select").filter({ has: page.locator('option[value="protect"]') });
  await setInput(await readFile(original));
  await mode.selectOption("protect");
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Proteggi con AES-256" }).click();
  const encrypted = await download("protetto-aes256.pdf");
  const lockedSource = encrypted.toString("latin1");
  assert.match(lockedSource, /\/Encrypt\s/u);
  assert.match(lockedSource, /\/R\s+6\b/u, "encrypted download uses revision R6");
  assert.match(lockedSource, /\/V\s+5\b/u, "encrypted download uses AES-256");
  await assert.rejects(readWithIndependentParser(encrypted));
  await assert.rejects(readWithIndependentParser(encrypted, "sbagliata"));
  const lockedPages = await readWithIndependentParser(encrypted, password);
  assert.equal(lockedPages.length, 2);
  assert.match(lockedPages.join(" "), /alpha[\s\S]*beta/u);

  await setInput(encrypted);
  await mode.selectOption("remove");
  await page.locator('input[type="password"]').fill("sbagliata");
  await page.getByRole("button", { name: "Sblocca o copia PDF" }).click();
  await page.getByText(/Password PDF non corretta/u).first().waitFor({ timeout: 30_000 });
  assert.equal(await page.locator('[data-result-class="pdf"]').count(), 0, "wrong password never produces output");
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sblocca o copia PDF" }).click();
  const decrypted = await download("sbloccato.pdf");
  assert.doesNotMatch(decrypted.toString("latin1"), /\/Encrypt\s/u);
  const unlockedPages = await readWithIndependentParser(decrypted);
  assert.equal(unlockedPages.length, 2);
  assert.match(unlockedPages.join(" "), /alpha[\s\S]*beta/u);
  assert.deepEqual(exceptions, []);
  assert.deepEqual(offsite, []);
  console.log("STR417_COMPILED_BROWSER_PASS", JSON.stringify({
    inputBytes: (await readFile(original)).length, encryptedBytes: encrypted.length,
    decryptedBytes: decrypted.length, pages: 2, cipher: "AES-256 R6",
    encryptedSha256: createHash("sha256").update(encrypted).digest("hex"),
    decryptedSha256: createHash("sha256").update(decrypted).digest("hex"),
    independentParser: "PDF.js", incorrectPassword: "REJECTED", offsiteRequests: offsite.length,
    browser: "existing MiniPC automation Chrome via reverse SSH loopback", physicalMobile: "NOT_RUN",
  }));
} finally {
  await page?.close().catch(() => undefined);
  await context?.close().catch(() => undefined);
  await browser?.close().catch(() => undefined);
  tunnel.kill("SIGTERM");
  server.kill("SIGTERM");
}
