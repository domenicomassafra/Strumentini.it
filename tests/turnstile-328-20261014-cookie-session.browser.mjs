/** #328 local real Chrome/WebKit session-bound login/register, no live auth.
 * Astro serves real site assets; a separate 127.0.0.1 HTTP proxy serves
 * synthetic, cookie-aware auth endpoints so WebKit sees real Set-Cookie bytes.
 * Cloudflare JS is Playwright-mocked; Siteverify/staging/D1 NOT_RUN.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { setTimeout as pause } from "node:timers/promises";
import { chromium, webkit } from "@playwright/test";

const origin = "http://127.0.0.1:19728";
const astroOrigin = "http://127.0.0.1:19726";
const astro = spawn("./node_modules/.bin/astro", ["dev", "--host", "127.0.0.1", "--port", "19726", "--strictPort"], {
  cwd: process.cwd(), stdio: "ignore",
});
const user = email => ({ email, name: "Fixture", passwordEnabled: true, googleConnected: false });
const vendor = `window.__turnstile328={}; window.turnstile={
  render(target,opts){window.__turnstile328[opts.action]=opts;target.textContent='Verifica locale';return 'fixture-'+opts.action;},
  reset(id){(window.__reset328 ||= []).push(id);}
}; window.strumentiniTurnstileLoaded();`;
const scenarios = [];
const pageErrors = [];
const offsite = [];
let activeFixture;

function json(res, status, body, extra = {}) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store", ...extra });
  res.end(JSON.stringify(body));
}

const proxy = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, origin).pathname;
    if (path.startsWith("/api/auth/")) {
      const fixture = activeFixture;
      assert(fixture, "Only known isolated auth scenarios can use the fixture");
      const { flow, mode, expected, token, state } = fixture;
      if (path === "/api/auth/google/config") return json(res, 503, { error: "disabled fixture" });
      if (path === "/api/auth/session") {
        assert.equal(req.method, "GET");
        state.sessionReads++;
        if (state.posts > 0) state.postLoginProbeCache.push(req.headers["cache-control"] ?? "");
        if (mode === "session-offline" && state.posts > 0) return json(res, 503, { error: "Sessione temporaneamente indisponibile" });
        const receivedCookie = /(?:^|;\s*)su_session=([^;]+)/u.exec(req.headers.cookie ?? "")?.[1];
        if (receivedCookie === token) state.cookieReads++;
        const matchingUser = receivedCookie === token ? user(expected) : null;
        return json(res, 200, { user: matchingUser ?? (mode === "wrong-user" && state.posts > 0 ? user("other@example.test") : null) });
      }
      assert.equal(path, `/api/auth/${flow}`, "Unexpected auth endpoint");
      assert.equal(req.method, "POST");
      let body = "";
      for await (const chunk of req) body += chunk;
      const data = JSON.parse(body);
      assert.equal(data.email, expected);
      assert.equal(data.turnstileToken, `token-${flow}`);
      state.posts++;
      const cookie = mode === "verified-cookie" || mode === "session-offline"
        ? { "set-cookie": `su_session=${token}; HttpOnly; Path=/; SameSite=Lax` } : {};
      return json(res, flow === "register" ? 201 : 200, { user: user(expected) }, cookie);
    }

    // The only other traffic consists of GETs for the actual local Astro
    // document/assets. Never proxy mutations or arbitrary remote URLs.
    assert(["GET", "HEAD"].includes(req.method));
    const upstream = await fetch(new URL(req.url, astroOrigin), { cache: "no-store" });
    res.writeHead(upstream.status, Object.fromEntries(upstream.headers.entries()));
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    json(res, 502, { error: `Local fixture refused request: ${String(error)}` });
  }
});

async function ready() {
  for (let i = 0; i < 100; i++) {
    if (astro.exitCode !== null) throw Error(`Astro exited ${astro.exitCode}`);
    try {
      if ((await fetch(`${origin}/accedi/`, { signal: AbortSignal.timeout(1000) })).ok) return;
    } catch { /* Astro still booting. */ }
    await pause(200);
  }
  throw Error("Isolated Astro fixture failed to start");
}

