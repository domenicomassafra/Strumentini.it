import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { readFile, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import {
  makePdfaCandidate419, validatePdfaCandidate419, exportValidatedPdfa419, PDF_A_PROFILE_419,
} from "../scripts/pdfa-419.mjs";

const fontFile = fileURLToPath(new URL("../src/engines/pdf/assets/noto-sans-latin-400-regular.ttf", import.meta.url));
const getFont = () => readFile(fontFile);
const timeLimit = 120_000;
// CI always provisions the pinned validator in a mandatory preflight. On local
// machines without a running Docker daemon, only independent-verdict tests skip.
const independentValidatorIt = process.env.CI
  ? it
  : it.skipIf(spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"],
      { encoding: "utf8", timeout: 5_000 }).status !== 0);

function replaceSameSize(bytes: Uint8Array, from: string, to: string) {
  expect(from.length).toBe(to.length);
  const changed = Buffer.from(bytes);
  const where = changed.indexOf(from, 0, "latin1");
  expect(where).toBeGreaterThan(0);
  changed.write(to, where, "latin1");
  return changed;
}

async function makeBrokenFontPdf() {
  const doc = new PDFDocument({ pdfVersion: "1.7", subset: "PDF/A-2b" });
  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Uint8Array) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  // Helvetica is AFM-only and cannot be embedded in a PDF/A document.
  doc.text("Invalid font: Helvetica");
  doc.end();
  return await finished;
}

async function makeAttachmentPdf(font: Uint8Array) {
  const doc = new PDFDocument({
    pdfVersion: "1.7", subset: "PDF/A-2b",
  });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Uint8Array) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  doc.font(Buffer.from(font)).text("Attachment forbidden for selected profile");
  doc.file(Buffer.from("non PDF/A file"), { name: "note.txt" });
  doc.end();
  return done;
}

describe("STR-419 PDF/A-2b independent validator decision", () => {
  independentValidatorIt("validates actual PDFKit export with embedded Noto Sans via veraPDF", async () => {
    const bytes = await makePdfaCandidate419("Documento 2026: città, è già così. Costo € 100.", await getFont());
    const outcome = await validatePdfaCandidate419(bytes);
    expect(outcome.status).toBe("VALIDATED_PDFA_2B");
    expect(outcome.profile).toBe(PDF_A_PROFILE_419);
    expect(outcome.sha256).toMatch(/^[a-f0-9]{64}$/u);
  }, timeLimit);

  independentValidatorIt("REFUSED: invalid unembedded font never receives a PDF/A declaration", async () => {
    const outcome = await validatePdfaCandidate419(await makeBrokenFontPdf());
    expect(outcome.status).toBe("REFUSED");
  }, timeLimit);

  independentValidatorIt("REFUSED: missing ICC OutputIntent", async () => {
    const valid = await makePdfaCandidate419("Prova ICC", await getFont());
    const corrupt = replaceSameSize(valid, "/OutputIntents", "/OutputIntentz");
    expect((await validatePdfaCandidate419(corrupt)).status).toBe("REFUSED");
  }, timeLimit);

  independentValidatorIt("REFUSED: XMP with invalid PDF/A part", async () => {
    const valid = await makePdfaCandidate419("Prova XMP", await getFont());
    const corrupt = replaceSameSize(valid, "<pdfaid:part>2</pdfaid:part>", "<pdfaid:part>9</pdfaid:part>");
    expect((await validatePdfaCandidate419(corrupt)).status).toBe("REFUSED");
  }, timeLimit);

  independentValidatorIt("REFUSED: non-PDF/A attachment", async () => {
    const corrupt = await makeAttachmentPdf(await getFont());
    expect((await validatePdfaCandidate419(corrupt)).status).toBe("REFUSED");
  }, timeLimit);

  it("NOT_RUN: independent validator missing must never mean compliant", async () => {
    const valid = await makePdfaCandidate419("Verificatore assente", await getFont());
    const outcome = await validatePdfaCandidate419(valid, { validator: "/nonexistent/verapdf" });
    expect(outcome).toMatchObject({ status: "NOT_RUN", reason: "VALIDATOR_UNAVAILABLE" });
  }, timeLimit);

  it("does not write a PDF/A-labeled artifact when validator is unavailable", async () => {
    const directory = await mkdtemp(join(tmpdir(), "str-419-refuse-"));
    const output = join(directory, "must-not-exist.pdf");
    try {
      const decision = await exportValidatedPdfa419("No validator", await getFont(), output, {
        validator: "/nonexistent/verapdf",
      });
      expect(decision.status).toBe("NOT_RUN");
      await expect(stat(output)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, timeLimit);

  it("refuses unsupported glyphs rather than exporting changed text", async () => {
    await expect(makePdfaCandidate419("testo Ω", await getFont())).rejects.toThrow(/REFUSED_GLYPH/u);
    await expect(makePdfaCandidate419("testo 😀", await getFont())).rejects.toThrow(/REFUSED_GLYPH/u);
  });

  it("rejects invalid input and missing font before creating an archive", async () => {
    await expect(makePdfaCandidate419("", await getFont())).rejects.toThrow(/REFUSED_SOURCE/u);
    await expect(makePdfaCandidate419("non vuoto", new Uint8Array())).rejects.toThrow(/REFUSED_FONT/u);
  });
});
