import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type Locator, type Page } from "@playwright/test";
import { currentEvidenceSourceFingerprint } from "./lib/current-revision";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const port = Number(process.env.STRUMENTINI_DEVELOPER_WEB_OPERATIONS_PORT ?? 18205);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error(`invalid port ${String(port)}`);
const origin = `http://127.0.0.1:${port}`;
const outputPath = "quality/receipts/developer-web-operations/browser-acceptance.json";
const sleep = (ms: number) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

const toolIds = [
  "base-converter",
  "chmod-permission-helper",
  "cidr-calculator",
  "connection-device-info",
  "css-design-helper",
  "css-minifier",
  "html-minifier",
  "json-repair",
  "json-structural-diff",
  "json-type-schema-inference",
  "keyboard-event-diagnostic",
  "password-pin-passphrase-generator",
  "password-strength-estimator",
  "random-picker-team-coupon-generator",
  "sitemap-xml-generator",
  "x509-csr-inspector",
  "xml-formatter-validator",
] as const;

type ToolId = typeof toolIds[number];

interface TaskRequest {
  readonly url: string;
  readonly method: string;
  readonly postData: string | null;
}

interface BrowserResult {
  readonly toolId: ToolId;
  readonly oracleEntryId: string;
  readonly status: "PASS";
  readonly semanticAssertion: string;
  readonly outputSha256: string;
  readonly componentUrl: string;
  readonly componentAbsentFromHome: true;
  readonly externalTaskRequests: 0;
  readonly nonGetTaskRequests: 0;
  readonly taskContentLeaks: 0;
  readonly storageMutations: 0;
  readonly urlMutations: 0;
  readonly runtimeErrors: 0;
  readonly horizontalOverflow: false;
  readonly unlabeledControls: 0;
  readonly explicitReferenceRequests?: number;
}

function expectedStaticFailure(url: string): boolean {
  try {
    return new URL(url).pathname === "/api/auth/session";
  } catch {
    return false;
  }
}

function componentUrl(html: string, toolId: string): string {
  const match = html.match(/<astro-island\b[^>]*\bcomponent-url="([^"]+)"/u);
  if (match?.[1] === undefined) throw new Error(`${toolId}: hydrated component URL missing from built route`);
  return match[1];
}

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${origin}/tools/base-converter/`);
      if (response.ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error(`acceptance server did not start: ${origin}`);
}

async function browserStorage(page: Page): Promise<string> {
  return page.evaluate(() => JSON.stringify({
    local: Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key)]),
    session: Object.keys(sessionStorage)
      .filter((key) => key !== "strumentini:tool-opened:v1" && key !== "strumentini:tool-entry-source:v1")
      .sort()
      .map((key) => [key, sessionStorage.getItem(key)]),
  }));
}

async function a11yAudit(scope: Locator): Promise<string[]> {
  return scope.locator("input, textarea, select, button").evaluateAll((controls) => controls.filter((control) => {
    const element = control as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement;
    if (element instanceof HTMLInputElement && element.type === "hidden") return false;
    if (element instanceof HTMLButtonElement && (element.textContent ?? "").trim() !== "") return false;
    const id = element.getAttribute("id");
    return !element.getAttribute("aria-label")
      && !element.getAttribute("aria-labelledby")
      && element.closest("label") === null
      && !(id && document.querySelector(`label[for="${CSS.escape(id)}"]`));
  }).map((control) => control.outerHTML.slice(0, 180)));
}

async function setById(page: Page, id: string, value: string): Promise<void> {
  const control = page.locator(`#${id}`);
  await control.waitFor();
  const tag = await control.evaluate((element) => element.tagName);
  if (tag === "SELECT") await control.selectOption(value);
  else await control.fill(value);
}

async function submitGeneric(page: Page, toolId: ToolId, fields: Readonly<Record<string, string>>, expected: readonly RegExp[]): Promise<string> {
  for (const [field, value] of Object.entries(fields)) await setById(page, `${toolId}-${field}`, value);
  const island = page.locator("article[data-tool-page] astro-island").first();
  const form = island.locator("form").first();
  const submit = form.locator("button[type='submit']").first();
  await submit.focus();
  await page.keyboard.press("Enter");
  const gutter = island.locator(".gutter[data-state='success']").first();
  await gutter.waitFor({ timeout: 15_000 });
  const text = await gutter.innerText();
  for (const matcher of expected) if (!matcher.test(text)) throw new Error(`${toolId}: expected ${String(matcher)} in ${JSON.stringify(text.slice(0, 2400))}`);
  return text;
}

