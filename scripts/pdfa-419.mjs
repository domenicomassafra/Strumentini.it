/**
 * STR-419: deliberately narrow, opt-in PDF/A-2b CLI exporter.
 * PDFKit (MIT) produces a candidate; independent veraPDF decides the label.
 * No PDF/A file is released if the validator is unavailable or rejects it.
 */
import { PDFDocument } from "pdfkit";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdtemp, rm, chmod } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PDF_A_PROFILE_419 = "PDF/A-2b";
export const VERAPDF_IMAGE_419 = "verapdf/cli@sha256:d565095c67a083e693aebf7d1a15784007370571053fc1aa5b502665b9a78f9c";

// The bundled OFL font is deliberately subset to these code points (16,032 bytes).
// Refuse missing glyphs rather than silently replacing characters in an archive.
const FONT_CHARS_419 = /^[\t\n\r\x20-\x7e\xa0\xa3\xa7\xab\xb0\xbb\xc0\xc8-\xc9\xcc\xd2\xd9\xe0\xe8-\xe9\xec\xf2\xf9\u2013-\u2014\u2018-\u201d\u2026\u20ac]+$/u;

/** Controlled input: plain UTF-8 text and a locally licensed, embedded font. */
export async function makePdfaCandidate419(source, fontBytes, options = {}) {
  if (typeof source !== "string" || !source.trim() ||
      Buffer.byteLength(source, "utf8") > 128 * 1024 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(source)) {
    throw new Error("REFUSED_SOURCE: testo vuoto, troppo lungo o contenente controlli");
  }
  if (!FONT_CHARS_419.test(source)) {
    throw new Error("REFUSED_GLYPH: caratteri assenti dal font incorporato");
  }
  if (!(fontBytes instanceof Uint8Array) || fontBytes.byteLength < 1000) {
    throw new Error("REFUSED_FONT: font incorporabile richiesto");
  }
  const doc = new PDFDocument({
    pdfVersion: "1.7", subset: "PDF/A-2b", font: null,
    autoFirstPage: false, compress: true,
    info: { Title: options.title ?? "Documento archiviabile", Creator: "Strumentini STR-419" },
  });
  const chunks = [];
  const finished = new Promise((resolveDone, reject) => {
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolveDone(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  doc.addPage({ size: "A4", margin: 44 });
  // PDF/A disallows AFM-only fonts: every actual text character uses the embedded face.
  doc.font(Buffer.from(fontBytes)).fontSize(10);
  doc.text(source, { width: 505, lineGap: 2 });
  doc.end();
  return await finished;
}

/** Never accept XML content without exactly one successful independent report. */
export async function validatePdfaCandidate419(bytes, options = {}) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 100 || bytes.length > 20 * 1024 * 1024) {
    return { status: "REFUSED", reason: "PDF_BYTES_INVALID" };
  }
  const directory = await mkdtemp(join(tmpdir(), "str-419-"));
  await chmod(directory, 0o755);
  try {
    await writeFile(join(directory, "candidate.pdf"), bytes);
    const processResult = spawnSync(options.validator ?? "docker", [
      "run", "--rm", "--network", "none", "--memory", "2g",
      "-v", directory + ":/data:ro",
      options.image ?? VERAPDF_IMAGE_419,
      "--flavour", "2b", "--format", "xml", "/data/candidate.pdf",
    ], { encoding: "utf8", timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
    if (processResult.error) {
      return { status: "NOT_RUN", reason: "VALIDATOR_UNAVAILABLE", detail: String(processResult.error?.code ?? processResult.status) };
    }
    const report = processResult.stdout;
    const found = report.match(/<validationReport\b[^>]*>/gu) ?? [];
    const summary = report.match(/<batchSummary\b[^>]*>/u)?.[0] ?? "";
    const validatedSummary = report.match(/<validationReports\b[^>]*>/u)?.[0] ?? "";
    const compliant = found.length === 1 &&
      /profileName="PDF\/A-2b validation profile"/u.test(found[0]) &&
      /isCompliant="true"/u.test(found[0]) &&
      /totalJobs="1"/u.test(summary) &&
      /failedToParse="0"/u.test(summary) &&
      /encrypted="0"/u.test(summary) &&
      /outOfMemory="0"/u.test(summary) &&
      /veraExceptions="0"/u.test(summary) &&
      /compliant="1"/u.test(validatedSummary) &&
      /nonCompliant="0"/u.test(validatedSummary) &&
      /failedJobs="0"/u.test(validatedSummary);
    if (!found.length || !/totalJobs="1"/u.test(summary)) {
      return { status: "NOT_RUN", reason: "INVALID_VALIDATOR_REPORT" };
    }
    // veraPDF can return a nonzero process code for a correctly completed failing
    // conformance check. The report controls REFUSED versus validator NOT_RUN.
    if (processResult.status !== 0 && compliant) {
      return { status: "NOT_RUN", reason: "VALIDATOR_EXIT_INCONSISTENT" };
    }
    return {
      status: compliant ? "VALIDATED_PDFA_2B" : "REFUSED",
      reason: compliant ? "INDEPENDENT_VERAPDF_PASS" : "INDEPENDENT_VERAPDF_FAIL",
      sha256: createHash("sha256").update(bytes).digest("hex"),
      profile: PDF_A_PROFILE_419,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

/** Save only the exact bytes which veraPDF approved. No output on failure. */
export async function exportValidatedPdfa419(source, fontBytes, outputPath, options = {}) {
  const candidate = await makePdfaCandidate419(source, fontBytes);
  const decision = await validatePdfaCandidate419(candidate, options);
  if (decision.status === "VALIDATED_PDFA_2B") {
    await writeFile(outputPath, candidate, { flag: "wx" });
  }
  return decision;
}

async function main() {
  if (process.argv.length !== 4) {
    process.stderr.write("Usage: node scripts/pdfa-419.mjs input.txt output.pdf\n");
    process.exitCode = 2;
    return;
  }
  const input = resolve(process.argv[2]);
  const output = resolve(process.argv[3]);
  try {
    const fontPath = fileURLToPath(new URL("../src/engines/pdf/assets/noto-sans-latin-400-regular.ttf", import.meta.url));
    const [text, font] = await Promise.all([readFile(input, "utf8"), readFile(fontPath)]);
    const result = await exportValidatedPdfa419(text, font, output);
    process.stdout.write(JSON.stringify(result) + "\n");
    if (result.status !== "VALIDATED_PDFA_2B") process.exitCode = 1;
  } catch (error) {
    process.stderr.write("REFUSED: " + String(error?.message ?? error) + "\n");
    process.exitCode = 1;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
