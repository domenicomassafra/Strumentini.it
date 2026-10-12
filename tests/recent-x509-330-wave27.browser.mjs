/** #330 wave27: real local Chrome 390px X.509 / PKCS#10 inspections and success-only Recenti.
 * OpenSSL generates throwaway private keys directly to /dev/null; no secret is saved.
 * Run: node tests/recent-x509-330-wave27.browser.mjs
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const port = 18793;
const origin = (process.env.X509330_ORIGIN ?? `http://127.0.0.1:${port}`).replace(/\/$/u, "");
const toolId = "x509-csr-inspector";

function openssl(args, input) {
  const proc = spawnSync("openssl", args, {
    ...(input === undefined ? {} : { input }), timeout: 20_000, maxBuffer: 1024 * 1024,
  });
  assert.equal(proc.status, 0, `openssl ${args[0]}: ${String(proc.stderr)}`);
  return proc.stdout;
}

const certificate = openssl([
  "req", "-new", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "/dev/null", "-out", "/dev/stdout",
  "-days", "2", "-subj", "/CN=wave27.example/O=Strumentini", "-addext", "subjectAltName=DNS:wave27.example,DNS:alt.wave27.example",
]);
const csr = openssl([
  "req", "-new", "-newkey", "rsa:2048", "-nodes", "-keyout", "/dev/null", "-out", "/dev/stdout",
  "-subj", "/CN=csr.wave27.example/O=Strumentini", "-addext", "subjectAltName=DNS:csr.wave27.example",
]);
assert.match(String(certificate), /-----BEGIN CERTIFICATE-----/u);
assert.match(String(csr), /-----BEGIN CERTIFICATE REQUEST-----/u);
const certDer = openssl(["x509", "-inform", "PEM", "-outform", "DER"], certificate);
const csrDer = openssl(["req", "-inform", "PEM", "-outform", "DER"], csr);
openssl(["req", "-verify", "-noout"], csr);

function oracle(kind, pem, der) {
  const command = kind === "certificate" ? "x509" : "req";
  const subject = String(openssl([command, "-noout", "-subject", "-nameopt", "RFC2253"], pem));
  const details = String(openssl([command, "-noout", "-text"], pem));
  assert.match(subject, /subject=O=Strumentini,CN=(?:csr\.)?wave27\.example/u);
  assert.match(details, /Public-Key:\s*\(2048 bit\)/u);
  const fingerprint = [...createHash("sha256").update(der).digest()].map(b => b.toString(16).padStart(2, "0")).join(":").toUpperCase();
  if (kind === "certificate") {
    const opensslFp = String(openssl(["x509", "-noout", "-fingerprint", "-sha256"], pem));
    assert(opensslFp.toUpperCase().includes(fingerprint));
  } else {
    const opensslDigest = openssl(["dgst", "-sha256", "-binary"], der);
    assert.equal(opensslDigest.toString("hex"), createHash("sha256").update(der).digest("hex"));
  }
  return { fingerprint, subject, bits: 2048 };
}
const certOracle = oracle("certificate", certificate, certDer);
const csrOracle = oracle("csr", csr, csrDer);

async function recent(page) {
  return page.evaluate(async () => {
    if (typeof indexedDB.databases === "function" &&
        !(await indexedDB.databases()).some(db => db.name === "utility-workbench")) return [];
    return new Promise((resolve, reject) => {
      const opened = indexedDB.open("utility-workbench", 1);
      opened.onerror = () => reject(opened.error);
      opened.onsuccess = () => {
        const db = opened.result;
        if (!db.objectStoreNames.contains("state")) { db.close(); resolve([]); return; }
        const tx = db.transaction("state", "readonly");
        const get = tx.objectStore("state").get("workbench/state:v1");
        get.onerror = () => reject(get.error);
        get.onsuccess = () => resolve(get.result?.recent ?? []);
        tx.oncomplete = () => db.close();
      };
    });
  });
}

async function expectCount(page, count, timeout = 6500) {
  const deadline = Date.now() + timeout;
  let rows;
  do {
    rows = await recent(page);
    const matches = rows.filter(row => row.toolId === toolId);
    if ((count === 0 && matches.length === 0) ||
        (matches.length === 1 && matches[0].useCount === count)) {
      if (count > 0) {
        assert.deepEqual(Object.keys(matches[0]).sort(), ["lastUsedAt", "toolId", "useCount"]);
        assert(Number.isFinite(Date.parse(matches[0].lastUsedAt)));
      }
      for (const privateValue of ["wave27.example", "Strumentini", "BEGIN CERTIFICATE", "PRIVATE_", "RSA PRIVATE KEY"]) {
        assert(!JSON.stringify(rows).includes(privateValue), `Recenti persisted confidential input: ${privateValue}`);
      }
      return;
    }
    await new Promise(done => setTimeout(done, 80));
  } while (Date.now() < deadline);
  assert.fail(`Expected ${toolId} useCount=${count}, observed ${JSON.stringify(rows)}`);
}

async function hydrated(page) {
  assert.equal((await page.goto(`${origin}/tools/x509-csr-inspector/`, { waitUntil: "networkidle" }))?.status(), 200);
  await page.waitForFunction(() => [...document.querySelectorAll('astro-island[client="load"]')]
    .every(island => !island.hasAttribute("ssr")), null, { timeout: 20_000 });
}

async function checkResult(page, kind, expected) {
  const result = page.locator("section[aria-live='polite']");
  await result.waitFor({ timeout: 15_000 });
  const text = await result.innerText();
  assert.match(text, kind === "certificate" ? /Certificato X\.509/u : /CSR PKCS#10/u);
  assert(text.includes(kind === "certificate" ? "CN=wave27.example" : "CN=csr.wave27.example"), `OpenSSL subject differs: ${text}`);
  assert(text.includes("2048 bit"), `OpenSSL public key differs: ${text}`);
  assert(text.includes(expected.fingerprint), `OpenSSL SHA-256 differs: ${text}`);
  assert.match(text, /Non verifica catena di fiducia/u);
  return text;
}

function watch(page, errors, outbound) {
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", req => {
    if (!["GET", "HEAD"].includes(req.method()) ||
      ![origin, "blob:", "data:"].some(prefix => req.url().startsWith(prefix))) outbound.push(`${req.method()} ${req.url()}`);
  });
}

async function submitTwice(page) {
  await page.locator("form").evaluate(form => {
    for (let i = 0; i < 2; i++) {
      if (form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })))
        throw Error("Expected form handler to prevent native submit");
    }
  });
}

const server = process.env.X509330_ORIGIN ? null : spawn(resolve(root, "node_modules/.bin/astro"),
  ["dev", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
  { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
let logs = "";
if (server) for (const stream of [server.stdout, server.stderr])
  stream.on("data", chunk => { logs = (logs + String(chunk)).slice(-6000); });
let browser;
try {
  let ready = false;
  for (let i = 0; i < 150; i++) {
    if (server && server.exitCode !== null) throw Error(`Astro died: ${logs}`);
    try { ready = (await fetch(`${origin}/tools/x509-csr-inspector/`)).ok; if (ready) break; } catch { /* boot */ }
    await new Promise(done => setTimeout(done, 150));
  }
  assert(ready, `Astro X509 page unavailable: ${logs}`);
  browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [], outbound = [];
  watch(page, errors, outbound);
  await hydrated(page);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
  await expectCount(page, 0);
  const input = page.getByLabel("PEM da ispezionare");
  const file = page.getByLabel("File certificato o CSR");

  await input.fill(String(certificate));
  await submitTwice(page);
  await checkResult(page, "certificate", certOracle);
  await expectCount(page, 1); // RED: untracked valid real X.509 inspection.
  await page.waitForTimeout(150);
  await expectCount(page, 1); // Duplicate submit must count once.

  await input.fill("-----BEGIN CERTIFICATE-----\ninvalid!!\n-----END CERTIFICATE-----");
  await page.getByRole("button", { name: "Ispeziona localmente" }).click();
  await page.getByRole("alert").first().waitFor();
  assert.equal(await page.locator("section[aria-live='polite']").count(), 0);
  await expectCount(page, 1);

  await input.fill("-----BEGIN ENCRYPTED PRIVATE KEY-----\nAAAA\n-----END ENCRYPTED PRIVATE KEY-----");
  await page.getByRole("button", { name: "Ispeziona localmente" }).click();
  await page.getByRole("alert").first().waitFor();
  await expectCount(page, 1);

  await file.setInputFiles({ name: "PRIVATE_cert.der", mimeType: "application/pkix-cert", buffer: certDer });
  await page.getByRole("button", { name: "Ispeziona localmente" }).click();
  await checkResult(page, "certificate", certOracle);
  await expectCount(page, 2);

  await file.setInputFiles({ name: "PRIVATE_cert.pem", mimeType: "application/x-pem-file", buffer: certificate });
  await page.getByRole("button", { name: "Ispeziona localmente" }).click();
  await checkResult(page, "certificate", certOracle); // RED: PEM file bytes mishandled as DER.
  await expectCount(page, 3);

  await file.setInputFiles([]);
  await input.fill(String(csr));
  await page.getByRole("button", { name: "Ispeziona localmente" }).click();
  await checkResult(page, "csr", csrOracle);
  await expectCount(page, 4);

  await file.setInputFiles({ name: "PRIVATE_csr.der", mimeType: "application/pkcs10", buffer: csrDer });
  await page.getByRole("button", { name: "Ispeziona localmente" }).click();
  await checkResult(page, "csr", csrOracle);
  await expectCount(page, 5);

  await file.setInputFiles({ name: "PRIVATE_invalid.der", mimeType: "application/octet-stream", buffer: Buffer.from([0x30, 0x80, 0, 0]) });
  await page.getByRole("button", { name: "Ispeziona localmente" }).click();
  await page.getByRole("alert").first().waitFor();
  await expectCount(page, 5);
  await file.setInputFiles({ name: "PRIVATE_huge.der", mimeType: "application/octet-stream", buffer: Buffer.alloc(262_145, 0x30) });
  await page.getByRole("button", { name: "Ispeziona localmente" }).click();
  await page.getByRole("alert").first().waitFor();
  await expectCount(page, 5);

  // Intercept the real browser File.arrayBuffer promise, allowing changes while pending.
  await page.evaluate(() => {
    const original = File.prototype.arrayBuffer;
    window.__x509Held = [];
    File.prototype.arrayBuffer = function () {
      return new Promise((resolve, reject) => window.__x509Held.push({ file: this, resolve, reject }));
    };
    window.__x509Release = () => {
      const next = window.__x509Held.shift();
      next.resolve(original.call(next.file));
    };
  });

  await file.setInputFiles({ name: "PRIVATE_cancel.der", mimeType: "application/pkix-cert", buffer: certDer });
  await submitTwice(page);
  await page.waitForFunction(() => window.__x509Held?.length === 1);
  await page.getByRole("button", { name: "Azzera" }).click();
  await page.evaluate(() => window.__x509Release());
  await page.waitForTimeout(250);
  assert.equal(await page.locator("section[aria-live='polite']").count(), 0, "reset resurrected stale inspection");
  await expectCount(page, 5);
  assert.equal(await file.inputValue(), "", "reset must clear native file input");

  await file.setInputFiles({ name: "PRIVATE_old.der", mimeType: "application/pkix-cert", buffer: certDer });
  await submitTwice(page);
  await page.waitForFunction(() => window.__x509Held?.length === 1);
  await file.setInputFiles({ name: "PRIVATE_new.csr", mimeType: "application/pkcs10", buffer: csrDer });
  await submitTwice(page);
  await page.waitForFunction(() => window.__x509Held?.length === 2);
  await page.evaluate(() => window.__x509Release());
  await page.waitForTimeout(160);
  assert.equal(await page.locator("section[aria-live='polite']").count(), 0, "old file result overtook new file");
  await page.evaluate(() => window.__x509Release());
  await checkResult(page, "csr", csrOracle);
  await expectCount(page, 6);

  await page.goto(`${origin}/preferiti/`, { waitUntil: "networkidle" });
  await page.locator("[data-area-activity] li").first().waitFor();
  assert.match(await page.locator("[data-area-activity]").innerText(), /X\.509|certificat|CSR/iu);
  await page.reload({ waitUntil: "networkidle" });
  await expectCount(page, 6);

  const denied = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await denied.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", { configurable: true, get() { throw new DOMException("denied", "SecurityError"); } });
  });
  const blocked = await denied.newPage();
  watch(blocked, errors, outbound);
  await hydrated(blocked);
  await blocked.getByLabel("PEM da ispezionare").fill(String(certificate));
  await blocked.getByRole("button", { name: "Ispeziona localmente" }).click();
  await checkResult(blocked, "certificate", certOracle);
  await denied.close();

  assert.deepEqual(errors, []);
  assert.deepEqual(outbound, [], "X.509 / CSR content must never leave the browser");
  console.log("X509_330_WAVE27_PASS Chrome390 OpenSSL cert+CSR PEM/DER oracle subject/RSA2048/SHA256, metadata-only IDB count=6, double submit once, invalid/encrypted/oversize zero, reset and replace stale zero, denied IndexedDB inspection succeeds, outbound=0");
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
