import { strict as assert } from "node:assert";
import { spawn, execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const golden = async name => (await readFile(new URL(`../quality/fixtures/str-388/${name}`, import.meta.url), "utf8")).trimEnd();
const port = await new Promise((done, fail) => {
  const socket = createServer();
  socket.once("error", fail);
  socket.listen(0, "127.0.0.1", () => {
    const address = socket.address();
    if (address === null || typeof address === "string") return fail(new Error("no free port"));
    socket.close(() => done(address.port));
  });
});
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
async function ready() {
  for (let attempt = 0; attempt < 90; attempt++) {
    if (server.exitCode !== null) throw new Error("static server exited");
    try { if ((await fetch(`${origin}/tools/csv-sort/`, { signal: AbortSignal.timeout(1500) })).ok) return; }
    catch { /* waiting for static server */ }
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error("compiled static route not ready");
}
try {
  await ready();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    const errors = [];
    const offOrigin = [];
    page.on("pageerror", err => errors.push(err.message));
    context.on("request", req => {
      const url = req.url();
      if (!url.startsWith(origin) && !url.startsWith("blob:") && !url.startsWith("data:")) offOrigin.push(url);
    });
    async function open(route) {
      assert.equal((await page.goto(`${origin}/tools/${route}/`, { waitUntil: "domcontentloaded" }))?.status(), 200);
      await page.waitForFunction(() => [...document.querySelectorAll("astro-island")].every(island => !island.hasAttribute("ssr")));
    }
    const source = await golden("golden-mixed-locale.csv");
    await open("csv-sort");
    await page.locator("textarea").first().fill(source);
    await page.getByLabel("Posizione colonna").fill("1");
    await page.getByLabel("Confronto / tipo").selectOption("numeric");
    await page.locator("button[data-tool-run-control]").click();
    await page.locator("[data-str388-diff]").waitFor();
    assert.match(await page.locator("[data-str388-diff]").innerText(), /Léa/u);
    assert.equal(await page.locator("[data-str388-changed=true]").count() > 0, true);
    await page.locator("[data-str388-apply]").click();
    assert.equal(await page.locator("textarea").first().inputValue(), await golden("golden-sorted.csv"));
    await page.locator("[data-str388-undo]").click();
    assert.equal(await page.locator("textarea").first().inputValue(), source, "Undo restores source bytes incl Unicode/duplicates");
    assert.equal(await page.locator("[data-result-class=table]").count(), 0);

    await open("csv-filter");
    await page.locator("textarea").first().fill(source);
    await page.getByLabel("Posizione colonna").fill("2");
    await page.getByLabel("Operatore").selectOption("equals");
    await page.getByLabel("Valore").fill("ok");
    await page.locator("button[data-tool-run-control]").click();
    await page.locator("[data-str388-diff]").waitFor();
    const dlReady = page.waitForEvent("download");
    await page.locator('[data-result-action="download"]').click();
    const dl = await dlReady;
    const actual = (await readFile(await dl.path(), "utf8")).trimEnd();
    assert.equal(actual, await golden("golden-filtered.csv"));
    const oracleRows = JSON.parse(execFileSync("python3", ["-c", "import csv,json,sys;print(json.dumps(list(csv.reader(open(sys.argv[1],newline='',encoding='utf-8'),delimiter=';')),ensure_ascii=False))", await dl.path()], { encoding: "utf8" }));
    assert.equal(oracleRows[1][0], "Ada");
    assert.equal(oracleRows[2][0], "Ada");
    await page.locator("[data-str388-apply]").click();
    assert.equal(await page.locator("textarea").first().inputValue(), await golden("golden-filtered.csv"));
    await page.locator("[data-str388-undo]").click();
    assert.equal(await page.locator("textarea").first().inputValue(), source);

    await open("csv-cleaner");
    const original = Buffer.from("\ufeffnome;importo\r\n🌹 Zoë;1,5\r\n🌹 Zoë;NULL\r\n");
    await page.locator("input[type=file]").setInputFiles({ name: "origine.csv", mimeType: "text/csv", buffer: original });
    await page.getByRole("button", { name: "Pulisci CSV" }).click();
    await page.locator("[data-str388-diff]").waitFor();
    assert.match(await page.locator("[data-str388-diff]").innerText(), /Zoë/u);
    await page.locator("[data-str388-apply]").click();
    assert.match(await page.locator(".file-note").allTextContents().then(a => a.join(" ")), /origine\.clean\.csv/u);
    await page.locator("[data-str388-undo]").click();
    assert.match(await page.locator(".file-note").allTextContents().then(a => a.join(" ")), /origine\.csv/u);
    await page.getByRole("button", { name: "Pulisci CSV" }).click();
    await page.locator("[data-str388-diff]").waitFor();
    assert.equal(await page.locator("[data-str388-undo]").count(), 0);
    assert.deepEqual(errors, []);
    assert.deepEqual(offOrigin, []);
    console.log("PASS STR-388 compiled Chromium: sort/filter/clean previews, apply/undo exact source, Unicode/NULL/duplicates, Python CSV oracle, no egress");
  } finally { await browser.close(); }
} finally {
  server.kill("SIGTERM");
  await new Promise(done => {
    if (server.exitCode !== null) return done();
    server.once("exit", done);
    setTimeout(done, 1500).unref();
  });
}