async function exerciseGeneric(page: Page, toolId: ToolId): Promise<{ text: string; assertion: string }> {
  if (toolId === "cidr-calculator") {
    return { text: await submitGeneric(page, toolId, { cidr: "192.0.2.129/24" }, [/192\.0\.2\.0\/24/u, /192\.0\.2\.255/u, /256/u]), assertion: "fixture IPv4 /24 network, broadcast and address count" };
  }
  if (toolId === "base-converter") {
    return { text: await submitGeneric(page, toolId, { value: "ff", fromBase: "16", toBase: "2" }, [/11111111/u, /\b255\b/u]), assertion: "fixture exact ff base16 to binary and decimal facts" };
  }
  if (toolId === "chmod-permission-helper") {
    return { text: await submitGeneric(page, toolId, { permissions: "4755" }, [/4755/u, /rwsr-xr-x/u, /setuid/iu]), assertion: "fixture chmod special-bit conversion 4755 ↔ rwsr-xr-x" };
  }
  if (toolId === "json-repair") {
    return { text: await submitGeneric(page, toolId, { text: "{\n // note\n \"name\": \"Ada\",\n}" }, [/Ada/u, /comment|trailing|virgola/iu]), assertion: "bounded comment/trailing-comma repair with explicit edit evidence" };
  }
  if (toolId === "json-structural-diff") {
    return { text: await submitGeneric(page, toolId, { leftJson: "{\"a\":1}", rightJson: "{\"a\":\"1\"}" }, [/\/a/u, /type|tipo/iu]), assertion: "stable JSON pointer reports a type change" };
  }
  if (toolId === "json-type-schema-inference") {
    return { text: await submitGeneric(page, toolId, { json: "{\"name\":\"Ada\",\"tags\":[\"local\"]}", typeName: "Root", mode: "both" }, [/Root/u, /name/u, /schema|typescript/iu]), assertion: "single-example TypeScript/JSON-Schema inference renders the named root" };
  }
  if (toolId === "xml-formatter-validator") {
    return { text: await submitGeneric(page, toolId, { text: "<root><item id=\"1\"/></root>", mode: "prettify", indent: "2" }, [/<root>/u, /item/u]), assertion: "bounded XML prettify route renders parsed XML" };
  }
  if (toolId === "css-minifier") {
    return { text: await submitGeneric(page, toolId, { text: "/* comment */\n.card { color: red; content: \"a b\"; --gap: 1rem  2rem; }" }, [/\.card\{color:red;content:/u, /--gap:1rem 2rem/u]), assertion: "parser-backed CSS fixture preserves string semantics and minifies custom property" };
  }
  if (toolId === "html-minifier") {
    return { text: await submitGeneric(page, toolId, { text: "<div>\n <p>A</p>\n <p>B</p>\n</div>", mode: "advanced" }, [/<div><p>A<\/p><p>B<\/p><\/div>/u]), assertion: "explicit advanced-mode HTML fixture produces canonical compact blocks" };
  }
  throw new Error(`${toolId}: no generic acceptance case`);
}

async function exerciseConnection(page: Page): Promise<{ text: string; assertion: string; explicitReferenceRequests: number }> {
  let referenceCalls = 0;
  await page.route("https://api64.ipify.org/**", async (route) => {
    referenceCalls += 1;
    if (referenceCalls === 1) await route.fulfill({ status: 200, contentType: "application/json", body: '{"ip":"203.0.113.7"}' });
    else await route.fulfill({ status: 503, contentType: "application/json", body: '{}' });
  });
  await page.getByText("Viewport CSS", { exact: true }).first().waitFor();
  const bodyBefore = await page.locator("article[data-tool-page]").innerText();
  if (!/IP pubblico · azione di rete facoltativa/u.test(bodyBefore) || /IP pubblico:\s*203\.0\.113\.7/u.test(bodyBefore)) throw new Error("connection-device-info: public-IP disclosure/state invalid before explicit action");
  const button = page.getByRole("button", { name: /Trova IP pubblico/u });
  await button.click();
  await page.getByText("203.0.113.7", { exact: true }).waitFor();
  await button.click();
  await page.getByRole("alert").filter({ hasText: /Non riesco a recuperare l'IP pubblico/u }).waitFor();
  const text = await page.locator("article[data-tool-page] astro-island").first().innerText();
  if (!/Viewport CSS/u.test(text) || !/Non sono una prova di identità/u.test(text)) throw new Error("connection-device-info: local support facts/provenance missing");
  if (referenceCalls !== 2) throw new Error(`connection-device-info: expected 2 explicit reference requests, got ${referenceCalls}`);
  return { text, assertion: "local browser/device facts plus disclosed public-IP success/failure only after explicit action", explicitReferenceRequests: referenceCalls };
}

async function exerciseKeyboard(page: Page): Promise<{ text: string; assertion: string }> {
  await page.getByRole("button", { name: "Avvia test" }).click();
  const surface = page.getByRole("region", { name: "Area di prova eventi tastiera" });
  await surface.evaluate((element) => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "K", code: "KeyK", location: 1, ctrlKey: true, altKey: true, shiftKey: true, repeat: true, bubbles: true }));
    element.dispatchEvent(new KeyboardEvent("keyup", { key: "K", code: "KeyK", location: 1, ctrlKey: true, altKey: true, shiftKey: true, bubbles: true }));
  });
  await page.getByText(/Cronologia recente \(2\/12\)/u).waitFor();
  const text = await page.locator("article[data-tool-page] astro-island").first().innerText();
  for (const matcher of [/KeyK/u, /sinistra/u, /Ctrl.*Alt.*Shift/u, /12 eventi/u]) if (!matcher.test(text)) throw new Error(`keyboard-event-diagnostic: expected ${String(matcher)}`);
  return { text, assertion: "focus-scoped keydown/keyup captures code, location, modifiers and bounded in-memory history" };
}

