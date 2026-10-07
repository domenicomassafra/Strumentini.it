import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import render from "preact-render-to-string";
import { RESULT_V2_SEMANTIC_FIXTURES } from "../quality/fixtures/result-v2-semantic-classes/fixtures";
import { RESULT_V2_CLASS_CONTRACTS } from "../src/quality/result-v2-conformance";

const css = [
  await readFile(new URL("../src/styles/global.css", import.meta.url), "utf8"),
  await readFile(new URL("../src/components/tools/tool-surface.css", import.meta.url), "utf8"),
].join("\n");

const body = RESULT_V2_SEMANTIC_FIXTURES
  .map((fixture) => render(fixture.render() as Parameters<typeof render>[0]))
  .join("\n");

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.setContent(`<!doctype html><html lang="it"><head><meta charset="utf-8"><style>${css}</style></head><body><main>${body}</main></body></html>`);

  for (const fixture of RESULT_V2_SEMANTIC_FIXTURES) {
    const contract = RESULT_V2_CLASS_CONTRACTS[fixture.class];
    const root = page.locator(`[data-result-class="${fixture.class}"]`);
    if (await root.count() !== 1) throw new Error(`${fixture.class}: expected exactly one rendered class fixture`);

    const slots = await root.locator("[data-result-slot]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-result-slot")));
    let cursor = -1;
    for (const slot of contract.requiredSlots) {
      const index = slots.indexOf(slot, cursor + 1);
      if (index < 0) throw new Error(`${fixture.class}: required slot ${slot} is missing or out of order`);
      cursor = index;
    }

    const panel = root.locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' result-panel ')][1]");
    if (await panel.getAttribute("aria-live") !== null) throw new Error(`${fixture.class}: payload panel must not be a live region`);
    if (await panel.locator('[data-result-announcement="polite"]').count() !== 1) throw new Error(`${fixture.class}: missing concise polite announcement`);
    if (await panel.locator('[data-result-announcement="assertive"]').count() !== 1) throw new Error(`${fixture.class}: missing concise assertive announcement`);
    if (await panel.locator('[data-result-state="success"]').count() !== 1) throw new Error(`${fixture.class}: missing visible non-colour success cue`);

    const actions = root.locator("[data-result-action]");
    const actionIds = await actions.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-result-action")));
    for (const action of contract.requiredActions) {
      if (!actionIds.includes(action)) throw new Error(`${fixture.class}: browser fixture missing action ${action}`);
    }
    const primaryAction = root.locator('[data-primary-action="true"]');
    if (await primaryAction.count() !== 1) throw new Error(`${fixture.class}: expected one explicit primary action`);
    if (!(await primaryAction.getAttribute("aria-label"))?.includes("azione principale")) {
      throw new Error(`${fixture.class}: primary action lacks explicit accessible primary semantics`);
    }
    for (let index = 0; index < await actions.count(); index += 1) {
      const action = actions.nth(index);
      if (await action.getAttribute("type") !== "button") throw new Error(`${fixture.class}: result action is not a keyboard button`);
      const name = await action.getAttribute("aria-label");
      if (name === null || name.trim() === "") throw new Error(`${fixture.class}: result action lacks accessible name`);
    }
  }

  const textPreview = page.locator('[data-result-class="text-code"] [data-result-slot="selectable-output"] pre');
  await textPreview.focus();
  if (!(await textPreview.evaluate((node) => node === document.activeElement))) throw new Error("text-code: selectable preview is not keyboard focusable");

  const tablePreview = page.locator('[data-result-class="table"] [data-result-slot="table-preview"] [role="region"]');
  await tablePreview.focus();
  if (!(await tablePreview.evaluate((node) => node === document.activeElement))) throw new Error("table: preview region is not keyboard focusable");

  const pdfPage = page.locator('[data-result-class="pdf"] [data-page-preview-control]');
  await pdfPage.focus();
  if (!(await pdfPage.evaluate((node) => node === document.activeElement))) throw new Error("pdf: page preview control is not keyboard focusable");

  const imageAlt = await page.locator('[data-result-class="image"] img').getAttribute("alt");
  if (imageAlt === null || imageAlt.trim() === "") throw new Error("image: visual preview lacks alternative text");

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflow) throw new Error("Result v2 semantic fixtures overflow horizontally at 390px.");

  console.log(`result v2 semantic browser acceptance PASS: ${RESULT_V2_SEMANTIC_FIXTURES.length} classes, keyboard previews/actions, concise announcements, 390px`);
} finally {
  await browser.close();
}
