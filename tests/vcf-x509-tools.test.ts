import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseVCard } from "../src/tools/vcf-viewer-csv-export/module";
import { inspectX509OrCsr } from "../src/tools/x509-csr-inspector/module";

describe("VCF viewer and CSV export", () => {
  it("preserves folds, repeated values and unsupported raw properties", async () => {
    const fixture = JSON.parse(await readFile(resolve("quality/fixtures/vcard-rfc6350/vectors.json"), "utf8")) as {
      vectors: Array<{ vcf: string; expected: Record<string, string | number> }>;
    };
    const vector = fixture.vectors[0]!;
    const result = parseVCard(vector.vcf);
    expect(result.contacts).toHaveLength(vector.expected.contacts as number);
    const first = result.contacts[0]!;
    expect(first.phones).toHaveLength(vector.expected.first_phones as number);
    expect(first.emails).toHaveLength(vector.expected.first_emails as number);
    expect(first.notes[0]).toBe(vector.expected.first_note);
    expect(first.unsupported.some((property) => property.name === vector.expected.unsupported_name)).toBe(true);
    expect(first.rawSource).toContain("\n e continua qui");
    expect(first.phones[0]?.raw).toContain("TEL;TYPE=cell:");
  });

  it("protects formula-like CSV cells while retaining source-contact rows", async () => {
    const fixture = JSON.parse(await readFile(resolve("quality/fixtures/vcard-rfc6350/vectors.json"), "utf8")) as {
      vectors: Array<{ vcf: string; expected: Record<string, string | number> }>;
    };
    const vector = fixture.vectors[0]!;
    const result = parseVCard(vector.vcf);
    expect(result.csv).toContain(`"${vector.expected.csv_formula_cell as string}"`);
    expect(result.csv).toContain('"1","Giulia Èrba"');
    expect(result.csv).toContain('"2","\'=2+3"');
  });
});

describe("X.509 certificate and PKCS#10 CSR inspector", () => {
  it("reads certificate facts and matches an independent SHA-256 implementation", async () => {
    const vectors = JSON.parse(await readFile(resolve("quality/fixtures/x509-csr-rfc/vectors.json"), "utf8")) as {
      certificate: { subject_contains: string; issuer_contains: string; serial: string; sans: string[]; public_key_algorithm: string; public_key_bits: number; sha256_fingerprint: string };
    };
    const pem = await readFile(resolve("quality/fixtures/x509-csr-rfc/sample-cert.pem"), "utf8");
    const der = new Uint8Array(await readFile(resolve("quality/fixtures/x509-csr-rfc/sample-cert.der")));
    const result = await inspectX509OrCsr(pem);
    expect(result.kind).toBe("certificate");
    expect(result.subject).toContain(vectors.certificate.subject_contains);
    expect(result.issuer).toContain(vectors.certificate.issuer_contains);
    expect(result.serialNumber).toBe(vectors.certificate.serial);
    expect(result.san).toEqual(vectors.certificate.sans);
    expect(result.publicKey).toMatchObject({ algorithm: vectors.certificate.public_key_algorithm, bits: vectors.certificate.public_key_bits });
    const independent = createHash("sha256").update(der).digest("hex").toUpperCase().match(/.{1,2}/gu)!.join(":");
    expect(result.sha256Fingerprint).toBe(independent);
    expect(result.sha256Fingerprint).toBe(vectors.certificate.sha256_fingerprint);
    expect(result.trustNotice).toMatch(/Non verifica catena di fiducia, revoca/iu);

    const derResult = await inspectX509OrCsr(der);
    expect(derResult.sha256Fingerprint).toBe(independent);
  });

  it("reads CSR subject/SAN facts and does not invent issuer or validity", async () => {
    const vectors = JSON.parse(await readFile(resolve("quality/fixtures/x509-csr-rfc/vectors.json"), "utf8")) as {
      csr: { subject_contains: string; sans: string[]; public_key_algorithm: string; public_key_bits: number };
    };
    const csr = await readFile(resolve("quality/fixtures/x509-csr-rfc/sample.csr.pem"), "utf8");
    const result = await inspectX509OrCsr(csr);
    expect(result.kind).toBe("csr");
    expect(result.subject).toContain(vectors.csr.subject_contains);
    expect(result.san).toEqual(vectors.csr.sans);
    expect(result.publicKey).toMatchObject({ algorithm: vectors.csr.public_key_algorithm, bits: vectors.csr.public_key_bits });
    expect(result.issuer).toBeNull();
    expect(result.validity).toBeNull();

    const der = new Uint8Array(await readFile(resolve("quality/fixtures/x509-csr-rfc/sample.csr.der")));
    const derResult = await inspectX509OrCsr(der);
    expect(derResult.kind).toBe("csr");
    expect(derResult.subject).toContain(vectors.csr.subject_contains);
    expect(derResult.san).toEqual(vectors.csr.sans);
  });

  it("fails explicitly for malformed, encrypted and unsupported inputs", async () => {
    await expect(inspectX509OrCsr("not a pem")).rejects.toThrow("PEM_UNSUPPORTED_OR_MALFORMED");
    await expect(inspectX509OrCsr("-----BEGIN ENCRYPTED PRIVATE KEY-----\nAAAA\n-----END ENCRYPTED PRIVATE KEY-----")).rejects.toThrow("ENCRYPTED_PEM_UNSUPPORTED");
    await expect(inspectX509OrCsr(new Uint8Array([0x30, 0x03, 0x02, 0x01, 0x01]))).rejects.toThrow("UNSUPPORTED_DER_STRUCTURE");
    await expect(inspectX509OrCsr(new Uint8Array([0x30, 0x80, 0x00, 0x00]))).rejects.toThrow("ASN1_INDEFINITE_LENGTH_UNSUPPORTED");
  });
});