async function exerciseCssDesign(page: Page): Promise<{ text: string; assertion: string }> {
  await page.getByLabel("Helper").selectOption("gradient");
  await page.getByLabel("Angolo (0–360°)").fill("90");
  await page.getByLabel("Colore iniziale").fill("#000000");
  await page.getByLabel("Colore finale").fill("#ffffff");
  await page.getByRole("button", { name: "Genera CSS" }).click();
  const output = page.getByLabel("CSS canonico");
  await output.waitFor();
  const css = await output.inputValue();
  if (css !== "background: linear-gradient(90deg, #000000, #ffffff);") throw new Error(`css-design-helper: fixture mismatch ${JSON.stringify(css)}`);
  return { text: await page.locator("article[data-tool-page] astro-island").first().innerText(), assertion: "fixture gradient renders exact canonical CSS and preview from the same validated model" };
}

async function exercisePasswordGenerator(page: Page): Promise<{ text: string; assertion: string }> {
  await page.getByLabel("Lunghezza password").fill("32");
  await page.getByRole("button", { name: "Genera password" }).click();
  const output = page.locator("[data-secret-output]");
  await output.waitFor();
  const secret = (await output.innerText()).trim();
  if (secret.length !== 32 || !/[a-z]/u.test(secret) || !/[A-Z]/u.test(secret) || !/[0-9]/u.test(secret) || !/[^A-Za-z0-9]/u.test(secret)) {
    throw new Error("password-pin-passphrase-generator: 32-char all-class WebCrypto output contract failed");
  }
  const text = await page.locator("article[data-tool-page] astro-island").first().innerText();
  if (!/WebCrypto getRandomValues/u.test(text) || !/rejection sampling/iu.test(text)) throw new Error("password-pin-passphrase-generator: randomness provenance missing");
  return { text, assertion: "browser WebCrypto path produces requested length/classes and discloses rejection sampling/local-only contract" };
}

