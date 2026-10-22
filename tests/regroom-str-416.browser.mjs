/** Real compiled static consumer. Run after npm run build with Node 26. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, relative, extname, sep } from "node:path";
import { gunzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";

const root = resolve("dist");
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".json": "application/json" };
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url || "/", "http://localhost").pathname;
    const file = resolve(root, "." + decodeURIComponent(path), path.endsWith("/") ? "index.html" : "");
    if (file === root || relative(root, file) === ".." || relative(root, file).startsWith(".." + sep)) return res.writeHead(403).end();
    const content = await readFile(file);
    res.writeHead(200, { "Content-Type": mime[extname(file)] ?? "application/octet-stream" }).end(content);
  } catch { res.writeHead(404).end(); }
});
await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const errors = [], writes = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const origin = "http://127.0.0.1:" + server.address().port;
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (!["GET", "HEAD"].includes(route.request().method())) { writes.push(url); return route.abort(); }
    if (!url.startsWith(origin + "/") && !/^(blob|data):/u.test(url)) return route.abort();
    return route.continue();
  });
  assert.equal((await page.goto(origin + "/tools/zip-creator/")).status(), 200);
  const tool = page.locator("[data-tool-operation]").first();
  await tool.locator("input[type=file]").setInputFiles([
    { name: "hello.txt", mimeType: "text/plain", buffer: Buffer.from("HELLO ".repeat(900)) },
    { name: "world.txt", mimeType: "text/plain", buffer: Buffer.from("WORLD") },
  ]);
  await tool.locator("button[type=submit]").click();
  await tool.locator("[data-archive-416-result]").waitFor({ timeout: 20_000 });
  assert.equal(await tool.locator("[data-archive-416-result] ol li").count(), 2);
  const downloaded = page.waitForEvent("download");
  await tool.locator("[data-archive-416-download]").click();
  const zip = await readFile(await (await downloaded).path());
  // Python stdlib ZIP parser is independent from the browser's fflate consumer.
  const json = execFileSync("python3", ["-c",
    "import io,json,sys,zipfile; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); assert z.testzip() is None; print(json.dumps({n:z.read(n).decode() for n in z.namelist()}))",
  ], { input: zip, encoding: "utf8" });
  assert.deepEqual(JSON.parse(json), { "hello.txt": "HELLO ".repeat(900), "world.txt": "WORLD" });

  await tool.locator("input[value=create-gzip]").check();
  await tool.locator("input[type=file]").setInputFiles({ name: "report.txt", mimeType: "text/plain", buffer: Buffer.from("REPORT ".repeat(160)) });
  await tool.locator("button[type=submit]").click();
  await tool.locator("[data-archive-416-result]").waitFor();
  const gzipDownloaded = page.waitForEvent("download");
  await tool.locator("[data-archive-416-download]").click();
  const gz = await readFile(await (await gzipDownloaded).path());
  assert.equal(gunzipSync(gz).toString("utf8"), "REPORT ".repeat(160));

  await tool.locator("input[value=extract]").check();
  await tool.locator("input[type=file]").setInputFiles({ name: "report.txt.gz", mimeType: "application/gzip", buffer: gz });
  await tool.locator("button[type=submit]").click();
  await tool.locator("[data-archive-416-result]").waitFor();
  const extracted = page.waitForEvent("download");
  await tool.locator("[data-archive-416-download]").click();
  assert.equal((await readFile(await (await extracted).path())).toString("utf8"), "REPORT ".repeat(160));

  const evilZip = Buffer.from(zip);
  const central = evilZip.indexOf(Buffer.from([0x50, 0x4b, 1, 2]));
  assert(central >= 0);
  evilZip.writeUInt32LE(0x7fffffff, central + 24); // claimed 2 GiB bomb
  await tool.locator("input[type=file]").setInputFiles({ name: "bomb.zip", mimeType: "application/zip", buffer: evilZip });
  await tool.locator("button[type=submit]").click();
  await tool.locator("[data-tool-error]").waitFor();
  assert.match(await tool.locator("[data-tool-error]").innerText(), /limite/u);
  assert.equal(await tool.locator("[data-archive-416-download]").count(), 0, "No partial archive download");
  assert.deepEqual(writes, []);
  assert.deepEqual(errors, []);
  console.log("PASS STR-416 compiled browser 390px: ZIP/Python, GZIP/gunzip, GZIP extract, bomb refusal, no egress");
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
