import { X509Certificate } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { extractP7m176, P7M_NOTICE_176 } from "../src/engines/p7m/reader-176";

const corpus = new URL("../quality/fixtures/p7m-cms-176/", import.meta.url);
const load = async (fileName: string) => new Uint8Array(await readFile(new URL(fileName, corpus)));
const result = (bytes: Uint8Array, fileName: string) => extractP7m176({ bytes, fileName });

describe("STR-423: extraction never establishes authenticity or legal signature validity", () => {
  it("retains NOT_VERIFIED for a self-signed signer without an established trust anchor", async () => {
    const certificate = new X509Certificate(await readFile(new URL("cert.pem", corpus)));
    expect(certificate.checkIssued(certificate)).toBe(true);
    const extracted = result(await load("documento-pdf.p7m"), "documento-pdf.p7m");
    expect(extracted.signatureVerification).toBe("NOT_VERIFIED");
    expect(extracted.notice).toBe(P7M_NOTICE_176);
    expect(extracted.notice).toContain("documento NON autenticato");
  });

  it("extracts byte-identical payload from an envelope bearing an expired certificate without claiming verification", async () => {
    const expiredCert = new X509Certificate(await readFile(new URL("cert-scaduto.pem", corpus)));
    expect(Date.parse(expiredCert.validTo)).toBeLessThan(Date.now());
    const extracted = result(await load("documento-scaduto.p7m"), "documento-scaduto.p7m");
    expect(Buffer.from(extracted.content).equals(await readFile(new URL("inner.pdf", corpus)))).toBe(true);
    expect(extracted.signerCount).toBe(1);
    expect(extracted.certificateCount).toBe(1);
    expect(extracted.signatureVerification).toBe("NOT_VERIFIED");
    expect(extracted.notice).toMatch(/firma NON verificata/u);
  });

  it("does not promote altered CMS content to authentic even when extraction succeeds", async () => {
    const extracted = result(await load("documento-manomesso.p7m"), "documento-manomesso.p7m");
    expect(extracted.signatureVerification).toBe("NOT_VERIFIED");
    expect(extracted.notice).toContain("documento NON autenticato");
    expect(Buffer.from(extracted.content).equals(await readFile(new URL("inner.pdf", corpus)))).toBe(false);
  });

  it.each(["troncato.p7m", "lunghezza-indefinita.p7m", "detached-senza-contenuto.p7m", "non-firma.p7m"])(
    "never produces a verified result from %s", async (fileName) => {
      const bytes = await load(fileName);
      expect(() => result(bytes, fileName)).toThrow(/^P7M_/u);
    },
  );
});
