import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CODE128B_MAX_CHARACTERS,
  CODE128_WIDTHS,
  code128BChecksum,
  ean13CheckDigit,
  encodeCode128B,
  encodeEan13,
} from "../src/engines/barcode";
import barcodeGeneratorModule from "../src/tools/barcode-generator/module";
import barcodeGeneratorManifest from "../src/tools/barcode-generator/manifest";

const fixture = JSON.parse(readFileSync(new URL("../quality/fixtures/barcode-linear/vectors.json", import.meta.url), "utf8")) as {
  ean13: Array<{ id: string; payload12?: string; expected_check_digit: number; expected_value13?: string; value13?: string; expected_valid?: boolean }>;
  code128b: Array<{ id: string; text: string; expected_data_codes?: number[]; expected_checksum: number; expected_codewords?: number[]; expected_widths?: string[] }>;
  refusals: Array<{ input: string; reason: string }>;
};

const TEST_EAN_L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"] as const;
const TEST_EAN_G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"] as const;
const TEST_EAN_R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"] as const;
const TEST_EAN_PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"] as const;

const TEST_CODE128_WIDTHS = [
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

function svgModuleBits(svg: string, quietZone: number, encodedModules: number): string {
  const group = svg.match(/<g fill="#000000">([\s\S]*?)<\/g>/u)?.[1];
  if (group === undefined) throw new Error("test decoder: black-bar group missing");
  const bits = Array.from({ length: encodedModules }, () => "0");
  for (const match of group.matchAll(/<rect x="([0-9]+)" y="0" width="([0-9]+)" height="([0-9]+)"\/>/gu)) {
    const x = Number(match[1]) - quietZone;
    const width = Number(match[2]);
    if (x < 0 || x + width > encodedModules) throw new Error("test decoder: bar outside encoded region");
    for (let offset = 0; offset < width; offset += 1) bits[x + offset] = "1";
  }
  return bits.join("");
}

function independentEan13Decode(bits: string): string {
  if (bits.length !== 95 || !bits.startsWith("101") || bits.slice(45, 50) !== "01010" || !bits.endsWith("101")) throw new Error("test decoder: invalid EAN guards");
  let parity = "";
  let left = "";
  for (let index = 0; index < 6; index += 1) {
    const chunk = bits.slice(3 + index * 7, 10 + index * 7);
    const l = TEST_EAN_L.indexOf(chunk as never);
    const g = TEST_EAN_G.indexOf(chunk as never);
    if (l >= 0) { left += String(l); parity += "L"; }
    else if (g >= 0) { left += String(g); parity += "G"; }
    else throw new Error("test decoder: invalid EAN left digit");
  }
  const first = TEST_EAN_PARITY.indexOf(parity as never);
  if (first < 0) throw new Error("test decoder: invalid EAN parity");
  let right = "";
  for (let index = 0; index < 6; index += 1) {
    const chunk = bits.slice(50 + index * 7, 57 + index * 7);
    const digit = TEST_EAN_R.indexOf(chunk as never);
    if (digit < 0) throw new Error("test decoder: invalid EAN right digit");
    right += String(digit);
  }
  const value = `${first}${left}${right}`;
  const expected = (() => {
    let sum = 0;
    for (let index = 0; index < 12; index += 1) sum += Number(value[index]) * (index % 2 === 0 ? 1 : 3);
    return (10 - sum % 10) % 10;
  })();
  if (Number(value[12]) !== expected) throw new Error("test decoder: EAN checksum mismatch");
  return value;
}

function runWidths(bits: string): string {
  if (bits.length === 0 || bits[0] !== "1") throw new Error("test decoder: symbol must start with bar");
  const widths: number[] = [];
  let previous = bits[0];
  let count = 0;
  for (const bit of bits) {
    if (bit === previous) count += 1;
    else {
      widths.push(count);
      previous = bit;
      count = 1;
    }
  }
  widths.push(count);
  return widths.join("");
}

function independentCode128BDecode(bits: string): { text: string; checksum: number; codewords: number[] } {
  if (bits.length < 35 || (bits.length - 13) % 11 !== 0) throw new Error("test decoder: invalid Code 128 module length");
  const symbols: number[] = [];
  const regularCount = (bits.length - 13) / 11;
  for (let index = 0; index < regularCount; index += 1) {
    const widths = runWidths(bits.slice(index * 11, index * 11 + 11));
    const code = TEST_CODE128_WIDTHS.indexOf(widths as never);
    if (code < 0 || code === 106) throw new Error(`test decoder: unknown Code 128 symbol ${widths}`);
    symbols.push(code);
  }
  const stopWidths = runWidths(bits.slice(regularCount * 11));
  if (stopWidths !== TEST_CODE128_WIDTHS[106]) throw new Error("test decoder: stop mismatch");
  symbols.push(106);
  if (symbols[0] !== 104) throw new Error("test decoder: not Start B");
  if (symbols.length < 3) throw new Error("test decoder: missing checksum");
  const suppliedChecksum = symbols[symbols.length - 2]!;
  const dataCodes = symbols.slice(1, -2);
  let weighted = 104;
  dataCodes.forEach((code, index) => { weighted += code * (index + 1); });
  const expectedChecksum = weighted % 103;
  if (suppliedChecksum !== expectedChecksum) throw new Error("test decoder: Code 128 checksum mismatch");
  if (dataCodes.some((code) => code < 0 || code > 94)) throw new Error("test decoder: outside declared Code B subset");
  return {
    text: String.fromCharCode(...dataCodes.map((code) => code + 32)),
    checksum: suppliedChecksum,
    codewords: symbols,
  };
}

describe("ticket 204 barcode generator", () => {
  it("generates the GS1 ISBN-derived EAN-13 known vector and independently decodes SVG bars", () => {
    const known = fixture.ean13.find(({ id }) => id === "gs1-isbn-example")!;
    expect(ean13CheckDigit(known.payload12!)).toBe(known.expected_check_digit);
    const result = encodeEan13(known.payload12!, "generate", true);
    expect(result).toMatchObject({ value: known.expected_value13, checksum: 8, expectedChecksum: 8, valid: true });
    expect(result.moduleBits).toHaveLength(95);
    expect(result.svg).not.toBeNull();
    const reconstructed = svgModuleBits(result.svg!, result.quietZoneModules, result.moduleBits.length);
    expect(reconstructed).toBe(result.moduleBits);
    expect(independentEan13Decode(reconstructed)).toBe(known.expected_value13);
  });

  it("keeps EAN generate and validate modes strict, including leading-zero vectors", () => {
    const zeros = fixture.ean13.find(({ id }) => id === "all-zero-boundary")!;
    expect(encodeEan13(zeros.payload12!, "generate", false)).toMatchObject({ value: zeros.expected_value13, humanReadable: false, valid: true });
    expect(encodeEan13(zeros.expected_value13!, "validate", true).valid).toBe(true);
    const invalid = fixture.ean13.find(({ id }) => id === "invalid-check-digit")!;
    const rejected = encodeEan13(invalid.value13!, "validate", true);
    expect(rejected).toMatchObject({ valid: false, expectedChecksum: invalid.expected_check_digit, svg: null, moduleBits: "" });
    expect(() => encodeEan13("97804713842", "generate")).toThrow(/12_DIGITS/u);
    expect(() => encodeEan13("9780471384298 ", "validate")).toThrow(/13_DIGITS/u);
    expect(() => encodeEan13("97804713842A8", "validate")).toThrow(/13_DIGITS/u);
  });

  it("matches hand-worked Code 128 B codewords and independently decodes rendered SVG geometry", () => {
    const known = fixture.code128b.find(({ id }) => id === "ascii-ab12")!;
    const result = encodeCode128B(known.text, true);
    expect(result.checksum).toBe(known.expected_checksum);
    expect(result.codewords).toEqual(known.expected_codewords);
    expect(result.codewords.map((codeword) => TEST_CODE128_WIDTHS[codeword])).toEqual(known.expected_widths);
    const reconstructed = svgModuleBits(result.svg!, result.quietZoneModules, result.moduleBits.length);
    expect(reconstructed).toBe(result.moduleBits);
    expect(independentCode128BDecode(reconstructed)).toEqual({ text: known.text, checksum: known.expected_checksum, codewords: known.expected_codewords });
  });

  it("round-trips representative printable ASCII through the independent Code 128 B decoder", () => {
    for (const text of ["Hello, World!", "CODE128", " !\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~", "aZ09 /-._"]) {
      const result = encodeCode128B(text, false);
      const reconstructed = svgModuleBits(result.svg!, result.quietZoneModules, result.moduleBits.length);
      expect(independentCode128BDecode(reconstructed).text).toBe(text);
      expect(result.svg).not.toContain("<text");
    }
  });

  it("refuses every character class outside the deliberately documented Code 128 B subset", () => {
    for (const refusal of fixture.refusals) expect(() => encodeCode128B(refusal.input)).toThrow(/CODE128B_UNSUPPORTED_CHARACTER/u);
    expect(() => encodeCode128B("")).toThrow(/INPUT_REQUIRED/u);
    expect(() => encodeCode128B("A".repeat(CODE128B_MAX_CHARACTERS + 1))).toThrow(/INPUT_TOO_LONG/u);
  });

  it("escapes human-readable SVG text instead of treating supported ASCII as markup", () => {
    const result = encodeCode128B('<&" barcode >', true);
    expect(result.svg).toContain("&lt;&amp;&quot; barcode &gt;");
    expect(result.svg).not.toContain("<script");
    expect(result.svg).not.toContain("href=");
  });

  it("keeps the production Code 128 table structurally valid and agrees with published sample rows", () => {
    expect(CODE128_WIDTHS).toHaveLength(107);
    for (let code = 0; code < 106; code += 1) {
      const widths = CODE128_WIDTHS[code]!;
      expect(widths).toMatch(/^[1-4]{6}$/u);
      expect([...widths].reduce((sum, value) => sum + Number(value), 0), String(code)).toBe(11);
      expect((Number(widths[0]) + Number(widths[2]) + Number(widths[4])) % 2, `bar parity ${code}`).toBe(0);
      expect((Number(widths[1]) + Number(widths[3]) + Number(widths[5])) % 2, `space parity ${code}`).toBe(1);
    }
    expect(CODE128_WIDTHS[0]).toBe("212222");
    expect(CODE128_WIDTHS[91]).toBe("412121");
    expect(CODE128_WIDTHS[92]).toBe("111143");
    expect(CODE128_WIDTHS[104]).toBe("211214");
    expect(CODE128_WIDTHS[105]).toBe("211232");
    expect(CODE128_WIDTHS[106]).toBe("2331112");
    expect([...CODE128_WIDTHS[106]].reduce((sum, value) => sum + Number(value), 0)).toBe(13);
  });

  it("computes Code 128 B modulo-103 independently from the module entry point", () => {
    const known = fixture.code128b.find(({ id }) => id === "ascii-mixed")!;
    const codes = [...known.text].map((character) => character.charCodeAt(0) - 32);
    let independent = 104;
    codes.forEach((code, index) => { independent += code * (index + 1); });
    expect(independent % 103).toBe(known.expected_checksum);
    expect(code128BChecksum(codes)).toBe(known.expected_checksum);
  });

  it("exposes only local deterministic generation in the manifest and module refuses Code 128 validate mode", () => {
    expect(barcodeGeneratorManifest).toMatchObject({
      id: "barcode-generator",
      runtime: { location: "LOCAL", network: "forbidden" },
      deterministic: true,
      gold: { oracleEntryId: "cand-246", fixtureFamilies: ["barcode-linear"] },
    });
    expect(() => barcodeGeneratorModule.run({ format: "code128b", mode: "validate", value: "ABC" }, { defaults: {} })).toThrow(/CODE128B_VALIDATE_UNSUPPORTED/u);
    expect(() => barcodeGeneratorModule.run({ format: "ean13", mode: "generate", value: "978047138429", humanReadable: "yes" }, { defaults: {} })).toThrow(/BARCODE_HUMAN_READABLE_INVALID/u);
  });
});
