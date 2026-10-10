// End-to-end REAL browser PDF.js conversion, downloaded OOXML and independent
// python-pptx/Pillow reopen. Does not claim mobile physical hardware.
import { spawn, execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolve } from "node:path";
import { strict as assert } from "node:assert";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const port = 18455;
const origin = (process.env.PDF255_ORIGIN ?? `http://127.0.0.1:${port}`).replace(/\/$/u, "");
const server = process.env.PDF255_ORIGIN ? null : spawn(resolve(root, "node_modules/.bin/astro"),
  ["dev", "--host", "127.0.0.1", "--port", String(port), "--ignore-lock"], { cwd: root, stdio: "ignore" });
let browser;
let checks = 0;
try {
  let ready = false;
  for (let n = 0; n < 100; n++) {
    try { ready = (await fetch(`${origin}/tools/pdf-to-images/`)).ok; if (ready) break; } catch { /* start-up */ }
    await new Promise(done => setTimeout(done, 100));
  }
  assert(ready, "PDF image tool route available");
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const errors = [];
  const requestBodies = [];
  page.on("pageerror", err => errors.push(err.message));
  page.on("request", request => {
    if (!request.url().startsWith(origin) && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) {
      requestBodies.push(`external ${request.url()}`);
    }
    if (request.method() !== "GET" || request.postData() !== null) requestBodies.push(`write request ${request.method()} ${request.url()}`);
  });
  assert.equal((await page.goto(`${origin}/tools/pdf-to-images/`, { waitUntil: "networkidle" })).status(), 200);
  const panel = page.locator("[data-pdf-pptx-255]");
  await panel.waitFor({ timeout: 15_000 });
  await page.locator('[data-pdf-pptx-255-hydrated="true"]').waitFor({ timeout: 45_000 });
  assert.match(await panel.innerText(), /non ricostruzione modificabile/u);
  checks++;
  await panel.locator('input[type="file"]').setInputFiles(resolve(root, "quality/fixtures/pdf-gold/simple-3page.pdf"));
  await panel.getByLabel(/Pagine PDF/u).fill("3,1,2");
  await panel.getByRole("button", { name: "Converti PDF in PPTX" }).click();
  await Promise.race([
    panel.locator("[data-pdf-pptx-255-result]").waitFor({ timeout: 45_000 }),
    panel.locator("[data-pdf-pptx-255-status]").getByText(/PDF_PPTX_|INVALID_|ERROR/iu).waitFor({ timeout: 45_000 })
      .then(async () => { throw Error(await panel.locator("[data-pdf-pptx-255-status]").innerText()); }),
  ]);
  assert.match(await panel.locator("[data-pdf-pptx-255-result]").innerText(), /3 slide/iu);
  assert.match(await panel.locator("[data-pdf-pptx-255-result]").innerText(), /3, 1, 2/u);
  assert(await panel.locator("[data-pdf-pptx-255-preview]").evaluate(img => img.complete && img.naturalWidth > 0));
  await panel.locator("[data-pdf-pptx-255-preview]").screenshot({ path: join(tmpdir(), "strumentini-pdf-pptx-255-first-slide.png") });
  checks += 3;
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    panel.locator("[data-pdf-pptx-255-download]").click(),
  ]);
  assert.equal(download.suggestedFilename(), "pagine-pdf-come-slide.pptx");
  const path = await download.path();
  assert(path);
  const bytes = await readFile(path);
  assert.equal(bytes.subarray(0, 2).toString(), "PK");
  checks += 2;
  const python = String.raw`
import io,sys,zipfile,hashlib
from pptx import Presentation
from PIL import Image
path=sys.argv[1]
with open(path,"rb") as h: payload=h.read()
p=Presentation(io.BytesIO(payload))
assert len(p.slides)==3
with zipfile.ZipFile(io.BytesIO(payload)) as z:
    assert z.testzip() is None
    paths=sorted(n for n in z.namelist() if n.startswith("ppt/media/pdf-page-"))
    assert len(paths)==3
for idx,page in enumerate([3,1,2]):
    slide=p.slides[idx]
    assert len(slide.shapes)==1
    pic=slide.shapes[0]
    assert pic.shape_type==13
    assert pic.name==f"Pagina PDF {page} (immagine)"
    with Image.open(io.BytesIO(pic.image.blob)) as im:
        im.load()
        assert im.size[0]>100 and im.size[1]>100
        assert im.format=="PNG"
    assert pic.left>=0 and pic.top>=0
    assert pic.left+pic.width<=p.slide_width+1 and pic.top+pic.height<=p.slide_height+1
    assert abs(pic.width/pic.height - im.width/im.height)<0.01
print("PDF_PPTX_255_BROWSER_INDEPENDENT_REOPEN_PASS pages=3,1,2 slide_shapes=3 raster_PNG=3 zip_crc=PASS")
`;
  const independent = execFileSync("python3", ["-c", python, path], { encoding: "utf8" }).trim();
  assert.match(independent, /PDF_PPTX_255_BROWSER_INDEPENDENT_REOPEN_PASS/u);
  checks++;

  // Invalid selection must retire the previously downloadable PPTX.
  await panel.getByLabel(/Pagine PDF/u).fill("50");
  assert.equal(await panel.locator("[data-pdf-pptx-255-result]").count(), 0);
  await panel.getByRole("button", { name: "Converti PDF in PPTX" }).click();
  await panel.locator("[data-pdf-pptx-255-status]").getByText(/Selezione pagine/iu).waitFor({ timeout: 20_000 });
  assert.equal(await panel.locator("[data-pdf-pptx-255-download]").count(), 0);
  checks += 2;
  assert.deepEqual(errors, []);
  assert.deepEqual(requestBodies, []);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), "390px no horizontal overflow");
  checks += 3;
  console.log(`PDF_PPTX_255_BROWSER_PASS checks=${checks} ${independent}, download=<real PPTX> local only`);
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
