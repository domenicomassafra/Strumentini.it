/** #330 wave23 genuine N-up PDF -> Recenti, Chrome desktop 390px only.
 * Run: node tests/recent-pdf-nup-330-wave23.browser.mjs
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.NUP330_PORT ?? 18636);
const origin = process.env.NUP330_ORIGIN ?? ("http://127.0.0.1:" + port);
const id = "pdf-n-up";
const colors = [[204,25,25],[25,135,35],[40,65,205],[225,175,20],[170,35,175]];
const pyFixture = [
  "import io,sys",
  "from reportlab.pdfgen import canvas",
  "from reportlab.lib.colors import Color",
  "count=int(sys.argv[1])",
  "colors=[(204,25,25),(25,135,35),(40,65,205),(225,175,20),(170,35,175)]",
  "b=io.BytesIO(); c=canvas.Canvas(b,pagesize=(320,480),pageCompression=0)",
  "for i in range(count):",
  " r,g,bl=colors[i]; c.setFillColor(Color(r/255,g/255,bl/255)); c.rect(0,0,320,480,stroke=0,fill=1)",
  " c.setFillColorRGB(1,1,1); c.setFont('Helvetica',90); c.drawString(110,215,str(i+1)); c.showPage()",
  "c.save(); sys.stdout.buffer.write(b.getvalue())",
].join("\n");
function fixture(pages) {
  const result = spawnSync("python3", ["-c",pyFixture,String(pages)], { timeout: 10000, maxBuffer: 1024 * 1024 });
  assert.equal(result.status, 0, String(result.stderr));
  assert.equal(result.stdout.subarray(0,5).toString(), "%PDF-");
  return result.stdout;
}
const sourceFive = fixture(5);
const sourceThree = fixture(3);
const faults = [];
const requests = [];
async function recent(page) {
  return page.evaluate(async () => {
    if (typeof indexedDB.databases === "function" &&
        !(await indexedDB.databases()).some((db) => db.name === "utility-workbench")) return [];
    return new Promise((resolve, reject) => {
      const opened = indexedDB.open("utility-workbench",1);
      opened.onerror = () => reject(opened.error);
      opened.onsuccess = () => {
        const db = opened.result;
        if (!db.objectStoreNames.contains("state")) { db.close(); resolve([]); return; }
        const tx = db.transaction("state","readonly");
        const item = tx.objectStore("state").get("workbench/state:v1");
        item.onerror = () => reject(item.error);
        item.onsuccess = () => resolve(item.result?.recent ?? []);
        tx.oncomplete = () => db.close();
      };
    });
  });
}
async function expectCount(page, expected, timeout = 9000) {
  const until = Date.now() + timeout;
  let rows;
  do {
    rows = await recent(page);
    const matching = rows.filter((row) => row.toolId === id);
    if ((expected === 0 && matching.length === 0) ||
        (matching.length === 1 && matching[0].useCount === expected)) {
      if (expected) {
        assert.deepEqual(Object.keys(matching[0]).sort(), ["lastUsedAt","toolId","useCount"]);
        assert(Number.isFinite(Date.parse(matching[0].lastUsedAt)));
      }
      const saved = JSON.stringify(rows);
      for (const value of ["PRIVATE_", "%PDF-", "pdf-n-up-raster", "sourceFive", "sourceThree"]) {
        assert(!saved.includes(value), "Private data was persisted: " + value);
      }
      return rows;
    }
    await new Promise((ok) => setTimeout(ok,95));
  } while (Date.now() < until);
  assert.fail("Expected N-up count " + expected + ", observed " + JSON.stringify(rows));
}
const pyInspect = [
  "import json,sys",
  "from pypdf import PdfReader",
  "reader=PdfReader(sys.argv[1],strict=True); result=[]",
  "for page in reader.pages:",
  " images=[]",
  " for key,ref in page['/Resources'].get_object().get('/XObject',{}).items():",
  "  entry=ref.get_object()",
  "  if entry.get('/Subtype')=='/Image': images.append({'filter':str(entry.get('/Filter')),'w':int(entry.get('/Width')),'h':int(entry.get('/Height'))})",
  " result.append({'width':float(page.mediabox.width),'height':float(page.mediabox.height),'images':images,'text':page.extract_text() or ''})",
  "print(json.dumps(result))",
].join("\n");
async function downloadAndInspect(page, count, width, height) {
  const event = page.waitForEvent("download", { timeout: 25000 });
  await page.getByRole("link", { name: "Scarica PDF n-up" }).click();
  const file = await event;
  const bytes = await readFile(await file.path());
  assert.equal(bytes.subarray(0,5).toString(), "%PDF-");
  const parsed = spawnSync("python3", ["-c",pyInspect,await file.path()], { encoding: "utf8", timeout: 16000 });
  assert.equal(parsed.status,0,"Independent pypdf parse: " + parsed.stderr);
  const pages = JSON.parse(parsed.stdout);
  assert.equal(pages.length,count);
  for (const sheet of pages) {
    assert(Math.abs(sheet.width-width)<.03 && Math.abs(sheet.height-height)<.03);
    assert.equal(sheet.images.length,1);
    assert.equal(sheet.images[0].filter,"/DCTDecode");
    assert(sheet.images[0].w>300 && sheet.images[0].h>300);
    assert.equal(sheet.text.trim(),"","N-up raster output falsely keeps searchable source text");
  }
  return { size: bytes.length, pages };
}
async function ready() {
  for (let i=0;i<160;i++) {
    if (server && server.exitCode !== null) throw Error("Astro exited before N-up route ready: " + serverLogs);
    try { if ((await fetch(origin+"/tools/pdf-n-up/")).ok) return; } catch {}
    await new Promise((ok)=>setTimeout(ok,250));
  }
  throw Error("Local n-up route not responding: " + serverLogs);
}
async function openTool(page) {
  const result = await page.goto(origin+"/tools/pdf-n-up/",{waitUntil:"networkidle"});
  assert.equal(result?.status(),200);
  await page.waitForFunction(() => [...document.querySelectorAll('astro-island[client="load"]')]
    .every((item) => !item.hasAttribute("ssr")), null, { timeout: 25000 });
}
async function choose(page, bytes, name) {
  await page.locator('[data-pdf-n-up] input[type="file"]').setInputFiles({
    name, mimeType: "application/pdf", buffer: bytes,
  });
}
async function submit(page,times=1) {
  await page.evaluate((count) => {
    const form = document.querySelector("[data-pdf-n-up]");
    for (let i=0;i<count;i++) {
      if (form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}))) throw Error("Unprevented form submit");
    }
  },times);
}
async function holdFrame(page) {
  await page.evaluate(() => {
    window.__nupOriginalFrame=window.requestAnimationFrame;
    window.__nupHeldFrames=[];
    window.requestAnimationFrame=(callback)=>{window.__nupHeldFrames.push(callback);return 321999;};
  });
}
async function releaseFrames(page) {
  await page.evaluate(() => {
    window.requestAnimationFrame=window.__nupOriginalFrame;
    const held=window.__nupHeldFrames.splice(0);
    for (const callback of held) callback(performance.now());
  });
}
function watch(page) {
  page.on("pageerror",(error)=>faults.push(error.message));
  page.on("request",(req)=>{
    if (!["GET","HEAD"].includes(req.method()) ||
        !(req.url().startsWith(origin)||req.url().startsWith("blob:")||req.url().startsWith("data:"))) {
      requests.push(req.method()+" "+req.url());
    }
  });
}
async function checkPreviewPixels(page,sheetNumber,expected) {
  const image=page.locator("[data-nup-result-preview]");
  if (sheetNumber===1) {
    const previous=await image.getAttribute("src");
    await page.getByRole("button",{name:"Foglio precedente"}).click();
    await page.waitForFunction(({prev,n})=>{
      const img=document.querySelector("[data-nup-result-preview]");
      return img && img.getAttribute("src")!==prev && img.alt.startsWith("Foglio "+n+" ");
    },{prev:previous,n:sheetNumber},{timeout:22000});
  } else {
    await page.locator('[data-nup-result-preview][alt^="Foglio 2 "]').waitFor({timeout:22000});
  }
  const samples=await image.evaluate(async (img)=>{
    await img.decode();
    const canvas=document.createElement("canvas");
    canvas.width=img.naturalWidth; canvas.height=img.naturalHeight;
    const ctx=canvas.getContext("2d",{willReadFrequently:true});
    if(!ctx) throw Error("PDF.js image canvas unavailable");
    ctx.drawImage(img,0,0);
    const W=841.89,H=595.28,m=18,g=12,cw=(W-2*m-g)/2,ch=(H-2*m-g)/2;
    const pixels=[0,1,2,3].map(i=>{
      const row=Math.floor(i/2),column=i%2;
      const x=m+(column+.5)*cw+column*g;
      // Avoid the large white page number printed at the centre of each
      // fixture page; sample its upper coloured raster quarter instead.
      const y=m+(row+.2)*ch+row*g;
      return Array.from(ctx.getImageData(Math.floor(x/W*canvas.width),Math.floor(y/H*canvas.height),1,1).data).slice(0,3);
    });
    canvas.width=0;canvas.height=0;
    return pixels;
  });
  expected.forEach((rgb,i)=>{
    const diff=Math.max(...rgb.map((value,j)=>Math.abs(value-samples[i][j])));
    assert(diff<=26,"PDF.js real N-up pixels wrong sheet "+sheetNumber+" slot "+(i+1)+": "+JSON.stringify({expected:rgb,found:samples[i]}));
  });
}
const server=process.env.NUP330_ORIGIN ? null :
  spawn("./node_modules/.bin/astro",["dev","--host","127.0.0.1","--port",String(port),"--strictPort"],
    {cwd:root,stdio:["ignore","pipe","pipe"]});
let serverLogs="";
if (server) for (const stream of [server.stdout,server.stderr]) stream.on("data",(chunk)=>{serverLogs=(serverLogs+String(chunk)).slice(-12000);});
let browser;
try {
  await ready();
  browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
  const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
  const page=await context.newPage();watch(page);
  await openTool(page);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  await expectCount(page,0);
  await choose(page,Buffer.from("NOT PDF"),"PRIVATE_INVALID_NUP.pdf");
  await page.getByRole("alert").first().waitFor({timeout:12000});
  await expectCount(page,0);
  await choose(page,sourceFive,"PRIVATE_FIVE_NUP.pdf");
  await page.locator("[data-nup-preview]").waitFor({timeout:22000});
  await page.getByLabel("Spazio tra le celle (pt)").fill("99");
  assert(await page.getByRole("button",{name:"Crea PDF n-up"}).isDisabled());
  await expectCount(page,0);
  await page.getByLabel("Spazio tra le celle (pt)").fill("12");
  await page.getByLabel("Impaginazione").selectOption("4-up");
  await page.getByLabel("Orientamento foglio").selectOption("landscape");
  assert.match(await page.locator("[data-nup-preview]").innerText(),/3 celle vuote/);
  await page.getByRole("button",{name:"Foglio successivo"}).click();
  await submit(page,2);
  await page.locator("[data-nup-result]").waitFor({timeout:35000});
  await page.locator("[data-nup-result-preview]").waitFor({timeout:25000});
  const first=await downloadAndInspect(page,2,841.89,595.28);
  await checkPreviewPixels(page,2,[colors[4],[255,255,255],[255,255,255],[255,255,255]]);
  await checkPreviewPixels(page,1,colors.slice(0,4));
  await expectCount(page,1); // RED: real genuine PDF but no Recenti before source fix
  await page.waitForTimeout(300);
  assert.equal((await recent(page)).find((r)=>r.toolId===id)?.useCount,1);
  await holdFrame(page);await submit(page);
  await page.getByRole("button",{name:"Annulla impaginazione"}).click();
  await releaseFrames(page);await page.waitForTimeout(130);
  assert.equal(await page.getByRole("link",{name:"Scarica PDF n-up"}).count(),0);
  await expectCount(page,1);
  await holdFrame(page);await submit(page);
  await page.getByLabel("Spazio tra le celle (pt)").fill("99");
  await releaseFrames(page);await page.waitForTimeout(130);
  assert.equal(await page.getByRole("link",{name:"Scarica PDF n-up"}).count(),0);
  await expectCount(page,1);
  await page.getByLabel("Spazio tra le celle (pt)").fill("12");
  await holdFrame(page);await submit(page);
  await choose(page,sourceThree,"PRIVATE_REPLACEMENT_NUP.pdf");
  await releaseFrames(page);await page.waitForTimeout(130);
  assert.equal(await page.getByRole("link",{name:"Scarica PDF n-up"}).count(),0);
  await expectCount(page,1);
  await page.locator("[data-nup-preview]").waitFor({timeout:20000});
  await page.getByLabel("Impaginazione").selectOption("2-up");
  await page.getByRole("button",{name:"Crea PDF n-up"}).click();
  await page.locator("[data-nup-result]").waitFor({timeout:35000});
  const second=await downloadAndInspect(page,2,841.89,595.28);
  await expectCount(page,2);
  await page.goto(origin+"/preferiti/",{waitUntil:"networkidle"});
  await page.locator("[data-area-activity] li").first().waitFor({timeout:20000});
  assert.match(await page.locator("[data-area-activity]").innerText(),/N-up|più pagine PDF su un foglio|più pagine per foglio/iu);
  await page.reload({waitUntil:"networkidle"});
  await expectCount(page,2);
  assert.deepEqual(faults,[]);assert.deepEqual(requests,[]);
  await context.close();

  const denied=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
  await denied.addInitScript(()=>{
    Object.defineProperty(window,"indexedDB",{configurable:true,get(){throw new DOMException("denied","SecurityError");}});
  });
  const blocked=await denied.newPage();watch(blocked);await openTool(blocked);
  await choose(blocked,sourceThree,"PRIVATE_STORAGE_DENIED_NUP.pdf");
  await blocked.locator("[data-nup-preview]").waitFor({timeout:20000});
  await blocked.getByRole("button",{name:"Crea PDF n-up"}).click();
  await blocked.locator("[data-nup-result]").waitFor({timeout:35000});
  await downloadAndInspect(blocked,2,595.28,841.89);
  await blocked.goto(origin+"/preferiti/",{waitUntil:"networkidle"});
  assert.match(await blocked.locator("body").innerText(),/memoria|browser|temporane|disponibil/iu);
  assert.deepEqual(faults,[]);assert.deepEqual(requests,[]);
  await denied.close();
  console.log("PASS #330 N-up Chrome390 real pypdf MediaBox+JPEG, PDF.js coloured cells",JSON.stringify({
    outputBytes:[first.size,second.size],outputPages:[first.pages.length,second.pages.length],
    useCount:2,doubleSubmit:"once",invalidCancelStale:"zero",deniedStorage:"PDF usable",offsite:0,
  }));
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
