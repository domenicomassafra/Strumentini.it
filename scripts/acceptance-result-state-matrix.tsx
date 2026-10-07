import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import render from "preact-render-to-string";
import { ToolResultPanel } from "../src/components/tools/shared/ToolResultPanel";
import { RESULT_V2_CLASS_CONTRACTS } from "../src/quality/result-v2-conformance";
import type { ResultClass } from "../src/catalog/manifest";

const root = resolve(import.meta.dirname, "..");
const receiptPath = resolve(root, "quality/receipts/result-v2/browser-state-matrix.json");
const css = [
  await readFile(resolve(root, "src/styles/global.css"), "utf8"),
  await readFile(resolve(root, "src/components/tools/tool-surface.css"), "utf8"),
].join("\n");

const samples = Object.entries(RESULT_V2_CLASS_CONTRACTS).flatMap(([resultClass, contract]) =>
  contract.requiredStates.map((state) => ({
    resultClass: resultClass as ResultClass,
    state,
    html: render(
      <div data-matrix-class={resultClass} data-matrix-state={state}>
        <ToolResultPanel
          eyebrow={"Fixture " + resultClass}
          placeholder="Nessun risultato"
          state={state}
          busy={state === "running"}
        >
          <p data-matrix-payload>Payload campione {resultClass} / {state}</p>
        </ToolResultPanel>
      </div>,
    ),
  })),
);

const consoleErrors: string[] = [];
const pageErrors: string[] = [];
const requests: string[] = [];
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => requests.push(request.url()));

  const body = samples.map((sample) => sample.html).join("\n");
  await page.setContent(
    '<!doctype html><html lang="it"><head><meta charset="utf-8"><style>'
      + css
      + "</style></head><body><main>"
      + body
      + "</main></body></html>",
    { waitUntil: "load" },
  );

  const observed: Array<{
    resultClass: string;
    state: string;
    visibleCue: string;
    polite: string;
    assertive: string;
    width390: boolean;
  }> = [];

  for (const sample of samples) {
    const selector = '[data-matrix-class="' + sample.resultClass + '"][data-matrix-state="' + sample.state + '"]';
    const scope = page.locator(selector);
    if (await scope.count() !== 1) throw new Error(selector + ": missing browser sample");
    const panel = scope.locator(".result-panel");
    if (await panel.getAttribute("data-state") !== sample.state) {
      throw new Error(selector + ": result panel state mismatch");
    }
    if (await panel.getAttribute("aria-live") !== null) {
      throw new Error(selector + ": full payload must not be a live region");
    }
    const visibleCue = (await scope.locator("[data-result-state]").innerText()).trim();
    if (!visibleCue.includes("Stato:")) throw new Error(selector + ": state has no visible text cue");
    if (await scope.locator("[data-result-state] [data-mark]").count() !== 1) {
      throw new Error(selector + ": state has no authored non-colour mark");
    }
    const polite = (await scope.locator('[data-result-announcement="polite"]').innerText()).trim();
    const assertive = (await scope.locator('[data-result-announcement="assertive"]').innerText()).trim();
    if (sample.state === "error" ? assertive === "" : polite === "") {
      throw new Error(selector + ": expected concise live announcement is empty");
    }
    observed.push({
      resultClass: sample.resultClass,
      state: sample.state,
      visibleCue,
      polite,
      assertive,
      width390: false,
    });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  for (const record of observed) {
    const selector = '[data-matrix-class="' + record.resultClass + '"][data-matrix-state="' + record.state + '"]';
    const scope = page.locator(selector);
    const overflow = await scope.evaluate((node) => node.scrollWidth > node.clientWidth + 1);
    if (overflow) throw new Error(selector + ": horizontal overflow at 390px");
    record.width390 = true;
  }

  if (consoleErrors.length > 0) throw new Error("Console errors: " + consoleErrors.join(" | "));
  if (pageErrors.length > 0) throw new Error("Page errors: " + pageErrors.join(" | "));
  if (requests.length > 0) throw new Error("Unexpected browser requests: " + requests.join(", "));

  const receipt = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    viewport: { width: 390, height: 844 },
    classes: Object.keys(RESULT_V2_CLASS_CONTRACTS),
    sampleCount: observed.length,
    consoleErrors,
    pageErrors,
    networkRequests: requests,
    samples: observed,
  };
  await mkdir(dirname(receiptPath), { recursive: true });
  await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + "\n", "utf8");
  console.log("result-state browser matrix PASS:", observed.length, "class/state samples");
} finally {
  await browser.close();
}
