import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { gzipSync, zipSync } from "fflate";
import PptxGenJS from "pptxgenjs";
import * as XLSX from "xlsx";
import { PDFDocument, StandardFonts, rgb } from "@cantoo/pdf-lib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const corpusDir = path.join(root, "public/corpus");
const tesseractDir = path.join(root, "public/tesseract");
const coreDir = path.join(tesseractDir, "core");
const langDir = path.join(tesseractDir, "lang");
const execFileAsync = promisify(execFile);

await Promise.all([mkdir(corpusDir, { recursive: true }), mkdir(coreDir, { recursive: true }), mkdir(langDir, { recursive: true })]);

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

if (!await exists(path.join(corpusDir, "sample.xlsx"))) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Voce", "Quantita", "Prezzo"],
    ["Consulenza", 2, 125.5],
    ["Licenza", 1, 49.9],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Fattura");
  XLSX.writeFile(workbook, path.join(corpusDir, "sample.xlsx"), { compression: true });
}

if (!await exists(path.join(corpusDir, "sample.docx"))) {
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ children: [new TextRun({ text: "Fattura di prova", bold: true })] }),
        new Paragraph("Cliente: Mario Rossi"),
        new Paragraph("Totale: 299,90 EUR"),
      ],
    }],
  });
  await writeFile(path.join(corpusDir, "sample.docx"), await Packer.toBuffer(doc));
}

if (!await exists(path.join(corpusDir, "sample.pptx"))) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  const slide = pptx.addSlide();
  slide.addText("Presentazione di prova", { x: 0.8, y: 0.8, w: 6.5, h: 0.6, fontSize: 28, bold: true });
  slide.addText("Valore verificabile: 12345", { x: 0.8, y: 1.7, w: 6.5, h: 0.5, fontSize: 18 });
  await pptx.writeFile({ fileName: path.join(corpusDir, "sample.pptx") });
}

if (!await exists(path.join(corpusDir, "sample.pdf"))) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < 3; index += 1) {
    const page = pdf.addPage([480, 320]);
    page.drawText(`Pagina ${index + 1} - ricevuta feasibility`, { x: 40, y: 250, size: 20, font, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(`Marker PDF-${index + 1}-12345`, { x: 40, y: 210, size: 14, font });
  }
  pdf.setTitle("Heavy local feasibility corpus");
  await writeFile(path.join(corpusDir, "sample.pdf"), await pdf.save());
}

if (!await exists(path.join(corpusDir, "sample-200.pdf"))) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < 200; index += 1) {
    const page = pdf.addPage([480, 320]);
    page.drawText(`Pagina ${index + 1} di 200`, { x: 40, y: 250, size: 18, font });
    page.drawText(`Marker LARGE-PDF-${index + 1}-12345`, { x: 40, y: 210, size: 12, font });
  }
  pdf.setTitle("Heavy local feasibility 200-page corpus");
  await writeFile(path.join(corpusDir, "sample-200.pdf"), await pdf.save());
}

