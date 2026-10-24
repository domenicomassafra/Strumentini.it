/** Compiled static site acceptance for STR-391. Run after npm run build. */
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
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
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function ready() {
  for (let index = 0; index < 70; index++) {
    if (server.exitCode !== null) throw new Error(`server exited ${server.exitCode}`);
    try { if ((await fetch(`${origin}/tools/csv-join/`, { signal: AbortSignal.timeout(1000) })).ok) return; }
    catch { /* wait for server startup */ }
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error("compiled CSV join route not ready");
}

try {
  await ready();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    const errors = [];
    const external = [];
    page.on("pageerror", (error) => errors.push(error.message));
    context.on("request", (request) => {
      if (!request.url().startsWith(origin) && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) external.push(request.url());
    });
    assert.equal((await page.goto(`${origin}/tools/csv-join/`, { waitUntil: "domcontentloaded" }))?.status(), 200);
    await page.waitForFunction(() => [...document.querySelectorAll("astro-island")].every((island) => !island.hasAttribute("ssr")));
    const left = page.locator("[data-str391-left]");
    const right = page.locator("[data-str391-right]");
    const sources = [await left.inputValue(), await right.inputValue()];
    assert.equal(await page.locator("[data-str391-status]").innerText(), "NOT_RUN");

    await page.locator("[data-str391-run]").click();
    await page.locator("[data-str391-result]").waitFor();
    const firstHash = await page.locator("[data-str391-hash]").innerText();
    const csvPromise = page.waitForEvent("download");
    await page.locator("[data-str391-download]").click();
    const csvDownload = await csvPromise;
    const bytes = await readFile(await csvDownload.path());
    assert.equal(sha(bytes), firstHash);
    const rows = JSON.parse(execFileSync("python3", ["-c", "import csv,json,sys;print(json.dumps(list(csv.reader(open(sys.argv[1],encoding='utf-8',newline=''))),ensure_ascii=False))", await csvDownload.path()], { encoding: "utf8" }));
    assert.deepEqual(rows, [["id", "gruppo", "id_right", "tag_right"], ["1", "si", "1", "α"], ["3", "si", "3", "γ"]]);

    const recipePromise = page.waitForEvent("download");
    await page.locator("[data-str391-save]").click();
    const recipeDownload = await recipePromise;
    const recipeBytes = await readFile(await recipeDownload.path());
    const recipe = JSON.parse(recipeBytes.toString("utf8"));
    assert.deepEqual(recipe.steps.map((step) => step.kind), ["filter", "join", "export"]);
    assert.equal(recipe.expected.outputSha256, firstHash);
    assert.equal(recipe.expected.sourceSha256.left, sha(Buffer.from(sources[0])));
    assert.equal(recipe.expected.sourceSha256.right, sha(Buffer.from(sources[1])));
    assert.ok(!recipeBytes.includes(Buffer.from(sources[0])));
    await page.locator("[data-str391-import]").setInputFiles({ name: "recipe.json", mimeType: "application/json", buffer: recipeBytes });
    assert.equal(await page.locator("[data-str391-status]").innerText(), "NOT_RUN");
    await page.locator("[data-str391-run]").click();
    await page.locator("[data-str391-result]").waitFor();
    assert.equal(await page.locator("[data-str391-hash]").innerText(), firstHash);
    await page.locator("[data-str391-replay]").click();
    await page.locator("[data-str391-status]").getByText("READY").waitFor();
    assert.equal(await page.locator("[data-str391-hash]").innerText(), firstHash);

    await page.locator("[data-str391-import]").setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from('{"version":1,"steps":[{"kind":"overwrite","path":"source.csv"}]}') });
    assert.match(await page.locator("[data-str391-error]").innerText(), /PIPELINE_INVALID/u);
    assert.equal(await page.locator("[data-str391-result]").count(), 0);
    await page.locator("[data-str391-cancel]").click();
    assert.equal(await page.locator("[data-str391-status]").innerText(), "NOT_RUN");
    assert.deepEqual([await left.inputValue(), await right.inputValue()], sources);
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log(`PASS STR-391 consumer: sha256=${firstHash}, CSV parsed independently, recipe replay stable, invalid/cancel safe, zero egress`);
  } finally { await browser.close(); }
} finally {
  server.kill("SIGTERM");
  await new Promise((done) => { if (server.exitCode !== null) return done(); server.once("exit", done); setTimeout(done, 1500).unref(); });
}
