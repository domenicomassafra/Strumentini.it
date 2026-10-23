import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { extractP7m176, P7M_LIMITS_176, P7M_NOTICE_176 } from "../src/engines/p7m/reader-176";

const corpus = "quality/fixtures/p7m-cms-176/";
const read = async (name: string) => new Uint8Array(await readFile(corpus + name));

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    merged.set(part, offset);
    offset += part.byteLength;
  }
  return merged;
}
function tlv(tag: number, content: Uint8Array): Uint8Array {
  const length = content.byteLength;
  const header = length < 0x80 ? [tag, length] : length < 0x100 ? [tag, 0x81, length] : [tag, 0x82, length >> 8, length & 0xff];
  return new Uint8Array([...header, ...content]);
}
const seq = (content: Uint8Array) => tlv(0x30, content);
const set = (content: Uint8Array) => tlv(0x31, content);
const octets = (content: Uint8Array) => tlv(0x04, content);
const context0 = (content: Uint8Array) => tlv(0xa0, content);
const oid = (body: readonly number[]) => tlv(0x06, new Uint8Array(body));
const signedDataOid = () => oid([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x02]);
const dataOid = () => oid([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x01]);

function envelope(payload: Uint8Array, options: { readonly chunks?: boolean } = {}): Uint8Array {
  const eContent = options.chunks === true
    ? context0(tlv(0x24, concat([octets(payload.subarray(0, 4)), octets(payload.subarray(4))])))
    : context0(octets(payload));
  const encap = seq(concat([dataOid(), eContent]));
  const signedData = seq(concat([tlv(0x02, new Uint8Array([1])), set(new Uint8Array()), encap, set(new Uint8Array())]));
  return seq(concat([signedDataOid(), context0(signedData)]));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("STR-423 P7M/CMS extraction without any authenticity claim", () => {
  it("extracts the exact eContent of an independently signed CMS corpus and never reports verification", async () => {
    const extracted = extractP7m176({ bytes: await read("documento-pdf.p7m"), fileName: "documento-pdf.p7m" });
    expect(Buffer.from(extracted.content).equals(Buffer.from(await read("inner.pdf")))).toBe(true);
    expect(extracted.mimeType).toBe("application/pdf");
    expect(extracted.fileName).toBe("documento-pdf.pdf");
    expect(extracted.contentBytes).toBe(192);
    expect(extracted.contentTypeOid).toBe("1.2.840.113549.1.7.1");
    expect(extracted.signerCount).toBe(1);
    expect(extracted.certificateCount).toBe(1);
    expect(extracted.encoding).toBe("DER");
    expect(extracted.signatureVerification).toBe("NOT_VERIFIED");
    expect(extracted.notice).toBe(P7M_NOTICE_176);
    expect(extracted.notice).toMatch(/firma NON verificata/iu);
    expect(JSON.stringify(extracted)).not.toMatch(/autentico|firma valida|verified signature/iu);
  });

  it("reads XML payloads and PEM-armoured envelopes with the same bytes", async () => {
    const xml = extractP7m176({ bytes: await read("documento-xml.p7m"), fileName: "documento-xml.p7m" });
    expect(Buffer.from(xml.content).equals(Buffer.from(await read("inner.xml")))).toBe(true);
    expect(xml.mimeType).toBe("application/xml");
    const pem = extractP7m176({ bytes: await read("documento-pem.p7m"), fileName: "documento-pem.p7m" });
    expect(pem.encoding).toBe("PEM");
    expect(Buffer.from(pem.content).equals(Buffer.from(await read("inner.pdf")))).toBe(true);
    expect(pem.signatureVerification).toBe("NOT_VERIFIED");
  });

  it("keeps extracting a tampered envelope while refusing to call it authentic", async () => {
    // OpenSSL reports this same fixture as a content-verification failure and
    // still writes 192 bytes. An extractor must not turn that into a pass.
    const tampered = extractP7m176({ bytes: await read("documento-manomesso.p7m"), fileName: "documento-manomesso.p7m" });
    expect(tampered.contentBytes).toBe(192);
    expect(Buffer.from(tampered.content).equals(Buffer.from(await read("inner.pdf")))).toBe(false);
    expect(tampered.signatureVerification).toBe("NOT_VERIFIED");
    expect(tampered.notice).toMatch(/NON autenticato/iu);
  });

  it.each([
    ["detached signature without eContent", "detached-senza-contenuto.p7m", "P7M_DETACHED"],
    ["truncated envelope", "troncato.p7m", "P7M_TRUNCATED"],
    ["BER indefinite length", "lunghezza-indefinita.p7m", "P7M_INDEFINITE_LENGTH"],
    ["not a CMS envelope", "non-firma.p7m", "P7M_CONTENT_INFO"],
  ] as const)("refuses %s with a stable code", async (_case, name, code) => {
    let observed = "";
    try {
      extractP7m176({ bytes: await read(name), fileName: name });
    } catch (error) {
      observed = (error as Error).message;
    }
    expect(observed).toBe(code);
  });

  it("refuses empty input, a lone tag and a declared length past the buffer", () => {
    expect(() => extractP7m176({ bytes: new Uint8Array(), fileName: "vuoto.p7m" })).toThrow(/P7M_EMPTY/u);
    expect(() => extractP7m176({ bytes: new Uint8Array([0x30]), fileName: "corto.p7m" })).toThrow(/P7M_TRUNCATED/u);
    const lying = seq(concat([
      signedDataOid(),
      context0(seq(concat([
        tlv(0x02, new Uint8Array([1])),
        set(new Uint8Array()),
        seq(concat([dataOid(), context0(new Uint8Array([0x04, 0x84, 0x7f, 0xff, 0xff, 0xff]))])),
      ]))),
    ]));
    expect(() => extractP7m176({ bytes: lying, fileName: "mentito.p7m" })).toThrow(/P7M_TRUNCATED/u);
  });

  it("joins a constructed OCTET STRING instead of truncating the payload", () => {
    const payload = new TextEncoder().encode("%PDF-1.4 constructed chunks");
    const joined = extractP7m176({ bytes: envelope(payload, { chunks: true }), fileName: "chunks.p7m" });
    expect(Buffer.from(joined.content).equals(Buffer.from(payload))).toBe(true);
    expect(joined.signatureVerification).toBe("NOT_VERIFIED");
  });

  it("refuses SignedData without the mandatory signerInfos SET", () => {
    const payload = new TextEncoder().encode("%PDF-1.4 missing signerInfos");
    const encap = seq(concat([dataOid(), context0(octets(payload))]));
    const missingSigners = seq(concat([tlv(0x02, new Uint8Array([1])), set(new Uint8Array()), encap]));
    const malformed = seq(concat([signedDataOid(), context0(missingSigners)]));
    expect(() => extractP7m176({ bytes: malformed, fileName: "signerinfos-missing.p7m" }))
      .toThrow("P7M_SIGNER_INFOS");
  });

  it("never touches the network and honours cancellation and the input ceiling", async () => {
    const network = vi.fn(() => { throw new Error("NETWORK_CALLED"); });
    vi.stubGlobal("fetch", network);
    extractP7m176({ bytes: await read("documento-pdf.p7m"), fileName: "documento-pdf.p7m" });
    expect(network).not.toHaveBeenCalled();
    const abort = new AbortController();
    abort.abort();
    const valid = await read("documento-pdf.p7m");
    expect(() => extractP7m176({ bytes: valid, fileName: "documento-pdf.p7m" }, abort.signal)).toThrow(/P7M_CANCELLED/u);
    expect(() => extractP7m176({ bytes: new Uint8Array(P7M_LIMITS_176.maxFileBytes + 1), fileName: "grande.p7m" })).toThrow(/P7M_LIMIT/u);
  });
});

it("refuses valid CMS DER followed by extra unparsed bytes", async () => {
  const valid = await read("documento-pdf.p7m");
  const withTrailer = concat([valid, new Uint8Array([0xde, 0xad])]);
  expect(() => extractP7m176({ bytes: withTrailer, fileName: "trailer.p7m" })).toThrow("P7M_TRAILING_DATA");
});
