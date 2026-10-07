import { invalid, type DeveloperWebResult } from "./types";

const BASE_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const IPV4_BITS = 32;
const IPV6_BITS = 128;

export const MAX_BASE_INTEGER_DIGITS = 4096;

interface ParsedRadixInteger {
  readonly value: bigint;
  readonly digits: string;
  readonly sign: -1 | 1;
}

interface ParsedIpAddress {
  readonly family: "IPv4" | "IPv6";
  readonly bits: 32 | 128;
  readonly value: bigint;
}

function invalidWithContext(message: string, character?: number, context?: string): never {
  return invalid("INVALID_INPUT", message, {
    ...(character === undefined ? {} : { character }),
    ...(context === undefined ? {} : { context }),
  });
}

function parseBase(value: string, label: string): number {
  const text = value.trim();
  if (!/^\d+$/u.test(text)) invalidWithContext(`${label} must be an integer from 2 through 36.`, 1, `${label}: ${JSON.stringify(value)}`);
  const base = Number(text);
  if (!Number.isInteger(base) || base < 2 || base > 36) invalidWithContext(`${label} must be from 2 through 36.`, 1, `${label}: ${text}`);
  return base;
}

function digitValue(character: string): number {
  return BASE_ALPHABET.indexOf(character.toLowerCase());
}

export function parseBoundedRadixInteger(raw: string, base: number): ParsedRadixInteger {
  if (!Number.isInteger(base) || base < 2 || base > 36) invalidWithContext("Base must be from 2 through 36.", 1, `base: ${String(base)}`);
  const text = raw.trim();
  if (text === "") invalidWithContext("Integer input must not be empty.", 1, "empty integer");

  const first = text[0];
  const sign: -1 | 1 = first === "-" ? -1 : 1;
  const signLength = first === "-" || first === "+" ? 1 : 0;
  const digits = text.slice(signLength);
  if (digits === "") invalidWithContext("A sign must be followed by at least one digit.", signLength + 1, "missing digits");
  if (digits.length > MAX_BASE_INTEGER_DIGITS) {
    invalidWithContext(
      `Integer input exceeds the ${MAX_BASE_INTEGER_DIGITS}-digit local bound.`,
      signLength + MAX_BASE_INTEGER_DIGITS + 1,
      `maximum digits: ${MAX_BASE_INTEGER_DIGITS}`,
    );
  }

  let value = 0n;
  const radix = BigInt(base);
  for (let index = 0; index < digits.length; index += 1) {
    const character = digits[index] ?? "";
    const digit = digitValue(character);
    if (digit < 0 || digit >= base) {
      invalidWithContext(
        `Digit ${JSON.stringify(character)} is not valid in base ${base}.`,
        signLength + index + 1,
        `digit ${JSON.stringify(character)} at position ${signLength + index + 1}; base ${base}`,
      );
    }
    value = value * radix + BigInt(digit);
  }

  return {
    value: sign === -1 && value !== 0n ? -value : value,
    digits: digits.toLowerCase(),
    sign,
  };
}

export function formatRadixInteger(value: bigint, base: number): string {
  if (!Number.isInteger(base) || base < 2 || base > 36) invalidWithContext("Base must be from 2 through 36.", 1, `base: ${String(base)}`);
  if (value === 0n) return "0";
  const negative = value < 0n;
  let remaining = negative ? -value : value;
  const radix = BigInt(base);
  let output = "";
  while (remaining > 0n) {
    const digit = Number(remaining % radix);
    output = `${BASE_ALPHABET[digit] ?? ""}${output}`;
    remaining /= radix;
  }
  return negative ? `-${output}` : output;
}

export function baseConversionOperation(rawValue: string, rawFromBase: string, rawToBase: string): DeveloperWebResult {
  const fromBase = parseBase(rawFromBase, "Source base");
  const toBase = parseBase(rawToBase, "Target base");
  const parsed = parseBoundedRadixInteger(rawValue, fromBase);
  const output = formatRadixInteger(parsed.value, toBase);
  const canonicalInput = formatRadixInteger(parsed.value, fromBase);
  return {
    valid: true,
    fromBase,
    toBase,
    canonicalInput,
    output,
    decimal: parsed.value.toString(10),
    exact: true,
    inputDigitCount: parsed.digits.length,
    outputDigitCount: output.startsWith("-") ? output.length - 1 : output.length,
    signPolicy: "leading + or - accepted; canonical output omits + and normalizes negative zero to zero",
    bound: { maximumInputDigits: MAX_BASE_INTEGER_DIGITS },
    human: `${canonicalInput} (base ${fromBase}) = ${output} (base ${toBase})`,
    machine: { base: toBase, integer: output },
  };
}

