// #333: real Chromium HTMLInputElement filechooser through the live homepage.
// Invoke with: node tests/acceptance-file-format-333.mjs http://127.0.0.1:4966
// Desktop browser/mobile viewport simulation, NOT native mobile OS picker proof.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

const base=(process.argv[2] ?? "http://127.0.0.1:4966").replace(/\/$/u,"");
const browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
const png=await readFile("quality/fixtures/image-metadata/synthetic-1x1-rgb.png");
const pdf=await readFile("quality/fixtures/pdf-gold/simple-2page.pdf");
const photo={name:"valid-image.png",mimeType:"image/png",buffer:png};
const validPdf={name:"valid-doc.pdf",mimeType:"application/pdf",buffer:pdf};
const zip=Buffer.from(zipSync({"payload.txt":strToU8("file-only payload")},{level:6}));
const polyglot=Buffer.concat([Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n"),zip,Buffer.from("\n%%EOF\n")]);
const context=await browser.newContext({viewport:{width:390,height:844}});
const page=await context.newPage();
page.setDefaultNavigationTimeout(90_000);
const unexpected=[];
const errors=[];
const resourceFailures=[];
page.on("pageerror",(error)=>errors.push(error.message));
page.on("requestfailed",(request)=>resourceFailures.push(`${request.url()} ${request.failure()?.errorText ?? "failed"}`));
page.on("response",(response)=>{
  if (response.status()>=400) resourceFailures.push(`${response.status()} ${response.url()}`);
});
page.on("request",(request)=>{
  if (request.method()!=="GET" && request.method()!=="HEAD") unexpected.push(`${request.method()} ${request.url()}`);
  if (!request.url().startsWith(base+"/")) unexpected.push(`offsite ${request.url()}`);
});

async function choose(selector,value) {
  const chooserPromise=page.waitForEvent("filechooser");
  await page.locator(selector).click();
  const chooser=await chooserPromise;
  assert.equal(chooser.isMultiple(),false);
  await chooser.setFiles(value);
  return chooser;
}
async function finished(pattern) {
  try {
    await page.locator("[data-home-file-status]").getByText(pattern).waitFor({timeout:12000});
  } catch {
    const moduleDiagnostic=await page.evaluate(async()=>{
      try { await import("/src/runtime/file-detection.ts"); return "direct module import OK"; }
      catch(error) { return String(error?.stack ?? error); }
    });
    throw Error(`Expected ${pattern}; status=${await page.locator("[data-home-file-status]").innerText()}; errors=${errors.join(" | ")}; network=${resourceFailures.slice(-20).join(" | ")}; module=${moduleDiagnostic}`);
  }
}
async function actions() {
  return page.locator("[data-home-file-action-format]:visible a").evaluateAll(
    (links)=>links.map((link)=>link.getAttribute("href")),
  );
}
async function verifyEmpty() {
  assert.deepEqual(await actions(),[]);
  assert.equal(await page.locator("[data-home-file-result]").isHidden(),true);
}

try {
  const response=await page.goto(base+"/",{waitUntil:"networkidle"});
  assert.equal(response?.status(),200);
  const files="[data-home-file-picker]";
  const photos="[data-home-photos-picker]";
  const status=page.locator("[data-home-file-status]");
  assert.equal(await page.locator('input[type="file"]').count(),2,"#336 retains exactly two separate native inputs");
  assert.equal(await page.locator(photos).getAttribute("accept"),"image/*");
  assert.equal(await page.locator(files).getAttribute("capture"),null);
  assert.equal(await page.locator(photos).getAttribute("capture"),null);
  assert.equal(await status.getAttribute("role"),"status");
  for (const [selector,id] of [[files,"home-file-picker"],[photos,"home-photos-picker"]]) {
    assert.equal(await page.locator(`label[for="${id}"]`).count(),1);
    await page.locator(selector).focus();
    assert(await page.locator(selector).evaluate((element)=>element===document.activeElement));
    assert((await page.locator(selector).boundingBox())?.height>=44);
  }
  await verifyEmpty();

  await choose(photos,photo);
  await finished(/PNG riconosciuto localmente/u);
  assert((await actions()).includes("/tools/image-metadata-viewer/"));
  assert.equal(await page.locator(photos).inputValue(),"");
  const prior=await actions();

  // An OS chooser cancel must preserve a good result and prevent unfinished
  // reads from replacing it after the user dismissed the picker.
  await page.evaluate(()=>{
    const original=File.prototype.slice;
    File.prototype.slice=function(...args) {
      const chunk=original.apply(this,args);
      if (this.name!=="slow.pdf") return chunk;
      return {arrayBuffer:()=>new Promise((resolve,reject)=>{
        window.__slowReadStarted=true;
        window.__releaseSlowRead=()=>chunk.arrayBuffer().then((result)=>{
          resolve(result);
          window.__slowReadReleased=true;
        },reject);
      })};
    };
  });
  await choose(files,{...validPdf,name:"slow.pdf"});
  await page.waitForFunction(()=>window.__slowReadStarted===true);
  assert.equal(await page.locator("[data-home-file-entry]").getAttribute("aria-busy"),"true");
  await page.locator(files).dispatchEvent("cancel");
  await finished(/Scelta annullata/u);
  assert.deepEqual(await actions(),prior);
  assert.equal(await page.locator("[data-home-file-entry]").getAttribute("aria-busy"),null);
  await page.evaluate(()=>window.__releaseSlowRead());
  await page.waitForFunction(()=>window.__slowReadReleased===true);
  await page.waitForTimeout(100); // flush completion microtasks in the real event loop
  assert.match(await status.innerText(),/Scelta annullata/u,"cancelled read must not publish an old success");
  assert.deepEqual(await actions(),prior);

  // OS error and zero-file chooser return preserve last good evidence.
  await page.locator(files).dispatchEvent("error");
  await finished(/Impossibile completare la selezione/u);
  assert.deepEqual(await actions(),prior);
  await page.locator(files).dispatchEvent("change");
  await finished(/Nessun nuovo file ricevuto/u);
  assert.deepEqual(await actions(),prior);

  await choose(files,{name:"wrong-type.png",mimeType:"application/pdf",buffer:pdf});
  await finished(/tipo dichiarato non coincide|estensione non coincide/iu);
  await verifyEmpty();

  await choose(files,{name:"masquerade.exe",mimeType:"",buffer:png});
  await finished(/estensione non coincide/u);
  await verifyEmpty();

  await choose(files,{name:"hybrid.pdf",mimeType:"application/pdf",buffer:polyglot});
  await finished(/strutture incompatibili o ambigue/u);
  await verifyEmpty();

  // The Photos chooser must not route a PDF to a PDF tool if the OS picker
  // incorrectly supplies the file despite the image/* accept hint.
  await choose(photos,validPdf);
  await finished(/selettore Foto.*immagini/u);
  await verifyEmpty();

  await choose(files,validPdf);
  await finished(/PDF riconosciuto localmente/u);
  assert((await actions()).includes("/tools/pdf-page-count-verifier/"));
  assert.equal(await page.locator(files).inputValue(),"");
  assert.equal(await page.locator(photos).inputValue(),"");
  assert.equal(unexpected.length,0,"no file upload/offsite transfer: "+unexpected.join(" | "));
  assert.deepEqual(errors,[],"no page errors");
  console.log("PASS #333 actual Chromium filechooser: #336 two accessible pickers, valid magic PDF/PNG, false MIME/extension and polyglot refusals, Photos scope, stale-read cancel, OS-error/empty retry, zero upload/offsite and no page errors.");
  console.log("NOT_RUN #333 native iOS/Android OS picker, hidden PDF object graph and full content decoders; detector success remains candidate-only.");
} finally {
  await context.close();
  await browser.close();
}
