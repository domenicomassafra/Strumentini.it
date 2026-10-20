/** STR-292: built /tools/csv-join/ browser download and independent Python readback. */
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const origin = process.env.STR292_BUILD_ORIGIN;
if (!origin || !/^https?:\/\/127\.0\.0\.1:\d+\/?$/.test(origin)) {
  throw new Error("Set STR292_BUILD_ORIGIN=http://127.0.0.1:<port> to a server serving built dist/");
}
const url = new URL("/tools/csv-join/", origin).href;
const directory = mkdtempSync(join(tmpdir(), "str-292-built-ui-"));
const browser = await chromium.launch({ headless: true });
try {
  for (const kind of ["desktop", "mobile-emulated"]) {
    const mobile = kind !== "desktop";
    const context = await browser.newContext({
      acceptDownloads: true,
      viewport: mobile ? { width: 375, height: 667 } : { width: 1440, height: 900 },
      isMobile: mobile, hasTouch: mobile,
    });
    try {
      const page = await context.newPage();
      const pageErrors = [], external = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("request", (request) => {
        if (new URL(request.url()).origin !== new URL(origin).origin) external.push(request.url());
      });
      const response = await page.goto(url);
      assert.equal(response?.status(), 200);
      // The HTML can be served before Astro/Preact has hydrated its form.
      await page.waitForFunction(() => [...document.querySelectorAll("astro-island")]
        .some((island) => island.querySelector("form textarea") && !island.hasAttribute("ssr")));
      await page.locator("textarea").nth(0).fill("id,name\n001,Zoë\n1,李\nNULL,=2+3");
      await page.locator("textarea").nth(1).fill("id,city\n001,Roma\n1,Bari\nNULL,=SUM(1;2)");
      await page.getByLabel("Tipo di unione").selectOption("full");
      await page.locator('form button[type="submit"]').click();
      const summary = page.locator('[data-result-slot="summary"]');
      await summary.getByText("4 righe · 4 colonne").waitFor({ timeout: 10000 });
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: "Scarica risultato" }).click(),
      ]);
      const path = join(directory, `${kind}.csv`);
      await download.saveAs(path);
      const python = spawnSync("python3", ["-c", `import csv,sys,json
with open(sys.argv[1],encoding='utf-8-sig',newline='') as f: rows=list(csv.reader(f))
assert rows==[['id','name','id_right','city_right'],['001','Zoë','001','Roma'],['1','李','1','Bari'],['NULL',"'=2+3",'',''],['','','NULL',"'=SUM(1;2)"]],rows
print(json.dumps({'rows':len(rows)-1,'header':rows[0]},ensure_ascii=False))`, path], { encoding: "utf8" });
      assert.equal(python.status, 0, python.stderr);
      assert.deepEqual(pageErrors, []);
      assert.deepEqual(external, []);
      console.log(JSON.stringify({
        kind, http: response.status(), download: download.suggestedFilename(),
        python: JSON.parse(python.stdout), pageErrors: pageErrors.length, externalRequests: external.length,
      }));
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  rmSync(directory, { recursive: true, force: true });
}