function parseIpv4Address(input: string): ParsedIpAddress {
  const parts = input.split(".");
  if (parts.length !== 4) invalidWithContext("IPv4 address must contain exactly four decimal octets.", 1, "IPv4 requires four octets");
  let value = 0n;
  let character = 1;
  for (const part of parts) {
    if (!/^\d{1,3}$/u.test(part)) invalidWithContext("IPv4 octet is not a decimal integer.", character, `invalid IPv4 octet ${JSON.stringify(part)}`);
    const octet = Number(part);
    if (octet < 0 || octet > 255) invalidWithContext("IPv4 octet must be from 0 through 255.", character, `IPv4 octet out of range: ${part}`);
    value = (value << 8n) | BigInt(octet);
    character += part.length + 1;
  }
  return { family: "IPv4", bits: IPV4_BITS, value };
}

function ipv4FromBigInt(value: bigint): string {
  const octets: string[] = [];
  for (let shift = 24n; shift >= 0n; shift -= 8n) octets.push(((value >> shift) & 255n).toString(10));
  return octets.join(".");
}

function normalizeIpv4Tail(address: string): string {
  if (!address.includes(".")) return address;
  const lastColon = address.lastIndexOf(":");
  if (lastColon < 0) invalidWithContext("Embedded IPv4 syntax is only valid at the end of an IPv6 address.", 1, "invalid embedded IPv4");
  const tail = address.slice(lastColon + 1);
  const parsed = parseIpv4Address(tail);
  const high = ((parsed.value >> 16n) & 0xffffn).toString(16);
  const low = (parsed.value & 0xffffn).toString(16);
  return `${address.slice(0, lastColon + 1)}${high}:${low}`;
}

function parseIpv6Hextet(part: string, character: number): bigint {
  if (!/^[0-9a-fA-F]{1,4}$/u.test(part)) invalidWithContext("IPv6 hextets must contain one through four hexadecimal digits.", character, `invalid IPv6 hextet ${JSON.stringify(part)}`);
  return BigInt(`0x${part}`);
}

function parseIpv6Address(input: string): ParsedIpAddress {
  if (input.includes("%")) invalidWithContext("IPv6 zone identifiers are not part of a CIDR network address.", input.indexOf("%") + 1, "zone identifier is unsupported in CIDR input");
  const address = normalizeIpv4Tail(input);
  const firstDouble = address.indexOf("::");
  if (firstDouble >= 0 && address.indexOf("::", firstDouble + 2) >= 0) invalidWithContext("IPv6 address may contain at most one :: compression marker.", firstDouble + 3, "multiple :: markers");

  let parts: string[];
  if (firstDouble >= 0) {
    const leftText = address.slice(0, firstDouble);
    const rightText = address.slice(firstDouble + 2);
    const left = leftText === "" ? [] : leftText.split(":");
    const right = rightText === "" ? [] : rightText.split(":");
    if (left.length + right.length >= 8) invalidWithContext("IPv6 :: must compress at least one zero hextet.", firstDouble + 1, "too many IPv6 hextets");
    parts = [...left, ...Array.from({ length: 8 - left.length - right.length }, () => "0"), ...right];
  } else {
    parts = address.split(":");
    if (parts.length !== 8) invalidWithContext("IPv6 address without :: must contain exactly eight hextets.", 1, `found ${parts.length} hextets`);
  }

  if (parts.length !== 8) invalidWithContext("IPv6 address must expand to exactly eight hextets.", 1, `expanded hextets: ${parts.length}`);
  let value = 0n;
  let character = 1;
  for (const part of parts) {
    const hextet = parseIpv6Hextet(part, character);
    value = (value << 16n) | hextet;
    character += part.length + 1;
  }
  return { family: "IPv6", bits: IPV6_BITS, value };
}

