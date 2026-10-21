/**
 * STR-423 / #176 — bounded extraction of the content carried by a CMS/PKCS#7
 * SignedData envelope (the ".p7m" file produced by Italian signature tools).
 *
 * This module is an extractor, never a verifier. It reads
 * SignedData.encapContentInfo.eContent and returns those bytes. It does not
 * validate digests, signed attributes, signatures, certificate chains,
 * revocation, timestamps or eIDAS qualification, and no code path here can
 * report a document as authentic. The owner decision of 20/10/2026 scoped
 * STR-423 to extraction with an always-visible "signature NOT verified" notice,
 * because the content is readable even when the signature is broken.
 */

export const P7M_LIMITS_176 = {
  maxFileBytes: 16 * 1024 * 1024,
  maxContentBytes: 16 * 1024 * 1024,
  maxDepth: 12,
  maxNodes: 1_024,
  maxCertificates: 128,
} as const;

export const P7M_NOTICE_176 =
  "Contenuto estratto; firma NON verificata, documento NON autenticato. Nessuna validità legale o eIDAS viene dichiarata.";

const SIGNED_DATA_OID = "1.2.840.113549.1.7.2";

type Class176 = 0 | 1 | 2 | 3;

interface Tlv176 {
  readonly tagClass: Class176;
  readonly constructed: boolean;
  readonly tag: number;
  readonly contentStart: number;
  readonly contentEnd: number;
}

interface Budget176 {
  nodes: number;
}

export interface P7mSource176 {
  readonly bytes: Uint8Array;
  readonly fileName: string;
}

export interface P7mExtraction176 {
  readonly content: Uint8Array;
  readonly fileName: string;
  readonly mimeType: string;
  readonly contentBytes: number;
  readonly contentTypeOid: string;
  readonly signerCount: number;
  readonly certificateCount: number;
  readonly encoding: "DER" | "PEM";
  readonly signatureVerification: "NOT_VERIFIED";
  readonly notice: string;
}

function reject(code: string): never {
  throw new Error("P7M_" + code);
}

function spend(budget: Budget176): void {
  budget.nodes += 1;
  if (budget.nodes > P7M_LIMITS_176.maxNodes) reject("NODES");
}

function readTlv(bytes: Uint8Array, offset: number, limit: number, depth: number, budget: Budget176): Tlv176 {
  if (depth > P7M_LIMITS_176.maxDepth) reject("DEPTH");
  spend(budget);
  if (offset + 2 > limit) reject("TRUNCATED");
  const first = bytes[offset] as number;
  const tagClass = (first >>> 6) as Class176;
  const constructed = (first & 0x20) !== 0;
  let tag = first & 0x1f;
  let cursor = offset + 1;
  if (tag === 0x1f) {
    tag = 0;
    for (let index = 0; index < 3; index += 1) {
      if (cursor >= limit) reject("TRUNCATED");
      const byte = bytes[cursor] as number;
      cursor += 1;
      tag = (tag << 7) | (byte & 0x7f);
      if ((byte & 0x80) === 0) break;
      if (index === 2) reject("TAG");
    }
  }
  if (cursor >= limit) reject("TRUNCATED");
  const lengthByte = bytes[cursor] as number;
  cursor += 1;
  let length: number;
  if (lengthByte < 0x80) {
    length = lengthByte;
  } else if (lengthByte === 0x80) {
    // Indefinite length is BER, not the DER profile of a P7M envelope. Refuse
    // it explicitly instead of guessing where the element ends.
    reject("INDEFINITE_LENGTH");
  } else {
    const octets = lengthByte & 0x7f;
    if (octets > 4) reject("LENGTH");
    if (cursor + octets > limit) reject("TRUNCATED");
    length = 0;
    for (let index = 0; index < octets; index += 1) {
      length = length * 256 + (bytes[cursor] as number);
      cursor += 1;
    }
  }
  if (length > limit - cursor) reject("TRUNCATED");
  return { tagClass, constructed, tag, contentStart: cursor, contentEnd: cursor + length };
}

function children(bytes: Uint8Array, parent: Tlv176, depth: number, budget: Budget176): Tlv176[] {
  if (!parent.constructed) reject("STRUCTURE");
  const items: Tlv176[] = [];
  let cursor = parent.contentStart;
  while (cursor < parent.contentEnd) {
    const child = readTlv(bytes, cursor, parent.contentEnd, depth + 1, budget);
    items.push(child);
    cursor = child.contentEnd;
    if (items.length > P7M_LIMITS_176.maxNodes) reject("NODES");
  }
  if (cursor !== parent.contentEnd) reject("STRUCTURE");
  return items;
}

