// Local Chrome verification of the actual homepage candidate->manifest routes.
// Native phone/OS pickers remain NOT_RUN; no file is forwarded to a tool.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const base = (process.argv[2] ?? "http://127.0.0.1:4932").replace(/\/$/u, "");
const browser = await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
const context = await browser.newContext({viewport:{width:390,height:844}});
const page = await context.newPage();
const errors = [];
const sent = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (req) => {
  if (!req.url().startsWith(base + "/") || !["GET", "HEAD"].includes(req.method())) sent.push(req.method() + " " + req.url());
});
const input = page.locator("[data-home-file-picker]");
const status = page.locator("[data-home-file-status]");
const actions = () => page.locator("[data-home-file-action-format]:visible a").evaluateAll(links => links.map(a=>a.getAttribute("href")));
async function choose(file, pattern) {
  const pending = page.waitForEvent("filechooser");
  await input.click();
  await (await pending).setFiles(file);
  await status.getByText(pattern).waitFor({timeout:20_000});
  return actions();
}

try {
  assert.equal((await page.goto(base + "/", {waitUntil:"domcontentloaded"}))?.status(), 200);
  const csv = {name:"data.csv",mimeType:"text/csv",buffer:Buffer.from('name,value\r\n"first, last","multi\nline"\r\nother,2\r\n')};
  const csvActions = await choose(csv,/CSV riconosciuto localmente/u);
  assert.deepEqual(csvActions,[
    "/tools/csv-cleaner/", "/tools/csv-dedupe/", "/tools/csv-column-map/",
    "/tools/csv-filter/", "/tools/csv-column-selector/", "/tools/csv-group-count/",
  ]);
  assert.equal(await page.locator("[data-home-file-result]").isVisible(),true);
  assert.match(await page.locator("[data-home-file-result]").innerText(),/selezionare di nuovo il file/u);
  assert.equal(await input.inputValue(),"");

  const malformed = await choose({name:"bad.csv",mimeType:"text/csv",buffer:Buffer.from('a,b\n1,2,3\n')},/struttura prevista/u);
  assert.deepEqual(malformed,[]);
  const masquerade = await choose({name:"forged.csv",mimeType:"image/png",buffer:Buffer.from('a,b\n1,2\n')},/Formato non riconosciuto/u);
  assert.deepEqual(masquerade,[]);
  const prose = await choose({name:"story.txt",mimeType:"text/plain",buffer:Buffer.from('Hello there')},/Formato non riconosciuto/u);
  assert.deepEqual(prose,[]);

  const png = await readFile("quality/fixtures/image-metadata/synthetic-1x1-rgb.png");
  const pngActions = await choose({name:"image.png",mimeType:"image/png",buffer:png},/PNG riconosciuto localmente/u);
  assert(pngActions.includes("/tools/image-resize/"));
  const pdf = await readFile("quality/fixtures/pdf-gold/simple-2page.pdf");
  const pdfActions = await choose({name:"input.pdf",mimeType:"application/pdf",buffer:pdf},/PDF riconosciuto localmente/u);
  assert(pdfActions.includes("/tools/pdf-merge/"));
  assert.deepEqual(errors,[]);
  assert.deepEqual(sent,[],"no document upload, POST or remote egress");
  console.log("PASS #335 real Chrome 390px: RFC4180 CSV, six manifest routes, PDF/PNG, malformed/spoof/text refusal, zero upload/offsite/page errors");
  console.log("NOT_RUN native iOS/Android file picker and real device assistive tech; suggestions never transfer files between pages");
} finally {
  await context.close();
  await browser.close();
}