async function exercisePasswordStrength(page: Page): Promise<{ text: string; assertion: string }> {
  await page.getByLabel("Password da stimare").fill("Q7!mR2@zV4#tN6$pK9&x");
  await page.getByRole("button", { name: "Stima e spiega" }).click();
  const text = await page.locator("article[data-tool-page] astro-island").first().innerText();
  if (!/Punteggio \d\/4/u.test(text) || !/Non consulta database di password violate/u.test(text) || !/non afferma che la password sia presente o assente/iu.test(text)) {
    throw new Error("password-strength-estimator: bounded heuristic/disclaimer evidence missing");
  }
  return { text, assertion: "deterministic heuristic result visibly discloses that no breach database or breach-membership claim is used" };
}

async function exerciseRandom(page: Page): Promise<{ text: string; assertion: string }> {
  await page.getByLabel("Modalità").selectOption("picker");
  await page.getByLabel("Origine casualità").selectOption("seeded");
  await page.getByLabel("Seed riproducibile").fill("draw");
  await page.getByLabel("Una voce per riga").fill("Ada\nAda\nBruno\nCarla");
  await page.getByLabel("Quante righe estrarre").fill("4");
  const generate = page.getByRole("button", { name: "Genera", exact: true });
  await generate.click();
  const output = page.locator("[data-random-output]");
  await output.waitFor();
  const first = await output.innerText();
  await generate.click();
  const second = await output.innerText();
  if (second !== first) throw new Error("random-picker-team-coupon-generator: seeded browser output is not reproducible");
  if ((first.match(/Ada/gu) ?? []).length !== 2 || first.trim().split("\n").length !== 4) throw new Error("random-picker-team-coupon-generator: duplicate-ticket fixture semantics failed");
  const text = await page.locator("article[data-tool-page] astro-island").first().innerText();
  if (!/PRNG seeded riproducibile · NON sicuro/u.test(text) || !/Rete\s+vietata/u.test(text)) throw new Error("random-picker-team-coupon-generator: seeded/local disclosure missing");
  return { text, assertion: "seeded duplicate-ticket fixture reproduces exactly and labels seeded PRNG non-secure; focused tests cover secure rejection sampling" };
}

async function exerciseSitemap(page: Page): Promise<{ text: string; assertion: string }> {
  await page.getByLabel("URL e metadati sitemap").fill("https://example.com/\nhttps://example.com/news?x=1&y=2\t2026-10-06\tweekly\t0.8");
  await page.getByRole("button", { name: "Genera sitemap.xml" }).click();
  const panel = page.locator(".result-panel[data-state='success']").first();
  await panel.waitFor();
  const text = await panel.innerText();
  for (const matcher of [/2 URL/u, /example\.com/u, /2026-10-06/u, /weekly/u, /0\.8/u]) if (!matcher.test(text)) throw new Error(`sitemap-xml-generator: expected ${String(matcher)}`);
  return { text, assertion: "protocol fixture renders two same-host URLs with optional lastmod/changefreq/priority and local provenance" };
}

async function exerciseX509(page: Page): Promise<{ text: string; assertion: string }> {
  const [pem, vectorsText] = await Promise.all([
    readFile(resolve(root, "quality/fixtures/x509-csr-rfc/sample-cert.pem"), "utf8"),
    readFile(resolve(root, "quality/fixtures/x509-csr-rfc/vectors.json"), "utf8"),
  ]);
  const vectors = JSON.parse(vectorsText) as { certificate: { subject_contains: string; serial: string; sha256_fingerprint: string } };
  await page.getByLabel("PEM da ispezionare").fill(pem);
  await page.getByRole("button", { name: "Ispeziona localmente" }).click();
  await page.getByText(vectors.certificate.sha256_fingerprint, { exact: true }).waitFor({ timeout: 15_000 });
  const text = await page.locator("article[data-tool-page] astro-island").first().innerText();
  for (const expected of [vectors.certificate.subject_contains, vectors.certificate.serial, "Non verifica catena di fiducia, revoca"]) if (!text.includes(expected)) throw new Error(`x509-csr-inspector: expected ${expected}`);
  return { text, assertion: "stored synthetic certificate renders fixture subject/serial and independently cross-checked SHA-256 with explicit trust limits" };
}

