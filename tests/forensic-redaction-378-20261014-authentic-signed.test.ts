/** #378: a cryptographically genuine signed PDF must be refused before rasterization.
 * Test-only key/certificate and PDF are ephemeral; neither is shipped or uploaded.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assertSupportedSource237, redactPdfRaster237 } from "../src/engines/pdf/secure-raster-redaction-237";

function run(exe: string, args: string[], cwd: string): Buffer {
  const result = spawnSync(exe, args, { cwd, encoding: "buffer", timeout: 15_000 });
  expect(result.error, `${exe} executable must exist for genuine signature evidence`).toBeUndefined();
  expect(result.status, `${exe}: ${String(result.stderr).slice(-320)}`).toBe(0);
  return result.stdout;
}

function unsignedPdf(): Buffer {
  const zeros = "0".repeat(20_000);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R /AcroForm 6 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 180 140] /Resources << >> /Contents 4 0 R /Annots [7 0 R] >>",
    "<< /Length 4 >>\nstream\nq Q\nendstream",
    `<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached /ByteRange [0000000000 0000000000 0000000000 0000000000] /Contents <${zeros}> >>`,
    "<< /SigFlags 3 /Fields [7 0 R] >>",
    "<< /Type /Annot /Subtype /Widget /FT /Sig /T (Synthetic Signature) /V 5 0 R /Rect [0 0 0 0] /P 3 0 R /F 4 >>",
  ];
  const offsets = [0];
  const pieces = [Buffer.from("%PDF-1.7\n")];
  let length = pieces[0]!.length;
  for (const [index, body] of objects.entries()) {
    offsets.push(length);
    const bytes = Buffer.from(`${index + 1} 0 obj\n${body}\nendobj\n`);
    pieces.push(bytes);
    length += bytes.length;
  }
  const xref = `xref\n0 ${offsets.length}\n0000000000 65535 f \n`
    + offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")
    + `trailer\n<< /Root 1 0 R /Size ${offsets.length} >>\nstartxref\n${length}\n%%EOF\n`;
  return Buffer.concat([...pieces, Buffer.from(xref)]);
}

function signRealPdf(dir: string): { pdf: Buffer; detachedContent: Buffer; signature: Buffer } {
  const pdf = unsignedPdf();
  const contentStart = pdf.indexOf("/Contents <") + "/Contents ".length;
  const contentEnd = contentStart + 20_002;
  expect(pdf.subarray(contentStart, contentStart + 1).toString()).toBe("<");
  expect(pdf.subarray(contentEnd - 1, contentEnd).toString()).toBe(">");
  const range = [0, contentStart, contentEnd, pdf.length - contentEnd];
  const rangeValue = range.map((n) => String(n).padStart(10, "0")).join(" ");
  const index = pdf.indexOf("/ByteRange [") + "/ByteRange [".length;
  expect(pdf.subarray(index, index + rangeValue.length).toString()).toBe("0000000000 0000000000 0000000000 0000000000");
  pdf.write(rangeValue, index, "ascii");
  const signed = Buffer.concat([pdf.subarray(0, contentStart), pdf.subarray(contentEnd)]);
  writeFileSync(join(dir, "covered.bin"), signed);
  run("openssl", ["req", "-new", "-newkey", "rsa:2048", "-x509", "-sha256", "-nodes", "-days", "1",
    "-subj", "/CN=Synthetic-Redaction-Test-Only", "-keyout", "key.pem", "-out", "cert.pem"], dir);
  run("openssl", ["cms", "-sign", "-binary", "-in", "covered.bin", "-signer", "cert.pem",
    "-inkey", "key.pem", "-outform", "DER", "-out", "signature.der", "-nosmimecap", "-md", "sha256"], dir);
  const signature = readFileSync(join(dir, "signature.der"));
  expect(signature.length).toBeGreaterThan(200);
  expect(signature.length * 2).toBeLessThanOrEqual(20_000);
  pdf.write(signature.toString("hex"), contentStart + 1, "ascii");
  writeFileSync(join(dir, "signed.pdf"), pdf);
  return { pdf, detachedContent: signed, signature };
}

describe("#378 independently authenticated signed-source refusal", () => {
  it("verifies the CMS/ByteRange signature and rejects the genuine signed PDF before rendering", async () => {
    const dir = mkdtempSync(join(tmpdir(), "strum378-signed-"));
    try {
      const { pdf, detachedContent } = signRealPdf(dir);
      const python = `import sys\nfrom pypdf import PdfReader\nr=PdfReader(sys.argv[1],strict=True)\nassert len(r.pages)==1\nsig=r.trailer['/Root']['/AcroForm']['/Fields'][0].get_object()['/V'].get_object()\na,b,c,d=list(sig['/ByteRange'])\nraw=open(sys.argv[1],'rb').read()\nassert (a,b,c,d)==(0,b,c,len(raw)-c)\nassert raw[b:b+1]==b'<' and raw[c-1:c]==b'>'\nassert raw[:b]+raw[c:]==open(sys.argv[2],'rb').read()\n`;
      run("python3", ["-c", python, join(dir, "signed.pdf"), join(dir, "covered.bin")], dir);
      run("openssl", ["cms", "-verify", "-binary", "-inform", "DER", "-in", "signature.der",
        "-content", "covered.bin", "-noverify", "-out", "verified.bin"], dir);
      expect(readFileSync(join(dir, "verified.bin"))).toEqual(detachedContent);
      // Independent negative control: modifying a byte in the signed range invalidates the CMS.
      const changed = Buffer.from(detachedContent);
      const changedAt = changed.indexOf("/Type /Catalog") + 6;
      expect(changedAt).toBeGreaterThan(5);
      changed[changedAt] = (changed[changedAt] ?? 0) ^ 1;
      writeFileSync(join(dir, "tampered.bin"), changed);
      const tampered = spawnSync("openssl", ["cms", "-verify", "-binary", "-inform", "DER",
        "-in", "signature.der", "-content", "tampered.bin", "-noverify"],
      { cwd: dir, encoding: "buffer", timeout: 15_000 });
      expect(tampered.status).not.toBe(0);
      expect(() => assertSupportedSource237(new Uint8Array(pdf))).toThrow(/^REDACTION_REFUSED:/u);
      const file = new File([new Uint8Array(pdf)], "genuinely-signed.pdf", { type: "application/pdf" });
      await expect(redactPdfRaster237(file, [{ page: 1, left: 0, top: 0, width: 1, height: 0.5 }]))
        .rejects.toThrow(/^REDACTION_REFUSED:/u);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);
});
