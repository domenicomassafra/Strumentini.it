/**
 * #520 authenticated consumer smoke on the MiniPC Android Emulator.
 *
 * Repeats the production account path inside the AVD `str277-api35`: real
 * Chrome registered on the installed site, session cookie, favourite added and
 * removed from the catalogue, logout, anonymous guard and a fresh login. The
 * AVD is expected to be already booted (controlcenter runbook
 * `minipc-kvm-access.md`):
 *
 *   ~/Android/Sdk/emulator/emulator -avd str277-api35 -no-window -no-audio \
 *     -no-boot-anim -no-snapshot-save -gpu swiftshader_indirect
 *
 * Run on the MiniPC checkout:
 *   AUTH_EMAIL=... AUTH_PASSWORD=... node scripts/acceptance-auth-android-520.mjs
 *
 * Playwright normally launches its own Chrome instance on the device. Some AVD
 * builds ignore `--remote-debugging-socket-name`, so the launch is bounded and
 * the lane falls back to bridging Chrome's `chrome_devtools_remote` socket over
 * loopback CDP (the fix prepared on branch `fix/android-277-cdp-fallback`).
 *
 * The receipt contains no password, cookie or anti-bot token.
 */
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { _android } from "playwright";
import { chromium } from "@playwright/test";

const origin = (process.env.AUTH_ORIGIN ?? "https://strumentini.it").replace(/\/$/u, "");
const email = process.env.AUTH_EMAIL ?? "";
const password = process.env.AUTH_PASSWORD ?? "";
const name = process.env.AUTH_NAME ?? "Strumentini Test 520 Android";
const toolId = process.env.AUTH_TOOL ?? "business-day";
const receiptPath = resolve(process.env.AUTH_RECEIPT ?? "quality/receipts/consumer-auth-520/android.json");
const adbBin = process.env.AUTH_ADB ?? resolve(process.env.HOME ?? "/home/udodo", "Android/Sdk/platform-tools/adb");
const cdpPort = Number(process.env.AUTH_CDP_PORT ?? 9222);
const nativeLaunchMs = Number(process.env.AUTH_NATIVE_LAUNCH_MS ?? 45_000);

if (email === "" || password === "") {
  console.error("AUTH_EMAIL and AUTH_PASSWORD are required; nothing was sent to production.");
  process.exit(2);
}

const adb = (...args) => execFileSync(adbBin, args, { encoding: "utf8", timeout: 30_000 }).trim();
const checks = [];
function record(step, passed, detail) {
  checks.push({ step, status: passed ? "PASS" : "FAIL", detail });
  console.log(`  ${passed ? "PASS" : "FAIL"} ${step}${detail === undefined ? "" : ` — ${detail}`}`);
  return passed;
}

assert.equal(adb("shell", "getprop", "sys.boot_completed"), "1", "AVD not booted");
assert.match(adb("shell", "pm", "list", "packages", "com.android.chrome"), /package:com.android.chrome/u);
const chromeVersion = adb("shell", "dumpsys", "package", "com.android.chrome").match(/versionName=([^\s]+)/u)?.[1];
const fingerprint = adb("shell", "getprop", "ro.build.fingerprint");
const serial = adb("get-serialno");
console.log(`AVD ${serial} Chrome ${chromeVersion} ${fingerprint}`);

let device;
let browser;
let context;
let cdpForward = false;
let page;
const pageErrors = [];

