/** STR-292: local Chromium desktop/mobile donor spike with CSP, network and independent Python CSV reopen. */
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const temp = mkdtempSync(join(tmpdir(), "str-292-browser-"));
const base = `
import { parseCsvTable } from "./src/engines/table/csv.ts";
import { joinCsvTables } from "./src/engines/table/operations.ts";

const left = parseCsvTable("id,name\\n001,Zoë\\n1,李\\nNULL,=2+3");
const right = parseCsvTable("id,city\\n001,Roma\\n1,Bari\\nNULL,=SUM(1;2)");
`;
const donorOperation = `
const native = aq.from(left.rows.map(row => ({ id: row[0], name: row[1] })))
  .join(aq.from(right.rows.map(row => ({ id: row[0], city: row[1] }))), ["id"]);
window.__str292DonorRows = native.objects().length;
`;
const rest = `
const before = performance.now();
const legacy = joinCsvTables(left, right, {
  leftKeyColumns:[0],rightKeyColumns:[0],joinType:"full",
  nullTokens:["NULL"], nullKeyPolicy:"never-match",
});
const durationMs = performance.now() - before;
const blob = new Blob([legacy.output], {type:"text/csv;charset=utf-8"});
const url = URL.createObjectURL(blob);
const link = document.createElement("a");
link.href = url;
link.download = "joined-292.csv";
link.textContent = "Download CSV";
document.body.append(link);
window.__str292 = {sourceRows:left.rows.length+right.rows.length, outputRows:legacy.outputRows,
  expectedHeaders:legacy.table.header,
  durationMs, heapUsed:performance.memory?.usedJSHeapSize??null,
  userAgent:navigator.userAgent};
`;

const bundles = {};
for (const mode of ["baseline", "donor"]) {
  const contents = (mode === "donor" ? 'import * as aq from "arquero";\n' : "") + base
    + (mode === "donor" ? donorOperation : "") + rest;
  const built = await build({
    stdin: { contents, resolveDir: process.cwd(), sourcefile: "arquero-gate-292-browser.ts" },
    bundle: true, format: "esm", platform: "browser", minify: true, write: false,
  });
  bundles[mode] = built.outputFiles[0].contents;
}
const server = createServer((req, res) => {
  const relaxed = new URL(req.url, "http://127.0.0.1").searchParams.has("relaxed");
  res.setHeader("Content-Security-Policy", `default-src 'none'; script-src 'self'${relaxed ? " 'unsafe-eval'" : ""}; connect-src 'none'; img-src 'none'; style-src 'none'; object-src 'none'; base-uri 'none'; frame-src 'none'`);
  for (const mode of ["baseline", "donor"]) {
    if (req.url === `/${mode}.js`) { res.setHeader("Content-Type", "text/javascript"); res.end(bundles[mode]); return; }
  }
  const mode = req.url?.includes("mode=donor") ? "donor" : "baseline";
  res.setHeader("Content-Type", "text/html");
  res.end(`<!doctype html><html lang="it"><head><meta charset="utf-8"></head><body><script type="module" src="/${mode}.js"></script></body></html>`);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const url = `http://127.0.0.1:${address.port}/`;

let browser;
try {
  browser = await chromium.launch({headless:true});
  const results = [];
  for (const kind of ["desktop", "mobile-emulated"]) for (const mode of ["baseline", "donor", "donor-relaxed"]) {
    const context = await browser.newContext({
      acceptDownloads: true,
      viewport: kind === "desktop" ? {width:1440,height:900} : {width:375,height:667},
      isMobile: kind !== "desktop",
      hasTouch: kind !== "desktop",
    });
    const page = await context.newPage();
    const external = [];
    const cspErrors = [];
    page.on("request", request => {if (!request.url().startsWith(url)) external.push(request.url());});
    page.on("console", message => {if (message.text().includes("Content Security Policy")) cspErrors.push(message.text());});
    page.on("pageerror", error => cspErrors.push(error.message));
    await page.goto(url + `?mode=${mode === "baseline" ? mode : "donor"}${mode === "donor-relaxed" ? "&relaxed=1" : ""}`, {waitUntil:"load"});
    if (mode === "donor") {
      await page.waitForTimeout(200);
      if (!cspErrors.some(message => message.includes("unsafe-eval"))) throw new Error(`Expected donor CSP failure: ${JSON.stringify(cspErrors)}`);
      if (external.length !== 0) throw new Error(`Unexpected outbound traffic: ${external}`);
      results.push({kind,mode,donorCspRejected:true,externalRequests:external.length,error:cspErrors[0]});
      await context.close();
      continue;
    }
    await page.locator("a[download]").waitFor({state:"attached",timeout:4000});
    const browserResult = await page.evaluate(() => window.__str292);
    if (mode === "donor-relaxed") {
      const donorRows = await page.evaluate(() => window.__str292DonorRows);
      if (donorRows !== 3) throw new Error(`Donor failed positive control with permissive CSP: ${donorRows}`);
      if (external.length !== 0 || cspErrors.length !== 0) throw new Error(JSON.stringify({external,cspErrors}));
      results.push({kind,mode,donorRows,externalRequests:external.length,cspErrors:cspErrors.length});
      await context.close();
      continue;
    }
    const [download] = await Promise.all([page.waitForEvent("download"), page.locator("a[download]").click()]);
    const path = join(temp, `${kind}-${mode}.csv`);
    await download.saveAs(path);
    const validator = `import sys,csv,json
with open(sys.argv[1], newline='', encoding='utf-8') as f:
  rows=list(csv.reader(f))
assert len(rows)==5, (len(rows),rows)
assert rows[0]==['id','name','id_right','city_right'],rows[0]
assert rows[1]==['001','Zoë','001','Roma'],rows[1]
assert rows[2]==['1','李','1','Bari'],rows[2]
assert rows[3]==['NULL',"'=2+3",'',''],rows[3]
assert rows[4]==['','','NULL',"'=SUM(1;2)"],rows[4]
print(json.dumps({'rows':len(rows)-1,'header':rows[0],'formula_literal':rows[-1][-1]},ensure_ascii=False))
`;
    const python = spawnSync("python3", ["-c",validator,path], {encoding:"utf8"});
    if (python.status !== 0) throw new Error(`independent CSV reopen failed: ${python.stderr}`);
    if (external.length !== 0 || cspErrors.length !== 0) throw new Error(JSON.stringify({external,cspErrors}));
    results.push({kind,mode, ...browserResult, externalRequests:external.length, cspErrors:cspErrors.length,
      download:download.suggestedFilename(), python:JSON.parse(python.stdout)});
    await context.close();
  }
  console.log(JSON.stringify({bundleBytes:Object.fromEntries(Object.entries(bundles).map(([key,val])=>[key,val.length])),results},null,2));
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
  rmSync(temp,{recursive:true,force:true});
}
