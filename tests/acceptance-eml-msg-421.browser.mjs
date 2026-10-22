import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = 18421;
const origin = "http://127.0.0.1:" + port;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/google-chrome" });
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.on("pageerror", error => console.error("PAGEERROR", error.message));
page.on("console", message => { if (message.type() === "error") console.error("CONSOLE", message.text()); });
const requests = [];
page.on("request", request => {
  if (!request.url().startsWith(origin) && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) requests.push(request.url());
});
try {
  let response;
  for (let n = 0; n < 20; n++) {
    try { response = await page.goto(origin + "/tools/eml-msg-viewer/", { waitUntil: "domcontentloaded" }); break; }
    catch { await new Promise(resolveSleep => setTimeout(resolveSleep, 250)); }
  }
  assert.equal(response?.status(), 200, "static compiled page returned HTTP 200");
  await page.getByRole("button", { name: "Apri email" }).waitFor();
  const { vectors } = JSON.parse(await readFile(resolve(root, "quality/fixtures/email-mime-msg-421/vectors.json"), "utf8"));
  const nested = Buffer.from(vectors[0].eml);
  await page.getByLabel("File EML o MSG").setInputFiles({ name: "nested.eml", mimeType: "message/rfc822", buffer: nested });
  await page.getByRole("button", { name: "Apri email" }).click();
  try { await page.locator("[data-email-preview]").waitFor({ timeout: 15_000 }); } catch (error) { console.error("UI AFTER SUBMIT", (await page.locator("body").innerText()).slice(-2500)); throw error; }
  assert.match(await page.locator("[data-email-preview]").innerText(), /Sicurezza MIME/);
  assert.match(await page.locator("[data-email-body]").innerText(), /Buongiorno dal corpo interno/);
  assert.match(await page.locator("[data-email-preview]").innerText(), /Non esportabile/);
  assert.equal(await page.locator("[data-email-preview] script").count(), 0);
  assert.equal(await page.locator("[data-email-preview] img").count(), 0);

  const original = page.waitForEvent("download");
  await page.getByRole("button", { name: "Scarica sorgente inattivo" }).click();
  const sourceDownload = await original;
  assert.equal(sourceDownload.suggestedFilename(), "email-originale.eml.download");
  const copied = await readFile(await sourceDownload.path());
  assert.deepEqual(copied, nested, "download preserves exact raw source bytes");
  await page.getByLabel("File EML o MSG").setInputFiles({ name: "reopen.eml", mimeType: "message/rfc822", buffer: copied });
  await page.getByRole("button", { name: "Apri email" }).click();
  await page.locator("[data-email-preview]").waitFor();
  assert.match(await page.locator("[data-email-preview]").innerText(), /Sicurezza MIME/);

  const benign = Buffer.from("From: test@example.test\r\nSubject: Attachment\r\nContent-Type: multipart/mixed; boundary=one\r\n\r\n--one\r\nContent-Type: text/plain\r\n\r\nhello\r\n--one\r\nContent-Type: text/plain\r\nContent-Disposition: attachment; filename=\"note.txt\"\r\nContent-Transfer-Encoding: base64\r\n\r\nY2lhbw==\r\n--one--\r\n");
  await page.getByLabel("File EML o MSG").setInputFiles({ name: "benign.eml", mimeType: "message/rfc822", buffer: benign });
  await page.getByRole("button", { name: "Apri email" }).click();
  await page.locator("[data-email-preview]").waitFor();
  const downloadWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "Scarica come file inattivo" }).click();
  const download = await downloadWait;
  assert.equal(download.suggestedFilename(), "note.txt.download");
  assert.deepEqual(await readFile(await download.path()), Buffer.from("ciao"));

  await page.getByLabel("File EML o MSG").setInputFiles(resolve(root, "tests/fixtures/eml-msg-421/attachments.msg"));
  await page.getByRole("button", { name: "Apri email" }).click();
  await page.locator("[data-email-preview]").waitFor();
  assert.match(await page.locator("[data-email-preview]").innerText(), /attachmentFiles/);
  assert.equal(await page.getByRole("button", { name: "Scarica come file inattivo" }).count(), 3);
  const msgDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Scarica come file inattivo" }).first().click();
  const msgAttachment = await msgDownload;
  assert.equal(msgAttachment.suggestedFilename(), "jpg.jpg.download");
  assert((await readFile(await msgAttachment.path())).length > 0);

  await page.getByLabel("File EML o MSG").setInputFiles({ name: "corrupt.msg", mimeType: "application/octet-stream", buffer: Buffer.from("INVALID") });
  await page.getByRole("button", { name: "Apri email" }).click();
  await page.getByText(/EMAIL_MSG_MALFORMED/u).waitFor();
  assert.equal(await page.locator("[data-email-preview]").count(), 0, "stale successful result cleared");
  assert.deepEqual(requests, [], "no external URLs requested by tracker/script or UI");

  console.log("PASS STR-421 built page: HTTP 200, nested MIME, inert HTML, blocked dangerous attachment, raw EML byte-for-byte download and reopen, benign attachment bytes, real MSG attachment download, corrupt MSG recovery, zero external requests.");
} finally {
  await context.close();
  await browser.close();
  server.kill();
}
