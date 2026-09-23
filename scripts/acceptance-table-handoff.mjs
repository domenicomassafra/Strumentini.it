import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root=resolve(import.meta.dirname,"..");
const port=18140;
const origin=`http://127.0.0.1:${port}`;
const server=spawn("python3",["-m","http.server",String(port),"--bind","127.0.0.1","--directory","dist"],{stdio:"ignore"});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sensitive=["1,Ada","2,Grace","ada@example.com"];

function assertLocalRequests(requests,label){
  for(const request of requests){const body=`${request.url}\n${request.postData??""}`;if(!request.url.startsWith(origin)||request.method!=="GET"||sensitive.some(value=>body.includes(value)))throw new Error(`${label}: external or task-content network request ${request.method} ${request.url}`);}
}

async function storageContains(page,needle){
  return page.evaluate(async value=>{
    const basic=JSON.stringify({local:{...localStorage},session:{...sessionStorage}});
    if(basic.includes(value))return true;
    const dbs=typeof indexedDB.databases==="function"?await indexedDB.databases():[];
    for(const info of dbs){if(!info.name)continue;const db=await new Promise((resolve,reject)=>{const request=indexedDB.open(info.name);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});for(const store of [...db.objectStoreNames]){const tx=db.transaction(store,"readonly");const values=await new Promise((resolve,reject)=>{const request=tx.objectStore(store).getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});if(JSON.stringify(values).includes(value)){db.close();return true;}}db.close();}
    return false;
  },needle);
}

try{
  await sleep(400);
  const browser=await chromium.launch({executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  const cleaner=await context.newPage();
  const cleanerRequests=[];cleaner.on("request",request=>cleanerRequests.push({url:request.url(),method:request.method(),postData:request.postData()}));
  await cleaner.goto(`${origin}/tools/csv-cleaner/`,{waitUntil:"networkidle"});
  const csv="\uFEFFid,name\r\n1,Ada\r\n1,Ada\r\n2,Grace\r\n";
  await cleaner.getByLabel("CSV file").setInputFiles({name:"people.csv",mimeType:"text/csv",buffer:Buffer.from(csv)});
  const requestStart=cleanerRequests.length;
  await cleaner.getByRole("button",{name:"Clean CSV"}).press("Enter");
  await cleaner.getByText(/3 data rows × 2 columns/u).waitFor();
  await cleaner.getByRole("button",{name:"Dismiss handoff"}).click();
  await cleaner.getByText("Handoff dismissed. The cleaned result remains on this page only.",{exact:true}).waitFor();
  if(context.pages().length!==1)throw new Error("dismiss created a target window");

  await cleaner.getByRole("button",{name:"Clean CSV"}).press("Enter");
  await cleaner.getByRole("button",{name:"Pass to CSV Dedupe"}).waitFor();
  const targetPromise=context.waitForEvent("page");
  await cleaner.getByRole("button",{name:"Pass to CSV Dedupe"}).click();
  const dedupe=await targetPromise;
  const dedupeRequests=[];dedupe.on("request",request=>dedupeRequests.push({url:request.url(),method:request.method(),postData:request.postData()}));
  await dedupe.waitForLoadState("networkidle");
  await dedupe.getByText(/Received from handoff · 3 data rows × 2 columns/u).waitFor();
  if(dedupe.url().includes("1%2CAda")||dedupe.url().includes("1,Ada")||dedupe.url().includes("handoff="))throw new Error("handoff payload/token remained in target URL after transfer");
  if(await storageContains(dedupe,"1,Ada"))throw new Error("handoff payload persisted in browser storage");
  await dedupe.getByRole("button",{name:"Remove duplicates"}).press("Enter");
  await dedupe.getByText("1 duplicate row removed · 2 data rows remain",{exact:true}).waitFor();
  await dedupe.getByText("id,name\n1,Ada\n2,Grace",{exact:true}).waitFor();
  await dedupe.setViewportSize({width:390,height:844});
  if(await dedupe.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth))throw new Error("CSV Dedupe 390px horizontal overflow");

  const mapper=await context.newPage();
  const mapperRequests=[];mapper.on("request",request=>mapperRequests.push({url:request.url(),method:request.method(),postData:request.postData()}));
  await mapper.goto(`${origin}/tools/csv-column-map/`,{waitUntil:"networkidle"});
  const mapCsv="first,last,email\nAda,Lovelace,ada@example.com\nGrace,Hopper,grace@example.com";
  await mapper.getByLabel("CSV file").setInputFiles({name:"contacts.csv",mimeType:"text/csv",buffer:Buffer.from(mapCsv)});
  await mapper.getByRole("button",{name:"Move source column 3 up"}).click();
  await mapper.getByRole("button",{name:"Move source column 3 up"}).click();
  await mapper.getByLabel("Output name for source column 1").fill("first_name");
  await mapper.getByText("Output schema:").waitFor();
  await mapper.getByRole("button",{name:"Apply column map"}).press("Enter");
  await mapper.getByText(/3 output columns · 0 dropped/u).waitFor();
  await mapper.getByText(/email,first_name,last/u).waitFor();
  await mapper.setViewportSize({width:390,height:844});
  if(await mapper.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth))throw new Error("CSV Column Map 390px horizontal overflow");

  assertLocalRequests(cleanerRequests.slice(requestStart),"Cleaner");
  assertLocalRequests(dedupeRequests,"Dedupe");
  assertLocalRequests(mapperRequests,"Column Map");
  await mkdir(resolve(root,"quality/receipts/table-ops"),{recursive:true});
  await writeFile(resolve(root,"quality/receipts/table-ops/browser-acceptance.json"),`${JSON.stringify({schemaVersion:1,status:"PASS",cleanerToDedupe:{preview:"PASS",dismiss:"PASS",explicitTransfer:"PASS",targetReceivesPayload:"PASS",payloadInUrl:false,payloadPersisted:false},csvDedupe:{keyboard:"PASS",mobile390:"PASS",stableOutput:"PASS"},csvColumnMap:{keyboard:"PASS",mobile390:"PASS",schemaPreview:"PASS",reorderRename:"PASS"},network:"same-origin GET assets only; no task content"},null,2)}\n`);
  await context.close();await browser.close();console.log("table browser acceptance PASS: Cleaner→Dedupe preview/dismiss/transfer, no persistence, Dedupe + Column Map keyboard/mobile/locality");
}finally{server.kill("SIGTERM");}
