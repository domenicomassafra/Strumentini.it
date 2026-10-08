import { chromium, firefox, webkit } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.STRUMENTINI_TRANSFORM_DOWNLOAD_PORT ?? 18430);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid acceptance port");
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
const cases = [
  { id: "json-formatter", input: '{ "x": "è" }', extension: ".json", type: "json" },
  { id: "xml-formatter-validator", input: "<root><item>café</item></root>", extension: ".xml", type: "xml" },
  { id: "css-minifier", input: 'p { content: "a b"; color: red; }', extension: ".css", type: "css" },
  { id: "html-minifier", input: '<p>café <strong>hello</strong></p>', extension: ".html", type: "html" },
  { id: "css-minifier", input: 'p{content:"a b";color:red}a{margin:0}', extension: ".css", type: "css", mode: "prettify" },
  { id: "html-minifier", input: '<div><p>café <strong>hello</strong></p><p>ancora</p></div>', extension: ".html", type: "html", mode: "prettify" },
];

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt++) {
    try { if ((await fetch(origin)).ok) return; } catch {}
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error("Static browser preview did not start");
}

let checked = 0;
try {
  await waitForServer();
  for (const [browserName, type] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await type.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    try {
      for (const example of cases) {
        const page = await context.newPage();
        const offsite = [];
        const errors = [];
        page.on("request", (req) => { if (!req.url().startsWith(origin) && !req.url().startsWith("blob:") && !req.url().startsWith("data:")) offsite.push(req.url()); });
        page.on("pageerror", (error) => errors.push(String(error)));
        let response;
        // Local static server/navigation can occasionally report a transient
        // non-200 during multi-engine runs under high CPU load. A bounded
        // retry still fails closed when the built route is genuinely absent.
        for (let attempt = 0; attempt < 3; attempt += 1) {
          response = await page.goto(`${origin}/tools/${example.id}/`, { waitUntil: "networkidle" });
          if (response?.status() === 200) break;
          await page.waitForTimeout(150);
        }
        if (response?.status() !== 200) throw new Error(`${browserName}/${example.id}: built route did not return 200 (observed ${String(response?.status())})`);
        await page.locator("form textarea").first().fill(example.input);
        if (example.mode !== undefined) await page.locator("form select").first().selectOption(example.mode);
        if (example.mode === "prettify") {
          const button = await page.locator("form button[type=submit]").innerText();
          if (button.trim() !== `Formatta ${example.type.toUpperCase()}`) throw new Error(`${browserName}/${example.id}: misleading action label for readable mode`);
        }
        await page.locator("form button[type=submit]").click();
        const downloadButton = page.locator('[data-result-action="download"]');
        await downloadButton.waitFor({ timeout: 15000 });
        const downloadEvent = page.waitForEvent("download");
        await downloadButton.click();
        const download = await downloadEvent;
        if (!download.suggestedFilename().endsWith(example.extension)) throw new Error(`${browserName}/${example.id}: downloaded summary instead of raw format`);
        const bytes = await readFile(await download.path());
        const value = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        if (value.startsWith('{"risultato"') || value.includes('"engineVersion"')) throw new Error(`${browserName}/${example.id}: serialized metadata was downloaded`);
        if (example.type === "json" && JSON.parse(value).x !== "è") throw new Error("JSON data changed");
        if (example.type === "xml" && !value.includes("<item>café</item>")) throw new Error("XML text changed");
        if (example.type === "css" && (!value.includes(example.mode === "prettify" ? 'content: "a b"' : 'content:"a b"') || !value.includes(example.mode === "prettify" ? "color: red" : "color:red"))) throw new Error("CSS semantics changed");
        if (example.type === "html" && !value.includes("<strong>hello</strong>")) throw new Error("HTML content changed");
        if (example.mode === "prettify" && !value.includes("\n")) throw new Error(`${browserName}/${example.id}: requested readable formatting missing`);
        const summary = await page.locator(".gutter").last().innerText();
        if (!summary.includes(`Byte output trasformato (UTF-8)`) || !summary.includes(String(bytes.byteLength))) throw new Error(`${browserName}/${example.id}: byte count missing or incorrect`);
        if (offsite.length > 0 || errors.length > 0) throw new Error(`${browserName}/${example.id}: unintended network or runtime errors ${JSON.stringify({ offsite, errors })}`);
        if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)) throw new Error(`${browserName}/${example.id}: 390px horizontal overflow`);
        checked++;
        await page.close();
      }
      console.log(`${browserName}: ${cases.length}/${cases.length} transformed text downloads PASS`);
    } finally {
      await context.close();
      await browser.close();
    }
  }
  console.log(`ticket 59 raw transform acceptance: ${checked}/${cases.length * 3} PASS`);
} finally {
  server.kill("SIGTERM");
}
