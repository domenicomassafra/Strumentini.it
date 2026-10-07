export const BARCODE_ENGINE_VERSION = "barcode-linear-v1";
export const CODE128B_MAX_CHARACTERS = 80;

export type BarcodeFormat = "ean13" | "code128b";
export type Ean13Mode = "generate" | "validate";

export interface LinearBarcodeResult {
  readonly format: BarcodeFormat;
  readonly value: string;
  readonly valid: boolean;
  readonly checksum: number;
  readonly expectedChecksum: number;
  readonly moduleBits: string;
  readonly quietZoneModules: number;
  readonly barHeightModules: number;
  readonly humanReadable: boolean;
  readonly svg: string | null;
  readonly svgWidthModules: number;
  readonly svgHeightModules: number;
  readonly supportedCharacters: string;
  readonly policySummary: string;
  readonly engineVersion: string;
}

const EAN_L = [
  "0001101", "0011001", "0010011", "0111101", "0100011",
  "0110001", "0101111", "0111011", "0110111", "0001011",
] as const;
const EAN_G = [
  "0100111", "0110011", "0011011", "0100001", "0011101",
  "0111001", "0000101", "0010001", "0001001", "0010111",
] as const;
const EAN_R = [
  "1110010", "1100110", "1101100", "1000010", "1011100",
  "1001110", "1010000", "1000100", "1001000", "1110100",
] as const;
const EAN_PARITY = [
  "LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG",
  "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL",
] as const;

/**
 * Code 128 symbol-character element widths, values 0..106.
 * Values 0..105 are six alternating bar/space widths totalling 11 modules;
 * stop (106) is seven widths totalling 13 modules.
 */
export const CODE128_WIDTHS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
] as const;

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function renderRuns(bits: string, xOffset: number, height: number): string {
  const rects: string[] = [];
  let index = 0;
  while (index < bits.length) {
    if (bits[index] === "0") {
      index += 1;
      continue;
    }
    const start = index;
    while (index < bits.length && bits[index] === "1") index += 1;
    rects.push(`<rect x="${xOffset + start}" y="0" width="${index - start}" height="${height}"/>`);
  }
  return rects.join("");
}

export function renderLinearBarcodeSvg(input: {
  readonly bits: string;
  readonly quietZoneModules: number;
  readonly barHeightModules: number;
  readonly humanReadableText?: string;
  readonly ariaLabel: string;
}): { readonly svg: string; readonly widthModules: number; readonly heightModules: number } {
  if (!/^[01]+$/u.test(input.bits)) throw new Error("BARCODE_INVALID_MODULES");
  if (!Number.isInteger(input.quietZoneModules) || input.quietZoneModules < 0) throw new Error("BARCODE_INVALID_QUIET_ZONE");
  if (!Number.isInteger(input.barHeightModules) || input.barHeightModules < 20 || input.barHeightModules > 200) throw new Error("BARCODE_INVALID_HEIGHT");
  const textHeight = input.humanReadableText === undefined ? 0 : 14;
  const widthModules = input.bits.length + input.quietZoneModules * 2;
  const heightModules = input.barHeightModules + textHeight;
  const text = input.humanReadableText === undefined
    ? ""
    : `<text x="${widthModules / 2}" y="${input.barHeightModules + 10}" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="9" fill="#000000">${escapeXml(input.humanReadableText)}</text>`;
  return {
    widthModules,
    heightModules,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthModules} ${heightModules}" width="${widthModules * 2}" height="${heightModules * 2}" role="img" aria-label="${escapeXml(input.ariaLabel)}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#ffffff"/><g fill="#000000">${renderRuns(input.bits, input.quietZoneModules, input.barHeightModules)}</g>${text}</svg>`,
  };
}

