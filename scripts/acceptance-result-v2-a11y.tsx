import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import render from "preact-render-to-string";
import { RESULT_V2_SEMANTIC_FIXTURES } from "../quality/fixtures/result-v2-semantic-classes/fixtures";

const root = resolve(import.meta.dirname, "..");
const receiptPath = resolve(root, "quality/receipts/result-v2/accessibility.json");
const css = [
  await readFile(resolve(root, "src/styles/global.css"), "utf8"),
  await readFile(resolve(root, "src/components/tools/tool-surface.css"), "utf8"),
].join("\n");
const body = RESULT_V2_SEMANTIC_FIXTURES
  .map((fixture) => render(fixture.render() as Parameters<typeof render>[0]))
  .join("\n");

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 780, height: 900 } });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setContent(
    '<!doctype html><html lang="it"><head><meta charset="utf-8"><style>'
      + css
      + "</style></head><body><main>"
      + body
      + "</main></body></html>",
  );

  const evidence: Array<Record<string, string | number | boolean>> = [];
  for (const fixture of RESULT_V2_SEMANTIC_FIXTURES) {
    const scope = page.locator('[data-result-class="' + fixture.class + '"]');
    const panel = scope.locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' result-panel ')][1]");
    const actions = scope.locator("[data-result-action]");
    const actionCount = await actions.count();
    if (actionCount < 1) throw new Error(fixture.class + ": no keyboard result actions");
    for (let index = 0; index < actionCount; index += 1) {
      const action = actions.nth(index);
      await action.focus();
      if (!(await action.evaluate((node) => node === document.activeElement && node instanceof HTMLElement && node.tabIndex >= 0))) {
        throw new Error(fixture.class + ": result action " + String(index + 1) + " cannot receive keyboard focus");
      }
    }
    const stateCue = panel.locator("[data-result-state]");
    if (await stateCue.count() !== 1) throw new Error(fixture.class + ": missing visible state cue");
    if (!(await stateCue.innerText()).includes("Stato:")) {
      throw new Error(fixture.class + ": visible state cue lacks text");
    }
    if (await stateCue.locator("[data-mark]").count() !== 1) {
      throw new Error(fixture.class + ": visible state cue relies on colour");
    }
    const primary = scope.locator('[data-primary-action="true"]');
    if (await primary.count() !== 1) throw new Error(fixture.class + ": missing explicit primary action");
    const ariaSnapshot = await scope.ariaSnapshot();
    if (!ariaSnapshot.includes("button")) throw new Error(fixture.class + ": accessibility tree lacks result actions");
    evidence.push({
      class: fixture.class,
      actionCount,
      keyboardActionCount: actionCount,
      primaryNamed: (await primary.getAttribute("aria-label"))?.includes("azione principale") === true,
      nonColorCue: true,
      ariaSnapshotObserved: true,
    });
  }

  const retry = page.locator('[data-result-action="retry"]').first();
  if (await retry.count() !== 1) throw new Error("No representative retry action in Result v2 fixtures");
  await retry.focus();
  if (!(await retry.evaluate((node) => node === document.activeElement))) {
    throw new Error("Retry action does not receive deterministic keyboard focus");
  }

  const directManipulationControls = page.locator("[data-page-preview-control]");
  if (await directManipulationControls.count() < 1) throw new Error("No direct-manipulation alternative in Result v2 fixtures");
  for (let index = 0; index < await directManipulationControls.count(); index += 1) {
    const control = directManipulationControls.nth(index);
    await control.focus();
    if (!(await control.evaluate((node) => node === document.activeElement && node instanceof HTMLElement && node.tabIndex >= 0))) {
      throw new Error("Direct-manipulation alternative cannot receive keyboard focus");
    }
  }

  const focusablePreviews = page.locator('.bounded-result-preview [tabindex="0"]');
  if (await focusablePreviews.count() < 2) throw new Error("Expected text and table keyboard preview alternatives");
  for (let index = 0; index < await focusablePreviews.count(); index += 1) {
    const preview = focusablePreviews.nth(index);
    await preview.focus();
    if (!(await preview.evaluate((node) => node === document.activeElement))) {
      throw new Error("Bounded result preview cannot receive keyboard focus");
    }
  }

  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  const zoom200Widths = [390, 320];
  for (const cssWidth of zoom200Widths) {
    await page.setViewportSize({ width: cssWidth * 2, height: 900 });
    const overflowAt200 = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    if (overflowAt200) throw new Error("Result v2 fixtures overflow at 200% zoom equivalent width " + String(cssWidth));
    const longLabel = page.getByText("Dimensione del risultato completo verificato localmente", { exact: true });
    if (await longLabel.count() !== 1) throw new Error("Missing long Italian Result v2 label fixture");
    const longLabelWraps = await longLabel.evaluate((node) => {
      const style = getComputedStyle(node);
      return style.whiteSpace !== "nowrap" && node.scrollWidth <= node.clientWidth + 1;
    });
    if (!longLabelWraps) throw new Error("Long Italian Result v2 label does not wrap at " + String(cssWidth) + "px / 200% zoom");
  }

  const reducedMotion = await page.evaluate(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  if (!reducedMotion) throw new Error("Reduced-motion media preference was not active");
  await actionsForReducedMotion(page);

  await mkdir(dirname(receiptPath), { recursive: true });
  await writeFile(receiptPath, JSON.stringify({
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    classes: evidence,
    keyboardRetry: true,
    keyboardDirectManipulationAlternatives: await directManipulationControls.count(),
    keyboardFocusablePreviews: await focusablePreviews.count(),
    nonColorState: true,
    accessibilityTreeObserved: true,
    zoom200Reflow: true,
    zoom200EquivalentWidths: zoom200Widths,
    longItalianLabelWraps: true,
    reducedMotion,
  }, null, 2) + "\n", "utf8");
  console.log("result-v2 accessibility certification PASS:", evidence.length, "classes");
} finally {
  await browser.close();
}

async function actionsForReducedMotion(page: import("@playwright/test").Page): Promise<void> {
  const firstAction = page.locator("[data-result-action]").first();
  await firstAction.focus();
  if (!(await firstAction.evaluate((node) => node === document.activeElement))) {
    throw new Error("Result action stopped being keyboard usable under reduced motion");
  }
}