try {
  await new Promise((resolve, reject) => { proxy.once("error", reject); proxy.listen(19728, "127.0.0.1", resolve); });
  await ready();
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch(engine === chromium ? { channel: "chrome", headless: true } : { headless: true });
    try {
      for (const flow of ["login", "register"]) for (const mode of ["no-cookie", "wrong-user", "session-offline", "verified-cookie"]) {
        const expected = `${flow}@example.test`;
        const token = `fixture-${flow}-${engine.name()}`;
        const state = { posts: 0, sessionReads: 0, cookieReads: 0, postLoginProbeCache: [] };
        activeFixture = { flow, mode, expected, token, state };
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "it-IT" });
        try {
          await context.route("**/*", route => {
            const url = new URL(route.request().url());
            if (url.origin === "https://challenges.cloudflare.com" && url.pathname === "/turnstile/v0/api.js")
              return route.fulfill({ status: 200, contentType: "application/javascript", body: vendor });
            if (url.origin !== origin) { offsite.push(route.request().url()); return route.abort(); }
            return route.continue();
          });
          const page = await context.newPage();
          page.on("pageerror", e => pageErrors.push(`${engine.name()} ${flow}/${mode}: ${e.message}`));
          assert.equal((await page.goto(`${origin}/accedi/`, { waitUntil: "domcontentloaded" }))?.status(), 200);
          if (flow === "register") await page.getByRole("tab", { name: "Crea un account" }).click();
          await page.waitForFunction(action => window.__turnstile328?.[action] !== undefined, flow);
          if (flow === "register") await page.locator("#register-name").fill("Persona Test");
          await page.locator(`#${flow}-email`).fill(expected);
          await page.locator(`#${flow}-password`).fill("password-alfa-1");
          await page.evaluate(action => window.__turnstile328[action].callback(`token-${action}`), flow);
          await page.locator(`#panel-${flow} [data-access-submit]`).click();
          await page.waitForFunction(() => document.querySelector("[data-access-submit]:not([disabled])") !== null || location.pathname !== "/accedi/");
          if (mode === "verified-cookie") {
            await page.waitForURL("**/preferiti/", { timeout: 7000 });
            assert.equal(state.posts, 1);
            assert(state.cookieReads >= 1, "Positive outcome requires server-observed browser Cookie");
            assert((await context.cookies(origin)).some(c => c.name === "su_session" && c.value === token && c.httpOnly));
          } else {
            assert.equal(new URL(page.url()).pathname, "/accedi/", `False login redirect: ${engine.name()} ${flow}/${mode}`);
            await page.locator("[data-access-error][role=alert]:visible").waitFor({ timeout: 7000 });
            assert.match(await page.locator("[data-access-error]").innerText(), /sessione|verificare|confermare/u);
            assert.equal(state.posts, 1);
            assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute("data-access-error")), true);
            assert(await page.locator(`#panel-${flow} [data-access-submit]`).isEnabled());
            const cookie = (await context.cookies(origin)).find(c => c.name === "su_session");
            if (mode === "session-offline") assert(cookie?.value === token, "Even a stored cookie cannot confirm an unavailable server session");
            else assert.equal(cookie, undefined, "No-cookie and wrong-user refusals must not mint a cookie");
          }
          assert(state.postLoginProbeCache.length >= 1, "Every accepted HTTP POST must trigger a fresh independent session probe");
          assert(state.postLoginProbeCache.some(value => /no-cache|no-store/u.test(value)),
            `Browser session follow-up must bypass cache: ${JSON.stringify({engine:engine.name(),flow,mode,state})}`);
          scenarios.push({ engine: engine.name(), flow, mode, ...state });
        } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  }
  assert.equal(scenarios.length, 16);
  assert.deepEqual(offsite, []);
  assert.deepEqual(pageErrors, []);
  console.log("PASS #328 actual cookie-bound local Chrome/WebKit, 16 scenarios", JSON.stringify({ scenarios,
    realSiteverify: "NOT_RUN", physicalDevices: "NOT_RUN", realAuthStaging: "NOT_RUN" }));
} finally {
  await new Promise(resolve => proxy.close(resolve));
  if (astro.exitCode === null) astro.kill("SIGTERM");
}
