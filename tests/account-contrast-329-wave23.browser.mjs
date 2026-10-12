/** #329 wave23: local account login/register browser computed CSS audit.
 * ACCOUNT329_ORIGIN=http://127.0.0.1:19629 node tests/account-contrast-329-wave23.browser.mjs
 * HTTP auth/Turnstile are intercepted; 320px is 1280px at 400%-equivalent
 * reflow, not native browser zoom. Screenreaders/physical mobile NOT_RUN.
 */
import assert from "node:assert/strict";
import { chromium, webkit } from "@playwright/test";

const origin = process.env.ACCOUNT329_ORIGIN ?? "http://127.0.0.1:19629";
const simulatedContrastFault = process.env.ACCOUNT329_WAVE23_FAULT === "contrast";
const reports = [];
const alertFocusSamples = [];
const external = new Set();
const jsErrors = [];
let authMutations = 0;

function luminance(value) {
  const match = /^rgba?\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)(?:\s*\/\s*([\d.]+))?\s*\)$/.exec(value);
  assert(match, `Unparseable computed CSS color: ${value}`);
  assert(!match[4] || Number(match[4]) === 1, `Non-opaque CSS color needs compositing: ${value}`);
  return match.slice(1, 4).map(Number).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
}
function contrast(ink, ground) {
  const a = luminance(ink), b = luminance(ground);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

async function audit(page, meta) {
  const data = await page.evaluate(() => {
    const root = document.querySelector(".ac-access");
    if (!root) throw Error("Real account route missing");
    const visible = (element) => {
      if (!element || element.closest("[hidden], [aria-hidden='true']")) return false;
      const css = getComputedStyle(element);
      return css.display !== "none" && css.visibility === "visible" && css.opacity !== "0" && element.getClientRects().length > 0;
    };
    const color = (element) => {
      const style = getComputedStyle(element);
      let at = element;
      let bg = "";
      while (at) {
        const test = getComputedStyle(at).backgroundColor;
        if (/^rgb\([\d, ]+\)$/.test(test)) { bg = test; break; }
        at = at.parentElement;
      }
      return { ink: style.color, bg, size: parseFloat(style.fontSize), weight: Number(style.fontWeight) };
    };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const text = [];
    let node;
    while ((node = walker.nextNode())) {
      const element = node.parentElement;
      if (!node.textContent?.trim() || !visible(element)) continue;
      text.push({ label: node.textContent.trim().slice(0, 85), cls: element.className || element.id, ...color(element) });
    }
    const controls = [...root.querySelectorAll(".ac-reveal, .ac-control-icon, .ac-tab, .ac-field-error, .ac-trust a, .ac-support a")]
      .filter(visible).map((el) => ({ label: el.getAttribute("aria-label") || el.textContent.trim().slice(0, 50), cls: el.className || el.id,
        rect: { left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right },
        ...color(el) }));
    const bounds = root.getBoundingClientRect();
    return { text, controls, geometry: { document: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth, left: bounds.left, right: bounds.right,
      rootScrollWidth: root.scrollWidth, rootClientWidth: root.clientWidth } };
  });
  const text = data.text.filter(({ bg }) => bg).map((row) => ({ ...row, ratio: contrast(row.ink, row.bg),
    threshold: row.size >= 24 || (row.size >= 18.66 && row.weight >= 700) ? 3 : 4.5 }));
  const controls = data.controls.filter(({ bg }) => bg).map((row) => ({ ...row, ratio: contrast(row.ink, row.bg) }));
  const problems = text.filter((row) => row.ratio + 0.001 < row.threshold);
  const weakIcons = controls.filter((row) => /ac-reveal|ac-control-icon/.test(row.cls) && row.ratio < 3);
  const report = { ...meta, samples: text.length, min: Math.min(...text.map((row) => row.ratio)),
    textProblems: problems, weakIcons, selected: controls.filter((x) => /ac-tab|ac-reveal|ac-control-icon/.test(x.cls)), geometry: data.geometry };
  reports.push(report);
  assert.deepEqual(problems, [], `Computed text contrast must meet WCAG AA: ${JSON.stringify(meta)}`);
  assert.deepEqual(weakIcons, [], `Password reveal icons must meet non-text 3:1 contrast: ${JSON.stringify(meta)}`);
  return report;
}

async function keyFocus(page, selector, engine) {
  // Actual Tab key, rather than programmatic HTMLElement.focus().
  let reached = false;
  for (let n = 0; n < 50; n++) {
    // macOS WebKit models Safari's default: Tab visits text controls; Option+Tab
    // reaches all page controls with Full Keyboard Access disabled.
    await page.keyboard.press(engine === "webkit" ? "Alt+Tab" : "Tab");
    if (await page.locator(selector).evaluate((node) => document.activeElement === node)) { reached = true; break; }
  }
  if (!reached) return { reached: false };
  return page.locator(selector).evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const css = getComputedStyle(node);
    return { reached: true, focusVisible: node.matches(":focus-visible"),
      outline: css.outlineStyle, width: parseFloat(css.outlineWidth), color: css.outlineColor,
      shadow: css.boxShadow, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, viewport: innerWidth };
  });
}

