import { invalid, type DeveloperWebResult } from "./types";

const BASE_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export const MAX_BASE_INTEGER_DIGITS = 4096;

interface ParsedRadixInteger {
  readonly value: bigint;
  readonly digits: string;
  readonly sign: -1 | 1;
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

// Load the pinned MIT parser only when the CIDR route is invoked.
export async function cidrOperation(rawCidr: string, signal?: AbortSignal): Promise<DeveloperWebResult> {
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
  const { cidrOperationWithIpaddr } = await import("./cidr-ipaddr");
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
  const result = cidrOperationWithIpaddr(rawCidr);
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
  return result;
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
