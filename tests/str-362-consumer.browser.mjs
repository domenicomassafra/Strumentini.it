// Run after npm run build. The existing #336 compiled flow performs real
// download and independent image/PDF parser reopen on two desktop engines.
// Browser mobile emulation is NOT an iOS Simulator or Android Emulator receipt.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { chromium, devices } from "@playwright/test";

const dist = resolve(import.meta.dirname, "../dist");
assert((await stat(resolve(dist, "index.html"))).isFile(), "npm run build must produce dist/index.html first");
const types = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css",
  ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".wasm": "application/wasm" };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
    const target = resolve(dist, pathname.replace(/^\/+/, ""), pathname.endsWith("/") ? "index.html" : "");
    assert(target.startsWith(dist + sep), "No path outside compiled consumer");
    const filename = (await stat(target)).isDirectory() ? resolve(target, "index.html") : target;
    response.writeHead(200, { "content-type": types[extname(filename)] ?? "application/octet-stream" });
    response.end(await readFile(filename));
  } catch { response.writeHead(404).end("Not found"); }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
try {
  const origin = "http://127.0.0.1:" + server.address().port;
  const { code, stdout, stderr } = await new Promise((done, reject) => {
    const proc = spawn(process.execPath, ["tests/str336-compiled.browser.mjs", origin], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    proc.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    proc.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    proc.once("error", reject);
    proc.once("close", (code) => done({ code, stdout, stderr }));
  });
  assert.equal(code, 0, "Compiled Photos/Files → job → download/share failed:\n" + stderr + "\n" + stdout);
  const reports = stdout.split("\n").filter((line) => line.startsWith("{")).map((line) => JSON.parse(line));
  assert.deepEqual(reports.map((report) => report.engine), ["Chromium", "WebKit"]);
  for (const report of reports) {
    assert.equal(report.result, "PASS_DESKTOP_BROWSER_MOBILE_EMULATION");
    assert.equal(report.permission, "SIMULATED_READ_DENIAL_PREVIOUS_RESULT_RETAINED");
    assert.equal(report.return, "SCRIPTED_BACKGROUND_RETURN_RETAINED");
    assert.equal(report.share, "SCRIPTED_ABORTERROR_OUTPUT_RETAINED");
    assert.equal(report.nativeSimulators, "NOT_RUN");
    assert.equal(report.pdf.pages, 2);
    assert(report.photo.bytes > 0 && report.pdf.bytes > 0);
    assert.match(report.photo.sha256, /^[a-f0-9]{64}$/);
    assert.match(report.pdf.sha256, /^[a-f0-9]{64}$/);
  }
  // #336 covers native share cancellation with a filename assertion. #362
  // also verifies the actual File bytes and the success → retained-output path.
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ ...devices["Pixel 7"], acceptDownloads: true });
    await context.addInitScript(() => {
      window.__str362Shares = [];
      Object.defineProperty(navigator, "canShare", { configurable: true, value: ({ files }) => files?.length === 1 });
      Object.defineProperty(navigator, "share", { configurable: true, value: async ({ files }) => {
        const shared = files[0];
        const bytes = new Uint8Array(await shared.arrayBuffer());
        window.__str362Shares.push({ name: shared.name, mime: shared.type, bytes: Array.from(bytes) });
        if (window.__str362Shares.length === 1) throw new DOMException("cancelled", "AbortError");
      }});
    });
    const page = await context.newPage();
    await page.goto(origin + "/tools/pdf-compression-lite/", { waitUntil: "networkidle" });
    const pdf = await readFile("quality/fixtures/pdf-gold/simple-2page.pdf");
    await page.locator("form input[type=file]").first().setInputFiles({ name: "allegato.pdf", mimeType: "application/pdf", buffer: pdf });
    await page.locator("form button[type=submit]").first().click();
    const downloadButton = page.locator('[data-result-action="download"]').first();
    await downloadButton.waitFor({ state: "visible", timeout: 30000 });
    const downloaded = page.waitForEvent("download");
    await downloadButton.click();
    const file = await downloaded;
    const downloadBytes = await readFile(await file.path());
    const shareButton = page.locator('[data-result-action="share"]').first();
    await shareButton.waitFor({ state: "visible", timeout: 15000 });
    await shareButton.click();
    await page.getByText(/Condivisione annullata/u).waitFor();
    assert(await downloadButton.isVisible(), "Cancel must not discard downloaded output");
    await shareButton.click();
    await page.getByText(/Condivisione completata/u).waitFor();
    const shares = await page.evaluate(() => window.__str362Shares);
    assert.equal(shares.length, 2);
    for (const shared of shares) {
      assert.equal(shared.name, file.suggestedFilename());
      assert.equal(shared.mime, "application/pdf");
      assert.equal(createHash("sha256").update(Buffer.from(shared.bytes)).digest("hex"),
        createHash("sha256").update(downloadBytes).digest("hex"), "Share File must contain exact downloaded bytes");
    }
    assert(await downloadButton.isVisible(), "Successful share must preserve output");
    await context.close();
  } finally { await browser.close(); }
  console.log(JSON.stringify({ ticket: "STR-362", result: "PASS_COMPILED_DESKTOP_MOBILE_EMULATION",
    engines: reports.map((report) => report.engine), nativeSimulators: "NOT_RUN",
    share: "SCRIPTED_CANCEL_AND_SUCCESS_EXACT_DOWNLOAD_BYTES",
    photos: reports.map((report) => report.photo), files: reports.map((report) => report.pdf) }));
} finally { await new Promise((done) => server.close(done)); }
