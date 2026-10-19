import ipaddr from "ipaddr.js";
import { invalid, type DeveloperWebResult } from "./types";

// ipaddr.js accepts octal/short IPv4 and zone IDs; the public CIDR contract does not.
function invalidCidr(message: string, character = 1, context = "invalid CIDR input"): never {
  return invalid("INVALID_INPUT", message, { character, context });
}

function decimalIpv4(input: string): readonly number[] {
  const parts = input.split(".");
  if (parts.length !== 4) invalidCidr("IPv4 requires four decimal octets.", 1, "IPv4 requires four octets");
  let character = 1;
  return parts.map((part) => {
    if (!/^\d{1,3}$/u.test(part)) invalidCidr("IPv4 octets must be decimal integers.", character, `invalid IPv4 octet ${JSON.stringify(part)}`);
    const octet = Number(part);
    if (octet > 255) invalidCidr("IPv4 octets must be from 0 through 255.", character, `IPv4 octet out of range: ${part}`);
    character += part.length + 1;
    return octet;
  });
}

function parseAddress(input: string): { family: "IPv4" | "IPv6"; bits: 32 | 128; value: bigint } {
  const v6 = input.includes(":");
  if (input.includes("%")) invalidCidr("IPv6 zone identifiers are not valid CIDR network addresses.", input.indexOf("%") + 1, "zone identifier is unsupported in CIDR input");

  let normalized = input;
  if (input.includes(".")) {
    if (v6) {
      const lastColon = input.lastIndexOf(":");
      const octets = decimalIpv4(input.slice(lastColon + 1));
      const high = (octets[0]! * 256 + octets[1]!).toString(16);
      const low = (octets[2]! * 256 + octets[3]!).toString(16);
      normalized = `${input.slice(0, lastColon + 1)}${high}:${low}`;
    } else {
      normalized = decimalIpv4(input).join(".");
    }
  } else if (!v6) {
    invalidCidr("IPv4 requires four decimal octets.", 1, "IPv4 requires four octets");
  }

  let bytes: number[];
  try {
    const parsed = ipaddr.parse(normalized);
    if (parsed.kind() !== (v6 ? "ipv6" : "ipv4")) invalidCidr("Unexpected IP address family.");
    bytes = parsed.toByteArray();
  } catch {
    invalidCidr("The IP address is invalid.", 1, `invalid ${v6 ? "IPv6" : "IPv4"} address`);
  }
  let value = 0n;
  for (const octet of bytes) value = (value << 8n) | BigInt(octet);
  return { family: v6 ? "IPv6" : "IPv4", bits: v6 ? 128 : 32, value };
}

function parseCidr(input: string): { address: ReturnType<typeof parseAddress>; prefix: number } {
  const text = input.trim();
  const slash = text.lastIndexOf("/");
  if (slash <= 0 || slash === text.length - 1 || text.indexOf("/") !== slash) {
    invalidCidr("CIDR input must contain exactly one address/prefix separator.", Math.max(1, slash + 1), "expected address/prefix");
  }
  const address = parseAddress(text.slice(0, slash));
  const rawPrefix = text.slice(slash + 1);
  if (!/^\d{1,3}$/u.test(rawPrefix)) invalidCidr("CIDR prefix must be a decimal integer.", 1, `invalid prefix ${JSON.stringify(rawPrefix)}`);
  const prefix = Number(rawPrefix);
  if (prefix > address.bits) invalidCidr(`CIDR prefix must be from 0 through ${address.bits}.`, 1, `prefix /${prefix}`);
  return { address, prefix };
}

function ipv4(value: bigint): string {
  const octets: string[] = [];
  for (let shift = 24n; shift >= 0n; shift -= 8n) octets.push(((value >> shift) & 255n).toString(10));
  return octets.join(".");
}

// RFC 5952: longest zero run, first run on a tie, never compress a single hextet.
function ipv6(value: bigint): string {
  const hextets: string[] = [];
  for (let shift = 112n; shift >= 0n; shift -= 16n) hextets.push(((value >> shift) & 0xffffn).toString(16));
  let bestStart = -1;
  let bestLength = 0;
  for (let index = 0; index < hextets.length;) {
    if (hextets[index] !== "0") { index += 1; continue; }
    let end = index;
    while (end < hextets.length && hextets[end] === "0") end += 1;
    if (end - index >= 2 && end - index > bestLength) {
      bestStart = index;
      bestLength = end - index;
    }
    index = end;
  }
  if (bestStart < 0) return hextets.join(":");
  const before = hextets.slice(0, bestStart).join(":");
  const after = hextets.slice(bestStart + bestLength).join(":");
  if (!before && !after) return "::";
  if (!before) return `::${after}`;
  if (!after) return `${before}::`;
  return `${before}::${after}`;
}

export function cidrOperationWithIpaddr(rawCidr: string): DeveloperWebResult {
  const { address, prefix } = parseCidr(rawCidr);
  const hostBits = address.bits - prefix;
  const hostMask = (1n << BigInt(hostBits)) - 1n;
  const networkMask = ((1n << BigInt(address.bits)) - 1n) ^ hostMask;
  const network = address.value & networkMask;
  const last = network | hostMask;
  const addressCount = 1n << BigInt(hostBits);

  if (address.family === "IPv4") {
    const networkText = ipv4(network);
    const broadcast = ipv4(last);
    const hostStart = prefix <= 30 ? network + 1n : network;
    const hostEnd = prefix <= 30 ? last - 1n : last;
    return {
      valid: true, family: "IPv4", prefix, network: `${networkText}/${prefix}`,
      range: { first: networkText, last: broadcast }, addressCount: addressCount.toString(10),
      subnetMask: ipv4(networkMask), wildcardMask: ipv4(hostMask), broadcast,
      hostRange: {
        first: ipv4(hostStart), last: ipv4(hostEnd),
        count: (prefix <= 30 ? addressCount - 2n : addressCount).toString(10),
        semantics: prefix === 31 ? "RFC 3021 point-to-point endpoints" : prefix === 32 ? "single host route" : "network and broadcast excluded",
      },
    };
  }

  const networkText = ipv6(network);
  return {
    valid: true, family: "IPv6", prefix, network: `${networkText}/${prefix}`,
    range: { first: networkText, last: ipv6(last) },
    addressCount: addressCount.toString(10), broadcastSemantics: "not applicable to IPv6",
  };
}
