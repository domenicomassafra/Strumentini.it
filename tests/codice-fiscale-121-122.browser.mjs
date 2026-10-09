/** Source-only #121/#122 Chromium acceptance, deliberately no production route.
 * Run: node tests/codice-fiscale-121-122.browser.mjs
 */
import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const vite = await createServer({
  configFile: false, root, logLevel: "error",
  server: { host: "127.0.0.1", port: 0, strictPort: false },
  plugins: [{
    name: "codice-fiscale-offline-acceptance",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== "/__cf-acceptance") return next();
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end('<!doctype html><html lang="it"><body>CF local engine acceptance</body></html>');
      });
    },
  }],
});
let browser;
try {
  await vite.listen();
  const addr = vite.httpServer?.address();
  assert(addr && typeof addr !== "string");
  const origin = `http://127.0.0.1:${addr.port}`;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const offsite = [];
  const scriptErrors = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(origin) && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) offsite.push(request.url());
  });
  page.on("pageerror", (error) => scriptErrors.push(error.message));
  assert.equal((await page.goto(`${origin}/__cf-acceptance`))?.status(), 200);
  const output = await page.evaluate(async () => {
    const { generateCodiceFiscale121, validateCodiceFiscale121, codiceFiscaleChecksum121 } =
      await import("/src/engines/italy/codice-fiscale-121.ts");
    const { decodeCodiceFiscale122 } = await import("/src/engines/italy/codice-fiscale-122.ts");
    const request = { surname: "Rossi", name: "Mario", sex: "M", birthDate: "2026-02-21",
      birthPlace: { kind: "current", istatCode: "058091" } };
    const generated = generateCodiceFiscale121(request);
    const decoded = decodeCodiceFiscale122(generated.status === "GENERATED_CANDIDATE" ? generated.code : "");
    const formal = validateCodiceFiscale121("RSSMRA80A01H501U");
    const foreign = generateCodiceFiscale121({ ...request, birthPlace: { kind: "foreign", istatCode: "201" } });
    const historical = generateCodiceFiscale121({ ...request, birthPlace: { kind: "suppressed", istatCode: "027810" } });
    const altBase = "RSSMRA80A01H50M";
    const omocode = decodeCodiceFiscale122(altBase + codiceFiscaleChecksum121(altBase));
    return { generated, decoded, formal, foreign, historical, omocode };
  });
  assert.equal(output.generated.status, "GENERATED_CANDIDATE");
  assert.equal(output.generated.code, "RSSMRA26B21H501N");
  assert.equal(output.generated.identityConfirmed, false);
  assert.equal(output.generated.officialAssignment, false);
  assert.equal(output.decoded.status, "DECODED_FORMALLY");
  assert.equal(output.decoded.geographyCandidates.find((candidate) => candidate.name === "Roma")?.belfiore, "H501");
  assert.equal(output.formal.status, "FORMALLY_VALID");
  assert.equal(output.foreign.reasonCode, "GEOGRAPHY_TEMPORAL_UNVERIFIED");
  assert.equal(output.historical.reasonCode, "GEOGRAPHY_CODE_UNAVAILABLE");
  assert.equal(output.omocode.omocodia[0]?.position, 15);
  assert.deepEqual(offsite, []);
  assert.deepEqual(scriptErrors, []);
  console.log("PASS #121/#122 real Chromium source-only / 390px / generation + formal + decode + historical/foreign refusal + omocodia + no offsite + no JS errors (11 checks)");
} finally {
  await browser?.close();
  await vite.close();
}