function decodeOid(bytes: Uint8Array, node: Tlv176): string {
  if (node.tagClass !== 0 || node.constructed || node.tag !== 6) reject("OID");
  if (node.contentEnd === node.contentStart) reject("OID");
  const arcs: number[] = [];
  let value = 0;
  let pending = false;
  for (let index = node.contentStart; index < node.contentEnd; index += 1) {
    const byte = bytes[index] as number;
    // Bounded arc accumulation: reject absurd multi-byte arcs early.
    if (value > 0x0fffffff) reject("OID");
    value = value * 128 + (byte & 0x7f);
    pending = (byte & 0x80) !== 0;
    if (!pending) {
      arcs.push(value);
      value = 0;
    }
  }
  if (pending || arcs.length === 0) reject("OID");
  const first = arcs[0] as number;
  const head = first < 40 ? [0, first] : first < 80 ? [1, first - 40] : [2, first - 80];
  return [...head, ...arcs.slice(1)].join(".");
}

function octets(bytes: Uint8Array, node: Tlv176, depth: number, budget: Budget176): Uint8Array {
  if (node.tagClass !== 0 || node.tag !== 4) reject("ECONTENT");
  if (!node.constructed) return bytes.subarray(node.contentStart, node.contentEnd);
  // BER allows a constructed OCTET STRING: concatenate the primitive chunks.
  const parts = children(bytes, node, depth, budget).map((child) => octets(bytes, child, depth + 1, budget));
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  if (total > P7M_LIMITS_176.maxContentBytes) reject("CONTENT_LIMIT");
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    merged.set(part, offset);
    offset += part.byteLength;
  }
  return merged;
}

function looksLikePem176(bytes: Uint8Array): boolean {
  const head = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, 64));
  return head.startsWith("-----BEGIN ");
}

function decodePem176(bytes: Uint8Array): Uint8Array {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const begin = text.indexOf("-----BEGIN ");
  const end = text.indexOf("-----END ");
  if (begin !== 0 || end === -1) reject("ENCODING");
  const body = text.slice(text.indexOf("\n", begin) + 1, end).replace(/\s+/gu, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/u.test(body)) reject("ENCODING");
  let decoded: string;
  try {
    decoded = atob(body);
  } catch {
    reject("ENCODING");
  }
  if (decoded.length > P7M_LIMITS_176.maxFileBytes) reject("LIMIT");
  const output = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) output[index] = decoded.charCodeAt(index);
  return output;
}

const MIME_BY_MAGIC_176: ReadonlyArray<{ readonly probe: readonly number[]; readonly mime: string; readonly extension: string }> = [
  { probe: [0x25, 0x50, 0x44, 0x46, 0x2d], mime: "application/pdf", extension: ".pdf" },
  { probe: [0x50, 0x4b, 0x03, 0x04], mime: "application/zip", extension: ".zip" },
  { probe: [0x89, 0x50, 0x4e, 0x47], mime: "image/png", extension: ".png" },
  { probe: [0xff, 0xd8, 0xff], mime: "image/jpeg", extension: ".jpg" },
  { probe: [0x47, 0x49, 0x46, 0x38], mime: "image/gif", extension: ".gif" },
  { probe: [0x49, 0x49, 0x2a, 0x00], mime: "image/tiff", extension: ".tif" },
  { probe: [0x4d, 0x4d, 0x00, 0x2a], mime: "image/tiff", extension: ".tif" },
  { probe: [0x25, 0x21, 0x50, 0x53], mime: "application/postscript", extension: ".ps" },
];

function sniff176(content: Uint8Array): { mimeType: string; extension: string } {
  for (const entry of MIME_BY_MAGIC_176) {
    if (entry.probe.length > content.byteLength) continue;
    if (entry.probe.every((byte, index) => content[index] === byte)) {
      return { mimeType: entry.mime, extension: entry.extension };
    }
  }
  const head = new TextDecoder("utf-8", { fatal: false }).decode(content.subarray(0, 256));
  if (head.trimStart().startsWith("<?xml") || head.trimStart().startsWith("<")) {
    return { mimeType: "application/xml", extension: ".xml" };
  }
  return { mimeType: "application/octet-stream", extension: ".bin" };
}

