import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";

const port = 18142;
const externalOrigin = process.env.PASSWORD_SECURITY_ORIGIN?.replace(/\/$/u, "") ?? null;
const origin = externalOrigin ?? `http://127.0.0.1:${port}`;
const server = externalOrigin === null
  ? spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { stdio: "ignore" })
  : null;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isExternal(url) {
  return !url.startsWith(origin) && !url.startsWith("blob:") && !url.startsWith("data:");
}

try {
  if (server !== null) await sleep(500);
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  const generator = await context.newPage();
  const generatorRequests = [];
  const secretTransportRequests = [];
  let generatedSecret = null;
  generator.on("request", (request) => {
    if (isExternal(request.url())) generatorRequests.push({ url: request.url(), method: request.method() });
    if (generatedSecret !== null && (request.url().includes(generatedSecret) || (request.postData() ?? "").includes(generatedSecret))) {
      secretTransportRequests.push({ url: request.url(), method: request.method() });
    }
  });
  const response = await generator.goto(`${origin}/tools/password-pin-passphrase-generator/`, { waitUntil: "networkidle" });
  if (response?.status() !== 200) throw new Error(`password generator route returned ${response?.status()}`);
  await generator.getByRole("heading", { name: "Genera password, PIN e passphrase italiane", exact: true }).waitFor();
  if (generatorRequests.length !== 0) throw new Error(`password generator made external request before action: ${JSON.stringify(generatorRequests)}`);

  const before = await generator.evaluate(() => ({
    url: location.href,
    historyLength: history.length,
    local: Object.fromEntries(Object.keys(localStorage).toSorted().map((key) => [key, localStorage.getItem(key)])),
    session: Object.fromEntries(Object.keys(sessionStorage).toSorted().map((key) => [key, sessionStorage.getItem(key)])),
  }));
  await generator.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (value) => { window.__passwordSecurityCopied = String(value); } },
    });
  });
  await generator.getByRole("button", { name: "Genera password", exact: true }).click();
  const secret = await generator.locator("[data-secret-output]").innerText();
  generatedSecret = secret;
  if (secret.length !== 20) throw new Error(`unexpected generated password length ${secret.length}`);
  if (!/[a-z]/u.test(secret) || !/[A-Z]/u.test(secret) || !/[0-9]/u.test(secret) || !/[^A-Za-z0-9]/u.test(secret)) {
    throw new Error(`generated password does not satisfy selected classes: ${secret}`);
  }
  await generator.getByRole("button", { name: "Copia", exact: true }).click();
  const copied = await generator.evaluate(() => window.__passwordSecurityCopied ?? "");
  if (copied !== secret) throw new Error("explicit clipboard action did not copy the generated secret exactly");
  const after = await generator.evaluate(() => ({
    url: location.href,
    historyLength: history.length,
    local: Object.fromEntries(Object.keys(localStorage).toSorted().map((key) => [key, localStorage.getItem(key)])),
    session: Object.fromEntries(Object.keys(sessionStorage).toSorted().map((key) => [key, sessionStorage.getItem(key)])),
    documentContainsSecretInUrl: location.href.includes(document.querySelector("[data-secret-output]")?.textContent ?? "__missing__"),
  }));
  if (after.url !== before.url || after.historyLength !== before.historyLength || after.documentContainsSecretInUrl) {
    throw new Error(`generator mutated URL/history with secret state: before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
  }
  if (JSON.stringify(after.local) !== JSON.stringify(before.local) || JSON.stringify(after.session) !== JSON.stringify(before.session)) {
    throw new Error(`generator changed browser storage: before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
  }
  if (generatorRequests.length !== 0) throw new Error(`password generator made external request: ${JSON.stringify(generatorRequests)}`);
  if (secretTransportRequests.length !== 0) throw new Error(`generated secret appeared in request telemetry/transport: ${JSON.stringify(secretTransportRequests)}`);
  await generator.getByRole("combobox", { name: "Modalità" }).selectOption("passphrase");
  await generator.getByText(/it-passphrase-2026-10-v1/u).first().waitFor();
  await generator.getByText(/versione 1\.0\.0/u).first().waitFor();
  await generator.getByText(/dichiarato non deterministico/u).first().waitFor({ state: "attached" });

  const estimator = await context.newPage();
  const estimatorRequests = [];
  estimator.on("request", (request) => {
    if (isExternal(request.url())) estimatorRequests.push({ url: request.url(), method: request.method() });
  });
  const estimatorResponse = await estimator.goto(`${origin}/tools/password-strength-estimator/`, { waitUntil: "networkidle" });
  if (estimatorResponse?.status() !== 200) throw new Error(`password estimator route returned ${estimatorResponse?.status()}`);
  await estimator.getByRole("heading", { name: "Stima la robustezza di una password", exact: true }).waitFor();
  const estimatorStorageBefore = await estimator.evaluate(() => JSON.stringify({
    local: Object.fromEntries(Object.keys(localStorage).toSorted().map((key) => [key, localStorage.getItem(key)])),
    session: Object.fromEntries(Object.keys(sessionStorage).toSorted().map((key) => [key, sessionStorage.getItem(key)])),
  }));
  await estimator.getByLabel("Password da stimare").fill("Ghiaia!Torre7Menta?Fiume");
  await estimator.getByRole("button", { name: "Stima e spiega", exact: true }).click();
  await estimator.getByText(/Non consulta database di password violate/u).first().waitFor();
  await estimator.getByText(/Punteggio/u).first().waitFor();
  const estimatorStorageAfter = await estimator.evaluate(() => JSON.stringify({
    local: Object.fromEntries(Object.keys(localStorage).toSorted().map((key) => [key, localStorage.getItem(key)])),
    session: Object.fromEntries(Object.keys(sessionStorage).toSorted().map((key) => [key, sessionStorage.getItem(key)])),
  }));
  if (estimatorStorageAfter !== estimatorStorageBefore) throw new Error("password estimator changed browser storage");
  if (estimatorRequests.length !== 0) throw new Error(`password estimator made external request: ${JSON.stringify(estimatorRequests)}`);

  await generator.setViewportSize({ width: 390, height: 844 });
  await estimator.setViewportSize({ width: 390, height: 844 });
  const mobileOverflow = await Promise.all([
    generator.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
    estimator.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
  ]);
  if (mobileOverflow.some(Boolean)) throw new Error(`password security routes overflow at 390px: ${mobileOverflow.join(",")}`);

  await browser.close();
  console.log("password security acceptance PASS: WebCrypto UI + explicit clipboard + no network/storage/URL persistence + explainable offline estimator");
} finally {
  server?.kill("SIGTERM");
}
