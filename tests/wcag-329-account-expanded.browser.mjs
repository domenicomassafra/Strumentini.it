/**
 * Ticket #329: independent computed-color/keyboard audit over real account
 * routes, including settings signed-in controls omitted from earlier matrices.
 * Run with an existing local dev server:
 * ACCOUNT329_ORIGIN=http://127.0.0.1:19573 node tests/wcag-329-account-expanded.browser.mjs
 * All session/account network requests are browser fixtures, never live users.
 */
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const origin = process.env.ACCOUNT329_ORIGIN ?? "http://127.0.0.1:19573";
const user = { id: "fixture", name: "Persona Test", email: "persona@example.test", passwordEnabled: true, googleConnected: true };
const checks = [];
const globalOverflows = [];
let fileChooserFocusChecks = 0;
let offsite = 0;
const externalUrls = new Set();
let mutations = 0;
const errors = [];

// Values are composited by the browser when opaque: no sampling a declared
// theme token instead of the paint on the actual foreground/background nodes.
function luminance(rgb) {
  const match = /^rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)(?:\s*\/\s*([\d.]+))?\)$/.exec(rgb);
  assert(match, `Unexpected browser color ${rgb}`);
  assert(!match[4] || Number(match[4]) === 1, `Color requires alpha composition: ${rgb}`);
  return match.slice(1, 4).map(Number).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i], 0);
}
function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

async function audit(page, meta) {
  // Read all visible text leaves, including dynamic validation and helper text.
  const rows = await page.evaluate(() => {
    const root = document.querySelector(".ac-access, .ac-shell");
    if (!root) throw new Error("account root missing");
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const rows = [];
    let node;
    while ((node = walker.nextNode())) {
      if (!node.textContent?.trim()) continue;
      const element = node.parentElement;
      if (!element || element.closest("[hidden], [aria-hidden=true]") || !element.getClientRects().length) continue;
      const style = getComputedStyle(element);
      if (style.visibility !== "visible" || Number(style.opacity) < 1) continue;
      let ancestor = element;
      let background = null;
      while (ancestor) {
        const color = getComputedStyle(ancestor).backgroundColor;
        if (/^rgb\(\d+[, ]+\d+[, ]+\d+\)$/.test(color)) { background = color; break; }
        ancestor = ancestor.parentElement;
      }
      if (!background) continue;
      rows.push({
        text: node.textContent.trim().slice(0, 90),
        node: element.tagName.toLowerCase(),
        cls: typeof element.className === "string" ? element.className.slice(0, 90) : "",
        ink: style.color,
        background,
        size: parseFloat(style.fontSize),
        weight: Number(style.fontWeight),
      });
    }
    return rows;
  });
  for (const row of rows) {
    const actual = contrast(row.ink, row.background);
    const large = row.size >= 24 || (row.size >= 18.66 && row.weight >= 700);
    checks.push({ ...meta, ...row, ratio: +actual.toFixed(3), threshold: large ? 3 : 4.5 });
  }
  const viewport = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: document.documentElement.clientWidth,
    offenders: Array.from(document.querySelectorAll("body *:not(svg):not(path)"))
      .filter((element) => element.getClientRects().length)
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.right > document.documentElement.clientWidth + 2 || rect.left < -2)
      .sort((a, b) => b.rect.right - a.rect.right)
      .slice(0, 40).map(({ element, rect }) => ({
        selector: element.tagName.toLowerCase() + (element.className && typeof element.className === "string" ? "." + element.className.trim().split(/\s+/).join(".") : ""),
        id: element.id, text: element.textContent.trim().slice(0, 42), left: Math.round(rect.left), right: Math.round(rect.right),
        withinScroller: Boolean(element.closest("[data-settings-nav]")),
      })),
  }));
  const rootOverflows = viewport.offenders.filter((row) => row.selector.startsWith("div.ac-") ||
    row.selector.startsWith("input") || row.selector.startsWith("span.ac-") || row.selector.startsWith("button.ac-"));
  assert.deepEqual(rootOverflows, [], `Account controls overflow ${JSON.stringify({ ...meta, viewport })}`);
  if (viewport.scroll > viewport.width + 1) {
    globalOverflows.push({ ...meta, viewport });
    // The authenticated global site header extends past 320px; it is owned by
    // the global shell, outside this ticket's account stylesheet jurisdiction.
    assert(meta.signedIn && meta.width === 320 && viewport.offenders.every((item) =>
      item.selector.startsWith("div.site-actions") || item.selector.startsWith("button.site-menu-button") ||
      (meta.path === "/impostazioni/" && item.withinScroller)),
      `Unexpected route overflow ${JSON.stringify({ ...meta, viewport })}`);
  }
}

