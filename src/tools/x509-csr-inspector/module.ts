import type { ToolModule } from "../../runtime/types";

export const X509_MAX_BYTES = 262_144;
const ASN1_MAX_DEPTH = 32;
const ASN1_MAX_NODES = 4096;

interface Asn1Node {
  readonly tag: number;
  readonly start: number;
  readonly valueStart: number;
  readonly end: number;
  readonly children: readonly Asn1Node[];
}

interface ParseState { nodes: number }

const OID_NAMES: Readonly<Record<string, string>> = {
  "2.5.4.3": "CN", "2.5.4.6": "C", "2.5.4.7": "L", "2.5.4.8": "ST", "2.5.4.10": "O", "2.5.4.11": "OU",
  "1.2.840.113549.1.9.1": "emailAddress",
};

const ALGORITHM_NAMES: Readonly<Record<string, string>> = {
  "1.2.840.113549.1.1.1": "RSA", "1.2.840.113549.1.1.5": "SHA-1 con RSA", "1.2.840.113549.1.1.11": "SHA-256 con RSA",
  "1.2.840.113549.1.1.12": "SHA-384 con RSA", "1.2.840.113549.1.1.13": "SHA-512 con RSA",
  "1.2.840.10045.2.1": "EC", "1.2.840.10045.4.3.2": "ECDSA con SHA-256", "1.2.840.10045.4.3.3": "ECDSA con SHA-384",
  "1.2.840.10045.4.3.4": "ECDSA con SHA-512", "1.3.101.112": "Ed25519", "1.3.101.113": "Ed448",
};

const CURVE_NAMES: Readonly<Record<string, string>> = {
  "1.2.840.10045.3.1.7": "P-256", "1.3.132.0.34": "P-384", "1.3.132.0.35": "P-521",
};

function parseNode(bytes: Uint8Array, offset: number, depth: number, state: ParseState): Asn1Node {
  if (depth > ASN1_MAX_DEPTH) throw new Error("ASN1_TOO_DEEP");
  if (offset + 2 > bytes.length) throw new Error("ASN1_TRUNCATED");
  if (++state.nodes > ASN1_MAX_NODES) throw new Error("ASN1_TOO_MANY_NODES");
  const tag = bytes[offset] ?? 0;
  if ((tag & 0x1f) === 0x1f) throw new Error("ASN1_HIGH_TAG_UNSUPPORTED");
  let cursor = offset + 1;
  const firstLength = bytes[cursor++] ?? 0;
  let length = 0;
  if ((firstLength & 0x80) === 0) length = firstLength;
  else {
    const count = firstLength & 0x7f;
    if (count === 0) throw new Error("ASN1_INDEFINITE_LENGTH_UNSUPPORTED");
    if (count > 4 || cursor + count > bytes.length) throw new Error("ASN1_LENGTH_INVALID");
    if ((bytes[cursor] ?? 0) === 0) throw new Error("ASN1_LENGTH_NON_MINIMAL");
    for (let index = 0; index < count; index += 1) length = length * 256 + (bytes[cursor++] ?? 0);
    if (length < 128) throw new Error("ASN1_LENGTH_NON_MINIMAL");
  }
  const valueStart = cursor;
  const end = valueStart + length;
  if (end > bytes.length) throw new Error("ASN1_TRUNCATED");
  const children: Asn1Node[] = [];
  if ((tag & 0x20) !== 0) {
    while (cursor < end) {
      const child = parseNode(bytes, cursor, depth + 1, state);
      children.push(child);
      cursor = child.end;
    }
    if (cursor !== end) throw new Error("ASN1_CHILD_LENGTH_MISMATCH");
  }
  return { tag, start: offset, valueStart, end, children };
}

function valueBytes(bytes: Uint8Array, node: Asn1Node): Uint8Array { return bytes.subarray(node.valueStart, node.end); }

function decodeOid(bytes: Uint8Array, node: Asn1Node): string {
  if (node.tag !== 0x06) throw new Error("ASN1_EXPECTED_OID");
  const value = valueBytes(bytes, node);
  if (value.length === 0) throw new Error("ASN1_OID_INVALID");
  const subidentifiers: number[] = [];
  let current = 0;
  for (const octet of value) {
    current = current * 128 + (octet & 0x7f);
    if (!Number.isSafeInteger(current)) throw new Error("ASN1_OID_INVALID");
    if ((octet & 0x80) === 0) { subidentifiers.push(current); current = 0; }
  }
  if (current !== 0) throw new Error("ASN1_OID_INVALID");
  const first = subidentifiers.shift();
  if (first === undefined) throw new Error("ASN1_OID_INVALID");
  const firstArc = first < 40 ? 0 : first < 80 ? 1 : 2;
  const parts = [firstArc, first - (firstArc === 0 ? 0 : firstArc === 1 ? 40 : 80), ...subidentifiers];
  return parts.join(".");
}