export function ean13CheckDigit(payload12: string): number {
  if (!/^\d{12}$/u.test(payload12)) throw new Error("EAN13_GENERATE_REQUIRES_12_DIGITS");
  let sum = 0;
  for (let index = 0; index < payload12.length; index += 1) {
    const digit = Number(payload12[index]);
    sum += digit * (index % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

export function ean13Modules(value13: string): string {
  if (!/^\d{13}$/u.test(value13)) throw new Error("EAN13_REQUIRES_13_DIGITS");
  const first = Number(value13[0]);
  const parity = EAN_PARITY[first]!;
  let bits = "101";
  for (let index = 1; index <= 6; index += 1) {
    const digit = Number(value13[index]);
    bits += parity[index - 1] === "L" ? EAN_L[digit] : EAN_G[digit];
  }
  bits += "01010";
  for (let index = 7; index <= 12; index += 1) bits += EAN_R[Number(value13[index])];
  bits += "101";
  return bits;
}

export function encodeEan13(input: string, mode: Ean13Mode, humanReadable = true): LinearBarcodeResult {
  const payload12 = mode === "generate"
    ? (() => {
        if (!/^\d{12}$/u.test(input)) throw new Error("EAN13_GENERATE_REQUIRES_12_DIGITS");
        return input;
      })()
    : (() => {
        if (!/^\d{13}$/u.test(input)) throw new Error("EAN13_VALIDATE_REQUIRES_13_DIGITS");
        return input.slice(0, 12);
      })();
  const expectedChecksum = ean13CheckDigit(payload12);
  const actualChecksum = mode === "generate" ? expectedChecksum : Number(input[12]);
  const value = mode === "generate" ? `${payload12}${expectedChecksum}` : input;
  const valid = actualChecksum === expectedChecksum;
  const moduleBits = valid ? ean13Modules(value) : "";
  const quietZoneModules = 12;
  const barHeightModules = 60;
  const rendered = valid
    ? renderLinearBarcodeSvg({
        bits: moduleBits,
        quietZoneModules,
        barHeightModules,
        ...(humanReadable ? { humanReadableText: value } : {}),
        ariaLabel: `EAN-13 ${value}`,
      })
    : null;
  return {
    format: "ean13",
    value,
    valid,
    checksum: actualChecksum,
    expectedChecksum,
    moduleBits,
    quietZoneModules,
    barHeightModules,
    humanReadable,
    svg: rendered?.svg ?? null,
    svgWidthModules: rendered?.widthModules ?? 0,
    svgHeightModules: rendered?.heightModules ?? 0,
    supportedCharacters: "digits 0-9 only",
    policySummary: mode === "generate"
      ? "EAN-13 generation accepts exactly 12 digits and appends the calculated GS1 check digit."
      : "EAN-13 validation accepts exactly 13 digits and compares the supplied final digit with the calculated GS1 check digit.",
    engineVersion: BARCODE_ENGINE_VERSION,
  };
}

export function code128BChecksum(dataCodes: readonly number[]): number {
  if (dataCodes.some((code) => !Number.isInteger(code) || code < 0 || code > 94)) throw new Error("CODE128B_INVALID_DATA_CODE");
  let sum = 104;
  for (let index = 0; index < dataCodes.length; index += 1) sum += dataCodes[index]! * (index + 1);
  return sum % 103;
}

function widthsToBits(widths: string): string {
  let black = true;
  let bits = "";
  for (const widthCharacter of widths) {
    const width = Number(widthCharacter);
    if (!Number.isInteger(width) || width < 1 || width > 4) throw new Error("CODE128_INVALID_PATTERN");
    bits += (black ? "1" : "0").repeat(width);
    black = !black;
  }
  return bits;
}

export function encodeCode128B(input: string, humanReadable = true): LinearBarcodeResult & { readonly codewords: readonly number[] } {
  if (input.length === 0) throw new Error("CODE128B_INPUT_REQUIRED");
  if (input.length > CODE128B_MAX_CHARACTERS) throw new Error("CODE128B_INPUT_TOO_LONG");
  const dataCodes: number[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const codePoint = input.codePointAt(index)!;
    if (codePoint < 32 || codePoint > 126) throw new Error(`CODE128B_UNSUPPORTED_CHARACTER:${index + 1}`);
    dataCodes.push(codePoint - 32);
  }
  const checksum = code128BChecksum(dataCodes);
  const codewords = [104, ...dataCodes, checksum, 106] as const;
  const moduleBits = codewords.map((codeword) => widthsToBits(CODE128_WIDTHS[codeword]!)).join("");
  const quietZoneModules = 10;
  const barHeightModules = 60;
  const rendered = renderLinearBarcodeSvg({
    bits: moduleBits,
    quietZoneModules,
    barHeightModules,
    ...(humanReadable ? { humanReadableText: input } : {}),
    ariaLabel: `Code 128 B ${input}`,
  });
  return {
    format: "code128b",
    value: input,
    valid: true,
    checksum,
    expectedChecksum: checksum,
    moduleBits,
    quietZoneModules,
    barHeightModules,
    humanReadable,
    svg: rendered.svg,
    svgWidthModules: rendered.widthModules,
    svgHeightModules: rendered.heightModules,
    supportedCharacters: "Code Set B subset: printable ASCII U+0020 through U+007E only; no FNC, no Code A/C switching, no GS1-128",
    policySummary: `Code 128 generation is deliberately limited to Code Set B printable ASCII 32-126, with at most ${CODE128B_MAX_CHARACTERS} characters. Start B, modulo-103 symbol check and stop are generated automatically.`,
    engineVersion: BARCODE_ENGINE_VERSION,
    codewords,
  };
}

