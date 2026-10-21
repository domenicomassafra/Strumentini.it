/**
 * STR-REUSE-55.5 / #279 — real Firefox-free Safari proof: drive the Safari 26.6
 * that ships with macOS through SafariDriver (WebDriver), on the built `dist/`
 * served from this host. This is the only lane that runs the actual Safari
 * application instead of a WebKit emulation; it needs the desktop, so the
 * "Allow remote automation" developer switch and `safaridriver --enable`.
 *
 * Usage: node scripts/acceptance-qr-reader-279-safari.mjs <fixture.jpg> <expectedPayload> [port]
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { extname, resolve, sep } from "node:path";
import { createHash } from "node:crypto";

const [fixtureArg, payloadArg, portArg] = process.argv.slice(2);
if (!fixtureArg || !payloadArg) {
  console.error("usage: node scripts/acceptance-qr-reader-279-safari.mjs <fixture.jpg> <expectedPayload> [port]");
  process.exit(2);
}
const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const fixture = resolve(fixtureArg);
const expected = payloadArg;
const port = Number(portArg ?? 18279);
const driver = process.env.SAFARIDRIVER ?? "http://127.0.0.1:4477";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fixtureBasename = fixture.split("/").pop();
const fixtureSha256 = sha(await readFile(fixture));
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".wasm": "application/wasm" };

const fixtureRoute = `/__qr279/${fixtureBasename}`;
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
    if (pathname === fixtureRoute) {
      response.setHeader("content-type", "image/jpeg");
      response.setHeader("cache-control", "no-store");
      response.writeHead(200).end(await readFile(fixture));
      return;
    }
    const filePath = resolve(dist, pathname.replace(/^\/+/u, ""), pathname.endsWith("/") ? "index.html" : "");
    if (!filePath.startsWith(dist + sep)) { response.writeHead(403).end("forbidden"); return; }
    const info = await stat(filePath);
    const file = info.isDirectory() ? resolve(filePath, "index.html") : filePath;
    const bytes = await readFile(file);
    response.setHeader("content-type", mime[extname(file)] ?? "application/octet-stream");
    response.setHeader("cache-control", "no-store");
    response.writeHead(200).end(bytes);
  } catch {
    response.writeHead(404).end("not found");
  }
});
await new Promise((done) => server.listen(port, "127.0.0.1", done));
const origin = `http://127.0.0.1:${port}`;

async function wd(path, method = "GET", body) {
  const response = await fetch(driver + path, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const parsed = text === "" ? {} : JSON.parse(text);
  if (parsed.value?.error !== undefined) throw new Error(`${path}: ${parsed.value.message}`);
  return parsed.value;
}

const created = await wd("/session", "POST", { capabilities: { alwaysMatch: { browserName: "safari" } } });
const sessionId = created.sessionId ?? created.capabilities?.sessionId;
if (!sessionId) throw new Error(`no SafariDriver session: ${JSON.stringify(created).slice(0, 300)}`);
const sid = `/session/${sessionId}`;
const observations = { safariVersion: null, viewport: null, payload: null, metadata: null, warnings: null, resources: null, decodeMs: null, lazy: null };

try {
  observations.safariVersion = await wd(`${sid}/execute/sync`, "POST", {
    script: "return navigator.userAgent;", args: [],
  });
  await wd(`${sid}/window/rect`, "POST", { width: 390, height: 844, x: 40, y: 40 });
  await wd(`${sid}/url`, "POST", { url: `${origin}/tools/qr-reader/` });
  await new Promise((done) => setTimeout(done, 1500));
  observations.viewport = await wd(`${sid}/execute/sync`, "POST", {
    script: "return {w: window.innerWidth, h: window.innerHeight, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, title: document.title};",
    args: [],
  });
  const scriptsAtLoad = await wd(`${sid}/execute/sync`, "POST", {
    script: "return performance.getEntriesByType('resource').filter(e => e.initiatorType === 'script').map(e => e.name);",
    args: [],
  });
  await wd(`${sid}/execute/sync`, "POST", {
    script: "const before = performance.getEntriesByType('resource').map(e => e.name); window.__qr279Before = before; return before.length;",
    args: [],
  });
  // SafariDriver's native file injection yields a file reference whose bytes the page cannot read
  // (arrayBuffer -> NotReadableError, createImageBitmap -> InvalidStateError). The identical bytes are
  // therefore fetched from this acceptance server and attached through DataTransfer, after pinning
  // their SHA-256 in the page against the fixture hash declared by the caller.
  observations.hostInjectionUnreadable = await wd(`${sid}/execute/async`, "POST", {
    script: `const done = arguments[arguments.length-1];
      const input = document.querySelector('form input[type=file]');
      const before = { hasInput: input !== null };
      fetch(${JSON.stringify(fixtureRoute)})
        .then((r) => r.blob())
        .then(async (blob) => {
          const buffer = await blob.arrayBuffer();
          const digest = await crypto.subtle.digest('SHA-256', buffer);
          const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
          const file = new File([blob], ${JSON.stringify(fixtureBasename)}, { type: 'image/jpeg', lastModified: Date.now() });
          const transfer = new DataTransfer();
          transfer.items.add(file);
          input.files = transfer.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          done({ ...before, attached: input.files.length, bytes: file.size, sha256: hex, readable: true });
        })
        .catch((error) => done({ ...before, attached: 0, error: String(error) }));`,
    args: [],
  });
  if (observations.hostInjectionUnreadable.attached !== 1) throw new Error(`fixture not attached: ${JSON.stringify(observations.hostInjectionUnreadable)}`);
  if (observations.hostInjectionUnreadable.sha256 !== fixtureSha256) throw new Error("attached bytes do not match the fixture hash");
  const submit = await wd(`${sid}/element`, "POST", { using: "xpath", value: "//button[contains(normalize-space(.), 'Decodifica QR')]" });
  const submitId = submit["element-6066-11e4-a52e-4f735466cecf"];
  if (!submitId) throw new Error("submit button not found");
  await wd(`${sid}/execute/sync`, "POST", { script: "window.__qr279Start = performance.now(); return true;", args: [] });
  await wd(`${sid}/element/${submitId}/click`, "POST", {});
  let payload = null;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    await new Promise((done) => setTimeout(done, 200));
    payload = await wd(`${sid}/execute/sync`, "POST", {
      script: "const el = document.querySelector('pre.json-result'); return el === null ? null : el.textContent.trim();",
      args: [],
    });
    if (payload !== null) break;
  }
  observations.decodeMs = await wd(`${sid}/execute/sync`, "POST", {
    script: "return Math.round(performance.now() - window.__qr279Start);", args: [],
  });
  observations.payload = payload;
  observations.metadata = await wd(`${sid}/execute/sync`, "POST", {
    script: "const rows = [...document.querySelectorAll('dl.assumptions > div')]; return Object.fromEntries(rows.map(r => [r.querySelector('dt').textContent.trim(), r.querySelector('dd').textContent.trim()]));",
    args: [],
  });
  observations.warnings = await wd(`${sid}/execute/sync`, "POST", {
    script: "const el = document.querySelector('ul.status-list'); return el === null ? [] : el.innerText.split('\\n').map(l => l.trim()).filter(Boolean);",
    args: [],
  });
  observations.resources = await wd(`${sid}/execute/sync`, "POST", {
    script: "const before = new Set(window.__qr279Before || []); return performance.getEntriesByType('resource').map(e => ({name: e.name, lazy: !before.has(e.name), kb: Math.round((e.transferSize||0)/1024)}));",
    args: [],
  });
  observations.screenshot = await wd(`${sid}/screenshot`, "GET");
} finally {
  await wd(sid, "DELETE").catch(() => {});
  await new Promise((done) => server.close(done));
}

const offsite = observations.resources.filter((entry) => !(entry.name.startsWith(origin + "/") || entry.name.startsWith("blob:") || entry.name.startsWith("data:")));
const lazy = observations.resources.filter((entry) => entry.lazy);
const result = {
  evidenceKind: "REAL_SAFARI_WEBDRIVER_DESKTOP",
  physicalDeviceObserved: false,
  browser: { engine: "Safari", userAgent: observations.safariVersion, viewport: observations.viewport },
  build: { revision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim() },
  fixture: { path: fixture, sha256: fixtureSha256 },
  upload: { mechanism: "same-origin fetch + DataTransfer", ...observations.hostInjectionUnreadable },
  expectedPayload: expected,
  payload: observations.payload,
  metadata: observations.metadata,
  warnings: observations.warnings,
  decodeMs: observations.decodeMs,
  lazyResources: lazy.map((entry) => entry.name),
  offsiteResources: offsite.map((entry) => entry.name),
  asserts: {
    payloadMatches: observations.payload === expected,
    ecLevelShown: /^Livello [MQH]$/u.test(observations.metadata?.["Correzione errori"] ?? ""),
    maskNotAttested: observations.metadata?.["Maschera"] === "non determinata",
    zxingWarningShown: (observations.warnings ?? []).some((line) => /decoder ZXing/u.test(line)),
    lazyChunkLoaded: lazy.some((entry) => /zxing-adapter/u.test(entry.name)),
    noOffsiteRequest: offsite.length === 0,
    noHorizontalOverflow: observations.viewport?.overflow === 0,
    uploadedBytesMatchFixture: observations.hostInjectionUnreadable?.sha256 === fixtureSha256,
  },
};
if (process.env.QR279_SCREENSHOT) {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(process.env.QR279_SCREENSHOT, Buffer.from(observations.screenshot, "base64"));
}
console.log(JSON.stringify(result, null, 2));
if (Object.values(result.asserts).some((value) => value !== true)) process.exitCode = 1;