if (!await exists(path.join(corpusDir, "sample.p7m"))) {
  const temporary = await mkdtemp(path.join(tmpdir(), "strumentini-p7m-"));
  try {
    const payload = path.join(temporary, "payload.txt");
    const key = path.join(temporary, "key.pem");
    const cert = path.join(temporary, "cert.pem");
    await writeFile(payload, "P7M payload locale 12345\n", "utf8");
    await execFileAsync("openssl", [
      "req", "-x509", "-newkey", "rsa:2048", "-keyout", key, "-out", cert, "-nodes",
      "-subj", "/CN=Strumentini Feasibility/O=Local Test", "-days", "1",
    ]);
    await execFileAsync("openssl", [
      "cms", "-sign", "-binary", "-nodetach", "-in", payload, "-signer", cert, "-inkey", key,
      "-outform", "DER", "-out", path.join(corpusDir, "sample.p7m"),
    ]);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

{
  const validP7m = await readFile(path.join(corpusDir, "sample.p7m"));
  await writeFile(path.join(corpusDir, "sample-corrupt.p7m"), validP7m.subarray(0, Math.max(16, Math.floor(validP7m.byteLength / 2))));
  const unsupportedCmsData = new Uint8Array([
    0x30, 0x1a, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x01,
    0xa0, 0x0d, 0x04, 0x0b, 0x75, 0x6e, 0x73, 0x75, 0x70, 0x70, 0x6f, 0x72, 0x74, 0x65, 0x64,
  ]);
  await writeFile(path.join(corpusDir, "sample-unsupported-cms.der"), unsupportedCmsData);
}

{
  const archivePayload = new TextEncoder().encode("archive payload 12345\n".repeat(4096));
  const zipBytes = zipSync({ "safe/payload.txt": archivePayload }, { level: 6 });
  const gzipBytes = gzipSync(archivePayload, { level: 6 });
  const unsafeZipBytes = zipSync({ "../escape.txt": new TextEncoder().encode("must never be written outside a target root") });
  await Promise.all([
    writeFile(path.join(corpusDir, "sample.zip"), zipBytes),
    writeFile(path.join(corpusDir, "sample.gz"), gzipBytes),
    writeFile(path.join(corpusDir, "sample-unsafe-path.zip"), unsafeZipBytes),
    writeFile(path.join(corpusDir, "sample-corrupt.zip"), zipBytes.subarray(0, Math.max(16, zipBytes.byteLength - 12))),
    writeFile(path.join(corpusDir, "sample-corrupt.gz"), gzipBytes.subarray(0, Math.max(10, gzipBytes.byteLength - 8))),
  ]);
}

if (!await exists(path.join(corpusDir, "sample-animated.gif"))) {
  await execFileAsync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=64x64:rate=4:duration=1",
    "-y", path.join(corpusDir, "sample-animated.gif"),
  ]);
}

if (!await exists(path.join(corpusDir, "sample-10s-720p.mp4"))) {
  await execFileAsync("ffmpeg", [
    "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=10",
    "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=10",
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "32", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-shortest", "-y", path.join(corpusDir, "sample-10s-720p.mp4"),
  ]);
}

{
  const hostileHtml = `<!doctype html><html><body><script>globalThis.__HOSTILE_EXECUTED__=true</script><img src="https://example.invalid/tracker.png"><iframe src="https://example.invalid/frame"></iframe></body></html>`;
  const eml = [
    "From: attacker@example.invalid",
    "To: victim@example.invalid",
    "Subject: hostile feasibility fixture",
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "",
    hostileHtml,
  ].join("\r\n");
  const epub = zipSync({
    mimetype: new TextEncoder().encode("application/epub+zip"),
    "META-INF/container.xml": new TextEncoder().encode(`<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`),
    "OEBPS/package.opf": new TextEncoder().encode(`<?xml version="1.0"?><package><manifest><item id="content" href="content.xhtml" media-type="application/xhtml+xml"/></manifest></package>`),
    "OEBPS/content.xhtml": new TextEncoder().encode(hostileHtml),
  });
  const invalidMsg = new Uint8Array(512);
  invalidMsg.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  await Promise.all([
    writeFile(path.join(corpusDir, "hostile.eml"), eml, "utf8"),
    writeFile(path.join(corpusDir, "hostile.epub"), epub),
    writeFile(path.join(corpusDir, "unsupported.msg"), invalidMsg),
  ]);
}

const tesseractRoot = path.join(root, "node_modules/tesseract.js");
const tesseractCoreRoot = path.join(root, "node_modules/tesseract.js-core");
await copyFile(path.join(tesseractRoot, "dist/worker.min.js"), path.join(tesseractDir, "worker.min.js"));
for (const name of [
  "tesseract-core.wasm.js",
  "tesseract-core.wasm",
  "tesseract-core-lstm.wasm.js",
  "tesseract-core-lstm.wasm",
  "tesseract-core-simd.wasm.js",
  "tesseract-core-simd.wasm",
  "tesseract-core-simd-lstm.wasm.js",
  "tesseract-core-simd-lstm.wasm",
  "tesseract-core-relaxedsimd.wasm.js",
  "tesseract-core-relaxedsimd.wasm",
  "tesseract-core-relaxedsimd-lstm.wasm.js",
  "tesseract-core-relaxedsimd-lstm.wasm",
]) {
  await copyFile(path.join(tesseractCoreRoot, name), path.join(coreDir, name));
}
await copyFile(
  path.join(root, "node_modules/@tesseract.js-data/ita/4.0.0/ita.traineddata.gz"),
  path.join(langDir, "ita.traineddata.gz"),
);