const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
try {
  for (const width of [320, 390]) for (const theme of ["light", "dark"]) for (const signedIn of [false, true]) {
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: "reduce", locale: "it-IT" });
    await ctx.addInitScript((value) => localStorage.setItem("strumentini:theme:v1", value), theme);
    await ctx.route("**/*", (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== origin) { offsite++; externalUrls.add(url.href); return route.abort(); }
      if (url.pathname === "/api/auth/session") {
        return route.fulfill({ status: signedIn ? 200 : 503, contentType: "application/json",
          body: JSON.stringify(signedIn ? { user } : { error: "Account non disponibile" }) });
      }
      if (url.pathname.startsWith("/api/auth/")) {
        if (request.method() !== "GET") mutations++;
        return route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"Servizio non disponibile"}' });
      }
      return route.continue();
    });
    const page = await ctx.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      for (const path of ["/accedi/", "/impostazioni/"]) {
        const response = await page.goto(`${origin}${path}`, { waitUntil: "domcontentloaded" });
        assert.equal(response?.status(), 200);
        assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
        if (path === "/impostazioni/") await page.locator(signedIn ? "[data-session-signedin]:visible" : "[data-session-signedout]:visible").first().waitFor();
        const panels = path === "/accedi/" ? (signedIn ? ["connected"] : ["login", "register"]) : ["profilo", "preferenze", "tema", "privacy"];
        for (const panel of panels) {
          if (panel !== "connected") await page.locator(`#tab-${panel}`).click();
          else await page.locator("[data-access-connected]:visible").waitFor();
          if (path === "/accedi/" && !signedIn) {
            await page.locator(`#panel-${panel} [data-access-submit]`).click();
            await page.locator(`#panel-${panel} [data-field-error]:visible`).first().waitFor();
          }
          if (path === "/impostazioni/" && signedIn && panel === "privacy") {
            await page.locator("[data-delete-submit]").click();
            await page.locator("#delete-confirm-error:visible").waitFor();
          }
          if (path === "/impostazioni/" && panel === "privacy") {
            // The native upload control must remain keyboard reachable and
            // retain a visible ring after its 320px intrinsic sizing fix.
            await page.locator("[data-local-clear]").focus();
            await page.keyboard.press("Tab");
            const fileFocus = await page.locator("#device-config-import").evaluate((element) => {
              const css = getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              return {
                active: document.activeElement === element,
                visible: element.matches(":focus-visible"),
                outline: css.outlineStyle,
                outlineWidth: parseFloat(css.outlineWidth),
                left: rect.left, right: rect.right, viewportWidth: innerWidth,
              };
            });
            assert(fileFocus.active && fileFocus.visible && fileFocus.outline !== "none" &&
              fileFocus.outlineWidth >= 2 && fileFocus.left >= 0 && fileFocus.right <= width + 1,
              `Keyboard file import loses focus or clips at ${width}px/${theme}: ${JSON.stringify(fileFocus)}`);
            fileChooserFocusChecks++;
          }
          await audit(page, { path, width, theme, signedIn, panel });
        }
      }
    } finally { await ctx.close(); }
  }
  const violations = checks.filter((row) => row.ratio + 0.001 < row.threshold);
  console.log(JSON.stringify({ ticket: 329, chrome: browser.version(), samples: checks.length,
    minimum: Math.min(...checks.map((row) => row.ratio)),
    violations: violations.slice(0, 12),
    globalOverflows: globalOverflows.map(({ path, width, theme, signedIn, panel, viewport }) =>
      ({ path, width, theme, signedIn, panel, documentWidth: viewport.scroll })),
    fileChooserFocusChecks, offsite, externalUrls: Array.from(externalUrls), mutations, errors }));
  assert.equal(fileChooserFocusChecks, 8);
  assert.deepEqual(violations, [], `Normal/large text contrast regression: ${JSON.stringify(violations.slice(0, 12))}`);
  assert.equal(mutations, 0);
  // All external requests were intercepted and aborted; only the intentional
  // third-party challenge bootstrap may be attempted by the actual login page.
  assert(Array.from(externalUrls).every((url) => url.startsWith("https://challenges.cloudflare.com/turnstile/v0/api.js")),
    `Unexpected external requests: ${JSON.stringify(Array.from(externalUrls))}`);
  assert.deepEqual(errors, []);
  console.log(`PASS #329 expanded: ${checks.length} visible account text samples, both routes, 320/390px, light/dark and signed-in/denied states.`);
} finally { await browser.close(); }
