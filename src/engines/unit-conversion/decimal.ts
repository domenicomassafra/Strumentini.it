export interface Rational {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

const MAX_DECIMAL_DIGITS = 80;
export const RESULT_DECIMAL_PLACES = 12;
const DECIMAL_PATTERN = /^([+-]?)(\d+)(?:[.,](\d+))?$/u;

function gcd(left: bigint, right: bigint): bigint {
  let first = left < 0n ? -left : left;
  let second = right < 0n ? -right : right;
  while (second !== 0n) [first, second] = [second, first % second];
  return first === 0n ? 1n : first;
}

export function rational(numerator: bigint, denominator: bigint): Rational {
  if (denominator === 0n) throw new Error("INVALID_DENOMINATOR");
  const sign = denominator < 0n ? -1n : 1n;
  const divisor = gcd(numerator, denominator);
  return {
    numerator: numerator * sign / divisor,
    denominator: denominator * sign / divisor,
  };
}

export function add(left: Rational, right: Rational): Rational {
  return rational(left.numerator * right.denominator + right.numerator * left.denominator, left.denominator * right.denominator);
}

export function subtract(left: Rational, right: Rational): Rational {
  return rational(left.numerator * right.denominator - right.numerator * left.denominator, left.denominator * right.denominator);
}

export function multiply(left: Rational, right: Rational): Rational {
  return rational(left.numerator * right.numerator, left.denominator * right.denominator);
}

export function divide(left: Rational, right: Rational, code = "INVALID_DENOMINATOR"): Rational {
  if (right.numerator === 0n) throw new Error(code);
  return rational(left.numerator * right.denominator, left.denominator * right.numerator);
}

export function compareZero(value: Rational): -1 | 0 | 1 {
  return value.numerator === 0n ? 0 : value.numerator < 0n ? -1 : 1;
}

export function parseDecimal(value: string | number, code = "INVALID_DECIMAL"): Rational {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(code);
    const text = String(value);
    const scientific = /^(-?)(\d+)(?:\.(\d+))?e([+-]?\d+)$/u.exec(text);
    if (scientific === null) return parseDecimal(text, code);
    const sign = scientific[1] ?? "";
    const whole = scientific[2]!;
    const fraction = scientific[3] ?? "";
    const digits = `${whole}${fraction}`;
    const point = whole.length + Number(scientific[4]);
    const expanded = point <= 0
      ? `0.${"0".repeat(-point)}${digits}`
      : point >= digits.length
        ? `${digits}${"0".repeat(point - digits.length)}`
        : `${digits.slice(0, point)}.${digits.slice(point)}`;
    return parseDecimal(`${sign}${expanded}`, code);
  }
  const text = value.trim();
  const match = DECIMAL_PATTERN.exec(text);
  if (match === null) throw new Error(code);
  const whole = match[2] ?? "";
  const fraction = match[3] ?? "";
  if (whole.length + fraction.length > MAX_DECIMAL_DIGITS) throw new Error("VALUE_OUT_OF_RANGE");
  const sign = match[1] === "-" ? -1n : 1n;
  return rational(sign * BigInt(`${whole}${fraction}` || "0"), 10n ** BigInt(fraction.length));
}

export function parseScale(value: string): Rational {
  const slash = value.indexOf("/");
  if (slash === -1) return parseDecimal(value, "INVALID_UNIT_SCALE");
  return rational(BigInt(value.slice(0, slash)), BigInt(value.slice(slash + 1)));
}

export function formatRounded(value: Rational, decimalPlaces = RESULT_DECIMAL_PLACES): string {
  const negative = value.numerator < 0n;
  const numerator = negative ? -value.numerator : value.numerator;
  const scale = 10n ** BigInt(decimalPlaces);
  const scaled = numerator * scale;
  let quotient = scaled / value.denominator;
  const remainder = scaled % value.denominator;
  if (remainder * 2n >= value.denominator) quotient += 1n;
  const whole = quotient / scale;
  const fraction = (quotient % scale).toString().padStart(decimalPlaces, "0").replace(/0+$/u, "");
  const sign = negative && quotient !== 0n ? "-" : "";
  return `${sign}${whole}${fraction === "" ? "" : `.${fraction}`}`;
}

export function rationalToNumber(value: Rational, code = "VALUE_OUT_OF_RANGE"): number {
  const result = Number(value.numerator) / Number(value.denominator);
  if (!Number.isFinite(result)) throw new Error(code);
  return result;
}

export function numberToDisplay(value: number, decimalPlaces = RESULT_DECIMAL_PLACES): string {
  if (!Number.isFinite(value)) throw new Error("VALUE_OUT_OF_RANGE");
  return value.toFixed(decimalPlaces).replace(/\.0+$/u, "").replace(/(\.\d*?)0+$/u, "$1");
}
