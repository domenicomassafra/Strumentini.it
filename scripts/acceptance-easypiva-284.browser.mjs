/** Browser-local acceptance for #284. All page requests must stay on loopback. */
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

const server = await createServer({ server: { host: "127.0.0.1", port: 0, strictPort: false },
  configFile: false, root: process.cwd(), logLevel: "error" });
let browser;
try {
  await server.listen();
  const address = server.httpServer.address();
  assert.equal(typeof address, "object");
  const base = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let externalRequests = 0;
  let outgoingPosts = 0;
  let localRequests = 0;
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== base) { externalRequests++; return route.abort(); }
    if (request.method() !== "GET") { outgoingPosts++; return route.abort(); }
    localRequests++;
    if (url.pathname === "/") return route.fulfill({ status: 200, contentType: "text/html",
      body: "<!doctype html><html lang=it><meta charset=utf-8><title>STR-284 local</title></html>" });
    return route.continue();
  });
  await page.goto(base, { waitUntil: "load" });
  const result = await page.evaluate(async () => {
    const engine = await import("/src/engines/italy/forfettario-2026-284.ts");
    const input = { taxYear: 2026, atecoVersion: "ATECO2025", atecoCode: "74.30.00",
      priorYearReceiptsCents: 5_000_000, declaresEligible: true, declaredTaxRate: "standard-15",
      inpsProfile: "professional-no-other-mandatory-pension-coverage",
      declaresOrdinaryProfessional: true, paidMandatoryContributionsCents: 500_000 };
    const estimate = engine.calculateForfettario2026_284({ ...input, yearReceiptsCents: 4_000_000 });
    const target = engine.calculateTargetNet2026_284({ ...input, targetAnnualNetCents: 3_000_000 });
    const plan = engine.buildPlanningProjection2026_284(2026, Array(12).fill(750_000));
    let refused = false;
    try { engine.calculateForfettario2026_284({ ...input, atecoCode: "69.10.10", yearReceiptsCents: 4_000_000 }); }
    catch (error) { refused = String(error).includes("UNVERIFIED_ATECO"); }
    return { net: estimate.netAfterPaidAndTaxCents, inpsDue: estimate.forecastContributionsDueCents,
      required: target.requiredAnnualReceiptsCents, targetNet: target.forecastNetAfterDueAndTaxCents,
      warning: plan.warnings[0], refused };
  });
  assert.equal(result.net, 3_107_000);
  assert.equal(result.inpsDue, 813_384);
  assert.ok(result.targetNet >= 3_000_000);
  assert.equal(result.warning, "FORF284_OVER_85K_NEXT_YEAR_EXIT");
  assert.equal(result.refused, true);
  assert.equal(externalRequests, 0);
  assert.equal(outgoingPosts, 0);
  assert.ok(localRequests >= 2);
  console.log("STR284_BROWSER_PASS", JSON.stringify({ ...result, localRequests, externalRequests, outgoingPosts }));
} finally {
  if (browser) await browser.close();
  await server.close();
}
