/** STR-278 — actual compiled client on existing MiniPC automation-browser. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";

const port = 19278;
const origin = "http://127.0.0.1:" + port;
const server = spawn("python3", ["-m","http.server",String(port),"--bind","127.0.0.1","--directory","dist"], {stdio:"ignore"});
let page, context;
try {
  for (let i=0; i<100; i++) {
    if (server.exitCode !== null) throw Error("Preview server failed");
    try { if ((await fetch(origin)).ok) break; } catch { /* startup */ }
    if (i === 99) throw Error("Preview unavailable");
    await delay(200);
  }
  const browser = await chromium.connectOverCDP("http://127.0.0.1:17629", {timeout:45000});
  context = await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
  page = await context.newPage();
  const requests=[], errors=[];
  page.on("request", r => requests.push({url:r.url(),method:r.method()}));
  page.on("pageerror", e => errors.push(String(e)));
  const policy = "default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'self' blob: data:; font-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'";
  await page.route(origin+"/tools/qr-generator/", async route => {
    const response = await route.fetch();
    await route.fulfill({response,headers:{...response.headers(),"content-security-policy":policy}});
  });
  const response = await page.goto(origin+"/tools/qr-generator/",{waitUntil:"domcontentloaded"});
  assert.equal(response?.status(),200);
  await page.getByLabel("Contenuto da codificare").fill("https://strumentini.it/tools/qr-generator");
  const before = requests.filter(r=>r.url.includes("/_astro/") && r.url.endsWith(".js")).length;
  await page.getByRole("button",{name:"Genera codice QR"}).click();
  await page.locator("pre.schema-preview").waitFor({state:"attached",timeout:20000});
  const rows = (await page.locator("pre.schema-preview").textContent()).trim().split("\n");
  assert.equal(rows.length>=21,true);
  const svg = decodeURIComponent((await page.locator('img[alt^="Codice QR del contenuto"]').getAttribute("src")).slice("data:image/svg+xml,".length));
  assert.match(svg, /data-matrix=/);
  assert.deepEqual(svg.match(/data-matrix="([^"]+)"/)?.[1]?.split(";"),rows);
  const after = requests.filter(r=>r.url.includes("/_astro/") && r.url.endsWith(".js")).length;
  assert.ok(after>before,"runtime modules must load lazily after submit");
  const d = page.waitForEvent("download");
  await page.getByRole("button",{name:/Scarica SVG/}).click();
  const download = await d;
  assert.match(await readFile(await download.path(),"utf8"),/data-matrix=/);
  assert.match(download.suggestedFilename(),/\.svg$/);
  await page.getByLabel("Contenuto da codificare").fill("x".repeat(79));
  await page.getByRole("button",{name:"Genera codice QR"}).click();
  await page.getByText(/Il contenuto supera i 78 byte/u).waitFor({timeout:15000});
  assert.deepEqual(errors,[]);
  assert.deepEqual(requests.filter(r=>!r.url.startsWith(origin)),[]);
  assert.deepEqual(requests.filter(r=>!["GET","HEAD"].includes(r.method)),[]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false);
  console.log(JSON.stringify({status:"PASS",viewport:"390x844",download:download.suggestedFilename(),lazyChunk:"PASS",invalidOverLimit:"REFUSED",egress:0,uploads:0,errors:0}));
} catch (error) { console.error(error); process.exitCode=1; }
finally {
  server.kill("SIGTERM");
  if (page && context) {
    try { await Promise.race([(async()=>{await page.close();await context.close()})(),delay(5000)]); } catch {}
  }
  process.exit(process.exitCode??0);
}
