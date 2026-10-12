/** #330 wave24: real Fill Overlays flattened PDF -> success-only Recenti.
 * node tests/recent-pdf-fill-overlays-330-wave24.browser.mjs
 * Installed desktop Chrome viewport 390x844, not physical mobile.
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.FILL243_PORT ?? 18639);
const base = process.env.FILL243_ORIGIN ?? ("http://127.0.0.1:" + port);
const id = "pdf-fill-overlays";
const first = await readFile(resolve(root, "quality/fixtures/pdf-gold/simple-2page.pdf"));
const second = await readFile(resolve(root, "quality/fixtures/pdf-gold/simple-3page.pdf"));
const privateFile = "PRIVATE_FILL_OVERLAYS_330_SOURCE.pdf";
const privateText = "PRIVATE243TEXT";
const errors = [], outbound = [];

async function recent(page) {
  return page.evaluate(async () => {
    if (typeof indexedDB.databases === "function" &&
      !(await indexedDB.databases()).some((db) => db.name === "utility-workbench")) return [];
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("utility-workbench", 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("state")) { db.close(); resolve([]); return; }
        const tx = db.transaction("state", "readonly");
        const result = tx.objectStore("state").get("workbench/state:v1");
        result.onerror = () => reject(result.error);
        result.onsuccess = () => resolve(result.result?.recent ?? []);
        tx.oncomplete = () => db.close();
      };
    });
  });
}
async function expectCount(page, number, timeoutMs = 8500) {
  const end = Date.now() + timeoutMs;
  let records = [];
  do {
    records = await recent(page);
    const matches = records.filter((r) => r.toolId === id);
    if ((number === 0 && matches.length === 0) ||
      (matches.length === 1 && matches[0].useCount === number)) {
      if (number) {
        assert.deepEqual(Object.keys(matches[0]).sort(), ["lastUsedAt", "toolId", "useCount"]);
        assert(Number.isFinite(Date.parse(matches[0].lastUsedAt)));
      }
      for (const secret of ["PRIVATE_", privateText, privateFile, "alpha", "beta", "gamma", "%PDF-", "pdf-overlay-flattened"]) {
        assert(!JSON.stringify(records).includes(secret), "Sensitive source/output in IndexedDB: " + secret);
      }
      return records;
    }
    await new Promise((r) => setTimeout(r, 90));
  } while (Date.now() < end);
  assert.fail("Expected " + id + " count " + number + ", got " + JSON.stringify(records));
}

const independent = [
  "import json,sys",
  "from pypdf import PdfReader",
  "p=PdfReader(sys.argv[1],strict=True)",
  "data=[]",
  "for page in p.pages:",
  " positions=[]",
  " def visitor(txt,cm,tm,font,size):",
  "  if sys.argv[2] in txt: positions.append([float(tm[4]),float(tm[5])])",
  " extracted=page.extract_text(visitor_text=visitor) or ''",
  " data.append({'text':extracted, 'overlayPositions':positions, 'width':float(page.mediabox.width), 'height':float(page.mediabox.height), 'rotation':int(page.get('/Rotate',0)), 'annotations':len(page.get('/Annots',[]))})",
  "print(json.dumps(data))",
].join("\n");
async function verifyPdf(page, expectedOriginal, pageOfOverlay, overlayText) {
  const download = page.waitForEvent("download", { timeout: 20000 });
  await page.getByRole("link", { name: "Scarica PDF appiattito" }).click();
  const produced = await download;
  const path = await produced.path();
  const bytes = await readFile(path);
  assert.equal(bytes.subarray(0,5).toString(), "%PDF-");
  const py = spawnSync("python3", ["-c", independent, path, overlayText], { encoding: "utf8", timeout: 15000 });
  assert.equal(py.status, 0, "Independent pypdf invalid output: " + py.stderr);
  const pages = JSON.parse(py.stdout);
  assert.equal(pages.length, expectedOriginal.length);
  const task = getDocument({ data: new Uint8Array(bytes), disableStream: true, disableAutoFetch: true, useSystemFonts: true });
  try {
    const pdf = await task.promise;
    assert.equal(pdf.numPages, expectedOriginal.length);
    for (let i = 0; i < pdf.numPages; i++) {
      const actual = pages[i];
      assert(Math.abs(actual.width - 612) < .02 && Math.abs(actual.height - 792) < .02);
      assert.equal(actual.rotation, 0);
      assert.equal(actual.annotations, 0, "Not flattened");
      assert(actual.text.includes(expectedOriginal[i]), "pypdf original source text removed");
      assert.equal(actual.text.includes(overlayText), (i+1) === pageOfOverlay,
        "pypdf overlay absent or present on wrong page " + (i+1));
      assert.equal(actual.overlayPositions.length, (i+1) === pageOfOverlay ? 1 : 0,
        "pypdf independently located unexpected overlay text positions");
      if ((i+1) === pageOfOverlay) {
        const [px, py] = actual.overlayPositions[0];
        assert(Math.abs(px-53)<.05 && Math.abs(py-714)<.05,
          "pypdf overlay geometry wrong: " + JSON.stringify(actual.overlayPositions));
      }
      const p = await pdf.getPage(i+1);
      assert(Math.abs(p.getViewport({ scale: 1 }).width - actual.width) < .02);
      const items = (await p.getTextContent()).items;
      const text = items.map((it) => it.str ?? "").join(" ");
      assert(text.includes(expectedOriginal[i]), "PDF.js original text absent");
      assert.equal(text.includes(overlayText), (i+1) === pageOfOverlay, "PDF.js overlay incorrect");
      if ((i+1) === pageOfOverlay) {
        const mark = items.find((it) => it.str?.includes(overlayText));
        assert(mark && Math.abs(mark.transform[4]-53)<.05 && Math.abs(mark.transform[5]-714)<.05,
          "PDF.js independently located wrong overlay coordinates");
      }
      p.cleanup();
    }
  } finally { await task.destroy(); }
  return { size: bytes.length, pages };
}
async function ready(server, getLog) {
  for (let i=0; i<150; i++) {
    if (server && server.exitCode !== null) throw Error("Astro server exited: " + getLog());
    try { if ((await fetch(base + "/tools/pdf-fill-overlays/")).ok) return; } catch {}
    await new Promise((r)=>setTimeout(r,200));
  }
  throw Error("PDF fill overlay route unavailable: " + getLog());
}
async function openTool(page) {
  const response = await page.goto(base + "/tools/pdf-fill-overlays/", { waitUntil: "networkidle" });
  assert.equal(response?.status(), 200);
  await page.waitForFunction(() => [...document.querySelectorAll('astro-island[client="load"]')]
    .every((el) => !el.hasAttribute("ssr")), null, { timeout: 25000 });
}
function watch(page) {
  page.on("pageerror", e => errors.push(e.message));
  page.on("request", req => {
    if (!["GET","HEAD"].includes(req.method()) ||
      !(req.url().startsWith(base) || req.url().startsWith("blob:") || req.url().startsWith("data:"))) {
      outbound.push(req.method() + " " + req.url());
    }
  });
}
async function choose(page, content, name) {
  await page.getByLabel("Documento PDF").setInputFiles({ name, mimeType:"application/pdf", buffer:content });
}
async function submit(page, n=1) {
  await page.evaluate((count) => {
    const form = document.querySelector("[data-pdf-fill-243]");
    for (let i=0;i<count;i++) {
      if (form.dispatchEvent(new Event("submit", { cancelable:true, bubbles:true }))) throw Error("Native submit not prevented");
    }
  }, n);
}
// True async file read trap: holds only the submit read, not the earlier
// source-inspection read. Avoid spying on or replacing the PDF engine.
async function holdPdfRead(page) {
  await page.evaluate(() => {
    window.__pdf243NativeRead=File.prototype.arrayBuffer;
    window.__pdf243HeldReads=[];
    File.prototype.arrayBuffer=function() {
      if (window.__pdf243GateReads === true) {
        return new Promise((resolve,reject)=>window.__pdf243HeldReads.push({resolve,reject,file:this}));
      }
      return window.__pdf243NativeRead.call(this);
    };
    window.__pdf243GateReads=true;
  });
}
async function releasePdfReads(page) {
  await page.evaluate(() => {
    window.__pdf243GateReads=false;
    File.prototype.arrayBuffer=window.__pdf243NativeRead;
    for (const pending of window.__pdf243HeldReads.splice(0)) {
      window.__pdf243NativeRead.call(pending.file).then(pending.resolve,pending.reject);
    }
  });
}
async function awaitHeldRead(page) {
  await page.waitForFunction(() => window.__pdf243HeldReads?.length > 0, null, { timeout: 15000 });
}

const server = process.env.FILL243_ORIGIN ? null :
  spawn("./node_modules/.bin/astro", ["dev","--host","127.0.0.1","--port",String(port),"--strictPort","--ignore-lock"],
    {cwd:root,stdio:["ignore","pipe","pipe"]});
let serverLog="";
if(server) for(const stream of [server.stdout,server.stderr])
  stream.on("data",chunk=>{serverLog=(serverLog+String(chunk)).slice(-9000);});
let browser;
try {
  await ready(server,()=>serverLog);
  browser = await chromium.launch({ headless:true, executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  const context = await browser.newContext({ viewport:{width:390,height:844}, acceptDownloads:true });
  const page = await context.newPage();watch(page);await openTool(page);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  await expectCount(page,0);
  assert(await page.getByRole("button",{name:"Appiattisci e verifica PDF"}).isDisabled());
  await choose(page,Buffer.from("not PDF"),"PRIVATE_INVALID_243.pdf");
  await page.getByRole("alert").first().waitFor({timeout:12000});
  await expectCount(page,0);
  await choose(page,first,privateFile);
  await page.getByLabel("Pagina").locator("option").first().waitFor({state:"attached",timeout:20000});
  await page.getByLabel("Testo da scrivere").fill(privateText);
  await page.getByLabel("Pagina").selectOption("2");
  await page.getByLabel("Larghezza (pt)").fill("200");
  await page.getByLabel("X dall'angolo alto sinistro (pt)").fill("50");
  // Source is valid but the writer must refuse text clipped by the chosen
  // region; this failed export cannot ever count or leave a download.
  await page.getByLabel("Testo da scrivere").fill("TOO-LONG-".repeat(6));
  await page.getByRole("button",{name:"Appiattisci e verifica PDF"}).click();
  await page.getByRole("alert").filter({hasText:/INVALID_TEXT|lungo|rettangolo/iu}).waitFor({timeout:20000});
  assert.equal(await page.getByRole("link",{name:"Scarica PDF appiattito"}).count(),0);
  await expectCount(page,0);
  await page.getByLabel("Testo da scrivere").fill(privateText);
  await submit(page,2);
  await page.locator("[data-243-result]").waitFor({timeout:26000});
  const firstOutput=await verifyPdf(page,["alpha","beta"],2,privateText);
  await expectCount(page,1); // genuine baseline RED after downloaded verified output
  await page.waitForTimeout(250);
  assert.equal((await recent(page)).find(r=>r.toolId===id)?.useCount,1);

  await holdPdfRead(page);
  await submit(page);
  await awaitHeldRead(page);
  await page.getByRole("button",{name:"Annulla elaborazione"}).click();
  await releasePdfReads(page);
  await page.waitForTimeout(280);
  assert.equal(await page.getByRole("link",{name:"Scarica PDF appiattito"}).count(),0);
  await expectCount(page,1);

  await holdPdfRead(page);
  await submit(page);
  await awaitHeldRead(page);
  await page.getByLabel("Testo da scrivere").fill("CHANGED243");
  await releasePdfReads(page);
  await page.waitForTimeout(250);
  assert.equal(await page.getByRole("link",{name:"Scarica PDF appiattito"}).count(),0);
  await expectCount(page,1);

  await holdPdfRead(page);
  await submit(page);
  await awaitHeldRead(page);
  await choose(page,second,"PRIVATE_243_REPLACED.pdf");
  await releasePdfReads(page);
  await page.waitForTimeout(280);
  assert.equal(await page.getByRole("link",{name:"Scarica PDF appiattito"}).count(),0);
  await expectCount(page,1);
  await page.getByLabel("Pagina").locator("option").nth(2).waitFor({state:"attached",timeout:20000});
  await page.getByLabel("Pagina").selectOption("3");
  await page.getByLabel("Testo da scrivere").fill("RETRY243");
  await page.getByRole("button",{name:"Appiattisci e verifica PDF"}).click();
  await page.locator("[data-243-result]").waitFor({timeout:26000});
  const secondOutput=await verifyPdf(page,["one","two","three"],3,"RETRY243");
  await expectCount(page,2);
  await page.goto(base+"/preferiti/",{waitUntil:"networkidle"});
  await page.locator("[data-area-activity] li").first().waitFor({timeout:16000});
  assert.match(await page.locator("[data-area-activity]").innerText(),/scrivi|compila|evidenzia|PDF/iu);
  await page.reload({waitUntil:"networkidle"});
  await expectCount(page,2);
  assert.deepEqual(errors,[]);
  assert.deepEqual(outbound,[]);
  await context.close();

  const denied=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
  await denied.addInitScript(()=>{
    Object.defineProperty(window,"indexedDB",{configurable:true,get(){throw new DOMException("denied","SecurityError");}});
  });
  const blocked=await denied.newPage();watch(blocked);await openTool(blocked);
  await choose(blocked,first,"PRIVATE_DENIED_243.pdf");
  await blocked.getByLabel("Pagina").locator("option").nth(1).waitFor({state:"attached",timeout:20000});
  await blocked.getByLabel("Testo da scrivere").fill("DENIED243");
  await blocked.getByRole("button",{name:"Appiattisci e verifica PDF"}).click();
  await blocked.locator("[data-243-result]").waitFor({timeout:26000});
  await verifyPdf(blocked,["alpha","beta"],1,"DENIED243");
  await blocked.goto(base+"/preferiti/",{waitUntil:"networkidle"});
  assert.match(await blocked.locator("body").innerText(),/memoria|browser|temporane|disponibil/iu);
  assert.deepEqual(errors,[]);
  assert.deepEqual(outbound,[]);
  await denied.close();
  console.log("PASS #330 wave24 Fill Overlays real Chrome390 pypdf+PDF.js real PDFs",
    JSON.stringify({outputBytes:[firstOutput.size,secondOutput.size],pages:[2,3],recents:2,
      doubleSubmit:"once",staleReadCancelAndEdits:"zero",idbDenied:"PDF downloadable",requests:0}));
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
