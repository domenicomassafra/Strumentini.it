import { chromium } from "@playwright/test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "vite";

const tempRoot = await mkdtemp(join(tmpdir(), "strumentini-result-op-"));
const entry = new URL("./fixtures/result-operation-slow-fixture.tsx", import.meta.url);

try {
  await build({
    logLevel: "error",
    build: {
      outDir: tempRoot,
      emptyOutDir: true,
      lib: {
        entry: entry.pathname,
        name: "ResultOperationAcceptance",
        formats: ["iife"],
        fileName: () => "fixture.js",
      },
      minify: false,
    },
  });
  const script = await readFile(join(tempRoot, "fixture.js"), "utf8");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.setContent("<!doctype html><html lang=\"it\"><body><main id=\"app\"></main></body></html>");
    await page.addScriptTag({ content: script });

    const form = page.locator("[data-fixture-form]");
    const runControl = page.locator("[data-tool-run-control]");
    await runControl.focus();
    await page.evaluate(() => {
      const element = document.querySelector<HTMLFormElement>("[data-fixture-form]");
      if (element === null) throw new Error("Missing fixture form.");
      element.requestSubmit();
      element.requestSubmit();
    });
    await form.locator("[data-tool-run-control]:disabled").waitFor();

    const firstIds = await page.evaluate(() => (
      window as unknown as { __slowFixture: { ids(): number[] } }
    ).__slowFixture.ids());
    if (firstIds.length !== 1) throw new Error("Double submit created competing runs.");
    const firstId = firstIds[0];
    if (firstId === undefined) throw new Error("Missing first controlled run.");
    const firstInput = await page.evaluate((id) => (
      window as unknown as { __slowFixture: { inputFor(value: number): string | null } }
    ).__slowFixture.inputFor(id), firstId);
    if (firstInput !== "dato-preservato") throw new Error("Controlled run captured the wrong input.");

    await page.getByRole("button", { name: "Annulla" }).click();
    await page.locator('[data-fixture-status="cancelled"]').waitFor();
    if (await page.getByLabel("Valore").inputValue() !== "dato-preservato") {
      throw new Error("Cancel cleared valid user input.");
    }
    if (!(await runControl.evaluate((node) => node === document.activeElement))) {
      throw new Error("Cancel did not restore focus to the run/retry control.");
    }

    await page.evaluate((id) => (
      window as unknown as { __slowFixture: { resolve(value: number): void } }
    ).__slowFixture.resolve(id), firstId);
    await page.locator('[data-fixture-status="cancelled"]').waitFor();
    if (await page.locator("[data-fixture-result]").count() !== 0) {
      throw new Error("Late completion after cancel leaked a stale success.");
    }

    await page.getByRole("button", { name: "Riprova" }).click();
    await page.locator('[data-fixture-status="running"]').waitFor();
    const retryIds = await page.evaluate(() => (
      window as unknown as { __slowFixture: { ids(): number[] } }
    ).__slowFixture.ids());
    if (retryIds.length !== 1) throw new Error("Retry did not create exactly one new run.");
    const retryId = retryIds[0];
    if (retryId === undefined) throw new Error("Missing retry run.");
    const retryInput = await page.evaluate((id) => (
      window as unknown as { __slowFixture: { inputFor(value: number): string | null } }
    ).__slowFixture.inputFor(id), retryId);
    if (retryInput !== "dato-preservato") throw new Error("Retry required user input re-entry.");
    await page.evaluate((id) => (
      window as unknown as { __slowFixture: { resolve(value: number): void } }
    ).__slowFixture.resolve(id), retryId);
    await page.locator('[data-fixture-status="success"]').waitFor();
    if ((await page.locator("[data-fixture-result]").innerText()) !== "dato-preservato:" + String(retryId)) {
      throw new Error("Retry success did not come from the current controlled run.");
    }

    await runControl.click();
    await page.locator('[data-fixture-status="running"]').waitFor();
    const errorIds = await page.evaluate(() => (
      window as unknown as { __slowFixture: { ids(): number[] } }
    ).__slowFixture.ids());
    const errorId = errorIds[0];
    if (errorIds.length !== 1 || errorId === undefined) throw new Error("Error fixture run was not isolated.");
    await page.evaluate((id) => (
      window as unknown as { __slowFixture: { fail(value: number): void } }
    ).__slowFixture.fail(id), errorId);
    const inlineError = page.locator("[data-tool-error]");
    await inlineError.waitFor();
    if (!(await inlineError.evaluate((node) => node === document.activeElement))) {
      throw new Error("Error recovery did not focus the inline error.");
    }
    if (await page.getByLabel("Valore").inputValue() !== "dato-preservato") {
      throw new Error("Error recovery cleared valid user input.");
    }

    console.log("result operation acceptance PASS: deterministic double-submit/cancel/stale/retry/error recovery");
  } finally {
    await browser.close();
  }
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