const requiredExternalFixtures = ["heic-source.png", "sample.heic", "ocr-it.png", "sample.wav", "sample.mp4"];
for (const name of requiredExternalFixtures) {
  try {
    await stat(path.join(corpusDir, name));
  } catch {
    throw new Error(`${name} is missing. Preserve the checked-in real-file fixture or regenerate it using the recipes in README.md.`);
  }
}

const files = [
  "heic-source.png",
  "sample.heic",
  "ocr-it.png",
  "sample.wav",
  "sample.mp4",
  "sample.xlsx",
  "sample.docx",
  "sample.pptx",
  "sample.pdf",
  "sample-200.pdf",
  "sample.p7m",
  "sample-corrupt.p7m",
  "sample-unsupported-cms.der",
  "sample.zip",
  "sample.gz",
  "sample-unsafe-path.zip",
  "sample-corrupt.zip",
  "sample-corrupt.gz",
  "sample-animated.gif",
  "sample-10s-720p.mp4",
  "hostile.eml",
  "hostile.epub",
  "unsupported.msg",
];
const provenance = {
  "heic-source.png": "96x64 PNG generated locally with FFmpeg lavfi color source",
  "sample.heic": "Converted from heic-source.png with macOS sips -s format heic",
  "ocr-it.png": "1280x240 PNG rendered locally with Pillow + system Helvetica; contains fixed Italian invoice text",
  "sample.wav": "2-second 48 kHz PCM sine wave generated locally with FFmpeg",
  "sample.mp4": "2-second 320x180 H.264/AAC MP4 generated locally with FFmpeg testsrc2+sine",
  "sample.xlsx": "Generated by this script with xlsx 0.18.5",
  "sample.docx": "Generated by this script with docx 9.8.1",
  "sample.pptx": "Generated by this script with pptxgenjs 4.0.1",
  "sample.pdf": "Generated by this script with @cantoo/pdf-lib 2.11.1",
  "sample-200.pdf": "Generated by this script with @cantoo/pdf-lib 2.11.1; 200 bounded synthetic pages",
  "sample.p7m": "Generated locally by OpenSSL CMS SignedData with an ephemeral self-signed fixture certificate; payload is synthetic",
  "sample-corrupt.p7m": "Deterministic truncation of the local valid CMS/P7M fixture",
  "sample-unsupported-cms.der": "Locally authored CMS ContentInfo with data content type rather than SignedData",
  "sample.zip": "Generated locally with fflate 0.8.3 from a synthetic repeated text payload",
  "sample.gz": "Generated locally with fflate 0.8.3 from the same synthetic repeated text payload",
  "sample-unsafe-path.zip": "Generated locally with fflate 0.8.3 and an intentionally unsafe ../ archive entry name",
  "sample-corrupt.zip": "Deterministic truncation of the local ZIP fixture",
  "sample-corrupt.gz": "Deterministic truncation of the local GZIP fixture",
  "sample-animated.gif": "64x64 1-second animated GIF generated locally with FFmpeg testsrc",
  "sample-10s-720p.mp4": "10-second 1280x720 H.264/AAC MP4 generated locally with FFmpeg testsrc2+sine",
  "hostile.eml": "Synthetic HTML EML containing script, remote image and iframe references for inert-content policy testing",
  "hostile.epub": "Synthetic EPUB ZIP containing XHTML with script and remote references for inert-content policy testing",
  "unsupported.msg": "Synthetic CFB-signature-only MSG-shaped invalid fixture; deliberately not claimed as a valid Outlook MSG",
};

const manifest = [];
for (const name of files) {
  const bytes = await readFile(path.join(corpusDir, name));
  manifest.push({
    name,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    provenance: provenance[name],
  });
}
await writeFile(path.join(corpusDir, "manifest.json"), `${JSON.stringify({ schemaVersion: 1, files: manifest }, null, 2)}\n`);
console.log(JSON.stringify({ corpusDir, files: manifest }, null, 2));
