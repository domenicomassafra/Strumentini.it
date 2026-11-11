/**
 * #520 authenticated consumer smoke on the installed production site.
 *
 * Registers a disposable test account through the site's own forms, proves the
 * session cookie survives a reload, adds and removes a favourite through the
 * catalogue control, logs out, checks the anonymous guard again, logs back in
 * and deletes the account from the account API. Every scenario runs against
 * https://strumentini.it as a browser sees it: no local build, no fixtures.
 *
 * The public registration and login endpoints sit behind Cloudflare Turnstile.
 * A browser launched by Playwright is refused the widget challenge ("La
 * verifica non è riuscita"), while the shared headed Chrome profile on the
 * MiniPC solves it in seconds. This script therefore attaches to an already
 * running Chrome over CDP instead of launching one, and opens exactly one tab,
 * which it closes again:
 *
 *   AUTH_EMAIL=... AUTH_PASSWORD=... node scripts/acceptance-auth-production-520.mjs
 *
 * Optional: AUTH_CDP_ENDPOINT (default http://127.0.0.1:17629, the SSH-forwarded
 * MiniPC automation browser), AUTH_ORIGIN, AUTH_NAME, AUTH_TOOL,
 * AUTH_RECEIPT, AUTH_KEEP_ACCOUNT=1 to leave the account in place.
 *
 * The receipt contains no password, no cookie and no Turnstile token.
 */
import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { chromium } from "@playwright/test";

const origin = (process.env.AUTH_ORIGIN ?? "https://strumentini.it").replace(/\/$/u, "");
const cdpEndpoint = process.env.AUTH_CDP_ENDPOINT ?? "http://127.0.0.1:17629";
const email = process.env.AUTH_EMAIL ?? "";
const password = process.env.AUTH_PASSWORD ?? "";
const name = process.env.AUTH_NAME ?? "Strumentini Test 520";
const toolId = process.env.AUTH_TOOL ?? "business-day";
const receiptPath = resolve(process.env.AUTH_RECEIPT ?? "quality/receipts/consumer-auth-520/production.json");
const keepAccount = process.env.AUTH_KEEP_ACCOUNT === "1";

if (email === "" || password === "") {
  console.error("AUTH_EMAIL and AUTH_PASSWORD are required; nothing was sent to production.");
  process.exit(2);
}

const checks = [];
function record(step, passed, detail) {
  checks.push({ step, status: passed ? "PASS" : "FAIL", detail });
  console.log(`  ${passed ? "PASS" : "FAIL"} ${step}${detail === undefined ? "" : ` — ${detail}`}`);
  return passed;
}

const browser = await chromium.connectOverCDP(cdpEndpoint);
const context = browser.contexts()[0];
const page = await context.newPage();
const failures = [];
page.on("pageerror", (error) => failures.push(String(error).slice(0, 200)));

/** Resolves the Turnstile token of one auth panel, empty string when absent. */
async function turnstileToken(panel) {
  return await page.evaluate((panelName) => {
    const box = document.querySelector(`#turnstile-${panelName}`);
    return box?.querySelector('input[name="cf-turnstile-response"]')?.value ?? "";
  }, panel);
}

async function waitForTurnstile(panel) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if ((await turnstileToken(panel)) !== "") return true;
    await page.waitForTimeout(500);
  }
  return false;
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

