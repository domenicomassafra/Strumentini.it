/**
 * #171: independent Poppler parser/readback evidence for a real corrected PDF.
 * Invoked with Node26: npx tsx scripts/acceptance-pdf-repair-418.ts.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { repairPdf418 } from "../src/engines/pdf/repair-418";

const folder = mkdtempSync(join(tmpdir(), "strumentini-418-"));
try {
  const pdf = await PDFDocument.create();
  for (const text of ["STR418_FIRST_PAGE", "STR418_SECOND_PAGE"]) {
    pdf.addPage([320, 280]).drawText(text, {
      x: 20, y: 120, font: await pdf.embedFont(StandardFonts.Helvetica),
    });
  }
  const source = await pdf.save({ useObjectStreams: false });
  const str = Buffer.from(source).toString("latin1");
  const match = /startxref\s+\d+\s+%%EOF/u.exec(str);
  assert(match);
  const marker = Buffer.from("startxref\n9999999\n%%EOF", "ascii");
  const damaged = new Uint8Array(source.length - match[0].length + marker.length);
  damaged.set(source.subarray(0, match.index));
  damaged.set(marker, match.index);
  damaged.set(source.subarray(match.index + match[0].length), match.index + marker.length);
  const previous = damaged.slice();
  const repaired = await repairPdf418(damaged);
  assert.deepEqual(damaged, previous);
  assert.equal(repaired.pageCount, 2);
  assert.deepEqual(repaired.losses, []);
  const before = join(folder, "corrupted.pdf");
  const after = join(folder, "repaired.pdf");
  writeFileSync(before, damaged);
  writeFileSync(after, repaired.bytes);
  const readText = (file: string) =>
    execFileSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8", timeout: 15_000 });
  const info = execFileSync("pdfinfo", [after], { encoding: "utf8", timeout: 15_000 });
  assert.match(info, /^Pages:\s+2$/mu);
  const beforeText = readText(before);
  const afterText = readText(after);
  // Independent parsers may tolerate a lying /Size. The repair preflight
  // must still reject the extra corruption rather than exporting it.
  const hostile = Buffer.from(Buffer.from(damaged).toString("latin1").replace(
    /\/Size\s+(\d+)\b/u,
    (_literal, digits: string) => "/Size " + "0".repeat(digits.length),
  ), "latin1");
  assert.notDeepEqual(hostile, Buffer.from(damaged));
  const hostilePath = join(folder, "hostile-size.pdf");
  writeFileSync(hostilePath, hostile);
  let popplerReadHostile = false;
  try {
    execFileSync("pdfinfo", [hostilePath], { timeout: 10_000, stdio: "pipe" });
    popplerReadHostile = true;
  } catch {
    // A strict independent parser is also permitted to reject malformed input.
  }
  await assert.rejects(repairPdf418(hostile), { code: "REFUSED" });
  assert.equal(afterText, beforeText);
  assert.match(afterText, /STR418_FIRST_PAGE/u);
  assert.match(afterText, /STR418_SECOND_PAGE/u);
  const parsed = await PDFDocument.load(readFileSync(after));
  assert.equal(parsed.getPageCount(), 2);
  console.log(JSON.stringify({
    result: "PASS", profile: repaired.profile, pages: 2,
    originalBytesUnchanged: true, populatedTexts: 2,
    popplerPdfinfo: "PASS", popplerPdftotext: "PASS",
    pdfLibIndependentOpen: "PASS", hostileWrongTrailerSizeRefused: true,
    popplerReadHostile, sourceBytes: source.byteLength,
    repairedBytes: repaired.bytes.byteLength,
  }));
} finally {
  rmSync(folder, { recursive: true, force: true });
}