async function openChromeOn(url) {
  device = (await _android.devices()).find((candidate) => candidate.serial() === serial);
  assert(device, `Playwright could not discover Android emulator ${serial}`);
  const launch = device.launchBrowser({ acceptDownloads: false });
  let timer;
  try {
    context = await Promise.race([launch, new Promise((__, fail) => {
      timer = setTimeout(() => fail(new Error("ANDROID520_NATIVE_LAUNCH_TIMEOUT")), nativeLaunchMs);
    })]);
    console.log("AVD_CHROME_LAUNCH native");
  } catch (error) {
    console.log("AVD_CHROME_LAUNCH fallback:", String(error?.message ?? error).slice(0, 160));
    launch.then((late) => late.close().catch(() => {})).catch(() => {});
  } finally {
    clearTimeout(timer);
  }
  if (context === undefined) {
    adb("forward", `tcp:${cdpPort}`, "localabstract:chrome_devtools_remote");
    cdpForward = true;
    adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", url, "com.android.chrome");
    let lastError;
    for (let attempt = 0; attempt < 20 && browser === undefined; attempt += 1) {
      try {
        browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`, { timeout: 3500 });
      } catch (error) {
        lastError = error;
        await sleep(1000);
      }
    }
    if (browser === undefined) throw lastError;
    context = browser.contexts()[0];
    assert(context, "CDP bridge exposed no browser context");
    console.log("AVD_CHROME_LAUNCH cdp-bridge");
  }
  page = context.pages().find((item) => item.url().startsWith(origin)) ?? context.pages()[0] ?? await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(String(error).slice(0, 200)));
}

async function turnstileToken(panel) {
  return await page.evaluate((panelName) => {
    const box = document.querySelector(`#turnstile-${panelName}`);
    return box?.querySelector('input[name="cf-turnstile-response"]')?.value ?? "";
  }, panel);
}

async function waitForTurnstile(panel) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if ((await turnstileToken(panel)) !== "") return true;
    await sleep(700);
  }
  return false;
}

/**
 * The emulator viewport is tall and the anti-bot widget expands above the
 * button, so a pointer click is unreliable there; requestSubmit() drives the
 * exact same submit handler the button calls.
 */
async function submitPanel(panel) {
  const form = `[data-access-panel="${panel}"]`;
  await page.waitForSelector(form, { timeout: 60_000 });
  await page.evaluate((selector) => {
    const element = document.querySelector(selector);
    element.requestSubmit();
  }, form);
}

async function api(path, init) {
  return await page.evaluate(async ({ path: requestPath, init: requestInit }) => {
    const response = await fetch(requestPath, { credentials: "same-origin", ...requestInit });
    const text = await response.text();
    let body;
    try {
      body = text === "" ? null : JSON.parse(text);
    } catch {
      body = text;
    }
    return { status: response.status, body };
  }, { path, init });
}

async function sessionUser() {
  const result = await api("/api/auth/session");
  return result.status === 200 ? result.body?.user ?? null : null;
}