/** Opens the catalogue on one tool: the list paginates 24 cards, so it is filtered first. */
async function openCatalogueOnTool(toolId) {
  await page.goto(`${origin}/strumenti/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const name = await page.evaluate((value) => {
    const card = document.querySelector(`[data-membership-toggle="${value}"]`)?.closest(".tool-card");
    return card?.getAttribute("data-name") ?? value;
  }, toolId);
  await page.goto(`${origin}/strumenti/?q=${encodeURIComponent(name)}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction((value) => {
    const button = document.querySelector(`[data-membership-toggle="${value}"]`);
    return button !== null && !button.disabled && button.getBoundingClientRect().width > 0;
  }, toolId, { timeout: 60_000 });
  return `[data-membership-toggle="${toolId}"]`;
}

async function sessionUser() {
  const result = await api("/api/auth/session");
  return result.status === 200 ? result.body?.user ?? null : null;
}

let receipt;
try {
  // 1. Registration through the real form.
  await page.goto(`${origin}/accedi/#registrati`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector('#register-name', { timeout: 30_000 });
  await page.fill("#register-name", name);
  await page.fill("#register-email", email);
  await page.fill("#register-password", password);
  const registerToken = await waitForTurnstile("register");
  record("registrazione: token anti-bot del form", registerToken, registerToken ? "ottenuto" : "non ottenuto in 90s");
  assert.ok(registerToken, "Turnstile token for the register panel was not issued");
  await page.click('[data-access-panel="register"] [data-access-submit]');
  await page.waitForURL(`${origin}/preferiti/`, { timeout: 90_000 });
  record("registrazione: redirect a /preferiti/", true);

  // 2. Session.
  const registered = await sessionUser();
  record("sessione dopo registrazione", registered?.email === email, registered?.email ?? "nessun utente");
  assert.equal(registered?.email, email, "session after registration did not expose the test account");

  // 3. Favourite add through the catalogue control.
  const toggle = await openCatalogueOnTool(toolId);
  await page.click(toggle);
  const added = await (async () => {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const result = await api("/api/favorites");
      if (result.status === 200 && (result.body?.tools ?? []).includes(toolId)) return result;
      await page.waitForTimeout(500);
    }
    return await api("/api/favorites");
  })();
  record("preferito aggiunto dal catalogo", (added.body?.tools ?? []).includes(toolId),
    `HTTP ${added.status}, ${(added.body?.tools ?? []).length} preferiti`);
  assert.ok((added.body?.tools ?? []).includes(toolId), "favourite was not stored for the account");

  // 4. Session persistence across a reload in the same tab.
  await page.reload({ waitUntil: "domcontentloaded" });
  const afterReload = await sessionUser();
  record("sessione persistente dopo reload", afterReload?.email === email, afterReload?.email ?? "nessun utente");
  assert.equal(afterReload?.email, email, "session did not survive a reload");

  // 5. Favourite removal through the same control.
  await openCatalogueOnTool(toolId);
  await page.click(toggle);
  const removed = await (async () => {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const result = await api("/api/favorites");
      if (result.status === 200 && !(result.body?.tools ?? []).includes(toolId)) return result;
      await page.waitForTimeout(500);
    }
    return await api("/api/favorites");
  })();
  record("preferito rimosso dal catalogo", !(removed.body?.tools ?? []).includes(toolId),
    `HTTP ${removed.status}, ${(removed.body?.tools ?? []).length} preferiti`);
  assert.ok(!(removed.body?.tools ?? []).includes(toolId), "favourite was not removed");

  // 6. Logout, then the anonymous guard.
  const logout = await api("/api/auth/logout", { method: "POST" });
  record("logout", logout.status === 204 || logout.status === 200, `HTTP ${logout.status}`);
  const signedOut = await sessionUser();
  record("sessione assente dopo logout", signedOut === null, signedOut === null ? "user null" : "utente ancora presente");
  const anonymousFavorites = await api("/api/favorites");
  record("preferiti anonimi respinti", anonymousFavorites.status === 401, `HTTP ${anonymousFavorites.status}`);
  assert.equal(anonymousFavorites.status, 401, "anonymous favourites were not rejected");

  // 7. Login again with the same credentials.
  await page.goto(`${origin}/accedi/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector("#login-email", { timeout: 30_000 });
  await page.fill("#login-email", email);
  await page.fill("#login-password", password);
  const loginToken = await waitForTurnstile("login");
  record("accesso: token anti-bot del form", loginToken, loginToken ? "ottenuto" : "non ottenuto in 90s");
  assert.ok(loginToken, "Turnstile token for the login panel was not issued");
  await page.click('[data-access-panel="login"] [data-access-submit]');
  await page.waitForURL(`${origin}/preferiti/`, { timeout: 90_000 });
  const relogged = await sessionUser();
  record("accesso con le stesse credenziali", relogged?.email === email, relogged?.email ?? "nessun utente");
  assert.equal(relogged?.email, email, "login with the registered credentials failed");

  // 8. Account deletion through the supported endpoint, then the credential dies.
  if (keepAccount) {
    record("eliminazione account", true, "saltata via AUTH_KEEP_ACCOUNT=1");
  } else {
    const deletion = await api("/api/auth/account", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    record("eliminazione account", deletion.status === 204 || deletion.status === 200, `HTTP ${deletion.status}`);
    const deletedSession = await sessionUser();
    record("sessione assente dopo eliminazione", deletedSession === null, deletedSession === null ? "user null" : "utente ancora presente");
    // The same credentials must now fail in the real form, after a fresh token.
    await page.goto(`${origin}/accedi/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForSelector("#login-email", { timeout: 30_000 });
    await page.fill("#login-email", email);
    await page.fill("#login-password", password);
    assert.ok(await waitForTurnstile("login"), "Turnstile token for the deleted-account login was not issued");
    await page.click('[data-access-panel="login"] [data-access-submit]');
    const refusal = await page.waitForFunction(() => {
      const message = document.querySelector("[data-access-error]");
      return message !== null && message.textContent.trim() !== "" ? message.textContent.trim() : false;
    }, undefined, { timeout: 60_000 }).then((handle) => handle.jsonValue()).catch(() => "");
    record("accesso rifiutato dopo eliminazione", /non corretti|non valid/u.test(refusal) && page.url().includes("/accedi"),
      refusal === "" ? "nessun messaggio" : refusal.slice(0, 80));
  }
} catch (error) {
  record("esecuzione", false, String(error).slice(0, 300));
} finally {
  receipt = {
    issue: "Strumentini.it#520",
    generatedAt: new Date().toISOString(),
    origin,
    cdpEndpoint,
    account: { email, name },
    tool: toolId,
    pageErrors: failures,
    checks,
    status: checks.every((check) => check.status === "PASS") ? "PASS" : "FAIL",
  };
  await mkdir(dirname(receiptPath), { recursive: true });
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  await page.close();
  await browser.close();
  console.log(`\n${receipt.status} — ${checks.filter((check) => check.status === "PASS").length}/${checks.length} — receipt: ${receiptPath}`);
}

if (receipt.status !== "PASS") process.exitCode = 1;