async function exercise(page: Page, toolId: ToolId): Promise<{ text: string; assertion: string; explicitReferenceRequests?: number }> {
  if (["base-converter", "chmod-permission-helper", "cidr-calculator", "css-minifier", "html-minifier", "json-repair", "json-structural-diff", "json-type-schema-inference", "xml-formatter-validator"].includes(toolId)) return exerciseGeneric(page, toolId);
  if (toolId === "connection-device-info") return exerciseConnection(page);
  if (toolId === "keyboard-event-diagnostic") return exerciseKeyboard(page);
  if (toolId === "css-design-helper") return exerciseCssDesign(page);
  if (toolId === "password-pin-passphrase-generator") return exercisePasswordGenerator(page);
  if (toolId === "password-strength-estimator") return exercisePasswordStrength(page);
  if (toolId === "random-picker-team-coupon-generator") return exerciseRandom(page);
  if (toolId === "sitemap-xml-generator") return exerciseSitemap(page);
  if (toolId === "x509-csr-inspector") return exerciseX509(page);
  throw new Error(`${toolId}: acceptance case missing`);
}

async function acceptTool(toolId: ToolId, homeHtml: string, page: Page): Promise<BrowserResult> {
  const routeHtml = await readFile(resolve(dist, "tools", toolId, "index.html"), "utf8");
  const component = componentUrl(routeHtml, toolId);
  if (homeHtml.includes(component)) throw new Error(`${toolId}: tool component ${component} is present in home HTML`);

  const runtimeErrors: string[] = [];
  const taskRequests: TaskRequest[] = [];
  let started = false;
  page.on("pageerror", (error) => runtimeErrors.push(String(error)));
  page.on("console", (message) => {
    const url = message.location().url;
    if (message.type() !== "error" || expectedStaticFailure(url)) return;
    if (toolId === "connection-device-info" && /^https:\/\/api64\.ipify\.org\/?/u.test(url)) return;
    runtimeErrors.push(`${message.text()} @ ${message.location().url}`);
  });
  page.on("requestfailed", (request) => {
    if (!expectedStaticFailure(request.url())) runtimeErrors.push(`request failed ${request.url()}`);
  });
  page.on("request", (request) => {
    if (started) taskRequests.push({ url: request.url(), method: request.method(), postData: request.postData() });
  });

  const response = await page.goto(`${origin}/tools/${toolId}/`, { waitUntil: "networkidle" });
  if (response?.status() !== 200) throw new Error(`${toolId}: HTTP ${String(response?.status())}`);
  const article = page.locator("article[data-tool-page]");
  await article.waitFor();
  const manifestModule = await import(`../src/tools/${toolId}/manifest.ts`) as { default?: { runtime?: { location?: string }; gold?: { oracleEntryId?: string } } };
  const expectedRuntime = manifestModule.default?.runtime?.location;
  const oracleEntryId = manifestModule.default?.gold?.oracleEntryId;
  if (typeof expectedRuntime !== "string" || typeof oracleEntryId !== "string") throw new Error(`${toolId}: manifest runtime/oracle binding unavailable`);
  if (await article.getAttribute("data-runtime") !== expectedRuntime) throw new Error(`${toolId}: rendered runtime does not match manifest ${expectedRuntime}`);

  const island = article.locator("astro-island").first();
  await island.waitFor();
  const storageBefore = await browserStorage(page);
  const urlBefore = page.url();
  started = true;
  const exercised = await exercise(page, toolId);
  await page.evaluate(() => new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
  const storageAfter = await browserStorage(page);
  const urlAfter = page.url();
  const unlabeled = await a11yAudit(island);
  if (unlabeled.length > 0) throw new Error(`${toolId}: unlabeled controls: ${unlabeled.join(" | ")}`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (horizontalOverflow) throw new Error(`${toolId}: horizontal overflow at 390px`);

  const allowedReference = toolId === "connection-device-info" ? /^https:\/\/api64\.ipify\.org\/?(?:\?.*)?$/u : null;
  const external = taskRequests.filter(({ url }) => !url.startsWith(origin));
  const unexpectedExternal = external.filter(({ url }) => !(allowedReference?.test(url) ?? false));
  const nonGet = taskRequests.filter(({ method }) => method !== "GET");
  const bodyLeaks = taskRequests.filter(({ postData }) => (postData ?? "") !== "");
  if (unexpectedExternal.length > 0) throw new Error(`${toolId}: unexpected external requests ${JSON.stringify(unexpectedExternal)}`);
  if (nonGet.length > 0) throw new Error(`${toolId}: non-GET task requests ${JSON.stringify(nonGet)}`);
  if (bodyLeaks.length > 0) throw new Error(`${toolId}: task content left in request bodies ${JSON.stringify(bodyLeaks)}`);
  if (storageAfter !== storageBefore) throw new Error(`${toolId}: task-owned local/session storage changed during task`);
  if (urlAfter !== urlBefore) throw new Error(`${toolId}: URL/history-visible state changed during task`);
  if (runtimeErrors.length > 0) throw new Error(`${toolId}: runtime/console errors: ${runtimeErrors.join(" | ")}`);
  if (toolId === "connection-device-info" && external.length !== exercised.explicitReferenceRequests) throw new Error(`${toolId}: explicit reference request accounting mismatch`);
  if (toolId !== "connection-device-info" && external.length !== 0) throw new Error(`${toolId}: external request observed`);

  return {
    toolId,
    oracleEntryId,
    status: "PASS",
    semanticAssertion: exercised.assertion,
    outputSha256: createHash("sha256").update(exercised.text).digest("hex"),
    componentUrl: component,
    componentAbsentFromHome: true,
    externalTaskRequests: 0,
    nonGetTaskRequests: 0,
    taskContentLeaks: 0,
    storageMutations: 0,
    urlMutations: 0,
    runtimeErrors: 0,
    horizontalOverflow: false,
    unlabeledControls: 0,
    ...(exercised.explicitReferenceRequests === undefined ? {} : { explicitReferenceRequests: exercised.explicitReferenceRequests }),
  };
}

const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", dist], {
  cwd: root,
  stdio: "ignore",
});

