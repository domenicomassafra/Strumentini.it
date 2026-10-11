import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { assertSupportedSource237, redactPdfRaster237 } from "../src/engines/pdf/secure-raster-redaction-237";
import {
  coveredRecoverableSource237, incrementalRevision237, ORPHAN_MARKER_237, PRIVATE_MARKER_237,
} from "./fixtures/pdf-redaction-malicious-237";

/** Genuine two-revision xref with a later comment containing a decoy trailer. */
function appendDecoyTrailer406(): Uint8Array {
  const input = Buffer.from(incrementalRevision237()).toString("latin1");
  const root = /\/Root\s+(\d+)\s+0\s+R/u.exec(input)?.[1];
  if (!root) throw Error("Synthetic fixture lost its actual root");
  const trailer = "% audit-note trailer << /Size 100 /Root " + root + " 0 R >>\n";
  const altered = input.replace(/(startxref\s+\d+\s+%%EOF\s*)$/u, trailer + "$1");
  if (altered === input) throw Error("Synthetic incremental footer not found");
  return new Uint8Array(Buffer.from(altered, "latin1"));
}

function independentPypdf406(bytes: Uint8Array): {
  readonly pages: number; readonly previousXref: number; readonly privateText: boolean;
  readonly orphan: boolean;
} {
  // No temporary PDF files, no network; pypdf parses actual supplied bytes.
  const py = [
    "from io import BytesIO",
    "from pypdf import PdfReader",
    "import json,sys",
    "raw=sys.stdin.buffer.read()",
    "r=PdfReader(BytesIO(raw),strict=True)",
    "prior=r.trailer.get('/Prev')",
    "assert isinstance(prior,int) and prior>0, 'true earlier xref required'",
    "text=''.join(page.extract_text() or '' for page in r.pages)",
    "print(json.dumps({'pages':len(r.pages),'previousXref':prior,",
    "'privateText':'PRIVATE_237_SOURCE_ONLY_NEVER_OUTPUT_4D792A' in text,",
    "'orphan':b'ORPHAN_237_RECOVERABLE_PRIVATE_7F9D13' in raw}))",
  ].join("\n");
  return JSON.parse(execFileSync("python3", ["-c", py], {
    input: Buffer.from(bytes), timeout: 8_000, encoding: "utf8", maxBuffer: 100_000,
    stdio: ["pipe", "pipe", "pipe"],
  })) as { pages: number; previousXref: number; privateText: boolean; orphan: boolean };
}

describe("#406 independent hostile redaction corpus: real xref vs decoy trailer", () => {
  it("refuses a genuine incremental revision masked by a later comment's decoy source trailer", async () => {
    const source = appendDecoyTrailer406();
    const readable = Buffer.from(source).toString("latin1");
    expect([...readable.matchAll(/(?:^|\n)startxref\s*\n/gu)]).toHaveLength(2);
    expect([...readable.matchAll(/%%EOF/gu)]).toHaveLength(2);
    expect(readable).toContain(PRIVATE_MARKER_237);
    expect(readable).toContain(ORPHAN_MARKER_237);

    // Independent reader confirms real earlier xref and recoverable text.
    const independent = independentPypdf406(source);
    expect(independent.pages).toBe(1);
    expect(independent.previousXref).toBeGreaterThan(0);
    expect(independent.privateText).toBe(true);
    expect(independent.orphan).toBe(true);

    // PDF.js is a second independent reader of those same bytes.
    const loader = getDocument({
      data: source.slice(), useSystemFonts: true, disableFontFace: true,
      disableAutoFetch: true, disableStream: true,
    });
    try {
      const doc = await loader.promise;
      expect(doc.numPages).toBe(1);
      const page = await doc.getPage(1);
      const text = (await page.getTextContent()).items.map((item) => "str" in item ? item.str : "").join("");
      expect(text).toContain(PRIVATE_MARKER_237);
    } finally { await loader.destroy(); }

    // Actual pre-render admission boundary must refuse.
    expect(() => assertSupportedSource237(source)).toThrow(/REDACTION_REFUSED: Revisioni incrementali/u);
    // Exercise the real export entrypoint as well: refuse before PDF.js
    // rendering, no Blob/document artifact and no sensitive-byte publication.
    await expect(redactPdfRaster237(
      new File([new Uint8Array(source)], "signed-looking-incremental.pdf", { type: "application/pdf" }),
      [{ page: 1, left: 0, top: 0, width: 1, height: 1 }],
    )).rejects.toThrow(/REDACTION_REFUSED: Revisioni incrementali/u);
  }, 20_000);

  it("retains the clean source subset while refusing the unmodified real incremental revision", () => {
    expect(assertSupportedSource237(coveredRecoverableSource237())).toBe(1);
    expect(() => assertSupportedSource237(incrementalRevision237()))
      .toThrow(/REDACTION_REFUSED: Revisioni incrementali/u);
  });
});
