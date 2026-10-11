/** #339 family expansion: real local CSV producer/download/opt-in in Chromium. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const base=(process.argv[2]??"http://127.0.0.1:4932").replace(/\/$/u,"");
const browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
const page=await context.newPage();
const errors=[];
const requests=[];
page.on("pageerror",error=>errors.push(error.message));
page.on("request",req=>{if(!req.url().startsWith(base+"/")||!["GET","HEAD"].includes(req.method()))requests.push(req.method()+" "+req.url());});
await page.route("**/api/auth/session",route=>route.fulfill({status:200,contentType:"application/json",body:'{"authenticated":false}'}));

async function hydrate(target) {
  assert.equal((await target.goto(base+"/tools/csv-dedupe/",{waitUntil:"domcontentloaded"}))?.status(),200);
  await target.waitForFunction(()=>{
    const island=document.querySelector('astro-island[component-url*="CsvDedupeTool"]');
    return island && !island.hasAttribute("ssr");
  },null,{timeout:25_000});
}
async function produce(target,value){
  await target.getByLabel("File CSV").setInputFiles({name:"input.csv",mimeType:"text/csv",buffer:Buffer.from(`name,value\n${value},1\n${value},1\n`)});
  await target.locator('[data-output-facts-338="available"]').waitFor({state:"hidden"});
  await target.getByText(/input\.csv ·/u).waitFor();
  await target.getByRole("button",{name:"Rimuovi duplicati"}).click();
  await target.locator('[data-output-facts-338="available"]').waitFor();
}
try {
  await hydrate(page);
  await produce(page,"first");
  const opt=page.locator("[data-download-optin339] input[type=checkbox]");
  assert.equal(await opt.isChecked(),false);
  assert.equal(await page.evaluate(()=>localStorage.getItem("strumentini:auto-download:v1")),null);
  const [manual]=await Promise.all([page.waitForEvent("download"),page.getByRole("button",{name:/Scarica/u}).click()]);
  assert.equal(manual.suggestedFilename(),"deduped.csv");
  assert.match(await readFile(await manual.path(),"utf8"),/first,1/u);
  let autoDownloads=0;
  page.on("download",()=>autoDownloads++);
  await opt.check();
  assert.equal(await page.evaluate(()=>localStorage.getItem("strumentini:auto-download:v1")),"enabled");
  await page.waitForTimeout(180);
  assert.equal(autoDownloads,0,"opt-in must not download an already completed CSV");
  const future=page.waitForEvent("download",{timeout:12_000});
  await produce(page,"second");
  const auto=await future;
  assert.equal(auto.suggestedFilename(),"deduped.csv");
  assert.match(await readFile(await auto.path(),"utf8"),/second,1/u);
  assert.equal(autoDownloads,1,"exactly one auto download per valid output");

  await page.evaluate(()=>{
    window.__realCreateObjectURL339=URL.createObjectURL;
    URL.createObjectURL=()=>{throw new DOMException("download denied","SecurityError");};
  });
  await produce(page,"denied");
  await page.getByText("Download automatico non disponibile",{exact:false}).waitFor();
  assert.equal(autoDownloads,1);
  await page.evaluate(()=>{URL.createObjectURL=window.__realCreateObjectURL339;});
  await opt.uncheck();
  assert.equal(await page.evaluate(()=>localStorage.getItem("strumentini:auto-download:v1")),null);
  await produce(page,"revoked");
  await page.waitForTimeout(220);
  assert.equal(autoDownloads,1,"revocation must prevent subsequent automatic downloads");
  assert.deepEqual(errors,[]);
  assert.deepEqual(requests,[]);

  const deniedContext=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
  await deniedContext.addInitScript(()=>{
    const real=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      if(key==="strumentini:auto-download:v1") throw new DOMException("storage denied","SecurityError");
      return real.call(this,key,value);
    };
  });
  const denied=await deniedContext.newPage();
  await denied.route("**/api/auth/session",route=>route.fulfill({status:200,contentType:"application/json",body:'{"authenticated":false}'}));
  await hydrate(denied);
  await produce(denied,"storage-denied");
  const deniedToggle=denied.locator('[data-download-optin339] input[type="checkbox"]');
  await deniedToggle.click();
  assert.equal(await deniedToggle.isChecked(),false);
  await denied.getByText("Impossibile salvare la preferenza",{exact:false}).waitFor();
  const denialManual=denied.waitForEvent("download");
  await denied.getByRole("button",{name:/Scarica/u}).click();
  assert.match(await readFile(await (await denialManual).path(),"utf8"),/storage-denied/u);
  await deniedContext.close();
  console.log("#339 CSV browser PASS: real bytes/manual, auto OFF, future one-shot opt-in, denied API, revoke, denied storage/manual fallback, 390px and zero uploads");
} finally {
  await context.close();
  await browser.close();
}