function decodeText(bytes: Uint8Array, node: Asn1Node): string {
  const value = valueBytes(bytes, node);
  if (node.tag === 0x1e) {
    if (value.length % 2 !== 0) return "[BMPString non valida]";
    let output = "";
    for (let index = 0; index < value.length; index += 2) output += String.fromCharCode(((value[index] ?? 0) << 8) | (value[index + 1] ?? 0));
    return output;
  }
  if (![0x0c, 0x13, 0x14, 0x16, 0x12, 0x1a].includes(node.tag)) return `[tag 0x${node.tag.toString(16)}]`;
  return new TextDecoder(node.tag === 0x0c ? "utf-8" : "windows-1252", { fatal: false }).decode(value);
}

function decodeName(bytes: Uint8Array, node: Asn1Node): string {
  const parts: string[] = [];
  for (const set of node.children) for (const pair of set.children) {
    const oidNode = pair.children[0];
    const valueNode = pair.children[1];
    if (oidNode === undefined || valueNode === undefined) continue;
    const oid = decodeOid(bytes, oidNode);
    parts.push(`${OID_NAMES[oid] ?? oid}=${decodeText(bytes, valueNode)}`);
  }
  return parts.join(", ") || "—";
}

function decodeTime(bytes: Uint8Array, node: Asn1Node): { raw: string; iso: string | null } {
  const raw = new TextDecoder("ascii").decode(valueBytes(bytes, node));
  let match: RegExpMatchArray | null = null;
  let year = 0;
  if (node.tag === 0x17) {
    match = raw.match(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/u);
    if (match !== null) { const yy = Number(match[1]); year = yy >= 50 ? 1900 + yy : 2000 + yy; }
  } else if (node.tag === 0x18) {
    match = raw.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/u);
    if (match !== null) year = Number(match[1]);
  }
  if (match === null) return { raw, iso: null };
  const month = Number(match[2]); const day = Number(match[3]);
  const hour = Number(match[4]); const minute = Number(match[5]); const second = Number(match[6]);
  const time = Date.UTC(year, month - 1, day, hour, minute, second);
  const date = new Date(time);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return { raw, iso: null };
  return { raw, iso: date.toISOString() };
}

function integerBitLength(bytes: Uint8Array): number {
  let index = 0;
  while (index < bytes.length - 1 && bytes[index] === 0) index += 1;
  const first = bytes[index] ?? 0;
  if (first === 0) return 0;
  return (bytes.length - index - 1) * 8 + (8 - Math.clz32(first) + 24);
}

function decodeSpki(bytes: Uint8Array, node: Asn1Node): { algorithm: string; oid: string; bits: number | null; curve: string | null } {
  const algorithmNode = node.children[0]; const bitString = node.children[1];
  const oidNode = algorithmNode?.children[0];
  if (algorithmNode === undefined || bitString === undefined || oidNode === undefined) throw new Error("X509_SPKI_INVALID");
  const oid = decodeOid(bytes, oidNode);
  let bits: number | null = null;
  let curve: string | null = null;
  if (oid === "1.2.840.113549.1.1.1") {
    const key = valueBytes(bytes, bitString);
    if (bitString.tag === 0x03 && key.length > 1 && key[0] === 0) {
      const nestedBytes = key.subarray(1);
      const root = parseNode(nestedBytes, 0, 0, { nodes: 0 });
      const modulus = root.children[0];
      if (modulus?.tag === 0x02) bits = integerBitLength(valueBytes(nestedBytes, modulus));
    }
  } else if (oid === "1.2.840.10045.2.1") {
    const curveNode = algorithmNode.children[1];
    if (curveNode?.tag === 0x06) {
      const curveOid = decodeOid(bytes, curveNode);
      curve = CURVE_NAMES[curveOid] ?? curveOid;
      bits = curve === "P-256" ? 256 : curve === "P-384" ? 384 : curve === "P-521" ? 521 : null;
    }
  } else if (oid === "1.3.101.112") bits = 256;
  else if (oid === "1.3.101.113") bits = 448;
  return { algorithm: ALGORITHM_NAMES[oid] ?? oid, oid, bits, curve };
}

