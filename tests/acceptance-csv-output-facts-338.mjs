// #338: actual producer UI and byte-derived CSV output facts in Chrome.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const base = (process.argv[2] ?? "http://127.0.0.1:4932").replace(/\/$/u, "");
const browser = await chromium.launch({headless:true, executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
const context = await browser.newContext({acceptDownloads:true,viewport:{width:390,height:844}});
const page = await context.newPage();
const errors=[];
const uploads=[];
// Astro dev serves no auth endpoint; answer locally as signed-out rather than
// misclassifying that expected 404 as a CSV producer/browser failure.
await page.route("**/api/auth/session",route=>route.fulfill({
  status:200, contentType:"application/json",body:JSON.stringify({authenticated:false}),
}));
page.on("pageerror", error=>errors.push(error.message));
page.on("console", message=>{if (message.type()==="error") errors.push("console: "+message.text());});
page.on("response",response=>{if(response.status()>=400) errors.push("HTTP "+response.status()+" "+response.url());});
page.on("requestfailed",request=>errors.push("failed: "+request.url()+" "+request.failure()?.errorText));
page.on("request", req=>{
  if (!["GET","HEAD"].includes(req.method()) || !req.url().startsWith(base+"/")) uploads.push(req.method()+" "+req.url());
});
try {
  page.setDefaultTimeout(25_000);
  page.setDefaultNavigationTimeout(90_000);
  assert.equal((await page.goto(base+"/tools/csv-dedupe/",{waitUntil:"domcontentloaded"}))?.status(),200);
  // Astro SSR is present before Preact listeners attach. The SSR attribute is
  // removed by Astro only after hydration finishes; wait for that contract.
  const island=page.locator('astro-island[component-url*="CsvDedupeTool"]');
  await island.first().waitFor();
  try { await page.waitForFunction(() => {
    const candidate=document.querySelector('astro-island[component-url*="CsvDedupeTool"]');
    return candidate && !candidate.hasAttribute("ssr");
  },{timeout:14_000}); }
  catch(error) {
    throw new Error(`${error.message}; hydration=${JSON.stringify({islands:await page.locator('astro-island').evaluateAll(elements=>elements.map(el=>({component:el.getAttribute('component-url'),ssr:el.hasAttribute('ssr')}))),errors})}`);
  }
  const input=page.getByLabel("File CSV");
  const csv='name,value\r\n"first, last","quoted\nline"\r\nother,2\r\n"first, last","quoted\nline"\r\n';
  await input.setInputFiles({name:"source.csv",mimeType:"text/csv",buffer:Buffer.from(csv)});
  try { await page.getByText(/source\.csv ·/u).waitFor({timeout:12_000}); }
  catch(error) {
    throw new Error(`${error.message}; before-run=${JSON.stringify({alerts:await page.locator('[role="alert"]').allInnerTexts(),status:await page.locator('[role="status"]').allInnerTexts(),fileInput:await input.evaluate(el=>({name:el.files?.[0]?.name,size:el.files?.[0]?.size})),body:(await page.locator('body').innerText()).slice(-2000),errors})}`);
  }
  await page.getByRole("button",{name:"Rimuovi duplicati"}).click();
  try { await page.locator('[data-output-facts-338="available"]').waitFor(); }
  catch(error) {
    throw new Error(`${error.message}; diagnostic=${JSON.stringify({alerts:await page.locator('[role="alert"]').allInnerTexts(), status:await page.locator('[role="status"]').allInnerTexts(), result:await page.locator('[data-result-class]').count(), body:(await page.locator('body').innerText()).slice(-2500), errors})}`);
  }
  assert.match(await page.locator('[data-output-facts-338="available"]').innerText(),/CSV riletto: 2 righe dati, 2 colonne/u);
  const downloadPromise=page.waitForEvent("download");
  await page.getByRole("button",{name:/Scarica/u}).click();
  const downloaded=await downloadPromise;
  assert.equal(downloaded.suggestedFilename(),"deduped.csv");
  const content=await readFile(await downloaded.path(),"utf8");
  assert(content.includes('"first, last"'));
  assert(content.includes('quoted\nline'));
  assert.equal(content.match(/first, last/gu)?.length,1);
  assert.deepEqual(errors,[]);
  assert.deepEqual(uploads,[],"real output is kept local; no upload or external traffic");
  console.log("PASS #338 CSV-dedupe real Chromium: multiline/quoted CSV actual output readback facts 2x2, download re-opened, zero uploads/errors");
} finally {
  await context.close();
  await browser.close();
}
