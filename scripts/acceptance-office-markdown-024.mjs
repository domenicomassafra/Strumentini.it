import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { unzipSync } from "fflate";

const origin = process.env.STRUMENTINI_ACCEPTANCE_ORIGIN ?? "http://127.0.0.1:18424";
const local = !process.env.STRUMENTINI_ACCEPTANCE_ORIGIN;
const server = local ? spawn("python3", ["-m", "http.server", "18424", "--bind", "127.0.0.1", "--directory", "dist"], { cwd: resolve(import.meta.dirname, ".."), stdio: "ignore" }) : null;

try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    try { if ((await fetch(`${origin}/documenti-markdown/`)).ok) { ready = true; break; } } catch {}
    await new Promise((done) => setTimeout(done, 200));
  }
  if (!ready) throw new Error("Office/Markdown preview unavailable");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    const nonLocalRequests = [];
    page.on("request", (request) => { if (!request.url().startsWith(origin) || request.method() !== "GET") nonLocalRequests.push(`${request.method()} ${request.url()}`); });
    const response = await page.goto(`${origin}/documenti-markdown/`, { waitUntil: "networkidle" });
    if (response?.status() !== 200) throw new Error(`Office page HTTP ${response?.status()}`);
    const source = "# Titolo prova\n\nUn **documento** convertito.\n\n- Prima voce\n- Seconda voce";
    await page.locator("[data-office-source]").setInputFiles({ name: "note.md", mimeType: "text/markdown", buffer: Buffer.from(source) });
    await page.locator("[data-office-submit]").click();
    await page.locator("[data-office-download]").waitFor({ timeout: 20000 });
    const [docxDownload] = await Promise.all([page.waitForEvent("download"), page.locator("[data-office-download]").click()]);
    if (docxDownload.suggestedFilename() !== "note.docx") throw new Error("Wrong DOCX filename");
    const docx = await readFile(await docxDownload.path());
    const members = unzipSync(docx);
    const documentXml = new TextDecoder().decode(members["word/document.xml"] ?? new Uint8Array());
    if (!documentXml.includes("Titolo prova") || !documentXml.includes("Seconda voce")) throw new Error("DOCX lost the document content");
    await page.locator("[data-office-operation]").selectOption("docx-to-markdown");
    await page.locator("[data-office-source]").setInputFiles({ name: "note.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: docx });
    await page.locator("[data-office-submit]").click();
    await page.locator("[data-office-download]").waitFor({ timeout: 20000 });
    const [markdownDownload] = await Promise.all([page.waitForEvent("download"), page.locator("[data-office-download]").click()]);
    if (markdownDownload.suggestedFilename() !== "note.md") throw new Error("Wrong Markdown filename");
    const markdown = await readFile(await markdownDownload.path(), "utf8");
    if (!markdown.includes("# Titolo prova") || !markdown.includes("Seconda voce")) throw new Error("DOCX → Markdown lost headings or text");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (overflow || nonLocalRequests.length > 0) throw new Error(`Mobile overflow ${overflow}; unexpected requests ${nonLocalRequests.join(", ")}`);
    console.log(`STR-024 PASS: ${origin} HTTP 200; Markdown → DOCX ${docx.length} bytes; DOCX → Markdown ${Buffer.byteLength(markdown)} bytes; verified ZIP document.xml, download, 390px, GET-only local assets`);
  } finally { await browser.close(); }
} finally { server?.kill("SIGTERM"); }
