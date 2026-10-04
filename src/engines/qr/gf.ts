/*
 * GF(256) arithmetic for QR error correction.
 *
 * ISO/IEC 18004 clause 8.5.1 fixes the field as GF(2^8) with primitive
 * polynomial 0x11D and primitive element α = 2. Everything here is derived
 * from those two facts, never from a table copied out of the standard, so the
 * numbers can be re-derived and re-checked by any reader of the code.
 */

const FIELD_SIZE = 255;
const PRIMITIVE = 0x11d;

// EXP holds α^i for i in [0, 255) plus a second cycle so products can index it
// with the plain sum of two exponents. LOG must be addressable for every
// non-zero field element, i.e. 0x00..0xFF inclusive — 256 entries, not 255.
const EXP = new Uint8Array(FIELD_SIZE * 2);
const LOG = new Uint8Array(FIELD_SIZE + 1);

(() => {
  let value = 1;
  for (let exponent = 0; exponent < FIELD_SIZE; exponent += 1) {
    EXP[exponent] = value;
    LOG[value] = exponent;
    value <<= 1;
    if ((value & 0x100) !== 0) value ^= PRIMITIVE;
  }
  for (let exponent = FIELD_SIZE; exponent < EXP.length; exponent += 1) EXP[exponent] = EXP[exponent - FIELD_SIZE] ?? 0;
})();

export function gfMultiply(left: number, right: number): number {
  if (left === 0 || right === 0) return 0;
  if (left < 0 || left > 255 || right < 0 || right > 255) throw new Error("QR_GALOIS_RANGE");
  return EXP[(LOG[left] ?? 0) + (LOG[right] ?? 0)] ?? 0;
}

export function gfPower(value: number, exponent: number): number {
  if (exponent === 0) return 1;
  if (value === 0) return 0;
  return EXP[(LOG[value] ?? 0) * exponent % FIELD_SIZE] ?? 0;
}

/** g(x) = ∏(x − α^i) for i in [0, degree), highest-order coefficient first. */
export function generatorPolynomial(degree: number): number[] {
  if (!Number.isInteger(degree) || degree < 1 || degree > FIELD_SIZE) throw new Error("QR_EC_DEGREE");
  let polynomial = [1];
  for (let index = 0; index < degree; index += 1) {
    const next = new Array<number>(polynomial.length + 1).fill(0);
    for (let position = 0; position < polynomial.length; position += 1) {
      next[position] = (next[position] ?? 0) ^ (polynomial[position] ?? 0);
      next[position + 1] = (next[position + 1] ?? 0) ^ gfMultiply(polynomial[position] ?? 0, gfPower(2, index));
    }
    polynomial = next;
  }
  return polynomial;
}

/** Reed–Solomon error correction codewords for one block. */
export function errorCorrection(data: readonly number[], degree: number): number[] {
  const generator = generatorPolynomial(degree);
  const work = [...data, ...new Array<number>(degree).fill(0)];
  for (let index = 0; index < data.length; index += 1) {
    const factor = work[index] ?? 0;
    if (factor === 0) continue;
    for (let offset = 0; offset <= degree; offset += 1) {
      work[index + offset] = (work[index + offset] ?? 0) ^ gfMultiply(generator[offset] ?? 0, factor);
    }
  }
  return work.slice(-degree);
}

/**
 * True when every root of g(x) is also a root of the received codeword
 * polynomial, i.e. the block is a valid Reed–Solomon codeword and carries no
 * detectable error. This is the check that separates "my decoder read some
 * bytes" from "my decoder read the bytes the encoder wrote".
 */
export function syndromesAreZero(codewords: readonly number[], degree: number): boolean {
  if (codewords.length === 0) return false;
  for (let root = 0; root < degree; root += 1) {
    let accumulator = 0;
    for (const codeword of codewords) accumulator = gfMultiply(accumulator, gfPower(2, root)) ^ codeword;
    if (accumulator !== 0) return false;
  }
  return true;
}