async function focusState(page, selector) {
  return page.locator(selector).evaluate((el) => {
    const css = getComputedStyle(el), rect = el.getBoundingClientRect();
    return { focused: document.activeElement === el, visible: el.matches(":focus-visible"),
      outline: css.outlineStyle, width: parseFloat(css.outlineWidth), color: css.outlineColor,
      shadow: css.boxShadow, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
      viewport: innerWidth, screenHeight: innerHeight };
  });
}

for (const engine of [chromium, webkit]) {
  const browser = await engine.launch({ headless: true });
  try {
    for (const width of [320, 390]) for (const theme of ["light", "dark"]) {
      const ctx = await browser.newContext({ viewport: { width, height: 844 }, locale: "it-IT", reducedMotion: "reduce" });
      await ctx.addInitScript((mode) => localStorage.setItem("strumentini:theme:v1", mode), theme);
      await ctx.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.origin === "https://challenges.cloudflare.com" && url.pathname.startsWith("/turnstile/v0/api.js")) {
          return route.fulfill({ status: 200, contentType: "application/javascript", body: `
            window.__wave23Widgets = {};
            window.turnstile = {
              render(el, opts) { window.__wave23Widgets[opts.action] = opts; el.textContent = "Verifica locale simulata"; return opts.action; },
              reset() {}
            };
            window.strumentiniTurnstileLoaded();
          ` });
        }
        if (url.origin !== origin) { external.add(url.href); return route.abort(); }
        if (url.pathname === "/api/auth/session") return route.fulfill({ status: 200, contentType: "application/json", body: '{"user":null}' });
        if (url.pathname.startsWith("/api/auth/")) {
          if (route.request().method() !== "GET") authMutations++;
          return route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"Servizio locale temporaneamente non disponibile"}' });
        }
        return route.continue();
      });
      const page = await ctx.newPage();
      page.on("pageerror", (error) => jsErrors.push(`${engine.name()} ${width}/${theme}: ${error.message}`));
      try {
        assert.equal((await page.goto(`${origin}/accedi/`, { waitUntil: "domcontentloaded" }))?.status(), 200);
        assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
        // Negative proof: browser-side only; NEVER edits production CSS/source.
        if (simulatedContrastFault && engine.name() === "chromium" && width === 320 && theme === "light") {
          await page.addStyleTag({ content: ".ac-access .ac-support { color: rgb(215, 215, 215) !important; }" });
        }
        const tabs = await keyFocus(page, "#tab-login", engine.name());
        assert(tabs.reached && tabs.focusVisible && tabs.outline !== "none" && tabs.width >= 2
          && tabs.left >= 0 && tabs.right <= width + 1,
          `Visible account tab keyboard ring missing: ${engine.name()} ${width}/${theme} ${JSON.stringify(tabs)}`);
        await page.keyboard.press("End");
        const registerTab = await page.locator("#tab-register").evaluate((el) => ({ focused: document.activeElement === el, selected: el.getAttribute("aria-selected") }));
        assert(registerTab.focused && registerTab.selected === "true", `Keyboard roving tab selection ${engine.name()} ${width}/${theme}`);
        await page.locator("#panel-register [data-access-submit]").click();
        await page.locator("#register-name-error:visible").waitFor();
        assert((await focusState(page, "#register-name")).focused, `Registration validation must focus first invalid field ${engine.name()} ${width}/${theme}`);
        const register = await audit(page, { engine: engine.name(), width, theme, panel: "register", state: "inline-errors" });
        await page.locator("#register-name").fill("Mario Rossi");
        await page.locator("#register-email").fill("test@example.test");
        await page.locator("#register-password").fill("example-pass-329");
        await page.waitForFunction(() => window.__wave23Widgets?.register);
        await page.evaluate(() => window.__wave23Widgets.register.callback("local-reg-token"));
        await page.locator("#panel-register [data-access-submit]").click();
        await page.locator("[data-access-error][role=alert]:visible").waitFor();
        await page.waitForTimeout(250);
        const registrationErrorFocus = await focusState(page, "[data-access-error]");
        assert(registrationErrorFocus.focused && registrationErrorFocus.outline !== "none" && registrationErrorFocus.width >= 2
          && registrationErrorFocus.top >= 72 && registrationErrorFocus.bottom < registrationErrorFocus.screenHeight - 4,
          `Registration 503 keyboard focus not visibly in viewport ${engine.name()} ${width}/${theme}: ${JSON.stringify(registrationErrorFocus)}`);
        const unclipped = await page.locator("[data-access-error]").evaluate((el) => {
          const box = el.getBoundingClientRect();
          const hit = document.elementFromPoint(box.left + box.width / 2, box.top + Math.min(10, box.height / 2));
          return hit === el || el.contains(hit);
        });
        assert(unclipped, `Focused HTTP503 alert is occluded by the sticky site header ${engine.name()} ${width}/${theme}`);
        alertFocusSamples.push({ engine: engine.name(), width, theme, top: registrationErrorFocus.top, bottom: registrationErrorFocus.bottom, unoccluded: true });
        await audit(page, { engine: engine.name(), width, theme, panel: "register", state: "HTTP503" });
        await page.getByRole("tab", { name: "Accedi", exact: true }).click();
        await page.locator("#panel-login [data-access-submit]").click();
        await page.locator("#login-email-error:visible").waitFor();
        assert((await focusState(page, "#login-email")).focused, `Login validation must focus first invalid field ${engine.name()} ${width}/${theme}`);
        const login = await audit(page, { engine: engine.name(), width, theme, panel: "login", state: "inline-errors" });
        await page.locator("#login-email").fill("test@example.test");
        await page.locator("#login-password").fill("example-pass-329");
        await page.waitForFunction(() => window.__wave23Widgets?.login);
        await page.evaluate(() => window.__wave23Widgets.login.callback("local-login-token"));
        await page.locator("#panel-login [data-access-submit]").click();
        await page.locator("[data-access-error][role=alert]:visible").waitFor();
        await page.waitForTimeout(250);
        const loginErrorFocus = await focusState(page, "[data-access-error]");
        assert(loginErrorFocus.focused && loginErrorFocus.outline !== "none" && loginErrorFocus.width >= 2
          && loginErrorFocus.top >= 72 && loginErrorFocus.bottom < loginErrorFocus.screenHeight - 4,
          `Login 503 alert focus clipped ${engine.name()} ${width}/${theme}: ${JSON.stringify(loginErrorFocus)}`);
        await audit(page, { engine: engine.name(), width, theme, panel: "login", state: "HTTP503" });
      } finally { await ctx.close(); }
    }
  } finally { await browser.close(); }
}

