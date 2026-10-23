import { strict as assert } from "node:assert";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
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
  // Reuse the approved MiniPC automation-browser; isolate only this test's tabs.
  // MiniPC uses the approved dedicated CDP browser; CI owns its ephemeral Chromium.
  const browser = process.env.CI === "true"
    ? await chromium.launch({ headless: true })
    : await chromium.connectOverCDP("http://127.0.0.1:17629");
  const context = await browser.newContext({ acceptDownloads: true });
  try {
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
    await page.getByLabel("Direzione").selectOption("desc");
    assert.equal(await page.locator("[data-result-class=table]").count(), 0, "option change invalidates previous result");
    assert.equal(await page.locator("[data-str388-undo]").count(), 1, "sort undo persists through option changes");
    await page.locator("[data-str388-undo]").click();
    assert.equal(await page.locator("textarea").first().inputValue(), source, "Undo restores source bytes incl Unicode/duplicates");
    assert.equal(await page.locator("[data-result-class=table]").count(), 0);
    const oversizedSource = "id,score\n" + "r,1\n".repeat(100_001);
    const digest = text => createHash("sha256").update(text).digest("hex");
    // Large inputs use the real file picker path: Playwright .fill() on a 400 KiB
    // controlled textarea has a 30s typing timeout unrelated to CSV processing.
    await page.locator("input[type=file]").setInputFiles({
      name: "over-100k.csv", mimeType: "text/csv", buffer: Buffer.from(oversizedSource),
    });
    await page.waitForFunction(length => document.querySelector("textarea")?.value.length === length, oversizedSource.length, { timeout: 120_000 });
    await page.locator("button[data-tool-run-control]").click();
    // The page also has a hidden account-logout alert; only the CSV form's
    // actual refusal proves that the oversized transformation was rejected.
    const oversizedError = page.locator('.table-workbench form [data-tool-error]');
    await oversizedError.waitFor({ timeout: 120_000 });
    assert.match(await oversizedError.innerText(), /L'operazione non è riuscita|limite|troppe righe/iu, "oversized CSV must produce a visible error in the CSV tool");
    assert.equal(digest(await page.locator("textarea").first().inputValue()), digest(oversizedSource), "refusal preserves full original rows");
    assert.equal(await page.locator("[data-str388-apply]").count(), 0);
    assert.equal(await page.locator('[data-result-class="table"]').count(), 0);
    const hugeCell = "🚀" + "x".repeat(150_000);
    const hugeSource = "id,description\n1," + hugeCell;
    await page.locator("input[type=file]").setInputFiles({
      name: "huge-unicode.csv", mimeType: "text/csv", buffer: Buffer.from(hugeSource),
    });
    await page.waitForFunction(length => document.querySelector("textarea")?.value.length === length, hugeSource.length, { timeout: 120_000 });
    await page.getByLabel("Posizione colonna").fill("0");
    await page.locator("button[data-tool-run-control]").click();
    await page.locator("[data-str388-diff]").waitFor({ timeout: 120_000 });
    assert.match(await page.locator("[data-str388-diff]").innerText(), /Anteprima limitata/u);
    await page.locator("[data-str388-apply]").click();
    await page.locator("[data-str388-undo]").click();
    assert.equal(digest(await page.locator("textarea").first().inputValue()), digest(hugeSource), "huge Unicode row remains exact after undo");

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
    await page.getByLabel("Valore").fill("other");
    assert.equal(await page.locator("[data-result-class=table]").count(), 0, "filter change invalidates stale output");
    assert.equal(await page.locator("[data-str388-undo]").count(), 1, "filter undo must remain after option change");
    await page.locator("[data-str388-undo]").click();
    assert.equal(await page.locator("textarea").first().inputValue(), source);

    await open("csv-sort");
    const colliding = 'key;value\n"foo · bar";x\nfoo;"bar · x"';
    await page.locator("textarea").first().fill(colliding);
    await page.locator("button[data-tool-run-control]").click();
    await page.locator("[data-str388-diff]").waitFor();
    assert.equal(await page.locator("[data-str388-changed=true]").count(), 2, "CSV cells that display similarly must show positional changes");
    await page.locator("[data-str388-apply]").click();
    await page.locator("[data-str388-undo]").click();
    assert.equal(await page.locator("textarea").first().inputValue(), colliding);

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
  } finally {
    await context.close();
    await browser.close();
  }
} finally {
  server.kill("SIGTERM");
  await new Promise(done => {
    if (server.exitCode !== null) return done();
    server.once("exit", done);
    setTimeout(done, 1500).unref();
  });
}