function ipv6FromBigInt(value: bigint): string {
  const hextets: string[] = [];
  for (let shift = 112n; shift >= 0n; shift -= 16n) hextets.push(((value >> shift) & 0xffffn).toString(16));

  let bestStart = -1;
  let bestLength = 0;
  for (let index = 0; index < hextets.length;) {
    if (hextets[index] !== "0") {
      index += 1;
      continue;
    }
    let end = index;
    while (end < hextets.length && hextets[end] === "0") end += 1;
    const length = end - index;
    if (length >= 2 && length > bestLength) {
      bestStart = index;
      bestLength = length;
    }
    index = end;
  }
  if (bestStart < 0) return hextets.join(":");
  const before = hextets.slice(0, bestStart).join(":");
  const after = hextets.slice(bestStart + bestLength).join(":");
  if (before === "" && after === "") return "::";
  if (before === "") return `::${after}`;
  if (after === "") return `${before}::`;
  return `${before}::${after}`;
}

function parsePrefix(raw: string, bits: 32 | 128): number {
  if (!/^\d{1,3}$/u.test(raw)) invalidWithContext("CIDR prefix must be a decimal integer.", 1, `invalid prefix ${JSON.stringify(raw)}`);
  const prefix = Number(raw);
  if (prefix < 0 || prefix > bits) invalidWithContext(`CIDR prefix for ${bits === 32 ? "IPv4" : "IPv6"} must be from 0 through ${bits}.`, 1, `prefix /${prefix}`);
  return prefix;
}

function parseCidr(input: string): { readonly address: ParsedIpAddress; readonly prefix: number } {
  const text = input.trim();
  const slash = text.lastIndexOf("/");
  if (slash <= 0 || slash === text.length - 1 || text.indexOf("/") !== slash) invalidWithContext("CIDR input must contain one address/prefix separator.", Math.max(1, slash + 1), "expected address/prefix");
  const addressText = text.slice(0, slash);
  const address = addressText.includes(":") ? parseIpv6Address(addressText) : parseIpv4Address(addressText);
  return { address, prefix: parsePrefix(text.slice(slash + 1), address.bits) };
}

function addressMask(bits: 32 | 128, prefix: number): { readonly networkMask: bigint; readonly hostMask: bigint } {
  const hostBits = bits - prefix;
  const all = (1n << BigInt(bits)) - 1n;
  const hostMask = hostBits === 0 ? 0n : (1n << BigInt(hostBits)) - 1n;
  return { hostMask, networkMask: all ^ hostMask };
}

export function cidrOperation(rawCidr: string): DeveloperWebResult {
  const { address, prefix } = parseCidr(rawCidr);
  const { networkMask, hostMask } = addressMask(address.bits, prefix);
  const network = address.value & networkMask;
  const last = network | hostMask;
  const addressCount = 1n << BigInt(address.bits - prefix);

  if (address.family === "IPv4") {
    const networkText = ipv4FromBigInt(network);
    const broadcastText = ipv4FromBigInt(last);
    const subnetMask = ipv4FromBigInt(networkMask);
    const wildcardMask = ipv4FromBigInt(hostMask);
    const hostStart = prefix <= 30 ? network + 1n : network;
    const hostEnd = prefix <= 30 ? last - 1n : last;
    const usableHostCount = prefix <= 30 ? addressCount - 2n : addressCount;
    return {
      valid: true,
      family: "IPv4",
      prefix,
      network: `${networkText}/${prefix}`,
      range: { first: networkText, last: broadcastText },
      addressCount: addressCount.toString(10),
      subnetMask,
      wildcardMask,
      broadcast: broadcastText,
      hostRange: {
        first: ipv4FromBigInt(hostStart),
        last: ipv4FromBigInt(hostEnd),
        count: usableHostCount.toString(10),
        semantics: prefix === 31 ? "RFC 3021 point-to-point endpoints" : prefix === 32 ? "single host route" : "network and broadcast excluded",
      },
    };
  }

  const networkText = ipv6FromBigInt(network);
  return {
    valid: true,
    family: "IPv6",
    prefix,
    network: `${networkText}/${prefix}`,
    range: { first: networkText, last: ipv6FromBigInt(last) },
    addressCount: addressCount.toString(10),
    broadcastSemantics: "not applicable to IPv6",
  };
}

interface PermissionTriplet {
  readonly symbolic: string;
  readonly read: boolean;
  readonly write: boolean;
  readonly execute: boolean;
}

function tripletFromDigit(digit: number, symbolic: string): PermissionTriplet {
  return {
    symbolic,
    read: (digit & 4) !== 0,
    write: (digit & 2) !== 0,
    execute: (digit & 1) !== 0,
  };
}

