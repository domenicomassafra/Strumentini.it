/** #330 wave24: real Booklet + Interleave PDF -> success-only Recenti.
 * node tests/recent-pdf-booklet-330-wave24.browser.mjs
 * Genuine installed Chrome desktop at 390px; not physical mobile.
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.BOOKLET330_PORT ?? 18637);
const base = process.env.BOOKLET330_ORIGIN ?? ("http://127.0.0.1:" + port);
const toolId = "pdf-booklet-interleave";
const colors = [[204,25,25],[25,135,35],[40,65,205],[225,175,20]];
const generator = [
  "import io,sys",
  "from reportlab.pdfgen import canvas",
  "from reportlab.lib.colors import Color",
  "kind=sys.argv[1]; buf=io.BytesIO(); c=canvas.Canvas(buf,pagesize=(320,480),pageCompression=0)",
  "colors=[(204,25,25),(25,135,35),(40,65,205),(225,175,20)]",
  "labels={'front':['FRONT-1','FRONT-2'],'back':['BACK-1','BACK-2'],'booklet':['PAGE-1','PAGE-2','PAGE-3','PAGE-4']}",
  "for index,label in enumerate(labels[kind]):",
  " if kind=='booklet':",
  "  r,g,b=colors[index]; c.setFillColor(Color(r/255,g/255,b/255)); c.rect(0,0,320,480,stroke=0,fill=1)",
  "  c.setFillColorRGB(1,1,1)",
  " else: c.setFillColorRGB(0,0,0)",
  " c.setFont('Helvetica',24); c.drawString(65,240,label); c.showPage()",
  "c.save();sys.stdout.buffer.write(buf.getvalue())",
].join("\n");
function fixture(kind) {
  const r=spawnSync("python3",["-c",generator,kind],{timeout:10000,maxBuffer:1024*1024});
  assert.equal(r.status,0,String(r.stderr));
  assert.equal(r.stdout.subarray(0,5).toString(),"%PDF-");
  return r.stdout;
}
const front=fixture("front"), back=fixture("back"), booklet=fixture("booklet");
const errors=[], outbound=[];

async function recent(page) {
  return page.evaluate(async () => {
    if (typeof indexedDB.databases==="function" &&
       !(await indexedDB.databases()).some((item)=>item.name==="utility-workbench")) return [];
    return new Promise((resolve,reject)=>{
      const request=indexedDB.open("utility-workbench",1);
      request.onerror=()=>reject(request.error);
      request.onsuccess=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains("state")) {db.close();resolve([]);return;}
        const tx=db.transaction("state","readonly");
        const got=tx.objectStore("state").get("workbench/state:v1");
        got.onerror=()=>reject(got.error);
        got.onsuccess=()=>resolve(got.result?.recent??[]);
        tx.oncomplete=()=>db.close();
      };
    });
  });
}
async function expectCount(page,wanted,ms=8500) {
  const end=Date.now()+ms;
  let entries=[];
  do {
    entries=await recent(page);
    const rows=entries.filter((r)=>r.toolId===toolId);
    if ((wanted===0&&rows.length===0)||(rows.length===1&&rows[0].useCount===wanted)) {
      if(wanted) {
        assert.deepEqual(Object.keys(rows[0]).sort(),["lastUsedAt","toolId","useCount"]);
        assert(Number.isFinite(Date.parse(rows[0].lastUsedAt)));
      }
      const stored=JSON.stringify(entries);
      for (const s of ["PRIVATE_", "%PDF-", "FRONT-1","BACK-2","PAGE-4","booklet-source-private","interleave-secret"]) {
        assert(!stored.includes(s),"Sensitive source/output persisted in Recenti: "+s);
      }
      return entries;
    }
    await new Promise((resolve)=>setTimeout(resolve,85));
  } while(Date.now()<end);
  assert.fail("Expected "+toolId+" useCount="+wanted+" observed "+JSON.stringify(entries));
}

const inspectPython=[
  "import json,sys,io",
  "from pypdf import PdfReader",
  "from PIL import Image",
  "reader=PdfReader(sys.argv[1],strict=True); out=[]",
  "for page in reader.pages:",
  " images=[]",
  " for name,ref in page['/Resources'].get_object().get('/XObject',{}).items():",
  "  obj=ref.get_object()",
  "  if obj.get('/Subtype')=='/Image':",
  "   sample=Image.open(io.BytesIO(obj.get_data())).convert('RGB')",
  "   images.append({'filter':str(obj.get('/Filter')),'size':list(sample.size),'left':list(sample.getpixel((int(sample.width*.25),int(sample.height*.25)))),'right':list(sample.getpixel((int(sample.width*.75),int(sample.height*.25))))})",
  " out.append({'width':float(page.mediabox.width),'height':float(page.mediabox.height),'rotation':int(page.get('/Rotate',0)),'text':(page.extract_text() or '').strip(),'images':images})",
  "print(json.dumps(out))",
].join("\n");
async function output(page,label,kind) {
  const event=page.waitForEvent("download",{timeout:25000});
  await page.getByRole("link",{name:label}).click();
  const downloaded=await event;
  const path=await downloaded.path();
  const bytes=await readFile(path);
  assert.equal(bytes.subarray(0,5).toString(),"%PDF-");
  const proc=spawnSync("python3",["-c",inspectPython,path],{encoding:"utf8",timeout:15000});
  assert.equal(proc.status,0,proc.stderr);
  const pages=JSON.parse(proc.stdout);
  const loading=getDocument({data:new Uint8Array(bytes),disableAutoFetch:true,disableStream:true,useSystemFonts:true});
  try {
    const pdf=await loading.promise;
    assert.equal(pdf.numPages,pages.length);
    for(let i=0;i<pdf.numPages;i++) {
      const p=await pdf.getPage(i+1);
      const viewport=p.getViewport({scale:1});
      assert(Math.abs(viewport.width-pages[i].width)<.06);
      assert(Math.abs(viewport.height-pages[i].height)<.06);
      const readable=(await p.getTextContent()).items.map((x)=>x.str??"").join(" ").trim();
      if(kind==="interleave") assert.equal(readable,pages[i].text);
      else assert.equal(readable,"","Booklet must declare its genuine rasterization");
      p.cleanup();
    }
  } finally {await loading.destroy();}
  return {size:bytes.length,pages};
}
async function ready(server,getLogs) {
  for(let i=0;i<150;i++) {
    if(server && server.exitCode!==null) throw Error("Astro failed: "+getLogs());
    try {if((await fetch(base+"/tools/pdf-booklet-interleave/")).ok)return;}catch{}
    await new Promise((r)=>setTimeout(r,220));
  }
  throw Error("Booklet route timeout: "+getLogs());
}
async function openTool(page) {
  const response=await page.goto(base+"/tools/pdf-booklet-interleave/",{waitUntil:"networkidle"});
  assert.equal(response?.status(),200);
  await page.waitForFunction(()=>[...document.querySelectorAll('astro-island[client="load"]')]
    .every((el)=>!el.hasAttribute("ssr")),null,{timeout:25000});
}
async function choose(page,index,bytes,name) {
  await page.locator('[data-pdf-251] input[type="file"]').nth(index).setInputFiles({
    name,mimeType:"application/pdf",buffer:bytes,
  });
}
async function submit(page,times=1) {
  await page.evaluate((count)=>{
    const form=document.querySelector("[data-pdf-251]");
    if(!form)throw Error("Booklet form missing");
    for(let i=0;i<count;i++)
      if(form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})))throw Error("Native submit unprevented");
  },times);
}
async function holdFrame(page) {
  await page.evaluate(()=>{
    window.__bookletOriginalRAF=window.requestAnimationFrame;
    window.__bookletHeld=[];
    window.requestAnimationFrame=(cb)=>{window.__bookletHeld.push(cb);return 554433;};
  });
}
async function releaseFrame(page) {
  await page.evaluate(()=>{
    window.requestAnimationFrame=window.__bookletOriginalRAF;
    for(const cb of window.__bookletHeld.splice(0))cb(performance.now());
  });
}
function watch(page) {
  page.on("pageerror",(e)=>errors.push(e.message));
  page.on("request",(req)=>{
    if(!["GET","HEAD"].includes(req.method()) ||
       !(req.url().startsWith(base)||req.url().startsWith("data:")||req.url().startsWith("blob:"))) {
      outbound.push(req.method()+" "+req.url());
    }
  });
}
const server=process.env.BOOKLET330_ORIGIN?null:
  spawn("./node_modules/.bin/astro",["dev","--host","127.0.0.1","--port",String(port),"--strictPort",
    ...(process.env.BOOKLET330_FORCE_DEV==="1"?["--force"]:[])],
    {cwd:root,stdio:["ignore","pipe","pipe"]});
let logs="";
if(server)for(const stream of [server.stdout,server.stderr])
  stream.on("data",(chunk)=>{logs=(logs+String(chunk)).slice(-10000);});
let browser;
try {
  await ready(server,()=>logs);
  browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
  const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
  const page=await context.newPage();watch(page);await openTool(page);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  await expectCount(page,0);
  await choose(page,0,Buffer.from("bad PDF"),"PRIVATE_BAD_FRONT.pdf");
  await page.getByRole("alert").first().waitFor({timeout:12000});
  await expectCount(page,0);

  // Standalone vector Interleave, reverse-back order; retry cannot record twice.
  await page.getByLabel("Operazione").selectOption("interleave");
  await choose(page,0,front,"PRIVATE_FRONT_INTERLEAVE.pdf");
  await choose(page,1,back,"PRIVATE_BACK_INTERLEAVE.pdf");
  await page.locator("[data-251-plan]").waitFor({timeout:20000});
  await submit(page,2);
  await page.locator("[data-251-result]").waitFor({timeout:25000});
  const interleaved=await output(page,"Scarica PDF intercalato","interleave");
  assert.equal(interleaved.pages.length,4);
  assert.deepEqual(interleaved.pages.map((p)=>p.text),["FRONT-1","BACK-2","FRONT-2","BACK-1"]);
  assert(interleaved.pages.every((p)=>Math.abs(p.width-320)<.1&&Math.abs(p.height-480)<.1));
  await expectCount(page,1); // baseline RED: no record even after real PDF success
  await page.waitForTimeout(240);
  assert.equal((await recent(page)).find((r)=>r.toolId===toolId)?.useCount,1);

  // Held RAF, explicit cancellation and options/input edits cannot resurrect stale results.
  await holdFrame(page);await submit(page);
  await page.getByRole("button",{name:"Annulla composizione"}).click();
  await releaseFrame(page);await page.waitForTimeout(220);
  assert.equal(await page.getByRole("link",{name:/Scarica PDF/}).count(),0);
  await expectCount(page,1);
  await holdFrame(page);await submit(page);
  await page.getByLabel("Ordine delle pagine retro").selectOption("forward");
  await releaseFrame(page);await page.waitForTimeout(220);
  assert.equal(await page.getByRole("link",{name:/Scarica PDF/}).count(),0);
  await expectCount(page,1);

  await page.getByLabel("Operazione").selectOption("booklet");
  await choose(page,0,booklet,"PRIVATE_BOOKLET_SOURCE.pdf");
  await page.locator("[data-251-plan]").waitFor({timeout:20000});
  await page.getByLabel("Margine esterno (pt)").fill("99");
  assert(await page.getByRole("button",{name:"Crea PDF e verifica"}).isDisabled());
  await expectCount(page,1);
  await page.getByLabel("Margine esterno (pt)").fill("18");
  await submit(page,2);
  await page.locator("[data-251-result]").waitFor({timeout:35000});
  await page.locator("[data-251-preview]").waitFor({timeout:25000});
  const imposed=await output(page,"Scarica PDF booklet","booklet");
  assert.equal(imposed.pages.length,2);
  for(const face of imposed.pages) {
    assert(Math.abs(face.width-841.89)<.1&&Math.abs(face.height-595.28)<.1);
    assert.equal(face.images.length,1);
    assert.equal(face.images[0].filter,"/DCTDecode");
  }
  // Real JPEG pixels from the downloaded PDF prove folded page order [4,1],[2,3].
  const expected=[[colors[3],colors[0]],[colors[1],colors[2]]];
  imposed.pages.forEach((face,index)=>{
    for(const [slot,point] of ["left","right"].entries()) {
      const rgb=face.images[0][point],want=expected[index][slot];
      assert(Math.max(...want.map((v,c)=>Math.abs(v-rgb[c])))<35,
        "Booklet imposition real JPEG wrong face/slot: "+JSON.stringify({index,point,rgb,want}));
    }
  });
  await expectCount(page,2);
  await holdFrame(page);await submit(page);
  await choose(page,0,front,"PRIVATE_REPLACED_BOOKLET.pdf");
  await releaseFrame(page);await page.waitForTimeout(240);
  assert.equal(await page.getByRole("link",{name:/Scarica PDF/}).count(),0);
  await expectCount(page,2);
  await page.goto(base+"/preferiti/",{waitUntil:"networkidle"});
  await page.locator("[data-area-activity] li").first().waitFor({timeout:20000});
  assert.match(await page.locator("[data-area-activity]").innerText(),/booklet|intercal/iu);
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
  await blocked.getByLabel("Operazione").selectOption("interleave");
  await choose(blocked,0,front,"PRIVATE_NO_DB_FRONT.pdf");
  await choose(blocked,1,back,"PRIVATE_NO_DB_BACK.pdf");
  await blocked.locator("[data-251-plan]").waitFor({timeout:20000});
  await blocked.getByRole("button",{name:"Crea PDF e verifica"}).click();
  await blocked.locator("[data-251-result]").waitFor({timeout:25000});
  const deniedOutput=await output(blocked,"Scarica PDF intercalato","interleave");
  assert.deepEqual(deniedOutput.pages.map((p)=>p.text),["FRONT-1","BACK-2","FRONT-2","BACK-1"]);
  await blocked.goto(base+"/preferiti/",{waitUntil:"networkidle"});
  assert.match(await blocked.locator("body").innerText(),/memoria|browser|temporane|disponibil/iu);
  assert.deepEqual(errors,[]);assert.deepEqual(outbound,[]);
  await denied.close();
  console.log("PASS #330 wave24 Booklet + Interleave real Chrome390 PDFs independently pypdf/PDF.js checked",
    JSON.stringify({bytes:[interleaved.size,imposed.size],outputPages:[4,2],useCount:2,
      doubleSubmit:"once",cancelOrEdit:"zero stale",indexedDBDenied:"real output",outbound:0}));
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