const textFailures = reports.flatMap((row) => row.textProblems.map((p) => ({ engine: row.engine, width: row.width, theme: row.theme, panel: row.panel, state: row.state, ...p })));
const iconFailures = reports.flatMap((row) => row.weakIcons.map((p) => ({ engine: row.engine, width: row.width, theme: row.theme, panel: row.panel, ...p })));
const overflows = reports.filter((entry) => entry.geometry.document > entry.geometry.viewport + 1 ||
  entry.geometry.left < -1 || entry.geometry.right > entry.geometry.viewport + 1);
assert.equal(reports.length, 32, "Both engines, two viewport widths, two themes, login/register inline and 503 states");
assert.deepEqual(textFailures, [], "WCAG AA computed normal/large text contrast");
assert.deepEqual(iconFailures, [], "WCAG nontext icon contrast for password reveals");
assert.deepEqual(overflows, [], "Account container and page must not horizontally overflow");
assert.deepEqual(jsErrors, []);
assert.deepEqual([...external], [], "No external traffic beyond intercepted local Turnstile fixture");
assert.equal(authMutations, 16, "Exactly one locally intercepted 503 per form/engine/viewport/theme, never real account mutation");
console.log("PASS #329 wave23 Chrome/WebKit login+register inline+HTTP503:", JSON.stringify({
  states: reports.length, computedTextSamples: reports.reduce((sum, entry) => sum + entry.samples, 0),
  minimumTextContrast: Math.min(...reports.map((entry) => entry.min)),
  registrationAlertFocusPositions: alertFocusSamples,
  keyboardFocusedRegistrationAlert: "visible/unoccluded after failure",
  widths: [320, 390], themes: ["light", "dark"], responsiveZoomEquivalent: "1280px at 400% (width-only)",
  localMocked503Submissions: authMutations, offsiteRequests: external.size, jsErrors: jsErrors.length,
  nativeZoom: "NOT_RUN", physicalDevices: "NOT_RUN", screenreaders: "NOT_RUN",
}));
