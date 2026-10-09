import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { assertSupportedSource237 } from "../src/engines/pdf/secure-raster-redaction-237";
import {
  byteRangeSource237, complexRasterSource237, coveredRecoverableSource237,
  decompressionGeometryBomb237, hybridReference237, incrementalRevision237, orphanSignatureSource237,
  ORPHAN_MARKER_237, PRIVATE_MARKER_237,
} from "./fixtures/pdf-redaction-malicious-237";

const root = resolve(import.meta.dirname, "fixtures/pdf-redaction-malicious-237");
const read = (name: string) => new Uint8Array(readFileSync(resolve(root, name)));

const corpus = [
  ["covered-orphan-237.pdf", coveredRecoverableSource237],
  ["complex-smask-form-237.pdf", () => complexRasterSource237()],
  ["complex-rotate-90-237.pdf", () => complexRasterSource237(90)],
  ["complex-rotate-180-237.pdf", () => complexRasterSource237(180)],
  ["complex-rotate-270-237.pdf", () => complexRasterSource237(270)],
  ["incremental-prev-237.pdf", incrementalRevision237],
  ["hybrid-xrefstm-237.pdf", hybridReference237],
  ["fake-signed-byte-range-237.pdf", byteRangeSource237],
  ["orphan-signature-no-acroform-237.pdf", orphanSignatureSource237],
  ["image-geometry-bomb-237.pdf", decompressionGeometryBomb237],
] as const;

describe("#237 independent adversarial PDF corpus: actual xref and fail-closed preflight", () => {
  it("pins real checked-in binary PDF fixtures to deterministic constructors", () => {
    for (const [name, factory] of corpus) expect(read(name), name).toEqual(Uint8Array.from(factory()));
  });

  it.each([
    "incremental-prev-237.pdf", "hybrid-xrefstm-237.pdf", "fake-signed-byte-range-237.pdf", "image-geometry-bomb-237.pdf",
  ])("refuses %s before any browser rendering", (name) => {
    const bytes = read(name);
    expect(() => assertSupportedSource237(bytes)).toThrow(/^REDACTION_REFUSED:/u);
  });

  it.each([
    "covered-orphan-237.pdf", "complex-smask-form-237.pdf",
    "complex-rotate-90-237.pdf", "complex-rotate-180-237.pdf", "complex-rotate-270-237.pdf",
  ])("admits bounded %s to rasterization (not itself proof of redaction)", (name) => {
    expect(assertSupportedSource237(read(name))).toBe(1);
  });

  it("stores actual independent second xref sections with intact /Prev chain and hybrid xref stream bytes", () => {
    for (const [name, marker] of [["incremental-prev-237.pdf", "Prev"], ["hybrid-xrefstm-237.pdf", "XRefStm"]] as const) {
      const data = read(name);
      const raw = Buffer.from(data).toString("latin1");
      expect([...raw.matchAll(/(?:^|\n)xref\n/gu)]).toHaveLength(2);
      const starts = [...raw.matchAll(/startxref\n(\d+)\n%%EOF/gu)];
      expect(starts).toHaveLength(2);
      const previous = Number(starts[0]![1]);
      const current = Number(starts[1]![1]);
      expect(raw.slice(previous, previous + 5)).toBe("xref\n");
      expect(raw.slice(current, current + 5)).toBe("xref\n");
      expect(raw.slice(current)).toContain(`/Prev ${previous}`);
      expect(raw.slice(current)).toContain(`/${marker}`);
      if (name.includes("hybrid")) {
        const offset = /\/XRefStm\s+(\d+)/u.exec(raw);
        expect(offset).not.toBeNull();
        const xrefStream = raw.slice(Number(offset![1]), current);
        expect(xrefStream).toMatch(/\/Type\s*\/XRef/u);
        expect(xrefStream).toContain("/W [1 4 2]");
        expect(xrefStream).toMatch(/^\d+ 0 obj/u);
      }
    }
  });

  it("is independently readable by pypdf, including complete incremental and hybrid revision trails", () => {
    const program = `from pypdf import PdfReader\nimport sys\nfor p in sys.argv[1:]:\n pdf=PdfReader(p,strict=False)\n assert len(pdf.pages)==1,p\n if 'incremental' in p: assert '/Prev' in pdf.trailer\n if 'hybrid' in p: assert '/XRefStm' in pdf.trailer\nprint('pypdf-valid',len(sys.argv)-1)\n`;
    const result = execFileSync("python3", ["-c", program, ...corpus.map(([filename]) => resolve(root, filename))],
      { encoding: "utf8", timeout: 8_000 });
    expect(result).toContain("pypdf-valid 10");
  });

  it.fails("SECURITY GAP: rejects orphan /ByteRange and /DocMDP without AcroForm (prime must fix)", () => {
    expect(() => assertSupportedSource237(read("orphan-signature-no-acroform-237.pdf")))
      .toThrow(/REDACTION_REFUSED/u);
  });

  it("independent pypdf proves the rejected-or-not gap is a real PDF signature structure without a form", () => {
    const program = `from pypdf import PdfReader\nimport sys\nr=PdfReader(sys.argv[1],strict=True)\nroot=r.trailer['/Root']\nassert '/AcroForm' not in root\nsig=root['/Perms']['/DocMDP'].get_object()\nassert sig['/Type']=='/Sig'\nassert len(sig['/ByteRange'])==4\nprint('valid-catalog-protected-signature-shape')`;
    const response = execFileSync("python3", ["-c", program,
      resolve(root, "orphan-signature-no-acroform-237.pdf")], { encoding: "utf8", timeout: 5_000 });
    expect(response).toContain("valid-catalog-protected-signature-shape");
  });

  it("independent PDF.js extracts readable text below opaque cover, and sees real Form+SMask/rotations", async () => {
    const coveredTask = getDocument({ data: read("covered-orphan-237.pdf"), useSystemFonts: true, disableFontFace: true });
    const covered = await coveredTask.promise;
    try {
      const page = await covered.getPage(1);
      const extraction = (await page.getTextContent()).items.map((part) => "str" in part ? part.str : "").join("");
      expect(extraction).toContain(PRIVATE_MARKER_237);
      expect(Buffer.from(read("covered-orphan-237.pdf")).toString("latin1")).toContain(ORPHAN_MARKER_237);
      const ops = await page.getOperatorList();
      expect(ops.fnArray.length).toBeGreaterThan(3);
    } finally { await coveredTask.destroy(); }
    for (const rotation of [0, 90, 180, 270] as const) {
      const name = rotation ? `complex-rotate-${rotation}-237.pdf` : "complex-smask-form-237.pdf";
      const task = getDocument({ data: read(name), useSystemFonts: true, disableFontFace: true });
      const doc = await task.promise;
      try {
        const page = await doc.getPage(1);
        expect(page.rotate).toBe(rotation);
        const ops = await page.getOperatorList();
        expect(ops.fnArray.length).toBeGreaterThan(4);
        const viewport = page.getViewport({ scale: 1 });
        expect([Math.round(viewport.width), Math.round(viewport.height)]).toEqual(rotation % 180 ? [140, 180] : [180, 140]);
      } finally { await task.destroy(); }
    }
  });
});