function ordinarySymbol(digit: number): string {
  return `${(digit & 4) !== 0 ? "r" : "-"}${(digit & 2) !== 0 ? "w" : "-"}${(digit & 1) !== 0 ? "x" : "-"}`;
}

function applySpecialSymbol(base: string, kind: "setuid" | "setgid" | "sticky", active: boolean): string {
  if (!active) return base;
  const execute = base[2] === "x";
  const marker = kind === "sticky" ? (execute ? "t" : "T") : (execute ? "s" : "S");
  return `${base.slice(0, 2)}${marker}`;
}

function chmodFromOctal(input: string): DeveloperWebResult {
  if (!/^(?:[0-7]{3}|[0-7]{4})$/u.test(input)) invalidWithContext("Octal mode must contain three or four digits from 0 through 7.", 1, `invalid chmod octal ${JSON.stringify(input)}`);
  const digits = input.length === 3 ? `0${input}` : input;
  const special = Number(digits[0]);
  const ownerDigit = Number(digits[1]);
  const groupDigit = Number(digits[2]);
  const otherDigit = Number(digits[3]);
  const setuid = (special & 4) !== 0;
  const setgid = (special & 2) !== 0;
  const sticky = (special & 1) !== 0;
  const ownerSymbol = applySpecialSymbol(ordinarySymbol(ownerDigit), "setuid", setuid);
  const groupSymbol = applySpecialSymbol(ordinarySymbol(groupDigit), "setgid", setgid);
  const otherSymbol = applySpecialSymbol(ordinarySymbol(otherDigit), "sticky", sticky);
  const symbolic = `${ownerSymbol}${groupSymbol}${otherSymbol}`;
  const octal = special === 0 ? digits.slice(1) : digits;
  return {
    valid: true,
    octal,
    octalPadded: digits,
    symbolic,
    output: symbolic,
    permissions: {
      owner: tripletFromDigit(ownerDigit, ownerSymbol),
      group: tripletFromDigit(groupDigit, groupSymbol),
      other: tripletFromDigit(otherDigit, otherSymbol),
    },
    specialBits: { setuid, setgid, sticky },
    human: `owner=${ownerSymbol}; group=${groupSymbol}; other=${otherSymbol}`,
    machine: { octal, symbolic },
  };
}

function permissionDigit(read: string, write: string, execute: string, offset: number, specialKind: "setuid" | "setgid" | "sticky"): { readonly digit: number; readonly special: boolean } {
  if (read !== "r" && read !== "-") invalidWithContext("Permission read position must be r or -.", offset + 1, `invalid ${specialKind} read marker`);
  if (write !== "w" && write !== "-") invalidWithContext("Permission write position must be w or -.", offset + 2, `invalid ${specialKind} write marker`);
  const allowedExecute = specialKind === "sticky" ? new Set(["x", "t", "T", "-"]) : new Set(["x", "s", "S", "-"]);
  if (!allowedExecute.has(execute)) invalidWithContext("Permission execute position contains an invalid marker.", offset + 3, `invalid ${specialKind} execute marker ${JSON.stringify(execute)}`);
  const executeOn = execute === "x" || execute === "s" || execute === "t";
  return {
    digit: (read === "r" ? 4 : 0) + (write === "w" ? 2 : 0) + (executeOn ? 1 : 0),
    special: execute === "s" || execute === "S" || execute === "t" || execute === "T",
  };
}

function chmodFromSymbolic(input: string): DeveloperWebResult {
  if (input.length !== 9) invalidWithContext("Symbolic mode must contain exactly nine permission characters.", 1, `symbolic length ${input.length}`);
  const owner = permissionDigit(input[0] ?? "", input[1] ?? "", input[2] ?? "", 0, "setuid");
  const group = permissionDigit(input[3] ?? "", input[4] ?? "", input[5] ?? "", 3, "setgid");
  const other = permissionDigit(input[6] ?? "", input[7] ?? "", input[8] ?? "", 6, "sticky");
  const special = (owner.special ? 4 : 0) + (group.special ? 2 : 0) + (other.special ? 1 : 0);
  const digits = `${special}${owner.digit}${group.digit}${other.digit}`;
  return chmodFromOctal(special === 0 ? digits.slice(1) : digits);
}

export function chmodPermissionOperation(rawMode: string): DeveloperWebResult {
  const mode = rawMode.trim();
  if (/^\d+$/u.test(mode)) return chmodFromOctal(mode);
  return chmodFromSymbolic(mode);
}