/** The catalogue paginates 24 cards, so it is filtered on the tool's own name. */
async function openCatalogueOnTool() {
  await page.goto(`${origin}/strumenti/`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  const toolName = await page.evaluate((value) => {
    const card = document.querySelector(`[data-membership-toggle="${value}"]`)?.closest(".tool-card");
    return card?.getAttribute("data-name") ?? value;
  }, toolId);
  await page.goto(`${origin}/strumenti/?q=${encodeURIComponent(toolName)}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction((value) => {
    const button = document.querySelector(`[data-membership-toggle="${value}"]`);
    return button !== null && !button.disabled && button.getBoundingClientRect().width > 0;
  }, toolId, { timeout: 90_000 });
  return `[data-membership-toggle="${toolId}"]`;
}

let receipt;
try {
  await openChromeOn(`${origin}/accedi/#registrati`);

  await page.goto(`${origin}/accedi/#registrati`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForSelector("#register-name", { timeout: 60_000 });
  await page.fill("#register-name", name);
  await page.fill("#register-email", email);
  await page.fill("#register-password", password);
  const registerToken = await waitForTurnstile("register");
  record("registrazione: token anti-bot del form", registerToken, registerToken ? "ottenuto" : "non ottenuto in 120s");
  assert.ok(registerToken, "Turnstile token for the register panel was not issued on the emulator");
  await submitPanel("register");
  await page.waitForURL(`${origin}/preferiti/`, { timeout: 120_000 });
  record("registrazione: redirect a /preferiti/", true);

  const registered = await sessionUser();
  record("sessione dopo registrazione", registered?.email === email, registered?.email ?? "nessun utente");
  assert.equal(registered?.email, email, "session after registration did not expose the test account");

  const toggle = await openCatalogueOnTool();
  await page.click(toggle);
  const added = await (async () => {
    const deadline = Date.now() + 45_000;
    let result;
    while (Date.now() < deadline) {
      result = await api("/api/favorites");
      if (result.status === 200 && (result.body?.tools ?? []).includes(toolId)) return result;
      await sleep(800);
    }
    return result;
  })();
  record("preferito aggiunto dal catalogo", (added?.body?.tools ?? []).includes(toolId),
    `HTTP ${added?.status}, ${(added?.body?.tools ?? []).length} preferiti`);
  assert.ok((added?.body?.tools ?? []).includes(toolId), "favourite was not stored on the emulator");

  await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
  const afterReload = await sessionUser();
  record("sessione persistente dopo reload", afterReload?.email === email, afterReload?.email ?? "nessun utente");
  assert.equal(afterReload?.email, email, "session did not survive a reload on the emulator");

  await openCatalogueOnTool();
  await page.click(toggle);
  const removed = await (async () => {
    const deadline = Date.now() + 45_000;
    let result;
    while (Date.now() < deadline) {
      result = await api("/api/favorites");
      if (result.status === 200 && !(result.body?.tools ?? []).includes(toolId)) return result;
      await sleep(800);
    }
    return result;
  })();
  record("preferito rimosso dal catalogo", !(removed?.body?.tools ?? []).includes(toolId),
    `HTTP ${removed?.status}, ${(removed?.body?.tools ?? []).length} preferiti`);
  assert.ok(!(removed?.body?.tools ?? []).includes(toolId), "favourite was not removed on the emulator");

  const logout = await api("/api/auth/logout", { method: "POST" });
  record("logout", logout.status === 204 || logout.status === 200, `HTTP ${logout.status}`);
  assert.equal(await sessionUser(), null, "session survived logout on the emulator");
  record("sessione assente dopo logout", true);
  const anonymous = await api("/api/favorites");
  record("preferiti anonimi respinti", anonymous.status === 401, `HTTP ${anonymous.status}`);
  assert.equal(anonymous.status, 401, "anonymous favourites were not rejected on the emulator");

  await page.goto(`${origin}/accedi/`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForSelector("#login-email", { timeout: 60_000 });
  await page.fill("#login-email", email);
  await page.fill("#login-password", password);
  const loginToken = await waitForTurnstile("login");
  record("accesso: token anti-bot del form", loginToken, loginToken ? "ottenuto" : "non ottenuto in 120s");
  assert.ok(loginToken, "Turnstile token for the login panel was not issued on the emulator");
  await submitPanel("login");
  await page.waitForURL(`${origin}/preferiti/`, { timeout: 120_000 });
  const relogged = await sessionUser();
  record("accesso con le stesse credenziali", relogged?.email === email, relogged?.email ?? "nessun utente");
  assert.equal(relogged?.email, email, "login with the registered credentials failed on the emulator");

  const deletion = await api("/api/auth/account", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  record("eliminazione account", deletion.status === 204 || deletion.status === 200, `HTTP ${deletion.status}`);
  record("sessione assente dopo eliminazione", (await sessionUser()) === null);
} catch (error) {
  record("esecuzione", false, String(error).slice(0, 700));
} finally {
  receipt = {
    issue: "Strumentini.it#520",
    lane: "android-emulator",
    generatedAt: new Date().toISOString(),
    origin,
    device: { serial, chromeVersion, fingerprint },
    account: { email, name },
    tool: toolId,
    pageErrors,
    checks,
    status: checks.every((check) => check.status === "PASS") ? "PASS" : "FAIL",
  };
  await mkdir(dirname(receiptPath), { recursive: true });
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  if (context) await context.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
  if (device) await device.close().catch(() => {});
  if (cdpForward) { try { adb("forward", "--remove", `tcp:${cdpPort}`); } catch { /* already released */ } }
  console.log(`\n${receipt.status} — ${checks.filter((check) => check.status === "PASS").length}/${checks.length} — receipt: ${receiptPath}`);
}

if (receipt.status !== "PASS") process.exitCode = 1;
