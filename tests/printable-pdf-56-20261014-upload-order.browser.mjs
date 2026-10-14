/**
 * #56: actual public TXT->PDF route, independent PDF readback and stale local
 * File.arrayBuffer() completion. No remote calls, Gold or print-dialog claim.
 * Run after an Astro static build.
 */
import { strict as assert } from "node:assert";
import { spawn, spawnSync } from "node:child_process";
import { readFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer as createTcpServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const privateToken = "PRIVATE_STALE_UPLOAD_56_73411";
const approvedToken = "APPROVED_SECOND_UPLOAD_56_93527";

async function freePort() {
  const server = createTcpServer();
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const address = server.address();
  assert(address && typeof address !== "string");
  await new Promise((ok) => server.close(ok));
  return address.port;
}

const port = await freePort();
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"],
  { cwd: root, stdio: "ignore" });
const scratch = await mkdtemp(join(tmpdir(), "printable-56-upload-"));
let browser;
try {
  let live = false;
  for (let i = 0; i < 80; i += 1) {
    try { live = (await fetch(`${origin}/tools/printable-pdf-from-text/`)).ok; } catch { /* starting */ }
    if (live) break;
    await new Promise((ok) => setTimeout(ok, 100));
  }
  assert(live, "local compiled printable route missing");
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const unexpectedRequests = [];
  page.on("request", (request) => {
    if (!(request.url().startsWith(origin) || request.url().startsWith("blob:") || request.url().startsWith("data:"))) {
      unexpectedRequests.push(request.url());
    }
  });
  await page.addInitScript(() => {
    const nativeArrayBuffer = File.prototype.arrayBuffer;
    globalThis.__printable56 = { started: false, released: false };
    File.prototype.arrayBuffer = function () {
      if (this.name !== "private-slow.txt") return nativeArrayBuffer.call(this);
      globalThis.__printable56.started = true;
      return new Promise((resolve, reject) => {
        globalThis.__printable56.release = () => {
          globalThis.__printable56.released = true;
          nativeArrayBuffer.call(this).then(resolve, reject);
        };
      });
    };
  });
  assert.equal((await page.goto(`${origin}/tools/printable-pdf-from-text/`))?.status(), 200);
  const upload = page.locator('[data-printable-pdf] input[type="file"]');
  await upload.setInputFiles({ name: "private-slow.txt", mimeType: "text/plain", buffer: Buffer.from(privateToken) });
  await page.waitForFunction(() => globalThis.__printable56?.started === true);
  await upload.setInputFiles({ name: "approved-second.txt", mimeType: "text/plain", buffer: Buffer.from(approvedToken) });
  await page.getByRole("textbox", { name: "Contenuto" }).locator("xpath=.")
    .waitFor({ state: "visible" });
  await page.waitForFunction((expected) => document.querySelector('textarea[aria-label="Contenuto"]')?.value === expected, approvedToken);
  await page.evaluate(() => globalThis.__printable56.release());
  await page.waitForFunction(() => globalThis.__printable56.released === true);
  // A late native File read may resolve in a future microtask and flush its
  // state in the next Preact render; do not treat initial second-file success
  // as proof that the first promise cannot overwrite it.
  await page.waitForTimeout(150);
  await page.getByRole("button", { name: "Genera e verifica PDF" }).click();
  const verified = page.locator('[data-printable-result="success"]');
  await verified.waitFor({ timeout: 25000 });
  const downloading = page.waitForEvent("download");
  await verified.getByRole("link", { name: "Scarica documento-stampabile.pdf" }).click();
  const bytes = await readFile(await (await downloading).path());
  assert.equal(bytes.subarray(0, 5).toString("ascii"), "%PDF-");
  const outputPath = join(scratch, "actual-browser-download.pdf");
  await writeFile(outputPath, bytes);
  const inspect = spawnSync("python3", ["-c", String.raw`
import json, sys
from pypdf import PdfReader
from pdfminer.high_level import extract_text
path, private, approved = sys.argv[1:]
doc = PdfReader(path, strict=True)
pypdf_text = "\n".join(page.extract_text() or "" for page in doc.pages)
miner_text = extract_text(path)
print(json.dumps({"pages":len(doc.pages),"pypdfPrivate":private in pypdf_text,
 "pypdfApproved":approved in pypdf_text,"pdfminerPrivate":private in miner_text,
 "pdfminerApproved":approved in miner_text}))
`, outputPath, privateToken, approvedToken], { encoding: "utf8", timeout: 15000 });
  assert.equal(inspect.status, 0, inspect.stderr);
  const forensic = JSON.parse(inspect.stdout);
  if (process.platform === "darwin") {
    const swift = spawnSync("/usr/bin/swift", ["-e", String.raw`
import Foundation
import PDFKit
let path = CommandLine.arguments[1]
let prv = CommandLine.arguments[2]
let approved = CommandLine.arguments[3]
guard let document = PDFDocument(url: URL(fileURLWithPath: path)) else { exit(2) }
let text = document.string ?? ""
print("PDFKIT_56_PAGES=\(document.pageCount) PRIVATE=\(text.contains(prv)) APPROVED=\(text.contains(approved))")
`, outputPath, privateToken, approvedToken], { encoding: "utf8", timeout: 25000 });
    assert.equal(swift.status, 0, swift.stderr);
    forensic.pdfkit = swift.stdout.trim();
  }
  console.log(JSON.stringify({ actualPdfBytes: bytes.length, forensic, offsite: unexpectedRequests.length }));
  assert.equal(forensic.pages, 1);
  assert.equal(forensic.pypdfPrivate, false, "PRIVATE first upload leaked into real downloaded PDF");
  assert.equal(forensic.pdfminerPrivate, false);
  assert.equal(forensic.pypdfApproved, true, "newer user-selected file lost from PDF");
  assert.equal(forensic.pdfminerApproved, true);
  if (forensic.pdfkit) assert.match(forensic.pdfkit, /PRIVATE=false APPROVED=true/u);
  assert.deepEqual(unexpectedRequests, []);

  // Typing into the editor supersedes a pending native File read, too.
  await page.evaluate(() => { globalThis.__printable56.started = false; globalThis.__printable56.released = false; });
  await upload.setInputFiles({ name: "private-slow.txt", mimeType: "text/plain", buffer: Buffer.from(privateToken) });
  await page.waitForFunction(() => globalThis.__printable56.started);
  assert.equal(await page.getByRole("button", { name: "Caricamento file..." }).isDisabled(), true);
  const typed = "CURRENT_USER_TYPED_TEXT_56_112233";
  await page.getByRole("textbox", { name: "Contenuto" }).fill(typed);
  await page.evaluate(() => globalThis.__printable56.release());
  await page.waitForTimeout(150);
  assert.equal(await page.getByRole("textbox", { name: "Contenuto" }).inputValue(), typed,
    "late file read replaced a user's more recent manual edit");

  // Reset/cancel revokes an unresolved file read and any downloadable result.
  await upload.setInputFiles([]);
  await page.evaluate(() => { globalThis.__printable56.started = false; globalThis.__printable56.released = false; });
  await upload.setInputFiles({ name: "private-slow.txt", mimeType: "text/plain", buffer: Buffer.from(privateToken) });
  await page.waitForFunction(() => globalThis.__printable56.started);
  await page.getByRole("button", { name: "Azzera" }).click();
  await page.evaluate(() => globalThis.__printable56.release());
  await page.waitForTimeout(150);
  assert.equal(await page.getByRole("textbox", { name: "Contenuto" }).inputValue(), "",
    "reset did not cancel the pending stale read");
  assert.equal(await page.locator('[data-printable-result="success"]').count(), 0);

  // Refusal for a real >512 KiB upload must revoke the previous valid PDF.
  await upload.setInputFiles({ name: "too-large.txt", mimeType: "text/plain", buffer: Buffer.alloc(512 * 1024 + 1, 65) });
  await page.getByRole("alert").waitFor();
  assert.equal(await page.locator('[data-printable-result="success"]').count(), 0);
  console.log("PRINTABLE_56_ACTUAL_BROWSER_PYPDF_PDFMINER_PDFKIT_PASS");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  await rm(scratch, { recursive: true, force: true });
}
