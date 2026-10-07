import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import render from "preact-render-to-string";
import {
  CalculatorResultV2Exemplar,
  TransformResultV2Exemplar,
  ValidatorResultV2Exemplar,
} from "../src/components/tools/shared/ResultV2Exemplars";

const css = [
  await readFile(new URL("../src/styles/global.css", import.meta.url), "utf8"),
  await readFile(new URL("../src/components/tools/tool-surface.css", import.meta.url), "utf8"),
].join("\n");

const body = [
  render(CalculatorResultV2Exemplar()),
  render(ValidatorResultV2Exemplar()),
  render(TransformResultV2Exemplar()),
].join("\n");

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const reorderCss = ".result-exemplar .actions{display:flex;flex-wrap:wrap}.result-exemplar [data-primary-action=\"true\"]{order:99}";
  await page.setContent("<!doctype html><html lang=\"it\"><head><meta charset=\"utf-8\"><style>" + css + "</style><style>" + reorderCss + "</style></head><body><main>" + body + "</main></body></html>");

  for (const kind of ["calculator", "validator", "transform"]) {
    const exemplar = page.locator("[data-exemplar=\"" + kind + "\"]");
    const primaryAnswer = exemplar.locator("[data-result-primary-answer]");
    if (await primaryAnswer.count() !== 1) throw new Error(kind + ": expected one semantic primary answer");
    const explanationFirst = await exemplar.locator(".result-explanation > :first-child").evaluate((node) => node.hasAttribute("data-result-primary-answer"));
    if (!explanationFirst) throw new Error(kind + ": primary answer is not first in semantic reading order");

    const primaryAction = exemplar.locator("[data-primary-action=\"true\"]");
    if (await primaryAction.count() !== 1) throw new Error(kind + ": expected exactly one primary action");
    const accessibleName = await primaryAction.getAttribute("aria-label");
    if (!accessibleName?.includes("azione principale")) throw new Error(kind + ": primary action lacks stable accessible semantics");
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflow) throw new Error("Result v2 exemplars overflow horizontally at 390px.");

  for (const kind of ["calculator", "validator", "transform"]) {
    const primaryAction = page.locator("[data-exemplar=\"" + kind + "\"] [data-primary-action=\"true\"]");
    const accessibleName = await primaryAction.getAttribute("aria-label");
    if (!accessibleName?.includes("azione principale")) {
      throw new Error(kind + ": wrapping/reordering changed primary-action semantics");
    }
  }
  console.log("result v2 exemplar acceptance PASS: answer-first + explicit primary action + 390px wrapping");
} finally {
  await browser.close();
}
