import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const udid = process.env.IMAGE_RESIZE_IOS_UDID ?? "00008120-0006384E14D8201E";
const driverOrigin = (process.env.SAFARIDRIVER_ORIGIN ?? "http://127.0.0.1:4444").replace(/\/$/u, "");
const siteOrigin = (process.env.IMAGE_RESIZE_PHYSICAL_ORIGIN ?? "http://192.168.1.5:18141").replace(/\/$/u, "");
const evidenceDir = resolve(root, ".scratch/strumentini-expansion-20261005/evidence/ticket278");
const evidencePath = resolve(evidenceDir, "safaridriver-physical-attempt.json");
const fixtureManifestPath = resolve(root, "dist/physical-fixtures/manifest.json");
const distPagePath = resolve(root, "dist/tools/image-resize/index.html");
const elementKey = "element-6066-11e4-a52e-4f735466cecf";

function command(file, args) {
  return execFileSync(file, args, { cwd: root, encoding: "utf8" }).trim();
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function detail(text, label) {
  const line = text.split(/\r?\n/u).find((candidate) => candidate.includes("• " + label + ":"));
  return line === undefined ? null : line.slice(line.indexOf(":") + 1).trim();
}

async function wd(method, path, body, timeoutMs = 15_000) {
  const response = await fetch(driverOrigin + path, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  return await response.json();
}

async function findElement(sessionId, using, value) {
  const payload = await wd("POST", "/session/" + sessionId + "/element", { using, value });
  if (payload?.value?.error) throw new Error(payload.value.message ?? payload.value.error);
  const elementId = payload?.value?.[elementKey];
  if (typeof elementId !== "string") throw new Error("Missing WebDriver element id for " + value);
  return elementId;
}

async function waitFor(sessionId, script, timeoutMs = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const payload = await wd("POST", "/session/" + sessionId + "/execute/sync", { script, args: [] });
    if (payload?.value === true) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error("Timed out waiting for physical Safari page state.");
}

await mkdir(evidenceDir, { recursive: true });
const deviceDetails = command("xcrun", ["devicectl", "device", "info", "details", "--device", udid]);
const safariDriverVersion = command("/usr/bin/safaridriver", ["--version"]);
const revision = command("git", ["rev-parse", "HEAD"]);
const fixtureManifest = JSON.parse(await readFile(fixtureManifestPath, "utf8"));
const fixturePath = resolve(root, "dist/physical-fixtures", fixtureManifest.filename);
const fixtureBytes = await readFile(fixturePath);
const distPageBytes = await readFile(distPagePath);
if (fixtureManifest.source?.pixels !== 16_000_000) throw new Error("Expected the current 16MP physical boundary fixture.");
if (sha256(fixtureBytes) !== fixtureManifest.sha256) throw new Error("Physical fixture SHA-256 mismatch.");

const evidence = {
  schemaVersion: 1,
  ticket: 278,
  status: "BLOCKED",
  target: "ios-safari",
  route: "/tools/image-resize/",
  observedAt: new Date().toISOString(),
  physicalSelection: {
    platformName: "iOS",
    "safari:useSimulator": false,
    "safari:deviceUDID": udid,
  },
  device: {
    name: detail(deviceDetails, "Device Name"),
    marketingName: detail(deviceDetails, "Marketing Name"),
    productType: detail(deviceDetails, "Product Type"),
    reality: detail(deviceDetails, "Device Reality"),
    udid: detail(deviceDetails, "UDID"),
    osVersion: detail(deviceDetails, "OS Version"),
    osBuild: detail(deviceDetails, "OS Build Update"),
    developerMode: detail(deviceDetails, "Developer Mode Status"),
  },
  browser: { safariDriverVersion, sessionCapabilities: null },
  build: { revision, distImageResizeSha256: sha256(distPageBytes) },
  fixture: {
    filename: fixtureManifest.filename,
    sha256: fixtureManifest.sha256,
    source: fixtureManifest.source,
    recommendedOutput: fixtureManifest.recommendedOutput,
    estimatedDecodedBytes: fixtureManifest.estimatedDecodedBytes,
  },
  stages: [],
  output: null,
  passEligibility: {
    physicalDevice: false,
    noSimulatorSubstitution: false,
    nativeFilePickerObserved: false,
    resizeCompleted: false,
    actualDownloadedArtifactVerified: false,
  },
  blocker: null,
  canonicalReceiptWritten: false,
};

let sessionId = null;
try {
  const create = await wd("POST", "/session", {
    capabilities: {
      alwaysMatch: {
        browserName: "Safari",
        platformName: "iOS",
        "safari:platformVersion": evidence.device.osVersion,
        "safari:useSimulator": false,
        "safari:deviceType": "iPhone",
        "safari:deviceUDID": udid,
      },
    },
  }, 30_000);

  if (create?.value?.error) {
    evidence.stages.push({ stage: "session-create", status: "BLOCKED", message: create.value.message });
    evidence.blocker = {
      stage: "session-create",
      message: create.value.message,
      note: "No WebDriver command reached the page; file picker, resize and download remain unproven.",
    };
  } else {
    sessionId = create?.value?.sessionId ?? create?.sessionId ?? null;
    if (typeof sessionId !== "string") throw new Error("SafariDriver did not return a session id.");
    evidence.browser.sessionCapabilities = create?.value?.capabilities ?? null;
    evidence.passEligibility.physicalDevice = evidence.device.reality === "physical";
    evidence.passEligibility.noSimulatorSubstitution = evidence.device.reality === "physical";
    evidence.stages.push({ stage: "session-create", status: "PASS" });

    const navigation = await wd("POST", "/session/" + sessionId + "/url", { url: siteOrigin + "/tools/image-resize/" }, 30_000);
    if (navigation?.value?.error) throw new Error(navigation.value.message);
    evidence.stages.push({ stage: "navigate-real-page", status: "PASS", url: siteOrigin + "/tools/image-resize/" });

    const inputId = await findElement(sessionId, "css selector", "#image-resize-file");
    const upload = await wd("POST", "/session/" + sessionId + "/element/" + inputId + "/value", {
      text: fixturePath,
      value: [...fixturePath],
    }, 30_000);
    if (upload?.value?.error) {
      evidence.stages.push({ stage: "file-input", status: "BLOCKED", message: upload.value.message });
      evidence.blocker = {
        stage: "file-input",
        message: upload.value.message,
        note: "Physical iOS file input could not accept the 16MP boundary fixture.",
      };
    } else {
      evidence.stages.push({
        stage: "file-input",
        status: "PARTIAL",
        method: "WebDriver element Send Keys",
        note: "This proves only web input attachment, not interaction with the native Files/Photos picker UI.",
      });
      await waitFor(sessionId, "return document.body.innerText.includes('Originale 4000×4000');");

      const configureScript = [
        "const labels=[...document.querySelectorAll('label')];",
        "const inputFor=(text)=>labels.find((label)=>label.innerText.includes(text))?.querySelector('input,select');",
        "const set=(el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};",
        "set(inputFor('Larghezza'),'1200');",
        "set(inputFor('Altezza'),'1200');",
        "set(inputFor('Formato di uscita'),'image/jpeg');",
        "const contain=labels.find((label)=>label.innerText.includes(\"Contieni nell'area\"))?.querySelector('input');",
        "if(contain&&!contain.checked)contain.click();",
        "return true;",
      ].join("");
      const configured = await wd("POST", "/session/" + sessionId + "/execute/sync", { script: configureScript, args: [] });
      if (configured?.value?.error) throw new Error(configured.value.message);

      const resizeId = await findElement(sessionId, "xpath", "//button[contains(normalize-space(.), 'Ridimensiona')]");
      const resized = await wd("POST", "/session/" + sessionId + "/element/" + resizeId + "/click", {});
      if (resized?.value?.error) throw new Error(resized.value.message);
      await waitFor(sessionId, "return document.body.innerText.includes('1200×1200') && [...document.querySelectorAll('a')].some((a)=>a.textContent.includes('Scarica'));", 60_000);

      const verifyScript = [
        "const done=arguments[arguments.length-1];",
        "const anchor=[...document.querySelectorAll('a')].find((a)=>a.textContent.includes('Scarica'));",
        "if(!anchor||!anchor.href.startsWith('blob:')){done({error:'download blob link missing'});return;}",
        "fetch(anchor.href).then((r)=>r.blob()).then(async(blob)=>{",
        "const bitmap=await createImageBitmap(blob);",
        "const result={width:bitmap.width,height:bitmap.height,type:blob.type,bytes:blob.size,filename:anchor.getAttribute('download')};",
        "bitmap.close();done(result);",
        "}).catch((error)=>done({error:String(error)}));",
      ].join("");
      const verified = await wd("POST", "/session/" + sessionId + "/execute/async", { script: verifyScript, args: [] }, 30_000);
      if (verified?.value?.error) throw new Error(verified.value.message ?? verified.value.error);
      evidence.output = verified?.value ?? null;
      evidence.passEligibility.resizeCompleted = evidence.output?.width === 1200
        && evidence.output?.height === 1200
        && evidence.output?.type === "image/jpeg"
        && Number(evidence.output?.bytes) > 0;
      evidence.stages.push({
        stage: "resize-and-page-blob-verification",
        status: evidence.passEligibility.resizeCompleted ? "PASS" : "FAIL",
        output: evidence.output,
      });

      const downloadId = await findElement(sessionId, "xpath", "//a[contains(normalize-space(.), 'Scarica')]");
      const clicked = await wd("POST", "/session/" + sessionId + "/element/" + downloadId + "/click", {});
      evidence.stages.push(clicked?.value?.error
        ? { stage: "download-click", status: "BLOCKED", message: clicked.value.message }
        : {
            stage: "download-click",
            status: "PARTIAL",
            note: "Safari accepted the link click, but WebDriver provides no independently reopened native iOS downloaded artifact here.",
          });
      evidence.blocker = {
        stage: "native-picker-download-proof",
        message: "WebDriver web-context evidence cannot prove the real iOS Files/Photos picker or independently reopen the downloaded file in the native Files/Downloads UI.",
        note: "Do not record a physical PASS from Send Keys or page-side blob inspection alone.",
      };
    }
  }
} catch (error) {
  evidence.stages.push({ stage: "unexpected-error", status: "BLOCKED", message: error instanceof Error ? error.message : String(error) });
  evidence.blocker ??= { stage: "unexpected-error", message: error instanceof Error ? error.message : String(error) };
} finally {
  if (typeof sessionId === "string") await wd("DELETE", "/session/" + sessionId).catch(() => undefined);
  await writeFile(evidencePath, JSON.stringify(evidence, null, 2) + "\n", "utf8");
}

console.log(JSON.stringify({
  status: evidence.status,
  evidencePath,
  blocker: evidence.blocker,
  device: evidence.device,
  safariDriverVersion: evidence.browser.safariDriverVersion,
}, null, 2));
process.exitCode = evidence.status === "PASS" ? 0 : 2;
