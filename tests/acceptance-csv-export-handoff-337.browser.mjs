/** #337: native CSV File handoff between REAL Astro routes, manual dedupe/export, independent Python CSV readback. */
import { strict as assert } from "node:assert";
import { spawn, execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { chromium, firefox, webkit } from "@playwright/test";

const root=resolve(import.meta.dirname,"..");
const existingOrigin=process.env.CSV337_ORIGIN;
const port=await new Promise((resolvePort,reject)=>{
  const probe=createServer();
  probe.once("error",reject);
  probe.listen(0,"127.0.0.1",()=>{
    const address=probe.address();
    if (!address || typeof address==="string") return reject(new Error("No local test port"));
    probe.close(()=>resolvePort(address.port));
  });
});
const origin=existingOrigin ?? `http://127.0.0.1:${port}`;
const server=existingOrigin===undefined
  ? spawn(resolve(root,"node_modules/.bin/astro"),["dev","--host","127.0.0.1","--port",String(port)],{cwd:root,stdio:["ignore","pipe","pipe"]})
  : null;
let serverErrors="";
server?.stderr.on("data",chunk=>{serverErrors+=String(chunk).slice(0,3000);});
const source=Buffer.from("name,amount\r\nMarta,12\r\nMarta,12\r\nLuca,9\r\n");
async function waitForServer(){
  for(let tries=0;tries<100;tries++){
    if(server!==null && server.exitCode!==null) throw new Error(`Astro exited ${server.exitCode}: ${serverErrors}`);
    try {
      const response=await fetch(`${origin}/tools/csv-cleaner/`,{signal:AbortSignal.timeout(1200)});
      if(response.ok) return;
    } catch { /* local Astro may still be starting */ }
    await new Promise(resolve=>setTimeout(resolve,170));
  }
  throw new Error(`Astro route not ready: ${serverErrors}`);
}
try {
  await waitForServer();
  for(const engine of [chromium,firefox,webkit]) {
    const browser=await engine.launch({headless:true});
    try {
      const context=await browser.newContext({acceptDownloads:true});
      const page=await context.newPage();
      const offOrigin=[],pageErrors=[],downloads=[];
      context.on("request",request=>{
        const url=request.url();
        if(!url.startsWith(origin) && !url.startsWith("blob:") && !url.startsWith("data:")) offOrigin.push(url);
      });
      context.on("page",popup=>{popup.on("pageerror",error=>pageErrors.push(error.message));popup.on("download",download=>downloads.push(download.suggestedFilename()));});
      page.on("pageerror",error=>pageErrors.push(error.message));
      assert.equal((await page.goto(`${origin}/tools/csv-cleaner/`,{waitUntil:"domcontentloaded"}))?.status(),200);
      await page.waitForFunction(()=>[...document.querySelectorAll("astro-island")].every(island=>!island.hasAttribute("ssr")),{timeout:25000});
      await page.getByLabel("File CSV").setInputFiles({name:"records.csv",mimeType:"text/csv",buffer:source});
      await page.getByRole("button",{name:"Pulisci CSV"}).click();
      const transfer=page.locator("[data-csv-export-handoff-337]");
      await transfer.waitFor({timeout:35000});
      assert.equal(await page.locator('[data-download-optin339] input[type="checkbox"]').isChecked(),false);
      const popupEvent=page.waitForEvent("popup");
      await transfer.click();
      const popup=await popupEvent;
      await popup.getByText("records.clean.csv",{exact:false}).first().waitFor({timeout:35000});
      assert.equal(new URL(popup.url()).pathname,"/tools/csv-dedupe/");
      assert.equal(new URL(popup.url()).hash,"", "One-use capability removed");
      assert.equal(await popup.locator('[data-result-class="table"]').count(),0,"No automatic CSV transform");
      assert.deepEqual(downloads,[],"No download before manual opt-in");
      assert.equal(await popup.locator('[data-download-optin339]').count(),0,"No automatic download before results");
      await popup.getByRole("button",{name:"Rimuovi duplicati"}).click();
      await popup.locator('[data-result-class="table"]').waitFor({timeout:35000});
      assert.equal(await popup.locator('[data-download-optin339] input[type="checkbox"]').isChecked(),false);
      const pending=popup.waitForEvent("download");
      await popup.locator('[data-result-action="download"]').click();
      const download=await pending;
      assert.equal(download.suggestedFilename(),"deduped.csv");
      const bytes=readFileSync(await download.path());
      const python=String.raw`import sys,csv,io,json
text=open(sys.argv[1],'rb').read().decode('utf-8',errors='strict')
data=list(csv.reader(io.StringIO(text,newline='')))
assert data==[['name','amount'],['Marta','12'],['Luca','9']],data
print('CSV_INDEPENDENT_PASS '+json.dumps(data))`;
      const check=execFileSync("python3",["-c",python,await download.path()],{encoding:"utf8",timeout:10000}).trim();
      assert.match(check,/CSV_INDEPENDENT_PASS/);
      await popup.getByRole("radio",{name:/Colonne chiave/}).check();
      assert.equal(await popup.locator('[data-result-class="table"]').count(),0,"Switching dedupe mode invalidates old export");
      await popup.getByRole("checkbox",{name:/Colonna 1: name/}).check();
      await popup.getByRole("button",{name:"Rimuovi duplicati"}).click();
      await popup.locator('[data-result-class="table"]').waitFor({timeout:35000});
      await popup.getByRole("checkbox",{name:/Colonna 1: name/}).uncheck();
      assert.equal(await popup.locator('[data-result-class="table"]').count(),0,"Changing key columns invalidates old export");
      assert.deepEqual(offOrigin,[],"No off-site requests");
      assert.deepEqual(pageErrors,[],"No page JS errors");
      console.log(`${engine.name()} REAL ROUTES CSV cleaner→file handoff→dedupe→manual CSV export→Python csv PASS (${bytes.length} bytes)`);

      // Even if the already-staged native File later fails reading, show an explicit error and never run/export.
      if(engine===chromium) {
        const denied=await browser.newContext({acceptDownloads:true});
        await denied.addInitScript(()=>{
          const original=File.prototype.stream;
          File.prototype.stream=function(){
            if(this.name.endsWith(".clean.csv")) throw new Error("Simulated local File.stream denial #337");
            return original.call(this);
          };
        });
        try {
          const deniedPage=await denied.newPage();
          await deniedPage.goto(`${origin}/tools/csv-cleaner/`);
          await deniedPage.waitForFunction(()=>[...document.querySelectorAll("astro-island")].every(island=>!island.hasAttribute("ssr")));
          await deniedPage.getByLabel("File CSV").setInputFiles({name:"records.csv",mimeType:"text/csv",buffer:source});
          await deniedPage.getByRole("button",{name:"Pulisci CSV"}).click();
          const deniedTransfer=deniedPage.locator("[data-csv-export-handoff-337]");
          await deniedTransfer.waitFor({timeout:35000});
          const pendingPopup=deniedPage.waitForEvent("popup");
          await deniedTransfer.click();
          const deniedPopup=await pendingPopup;
          await deniedPopup.getByText("Impossibile leggere il file CSV.").waitFor({timeout:35000});
          assert.equal(await deniedPopup.locator('[data-result-class="table"]').count(),0);
          assert.equal(new URL(deniedPopup.url()).hash,"");
          console.log("chromium #337 staged File read-denied: visible failure, no auto run/export PASS");
        } finally {await denied.close();}
      }
    } finally {await browser.close();}
  }
  console.log("PASS #337 CSV real Astro routes across Chromium, Firefox, WebKit; no egress/auto-download");
} finally {
  if(server!==null) {
    server.kill("SIGTERM");
    await new Promise(resolve=>{if(server.exitCode!==null)return resolve();server.once("exit",resolve);setTimeout(resolve,1500).unref();});
  }
}
