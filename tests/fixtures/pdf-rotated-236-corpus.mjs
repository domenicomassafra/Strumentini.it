/** #236 deterministic fixture, no producer PDF parser or OCR involved.
 * Four PDF pages share a deliberately non-origin CropBox and have 0/90/180/270
 * degree page rotation, a color solid, transparent overlay, a stroke, and a
 * vivid marker OUTSIDE the CropBox that must never appear in output.
 */
import assert from "node:assert/strict";

export const PDF_236_CROP = [20, 30, 200, 130];
export const PDF_236_PAGE_ROTATIONS = [0, 90, 180, 270];
export const PDF_236_CROP_GEOMETRY = [180, 100];

export function makeRotatedCropPdf236() {
  const objects = new Map();
  const add = (id, source) => {
    assert(!objects.has(id));
    objects.set(id, source);
  };
  add(1, "<< /Type /Catalog /Pages 2 0 R >>");
  add(2, "<< /Type /Pages /Count 4 /Kids [3 0 R 4 0 R 5 0 R 6 0 R] >>");
  for (let index = 0; index < 4; index += 1) {
    const pageId = 3 + index;
    const contentsId = 7 + index;
    const ink = ["1 0 0", "0 0.6 0", "0 0.2 1", "0.8 0.2 0.8"][index];
    add(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 240 160] /CropBox [${PDF_236_CROP.join(" ")}] /Rotate ${PDF_236_PAGE_ROTATIONS[index]} /Resources << /ExtGState << /GSa 11 0 R >> >> /Contents ${contentsId} 0 R >>`);
    const program = [
      "q 0 0 0 RG 1 w 22 32 174 94 re S Q",
      `q ${ink} rg 26 36 46 26 re f Q`,
      "q /GSa gs 0 0 1 rg 50 51 55 42 re f Q",
      "q 1 0 1 rg 215 140 18 12 re f Q", // outside CropBox: MUST be clipped
    ].join("\n") + "\n";
    add(contentsId, `<< /Length ${Buffer.byteLength(program)} >>\nstream\n${program}endstream`);
  }
  add(11, "<< /Type /ExtGState /ca 0.40 /CA 0.40 >>");
  let content = "%PDF-1.4\n%236-ROTATED-CROP\n";
  const offsets = [0];
  for (let id = 1; id <= 11; id += 1) {
    offsets[id] = Buffer.byteLength(content);
    content += `${id} 0 obj\n${objects.get(id)}\nendobj\n`;
  }
  const xref = Buffer.byteLength(content);
  content += "xref\n0 12\n0000000000 65535 f \n";
  for (let id = 1; id <= 11; id += 1) content += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  content += `trailer\n<< /Size 12 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(content, "latin1");
}
