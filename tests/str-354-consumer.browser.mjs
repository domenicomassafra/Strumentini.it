/** STR-354: inspect the actual compiled anonymous Home on five viewports.
 * Run from repository root after `npm run build`: node tests/str-354-consumer.browser.mjs
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve("dist");
const mime = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2",
};
const server = createServer(async (request, response) => {
  try {
    if (!["GET", "HEAD"].includes(request.method)) return response.writeHead(405).end();
    const path = new URL(request.url, "http://127.0.0.1").pathname;
    const filename = resolve(root, `.${decodeURIComponent(path)}`, path.endsWith("/") ? "index.html" : "");
    const rel = relative(root, filename);
    if (rel === ".." || rel.startsWith(`..${sep}`)) return response.writeHead(403).end();
    let contentType = mime[extname(filename)] ?? "application/octet-stream";
    const body = await readFile(filename).catch(async (error) => {
      if (extname(filename) !== "" || error.code !== "EISDIR" && error.code !== "ENOENT") throw error;
      // The command palette links to extensionless routes; the static artifact
      // stores their content in /tools/<slug>/index.html.
      contentType = "text/html";
      return readFile(resolve(filename, "index.html"));
    });
    response.writeHead(200, { "Content-Type": contentType });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch { response.writeHead(404).end(); }
});

let browser;
try {
  await new Promise((ok, fail) => {
    server.once("error", fail);
    server.listen(0, "127.0.0.1", ok);
  });
  const address = server.address();
  assert(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
  const session = await browser.newContext();
  const outgoing = [];
  const pageErrors = [];
  await session.route("**/*", async (route) => {
    const request = route.request();
    if (new URL(request.url()).origin !== origin || !["GET", "HEAD"].includes(request.method())) {
      outgoing.push(`${request.method()} ${request.url()}`);
      await route.abort();
      return;
    }
    await route.continue();
  });
  const page = await session.newPage();
  page.setDefaultTimeout(30_000);
  page.on("pageerror", (error) => pageErrors.push(error.message));

  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 850 });
    assert.equal((await page.goto(origin + "/", { waitUntil: "networkidle" }))?.status(), 200);
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      searchEnd: document.querySelector("[data-search-open]")?.getBoundingClientRect().bottom,
      fileStart: document.querySelector("[data-home-file-entry]")?.getBoundingClientRect().top,
    }));
    assert(!layout.overflow, `${width}px: home has horizontal overflow`);
    assert(layout.searchEnd < layout.fileStart, `${width}px: search/file visual order inverted`);
    await page.locator("[data-search-open]").click();
    await page.locator("[data-search-input]").fill("utm builder");
    const searchChoice = page.locator('[data-search-dialog] a[href="/tools/utm-builder"]');
    await searchChoice.waitFor();
    await page.locator("[data-search-input]").press("Enter");
    await page.waitForURL((url) => url.pathname.replace(/\/$/u, "") === "/tools/utm-builder", { timeout: 4000 });
    assert.equal(new URL(page.url()).pathname.replace(/\/$/u, ""), "/tools/utm-builder");
    await page.getByRole("textbox", { name: "URL di destinazione" }).fill("https://example.org/home354");
    await page.getByRole("textbox", { name: "Sorgente" }).fill("home354");
    await page.getByRole("textbox", { name: "Mezzo" }).fill("email");
    await page.getByRole("textbox", { name: "Campagna" }).fill("test354");
    await page.getByRole("button", { name: "Crea URL" }).click();
    await page.locator('[data-result-class="text-code"]').waitFor();
    assert.match(await page.locator('[data-result-class="text-code"]').innerText(), /utm_source=home354/u);

    await page.goto(origin + "/", { waitUntil: "networkidle" });
    const privateContents = `UNSUPPORTED_PRIVATE_354_${width}`;
    await page.locator("[data-home-file-picker]").setInputFiles({
      name: "non-supportato.xyz", mimeType: "application/octet-stream",
      buffer: Buffer.from(privateContents),
    });
    await page.locator("[data-home-file-status]").getByText(/Formato non riconosciuto/u).waitFor();
    assert.equal(await page.locator("[data-home-file-action-format]:visible").count(), 0);
    const fallback = page.locator("[data-home-file-fallback]");
    assert(await fallback.isVisible(), `${width}px: unsupported file has no reachable fallback`);
    await fallback.click();
    assert.equal(new URL(page.url()).pathname, "/strumenti/");
    assert(outgoing.every((item) => !item.includes(privateContents)), `${width}px: attempted file exfiltration`);
  }
  assert.deepEqual(outgoing, [], "Home/task journey attempted a nonlocal request or a write");
  assert.deepEqual(pageErrors, [], "unexpected browser exceptions");
  console.log("STR-354 PASS: anonymous Home search -> real local output, unsupported file -> catalog, 320/390/768/1024/1440, no outbound writes");
} finally {
  await browser?.close();
  server.close();
}