function ipString(value: Uint8Array): string {
  if (value.length === 4) return [...value].join(".");
  if (value.length === 16) {
    const groups: string[] = [];
    for (let index = 0; index < 16; index += 2) groups.push((((value[index] ?? 0) << 8) | (value[index + 1] ?? 0)).toString(16));
    return groups.join(":");
  }
  return [...value].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function decodeGeneralNames(der: Uint8Array): string[] {
  const root = parseNode(der, 0, 0, { nodes: 0 });
  const names: string[] = [];
  for (const child of root.children) {
    const value = valueBytes(der, child);
    if (child.tag === 0x82) names.push(`DNS:${new TextDecoder("ascii").decode(value)}`);
    else if (child.tag === 0x81) names.push(`email:${new TextDecoder("ascii").decode(value)}`);
    else if (child.tag === 0x86) names.push(`URI:${new TextDecoder("ascii").decode(value)}`);
    else if (child.tag === 0x87) names.push(`IP:${ipString(value)}`);
  }
  return names;
}

function decodeExtensions(bytes: Uint8Array, extensionsNode: Asn1Node): string[] {
  const names: string[] = [];
  const sequence = extensionsNode.tag === 0xa3 ? extensionsNode.children[0] : extensionsNode;
  if (sequence === undefined) return names;
  for (const extension of sequence.children) {
    const oidNode = extension.children[0];
    if (oidNode === undefined) continue;
    const oid = decodeOid(bytes, oidNode);
    if (oid !== "2.5.29.17") continue;
    const octetNode = extension.children.find((child) => child.tag === 0x04);
    if (octetNode === undefined) continue;
    names.push(...decodeGeneralNames(valueBytes(bytes, octetNode)));
  }
  return names;
}

function decodeCsrSans(bytes: Uint8Array, attributesNode: Asn1Node | undefined): string[] {
  if (attributesNode === undefined) return [];
  for (const attribute of attributesNode.children) {
    const oidNode = attribute.children[0];
    if (oidNode === undefined || decodeOid(bytes, oidNode) !== "1.2.840.113549.1.9.14") continue;
    const values = attribute.children[1];
    const extensions = values?.children[0];
    if (extensions !== undefined) return decodeExtensions(bytes, extensions);
  }
  return [];
}

function serialHex(bytes: Uint8Array, node: Asn1Node): string {
  return [...valueBytes(bytes, node)].map((byte) => byte.toString(16).padStart(2, "0")).join("").replace(/^00/u, "").toUpperCase() || "0";
}

function pemToDer(input: string): { kind: "certificate" | "csr"; bytes: Uint8Array } {
  if (/BEGIN (?:ENCRYPTED PRIVATE KEY|PRIVATE KEY)|Proc-Type:\s*4,ENCRYPTED/iu.test(input)) throw new Error("ENCRYPTED_PEM_UNSUPPORTED");
  const match = input.match(/^-----BEGIN (CERTIFICATE|CERTIFICATE REQUEST|NEW CERTIFICATE REQUEST)-----([\s\S]*?)-----END \1-----$/u);
  if (match === null) throw new Error("PEM_UNSUPPORTED_OR_MALFORMED");
  const body = (match[2] ?? "").replace(/\s+/gu, "");
  if (body === "" || !/^[A-Za-z0-9+/]+={0,2}$/u.test(body) || body.length % 4 !== 0) throw new Error("PEM_BASE64_INVALID");
  const decoded = atob(body);
  const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
  return { kind: match[1] === "CERTIFICATE" ? "certificate" : "csr", bytes };
}

function normalizeInput(input: unknown): { hintedKind: "certificate" | "csr" | null; bytes: Uint8Array } {
  if (typeof input === "string") {
    const pem = pemToDer(input.trim());
    return { hintedKind: pem.kind, bytes: pem.bytes };
  }
  if (input instanceof Uint8Array) return { hintedKind: null, bytes: input };
  if (input instanceof ArrayBuffer) return { hintedKind: null, bytes: new Uint8Array(input) };
  throw new Error("X509_INPUT_REQUIRED");
}

function toHex(bytes: Uint8Array): string { return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase(); }

async function sha256(bytes: Uint8Array): Promise<string> {
  if (globalThis.crypto?.subtle === undefined) throw new Error("WEBCRYPTO_UNAVAILABLE");
  const input = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  input.set(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", input.buffer);
  return toHex(new Uint8Array(digest)).match(/.{1,2}/gu)?.join(":") ?? "";
}

export interface X509Inspection {
  readonly kind: "certificate" | "csr";
  readonly subject: string;
  readonly issuer: string | null;
  readonly serialNumber: string | null;
  readonly validity: { readonly notBefore: string | null; readonly notAfter: string | null } | null;
  readonly san: readonly string[];
  readonly publicKey: { readonly algorithm: string; readonly oid: string; readonly bits: number | null; readonly curve: string | null };
  readonly signatureAlgorithm: { readonly name: string; readonly oid: string };
  readonly sha256Fingerprint: string;
  readonly trustNotice: string;
}

function parseCertificate(bytes: Uint8Array, root: Asn1Node): Omit<X509Inspection, "sha256Fingerprint" | "trustNotice"> {
  const tbs = root.children[0]; const sigAlg = root.children[1];
  if (root.children.length !== 3 || tbs?.tag !== 0x30 || sigAlg?.tag !== 0x30) throw new Error("UNSUPPORTED_DER_STRUCTURE");
  let index = tbs.children[0]?.tag === 0xa0 ? 1 : 0;
  const serial = tbs.children[index++]; index += 1;
  const issuer = tbs.children[index++]; const validity = tbs.children[index++]; const subject = tbs.children[index++]; const spki = tbs.children[index++];
  if (serial?.tag !== 0x02 || issuer?.tag !== 0x30 || validity?.tag !== 0x30 || subject?.tag !== 0x30 || spki?.tag !== 0x30) throw new Error("UNSUPPORTED_DER_STRUCTURE");
  const notBefore = validity.children[0]; const notAfter = validity.children[1];
  if (notBefore === undefined || notAfter === undefined) throw new Error("X509_VALIDITY_INVALID");
  const extensions = tbs.children.slice(index).find((node) => node.tag === 0xa3);
  const sigOidNode = sigAlg.children[0]; if (sigOidNode === undefined) throw new Error("X509_SIGNATURE_INVALID");
  const sigOid = decodeOid(bytes, sigOidNode);
  return {
    kind: "certificate", subject: decodeName(bytes, subject), issuer: decodeName(bytes, issuer), serialNumber: serialHex(bytes, serial),
    validity: { notBefore: decodeTime(bytes, notBefore).iso, notAfter: decodeTime(bytes, notAfter).iso },
    san: extensions === undefined ? [] : decodeExtensions(bytes, extensions), publicKey: decodeSpki(bytes, spki),
    signatureAlgorithm: { name: ALGORITHM_NAMES[sigOid] ?? sigOid, oid: sigOid },
  };
}

function parseCsr(bytes: Uint8Array, root: Asn1Node): Omit<X509Inspection, "sha256Fingerprint" | "trustNotice"> {
  const info = root.children[0]; const sigAlg = root.children[1];
  if (root.children.length !== 3 || info?.tag !== 0x30 || sigAlg?.tag !== 0x30) throw new Error("UNSUPPORTED_DER_STRUCTURE");
  const version = info.children[0]; const subject = info.children[1]; const spki = info.children[2];
  if (version?.tag !== 0x02 || subject?.tag !== 0x30 || spki?.tag !== 0x30) throw new Error("UNSUPPORTED_DER_STRUCTURE");
  const sigOidNode = sigAlg.children[0]; if (sigOidNode === undefined) throw new Error("X509_SIGNATURE_INVALID");
  const sigOid = decodeOid(bytes, sigOidNode);
  return {
    kind: "csr", subject: decodeName(bytes, subject), issuer: null, serialNumber: null, validity: null,
    san: decodeCsrSans(bytes, info.children[3]), publicKey: decodeSpki(bytes, spki),
    signatureAlgorithm: { name: ALGORITHM_NAMES[sigOid] ?? sigOid, oid: sigOid },
  };
}

export async function inspectX509OrCsr(input: string | Uint8Array | ArrayBuffer): Promise<X509Inspection> {
  const normalized = normalizeInput(input);
  if (normalized.bytes.length === 0) throw new Error("X509_INPUT_REQUIRED");
  if (normalized.bytes.length > X509_MAX_BYTES) throw new Error("X509_INPUT_TOO_LARGE");
  const root = parseNode(normalized.bytes, 0, 0, { nodes: 0 });
  if (root.start !== 0 || root.end !== normalized.bytes.length || root.tag !== 0x30) throw new Error("UNSUPPORTED_DER_STRUCTURE");
  let parsed: Omit<X509Inspection, "sha256Fingerprint" | "trustNotice">;
  if (normalized.hintedKind === "certificate") parsed = parseCertificate(normalized.bytes, root);
  else if (normalized.hintedKind === "csr") parsed = parseCsr(normalized.bytes, root);
  else {
    try { parsed = parseCertificate(normalized.bytes, root); }
    catch { try { parsed = parseCsr(normalized.bytes, root); } catch { throw new Error("UNSUPPORTED_DER_STRUCTURE"); } }
  }
  return {
    ...parsed,
    sha256Fingerprint: await sha256(normalized.bytes),
    trustNotice: "Questa è un'ispezione sintattica locale. Non verifica catena di fiducia, revoca, hostname, possesso della chiave privata o validità operativa.",
  };
}

const module: ToolModule = {
  async run(input) {
    if (typeof input !== "object" || input === null || !("data" in input)) throw new Error("X509_INPUT_REQUIRED");
    return inspectX509OrCsr((input as { data: string | Uint8Array | ArrayBuffer }).data);
  },
};

export default module;