try {
  const homeHtml = await readFile(resolve(dist, "index.html"), "utf8").catch(() => {
    throw new Error("dist/index.html missing; run npm run build before acceptance:developer-web-operations");
  });
  await waitForServer();
  const sourceFingerprint = await currentEvidenceSourceFingerprint(root);
  const browser = await chromium.launch(process.platform === "darwin"
    ? { executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true }
    : { headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const results: BrowserResult[] = [];
  try {
    for (const toolId of toolIds) {
      console.log(`accepting ${toolId}`);
      const page = await context.newPage();
      try { results.push(await acceptTool(toolId, homeHtml, page)); }
      finally { await page.close(); }
    }
  } finally {
    await context.close();
    await browser.close();
  }
  const scriptText = await readFile(new URL(import.meta.url), "utf8");
  const receipt = {
    schemaVersion: 1,
    status: "PASS",
    checkedAt: new Date().toISOString(),
    sourceFingerprint,
    tools: [...toolIds],
    routesChecked: results.length,
    semanticEvidence: "each route exercises a fixture-aligned or contract-specific browser action; focused unit tests own deeper refusal/property proofs",
    network: "zero unexpected external, non-GET, or task-body requests after task start; connection-device-info permits only its disclosed explicit ipify reference action",
    storage: "task-owned localStorage/sessionStorage byte-equivalent before/after each exercised task; exact navigation bookkeeping session keys are excluded",
    urlState: "task execution does not mutate the visible URL",
    mobileViewport: { width: 390, height: 844, horizontalOverflow: false },
    accessibility: "all exercised island controls have visible labels or accessible names",
    implementationEager: false,
    lazyImplementationEvidence: "each built tool island component-url is absent from the home document and is loaded only on its tool route",
    externalTaskRequests: 0,
    nonGetTaskRequests: 0,
    taskContentLeaks: 0,
    runtimeConsoleErrors: 0,
    scriptSha256: createHash("sha256").update(scriptText).digest("hex"),
    results,
  };
  await mkdir(resolve(root, "quality/receipts/developer-web-operations"), { recursive: true });
  await writeFile(resolve(root, outputPath), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`developer/web operations browser acceptance PASS: ${results.length} routes`);
} finally {
  server.kill("SIGTERM");
}