function suggestedName176(fileName: string, extension: string): string {
  const base = fileName.replace(/\.p7m$/iu, "").replace(/\.p7s$/iu, "").trim();
  const safe = base === "" ? "documento-estratto" : base.replace(/[\\/:*?"<>|\u0000-\u001f]/gu, "_").slice(0, 120);
  return safe.toLowerCase().endsWith(extension) ? safe : safe + extension;
}

/**
 * Extract the signed payload. The return value is always
 * `signatureVerification: "NOT_VERIFIED"`: a successfully parsed envelope says
 * nothing about who signed it or whether the signature still holds.
 */
export function extractP7m176(source: P7mSource176, signal?: AbortSignal): P7mExtraction176 {
  if (signal?.aborted) reject("CANCELLED");
  if (typeof source !== "object" || source === null) reject("INPUT");
  const { bytes } = source;
  if (!(bytes instanceof Uint8Array)) reject("INPUT");
  if (bytes.byteLength === 0) reject("EMPTY");
  if (bytes.byteLength > P7M_LIMITS_176.maxFileBytes) reject("LIMIT");
  if (typeof source.fileName !== "string") reject("INPUT");
  const encoding: "DER" | "PEM" = looksLikePem176(bytes) ? "PEM" : "DER";
  const der = encoding === "PEM" ? decodePem176(bytes) : bytes;
  const budget: Budget176 = { nodes: 0 };

  const root = readTlv(der, 0, der.byteLength, 0, budget);
  if (root.tagClass !== 0 || !root.constructed || root.tag !== 16) reject("CONTENT_INFO");
  const outer = children(der, root, 0, budget);
  if (outer.length !== 2) reject("CONTENT_INFO");
  const contentType = outer[0] as Tlv176;
  if (decodeOid(der, contentType) !== SIGNED_DATA_OID) reject("NOT_SIGNED_DATA");
  const explicit = outer[1] as Tlv176;
  if (explicit.tagClass !== 2 || explicit.tag !== 0 || !explicit.constructed) reject("CONTENT_INFO");
  const wrapped = children(der, explicit, 1, budget);
  if (wrapped.length !== 1) reject("SIGNED_DATA");
  const signedData = wrapped[0] as Tlv176;
  if (signedData.tagClass !== 0 || !signedData.constructed || signedData.tag !== 16) reject("SIGNED_DATA");
  const parts = children(der, signedData, 2, budget);
  if (parts.length < 3) reject("SIGNED_DATA");
  if ((parts[0] as Tlv176).tag !== 2 || (parts[1] as Tlv176).tag !== 17) reject("SIGNED_DATA");
  const encap = parts[2] as Tlv176;
  if (encap.tagClass !== 0 || encap.tag !== 16 || !encap.constructed) reject("ENCAP");
  const encapParts = children(der, encap, 3, budget);
  if (encapParts.length < 1 || encapParts.length > 2) reject("ENCAP");
  const contentOid = decodeOid(der, encapParts[0] as Tlv176);
  let eContent: Tlv176 | undefined;
  if (encapParts.length === 2) {
    const holder = encapParts[1] as Tlv176;
    if (holder.tagClass !== 2 || holder.tag !== 0 || !holder.constructed) reject("ENCAP");
    const inner = children(der, holder, 4, budget);
    if (inner.length !== 1) reject("ENCAP");
    eContent = inner[0] as Tlv176;
  }
  if (eContent === undefined) {
    // A detached signature carries no payload: returning invented bytes, or
    // asking the user for a second file, is out of the approved scope.
    reject("DETACHED");
  }
  const payload = octets(der, eContent, 5, budget);
  if (payload.byteLength === 0) reject("NO_CONTENT");
  if (payload.byteLength > P7M_LIMITS_176.maxContentBytes) reject("CONTENT_LIMIT");
  if (signal?.aborted) reject("CANCELLED");

  let certificateCount = 0;
  let signerCount = 0;
  for (const part of parts.slice(3)) {
    if (part.tagClass === 2 && part.tag === 0) {
      const entries = children(der, part, 3, budget);
      if (entries.length > P7M_LIMITS_176.maxCertificates) reject("CERTIFICATE_LIMIT");
      certificateCount = entries.length;
    } else if (part.tagClass === 0 && part.tag === 17) {
      signerCount = children(der, part, 3, budget).length;
    }
  }

  const content = payload.slice();
  const { mimeType, extension } = sniff176(content);
  return {
    content,
    fileName: suggestedName176(source.fileName, extension),
    mimeType,
    contentBytes: content.byteLength,
    contentTypeOid: contentOid,
    signerCount,
    certificateCount,
    encoding,
    signatureVerification: "NOT_VERIFIED",
    notice: P7M_NOTICE_176,
  };
}
