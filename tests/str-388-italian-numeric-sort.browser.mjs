/** STR-388: compiled route, real browser numeric locale sort and complete CSV download. */
import { strict as assert } from "node:assert";
import { spawn, execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const port = await new Promise((done, fail) => {
  const socket = createServer();
  socket.once("error", fail);
  socket.listen(0, "127.0.0.1", () => {
    const address = socket.address();
    if (address === null || typeof address === "string") return fail(new Error("no port"));
    socket.close(() => done(address.port));
  });
});
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });

async function ready() {
  for (let n = 0; n < 70; n++) {
    if (server.exitCode !== null) throw new Error(`static server exited ${server.exitCode}`);
    try { if ((await fetch(`${origin}/tools/csv-sort/`, { signal: AbortSignal.timeout(1000) })).ok) return; }
    catch { /* initial socket start */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("static CSV sort route not ready");
}

try {
  await ready();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    const errors = [];
    const offOrigin = [];
    page.on("pageerror", (error) => errors.push(error.message));
    context.on("request", (request) => {
      const url = request.url();
      if (!url.startsWith(origin) && !url.startsWith("blob:") && !url.startsWith("data:")) offOrigin.push(url);
    });
    assert.equal((await page.goto(`${origin}/tools/csv-sort/`, { waitUntil: "domcontentloaded" }))?.status(), 200);
    await page.waitForFunction(() => [...document.querySelectorAll("astro-island")].every((island) => !island.hasAttribute("ssr")));
    await page.locator("textarea").first().fill("nome;importo\nRosa;1,5\nAda;2\nLéa;1,25\nAda;2\nNoe;1.75");
    await page.getByLabel("Posizione colonna").fill("1");
    await page.getByLabel("Confronto / tipo").selectOption("numeric");
    await page.locator("button[data-tool-run-control]").click();
    await page.locator('[data-result-class="table"]').waitFor();
    const downloadReady = page.waitForEvent("download");
    await page.locator('[data-result-action="download"]').click();
    const download = await downloadReady;
    const bytes = await readFile(await download.path());
    const rows = JSON.parse(execFileSync("python3", ["-c", "import sys,csv,json;print(json.dumps(list(csv.reader(open(sys.argv[1],newline='',encoding='utf-8'), delimiter=';')),ensure_ascii=False))", await download.path()], { encoding: "utf8" }));
    assert.deepEqual(rows, [["nome", "importo"], ["Léa", "1,25"], ["Rosa", "1,5"], ["Noe", "1.75"], ["Ada", "2"], ["Ada", "2"]]);
    await page.getByLabel("Direzione").selectOption("desc");
    assert.equal(await page.locator('[data-result-class="table"]').count(), 0, "changing sort options invalidates old download");
    await page.locator("button[data-tool-run-control]").click();
    await page.locator('[data-result-class="table"]').waitFor();
    await page.locator("textarea").first().fill("nome;importo\nSolo;999");
    assert.equal(await page.locator('[data-result-class="table"]').count(), 0, "editing source must invalidate stale export");
    assert.ok(bytes.length > 20);
    assert.deepEqual(errors, []);
    assert.deepEqual(offOrigin, []);
    assert.equal(new URL(page.url()).search, "");
    console.log("PASS STR-388 compiled route Chromium: mixed decimals/Unicode/stable duplicates, independent CSV readback, no egress");
  } finally { await browser.close(); }
} finally {
  server.kill("SIGTERM");
  await new Promise((done) => { if (server.exitCode !== null) return done(); server.once("exit", done); setTimeout(done, 1500).unref(); });
}
