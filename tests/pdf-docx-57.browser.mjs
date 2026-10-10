/** Real public PDF->DOCX browser flow, independently reopened by python-docx. */
import { chromium, firefox, webkit } from "@playwright/test";
import { spawn, execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.PDF57_PORT ?? 18557);
const origin = process.env.PDF57_ORIGIN ?? `http://127.0.0.1:${port}`;
const server = process.env.PDF57_ORIGIN ? null : spawn(resolve(root, "node_modules/.bin/astro"),
  ["dev", "--host", "127.0.0.1", "--port", String(port), "--ignore-lock"], { cwd: root, stdio: "ignore" });
const fixture = resolve(root, "quality/fixtures/pdf-gold/simple-3page.pdf");
const independent = String.raw`
import sys,zipfile,hashlib
from docx import Document
path=sys.argv[1]
with zipfile.ZipFile(path) as archive:
 assert archive.testzip() is None, 'ZIP CRC mismatch'
 assert 'word/document.xml' in archive.namelist()
doc=Document(path)
paragraphs=[p.text for p in doc.paragraphs if p.text]
assert len([p for p in paragraphs if p.startswith('Pagina PDF ')]) == 3, paragraphs
for page in (1,2,3):
 assert any(p.startswith('Pagina PDF '+str(page)+' di 3') for p in paragraphs), paragraphs
expected_hash=hashlib.sha256(open(sys.argv[2], 'rb').read()).hexdigest()
assert ('SHA-256 PDF: '+expected_hash) in paragraphs, 'DOCX provenance digest differs from source file'
assert any('testo selezionabile' in p for p in paragraphs)
assert len(paragraphs)>10
print('PDF57_INDEPENDENT_DOCX_PASS paragraphs='+str(len(paragraphs))+' pages=3 editable=true crc=true')
`;
let count = 0;
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    try { ready = (await fetch(`${origin}/tools/pdf-to-markdown/`)).ok; if (ready) break; } catch { /* waiting for dev startup */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(ready, "PDF to Markdown and DOCX public route unavailable");
  for (const [name, launcher] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await launcher.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
      const errors = [], offsite = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.route("**/*", (route) => {
        const url = route.request().url();
        if (url.startsWith(origin + "/") || url.startsWith("blob:") || url.startsWith("data:")) return route.continue();
        offsite.push(url); return route.abort();
      });
      assert.equal((await page.goto(`${origin}/tools/pdf-to-markdown/`, { waitUntil: "networkidle" }))?.status(), 200);
      const panel = page.locator("[data-pdf-docx-57]");
      await panel.waitFor({ timeout: 30_000 });
      await panel.locator('input[type="file"]').setInputFiles(fixture);
      await panel.getByRole("button", { name: "Crea DOCX modificabile" }).click();
      await Promise.race([
        panel.locator("[data-pdf-docx-57-result]").waitFor({ timeout: 45000 }),
        panel.locator('[role="alert"]').waitFor({ timeout: 45000 }).then(async () => { throw new Error(await panel.locator('[role="alert"]').innerText()); }),
      ]);
      assert.match(await panel.locator("[data-pdf-docx-57-result]").innerText(), /3 pagine/u);
      const [download] = await Promise.all([page.waitForEvent("download"), panel.locator("[data-pdf-docx-57-download]").click()]);
      assert.equal(download.suggestedFilename(), "simple-3page.docx");
      const location = await download.path();
      assert(location);
      const bytes = await readFile(location);
      assert.equal(bytes.toString("utf8", 0, 2), "PK");
      const independentResult = execFileSync("python3", ["-c", independent, location, fixture], { encoding: "utf8" });
      assert.match(independentResult, /PDF57_INDEPENDENT_DOCX_PASS/u);
      await panel.locator('input[type="file"]').setInputFiles(resolve(root, "quality/fixtures/pdf-gold/encrypted-mark.pdf"));
      assert.equal(await panel.locator("[data-pdf-docx-57-download]").count(), 0, "Changing input retained stale DOCX download");
      assert.deepEqual(errors, [], `${name}: browser JS failures`);
      assert.deepEqual(offsite, [], `${name}: offsite requests`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2), `${name}: 390px overflow`);
      count++;
      console.log(`PDF57_${name.toUpperCase()}_PASS independent-python-docx-open pages=3 bytes=${bytes.length}, no-offsite, stale-output-cleared`);
      await page.close();
    } finally { await browser.close(); }
  }
  console.log(`PDF57_BROWSER_PASS ${count}/3 independent real downloads and reopen`);
} finally { server?.kill("SIGTERM"); }
