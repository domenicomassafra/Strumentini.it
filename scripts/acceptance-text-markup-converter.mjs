import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = 18154;
const suppliedOrigin = process.env.TEXT_MARKUP_ACCEPTANCE_ORIGIN?.replace(/\/$/u, "");
const origin = suppliedOrigin ?? `http://127.0.0.1:${port}`;
const server = suppliedOrigin === undefined
  ? spawn(resolve(root, "node_modules/.bin/astro"), ["dev", "--host", "127.0.0.1", "--port", String(port)], {
      cwd: root,
      stdio: "ignore",
    })
  : null;

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
    }
    await sleep(100);
  }
  throw new Error(`acceptance server did not become ready at ${origin}`);
}

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  const taskRequests = [];
  let capture = false;
  page.on("request", (request) => {
    if (capture) taskRequests.push({ url: request.url(), method: request.method(), postData: request.postData() });
  });

  const response = await page.goto(`${origin}/tools/text-markup-converter/`, { waitUntil: "networkidle" });
  if (response?.status() !== 200) throw new Error(`route returned HTTP ${response?.status()}`);
  await page.locator('[data-tool-page="text-markup-converter"][data-runtime="LOCAL"][data-network="forbidden"]').waitFor();
  capture = true;

  const form = page.locator("article[data-tool-page] form").first();
  const mode = form.locator("select").first();
  const source = form.locator("textarea").first();
  const submit = form.locator("button[type='submit']").first();
  await submit.click();
  await page.locator('.result-panel[data-state="success"] [data-sanitized-preview="true"] h1').waitFor();

  await mode.selectOption("html-to-markdown");
  await source.fill('<h2>Safe</h2><script>alert(1)</script><p onclick="alert(2)">ok <a href="jav&#x61;script:alert(3)">link</a></p><pre> a\n  b </pre>');
  await submit.click();
  const sanitized = page.locator('[data-sanitized-preview="true"]');
  await sanitized.locator("h2").waitFor();
  if (await sanitized.locator("script, iframe, object, embed, style, template").count() !== 0) throw new Error("active HTML survived sanitized preview");
  if (await sanitized.locator("[onclick], [onerror], [onload]").count() !== 0) throw new Error("event handler survived sanitized preview");
  if (await sanitized.locator('a[href^="javascript:"]').count() !== 0) throw new Error("unsafe javascript URL survived sanitized preview");
  if (!(await sanitized.textContent())?.includes("Safe")) throw new Error("safe visible HTML text was lost from preview");

  const downloadButton = page.locator('button[data-result-action="download"]');
  const [download] = await Promise.all([page.waitForEvent("download"), downloadButton.click()]);
  if (download.suggestedFilename() !== "documento-convertito.md") throw new Error(`unexpected Markdown filename: ${download.suggestedFilename()}`);
  const downloadPath = await download.path();
  if (downloadPath === null) throw new Error("download has no local path");
  const downloadedMarkdown = await readFile(downloadPath, "utf8");
  if (/javascript:|alert\(/iu.test(downloadedMarkdown)) throw new Error("unsafe active content survived Markdown artifact");
  if (!downloadedMarkdown.includes("```\n a\n  b \n```")) throw new Error("preformatted whitespace was not preserved in downloaded Markdown");

  await mode.selectOption("markdown-to-html");
  await source.fill("<img src=x onerror=alert(1)>\n\n# Titolo");
  await submit.click();
  await sanitized.locator("h1").waitFor();
  if (await sanitized.locator("img").count() !== 0) throw new Error("raw Markdown HTML became a live image element");
  const previewText = await sanitized.textContent();
  if (!previewText?.includes("<img src=x onerror=alert(1)>") || !previewText.includes("Titolo")) throw new Error("escaped raw Markdown HTML or heading missing from preview");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflow) throw new Error("horizontal overflow at 390px");
  const unsafeRequests = taskRequests.filter((request) => !request.url.startsWith(origin) || request.method !== "GET" || (request.postData ?? "") !== "");
  if (unsafeRequests.length > 0) throw new Error(`converter emitted external/write/body requests: ${JSON.stringify(unsafeRequests)}`);

  await page.close();
  await context.close();
  await browser.close();
  console.log("text-markup converter browser acceptance PASS: 390px, XSS-safe preview, pre whitespace, Markdown download, LOCAL network contract");
} finally {
  server?.kill("SIGTERM");
}
