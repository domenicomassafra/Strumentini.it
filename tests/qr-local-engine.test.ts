import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { errorCorrection, generatorPolynomial, gfMultiply, gfPower, syndromesAreZero } from "../src/engines/qr/gf";
import { formatDistanceToNearestLegal, popcount15, readFormatInformation, reserveGeometry } from "../src/engines/qr/geometry";
import {
  QR_BYTE_CAPACITY,
  QR_EC_LEVEL,
  QR_MAX_BYTES,
  QR_VERSION_SPECS,
  dataCodewordCount,
  formatInformation,
} from "../src/engines/qr/spec";
import { buildDataCodewords, describeSymbol, generateQr, penalty, renderQrSvg, rasterPlan } from "../src/engines/qr/encode";
import { decodeQrMatrixValue, normalizeMatrixInput } from "../src/engines/qr/decode";
import { decodeQrFromRaster, QR_RASTER_MAX_PIXELS } from "../src/engines/qr/raster";
import { readQrMatrix, readQrPixels } from "../src/engines/qr";
import qrGeneratorModule, { buildWifiQrPayload } from "../src/tools/qr-generator/module";
import qrReaderModule from "../src/tools/qr-reader/module";

interface QrFixture {
  readonly vectors: readonly {
    readonly name: string;
    readonly payload: string;
    readonly expected_version: number | null;
    readonly expected_size: number | null;
    readonly expected_mode: string | null;
    readonly expected_error_correction: string | null;
    readonly expected_byte_length: number | null;
    readonly expected_rejection?: string;
  }[];
  readonly capacity: readonly {
    readonly version: number;
    readonly size: number;
    readonly total_codewords: number;
    readonly ec_codewords: number;
    readonly byte_capacity: number;
    readonly remainder_bits: number;
  }[];
  readonly raster: {
    readonly scales: readonly number[];
    readonly quiet_zone_modules: number;
    readonly rotations_readable: readonly number[];
    readonly mirrored_readable: boolean;
  };
  readonly format_information: {
    readonly legal_word_count: number;
    readonly minimum_distance: number;
    readonly correctable_bit_errors_per_copy: number;
  };
}

const FIXTURE = JSON.parse(
  readFileSync(new URL("../quality/fixtures/qr-contract/vectors.json", import.meta.url), "utf8"),
) as QrFixture;

const context = { defaults: {} } as const;

/** Renders a module matrix to RGBA pixels, mirroring what a browser would paint. */
function rasterOf(rows: readonly string[], scale: number, quietZone: number) {
  const size = rows.length;
  const width = (size + quietZone * 2) * scale;
  const data = new Uint8ClampedArray(width * width * 4).fill(255);
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (rows[row]?.[column] !== "1") continue;
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const index = (((row + quietZone) * scale + dy) * width + (column + quietZone) * scale + dx) * 4;
          data[index] = 0;
          data[index + 1] = 0;
          data[index + 2] = 0;
          data[index + 3] = 255;
        }
      }
    }
  }
  return { width, height: width, data };
}

function transformRaster(source: { width: number; height: number; data: Uint8ClampedArray }, quarterTurns: number, mirror: boolean) {
  const width = source.width;
  const out = new Uint8ClampedArray(width * source.height * 4);
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let nx = x;
      let ny = y;
      for (let turn = 0; turn < quarterTurns; turn += 1) {
        const previous = nx;
        nx = ny;
        ny = width - 1 - previous;
      }
      if (mirror) nx = width - 1 - nx;
      const from = (y * width + x) * 4;
      const to = (ny * width + nx) * 4;
      out[to] = source.data[from]!;
      out[to + 1] = source.data[from + 1]!;
      out[to + 2] = source.data[from + 2]!;
      out[to + 3] = 255;
    }
  }
  return { width, height: source.height, data: out };
}

describe("QR Galois field and error correction", () => {
  it("covers every non-zero field element in the exponent table", () => {
    const seen = new Set<number>();
    for (let exponent = 0; exponent < 255; exponent += 1) seen.add(gfPower(2, exponent));
    expect(seen.size).toBe(255);
    expect(seen.has(0)).toBe(false);
    expect(gfPower(2, 0)).toBe(1);
    expect(gfMultiply(0, 123)).toBe(0);
  });

  it("keeps the primitive element's cycle closed", () => {
    expect(gfPower(2, 255)).toBe(gfPower(2, 0));
    expect(gfMultiply(2, 2)).toBe(4);
    expect(gfMultiply(0x80, 2)).toBe(0x1d);
  });

  it("builds generator polynomials whose roots are exactly the declared powers", () => {
    for (const degree of [7, 10, 15, 20]) {
      const polynomial = generatorPolynomial(degree);
      expect(polynomial, `degree ${degree} length`).toHaveLength(degree + 1);
      expect(polynomial[0], `degree ${degree} monic`).toBe(1);
      for (let root = 0; root < degree; root += 1) {
        let accumulator = 0;
        for (const coefficient of polynomial) accumulator = gfMultiply(accumulator, gfPower(2, root)) ^ coefficient;
        expect(accumulator, `degree ${degree} root ${root}`).toBe(0);
      }
    }
  });

  it("produces codewords whose syndromes are zero, and rejects corrupted ones", () => {
    for (const spec of QR_VERSION_SPECS) {
      const data = buildDataCodewords(new TextEncoder().encode("prova".repeat(spec.version)), spec);
      const parity = errorCorrection(data, spec.ecCodewords);
      expect(parity, `version ${spec.version} parity length`).toHaveLength(spec.ecCodewords);
      expect(syndromesAreZero([...data, ...parity], spec.ecCodewords), `version ${spec.version}`).toBe(true);
      const corrupted = [...data, ...parity];
      corrupted[0] = corrupted[0]! ^ 1;
      expect(syndromesAreZero(corrupted, spec.ecCodewords), `version ${spec.version} corrupted`).toBe(false);
    }
  });

  it("refuses a field element outside the byte range", () => {
    expect(() => gfMultiply(256, 2)).toThrow("QR_GALOIS_RANGE");
    expect(() => gfMultiply(-1, 2)).toThrow("QR_GALOIS_RANGE");
  });
});

describe("QR version envelope", () => {
  it("matches the declared version table exactly", () => {
    for (const entry of FIXTURE.capacity) {
      const spec = QR_VERSION_SPECS.find((candidate) => candidate.version === entry.version);
      expect(spec, `version ${entry.version}`).toBeDefined();
      expect(spec!.size).toBe(entry.size);
      expect(spec!.totalCodewords).toBe(entry.total_codewords);
      expect(spec!.ecCodewords).toBe(entry.ec_codewords);
      expect(spec!.remainderBits).toBe(entry.remainder_bits);
      expect(QR_BYTE_CAPACITY[entry.version - 1]).toBe(entry.byte_capacity);
      expect(spec!.size).toBe(4 * entry.version + 17);
      expect(spec!.totalCodewords - spec!.ecCodewords).toBe(dataCodewordCount(spec!));
    }
  });

  it("derives the byte capacity from the data codewords rather than a copied table", () => {
    for (const spec of QR_VERSION_SPECS) {
      const capacity = Math.floor(((spec.totalCodewords - spec.ecCodewords) * 8 - 12) / 8);
      expect(QR_BYTE_CAPACITY[spec.version - 1]).toBe(capacity);
    }
    expect(QR_MAX_BYTES).toBe(78);
    expect(QR_EC_LEVEL).toBe("L");
  });
});

describe("QR format information", () => {
  it("recognises all 32 legal format words, not only the eight it can write", () => {
    const legal = new Set<number>();
    for (let data = 0; data < FIXTURE.format_information.legal_word_count; data += 1) {
      const word = formatInformationForLevel(data >> 3, data & 0b111);
      expect(formatDistanceToNearestLegal(word), `data bits ${data}`).toBe(0);
      legal.add(word);
    }
    expect(legal.size).toBe(FIXTURE.format_information.legal_word_count);

    const levelL = new Set<number>();
    for (let mask = 0; mask < 8; mask += 1) {
      const word = formatInformation(mask);
      expect(legal.has(word), `level L mask ${mask}`).toBe(true);
      expect((formatInformation(mask) ^ 0x5412) >>> 10, `mask ${mask} data bits`).toBe((1 << 3) | mask);
      levelL.add(word);
    }
    expect(levelL.size).toBe(8);
  });

  it("keeps the 32 legal words at the minimum distance BCH(15,5) guarantees", () => {
    const distance = (left: number, right: number): number => {
      let count = 0;
      for (let bit = 0; bit < 15; bit += 1) if ((((left ^ right) >>> bit) & 1) === 1) count += 1;
      return count;
    };
    const words = Array.from({ length: 32 }, (_value, data) => formatInformationForLevel(data >> 3, data & 0b111));
    let minimum = 15;
    for (let left = 0; left < words.length; left += 1) {
      for (let right = left + 1; right < words.length; right += 1) {
        minimum = Math.min(minimum, distance(words[left]!, words[right]!));
      }
    }
    expect(minimum).toBeGreaterThanOrEqual(FIXTURE.format_information.minimum_distance);
    expect(Math.floor(minimum / 2)).toBe(FIXTURE.format_information.correctable_bit_errors_per_copy);
  });

  it("reads the mask from the symbol's own format field", () => {
    for (const vector of FIXTURE.vectors) {
      if (vector.expected_rejection !== undefined) continue;
      const generated = generateQr(vector.payload);
      const read = readFormatInformation(generated.matrix.map((row) => [...row]), generated.size);
      expect(read, vector.name).not.toBeNull();
      expect(read!.mask, vector.name).toBe(generated.mask);
      expect(read!.copiesAgree, vector.name).toBe(true);
      expect(read!.repairDistance, vector.name).toBe(0);
      expect(read!.errorLevelBits, vector.name).toBe(1);
    }
  });

  it("recovers the format field from the intact copy when the other is damaged", () => {
    const generated = generateQr("formato parzialmente danneggiato");
    const positions = formatPositions(generated.size);
    const half = positions.length / 2;
    const modules = generated.matrix.map((row) => [...row]);
    for (const { x, y, bit } of positions.slice(0, half)) modules[y]![x] = ((generated.mask ^ (1 << bit) ^ 0x5412) >>> bit & 1) === 1;
    // Flip three modules of the first copy, which stays inside the correction radius.
    for (const { x, y } of positions.slice(0, 3)) modules[y]![x] = !modules[y]![x];
    const read = readFormatInformation(modules, generated.size);
    expect(read).not.toBeNull();
    expect(read!.mask).toBe(generated.mask);
    expect(read!.copiesAgree).toBe(false);
    expect(read!.repairDistance).toBeLessThanOrEqual(FIXTURE.format_information.correctable_bit_errors_per_copy);
  });

  it("refuses a format field no legal word is close enough to", () => {
    const generated = generateQr("formato illeggibile");
    const legal = Array.from({ length: 32 }, (_value, data) => formatInformationForLevel(data >> 3, data & 0b111));
    let unrecoverable = -1;
    for (let word = 0; word <= 0x7fff; word += 1) {
      const worst = Math.min(...legal.map((candidate) => popcount15(candidate ^ word)));
      if (worst > FIXTURE.format_information.correctable_bit_errors_per_copy) {
        unrecoverable = word;
        break;
      }
    }
    expect(unrecoverable).toBeGreaterThanOrEqual(0);
    const modules = generated.matrix.map((row) => [...row]);
    for (const { x, y, bit } of formatPositions(generated.size)) modules[y]![x] = ((unrecoverable >>> bit) & 1) === 1;
    expect(readFormatInformation(modules, generated.size)).toBeNull();
  });

  it("knows its correction radius", () => {
    const word = formatInformation(3);
    expect(formatDistanceToNearestLegal(word)).toBe(0);
    for (let bit = 0; bit < FIXTURE.format_information.correctable_bit_errors_per_copy; bit += 1) {
      expect(formatDistanceToNearestLegal(word ^ (1 << bit))).toBe(1);
    }
  });
});

describe("QR generation against the fixture", () => {
  it("matches every declared vector", () => {
    for (const vector of FIXTURE.vectors) {
      if (vector.expected_rejection !== undefined) {
        expect(() => generateQr(vector.payload), vector.name).toThrow(vector.expected_rejection);
        expect(() => qrGeneratorModule.run({ payload: vector.payload }, context), vector.name).toThrow(vector.expected_rejection);
        continue;
      }
      const generated = generateQr(vector.payload);
      expect(generated.version, vector.name).toBe(vector.expected_version);
      expect(generated.size, vector.name).toBe(vector.expected_size);
      expect(generated.mode, vector.name).toBe(vector.expected_mode);
      expect(generated.errorCorrection, vector.name).toBe(vector.expected_error_correction);
      expect(generated.byteLength, vector.name).toBe(vector.expected_byte_length);
      expect(generated.quietZone, vector.name).toBe(4);
      expect(generated.matrixRows.every((row) => row.length === generated.size), vector.name).toBe(true);
    }
  });

  it("builds a symbol whose geometry matches the specification", () => {
    for (const vector of FIXTURE.vectors) {
      if (vector.expected_rejection !== undefined) continue;
      const described = describeSymbol(generateQr(vector.payload).matrixRows);
      expect(described.finderPatternsAtCorners, vector.name).toBe(true);
      expect(described.timingPatternsAlternate, vector.name).toBe(true);
      expect(described.darkModulePresent, vector.name).toBe(true);
      expect(described.quietZoneRequired, vector.name).toBe(4);
      const remainder = QR_VERSION_SPECS.find((spec) => spec.version === described.version)!.remainderBits;
      expect(described.dataModules, vector.name).toBe(described.codewordBits + remainder);
    }
  });

  it("pads with the alternating pad codewords the specification names", () => {
    const spec = QR_VERSION_SPECS[0]!;
    // "a" is one byte, so the first codewords are mode 0100, count 1, then 0x61,
    // then the 4-bit terminator: 0100 00000001 01100001 0000.
    const codewords = buildDataCodewords(new TextEncoder().encode("a"), spec);
    expect(codewords.slice(0, 3)).toEqual([0x40, 0x16, 0x10]);
    expect(codewords).toHaveLength(spec.totalCodewords - spec.ecCodewords);
    const padding = codewords.slice(-6);
    expect(padding).toEqual([0xec, 0x11, 0xec, 0x11, 0xec, 0x11]);
  });

  it("keeps the mask it chose consistent with the lowest penalty score", () => {
    const generated = generateQr("https://esempio.it/campagna?utm_source=verifica");
    const spec = QR_VERSION_SPECS.find((candidate) => candidate.version === generated.version)!;
    const data = buildDataCodewords(new TextEncoder().encode(generated.payload), spec);
    expect([...data, ...errorCorrection(data, spec.ecCodewords)]).toHaveLength(spec.totalCodewords);
    const scores = Array.from({ length: 8 }, (_value, mask) => penalty(generateQr(generated.payload, { mask }).matrix));
    expect(generated.mask).toBe(scores.indexOf(Math.min(...scores)));
  });

  it("honours an explicit mask and refuses an impossible one", () => {
    expect(generateQr("ciao", { mask: 0 }).mask).toBe(0);
    expect(generateQr("ciao", { mask: 7 }).mask).toBe(7);
    expect(() => generateQr("ciao", { mask: 8 })).toThrow("QR_INVALID_MASK");
    expect(() => qrGeneratorModule.run({ payload: "ciao", mask: -1 }, context)).toThrow("QR_INVALID_MASK");
    expect(() => qrGeneratorModule.run({ payload: 7 }, context)).toThrow("QR_INPUT_REQUIRED");
    expect(qrGeneratorModule.run({ payload: "ciao" }, context)).toMatchObject({ byteLimit: QR_MAX_BYTES, bytesRemaining: QR_MAX_BYTES - 4 });
  });

  it("builds escaped Wi-Fi presets and round-trips them through the canonical QR engine", () => {
    const payload = buildWifiQrPayload({
      ssid: 'Caffè;Ospiti: "2G"',
      password: "p\\ass;word,uno:due",
      security: "WPA",
      hidden: true,
    });
    expect(payload).toBe('WIFI:T:WPA;S:Caffè\\;Ospiti\\: \\"2G\\";P:p\\\\ass\\;word\\,uno\\:due;H:true;;');
    const generated = qrGeneratorModule.run({ preset: "wifi", ssid: 'Caffè;Ospiti: "2G"', password: "p\\ass;word,uno:due", security: "WPA", hidden: true }, context) as { matrixRows: string[]; payload: string };
    expect(generated.payload).toBe(payload);
    expect(readQrMatrix(generated.matrixRows).payload).toBe(payload);
    expect(buildWifiQrPayload({ ssid: "Rete aperta", security: "nopass" })).toBe("WIFI:T:nopass;S:Rete aperta;;");
    expect(() => buildWifiQrPayload({ ssid: "", security: "WPA", password: "x" })).toThrow("QR_WIFI_SSID_REQUIRED");
    expect(() => buildWifiQrPayload({ ssid: "Rete", security: "WPA" })).toThrow("QR_WIFI_PASSWORD_REQUIRED");
  });

  it("rejects an empty payload rather than producing an empty symbol", () => {
    expect(() => generateQr("")).toThrow("QR_PAYLOAD_REQUIRED");
  });

  it("renders an SVG that carries its own matrix for the reader", () => {
    const generated = generateQr("https://esempio.it/?a=1");
    expect(generated.svg).toContain(`data-matrix="${generated.matrixRows.join(";")}"`);
    expect(generated.svg).toContain("<svg");
    const plan = rasterPlan(generated.matrixRows, 8);
    expect(plan.width).toBe((generated.size + 8) * 8);
    expect(plan.dark.length).toBe(generated.matrixRows.join("").split("1").length - 1);
    expect(renderQrSvg(generated.matrixRows, { scale: 4 })).toContain('viewBox="0 0 132 132"');
  });
});

describe("QR matrix decoding", () => {
  it("round-trips every fixture payload through the matrix decoder", () => {
    for (const vector of FIXTURE.vectors) {
      if (vector.expected_rejection !== undefined) continue;
      const generated = generateQr(vector.payload);
      const decoded = readQrMatrix(generated.matrixRows);
      expect(decoded.payload, vector.name).toBe(vector.payload);
      expect(decoded.version, vector.name).toBe(generated.version);
      expect(decoded.size, vector.name).toBe(generated.size);
      expect(decoded.mask, vector.name).toBe(generated.mask);
      expect(decoded.errorCorrectionVerified, vector.name).toBe(true);
      expect(decoded.maskFromFormatInformation, vector.name).toBe(true);
      expect(decoded.errorCorrection, vector.name).toBe("L");
    }
  });

  it("accepts the four documented input shapes", () => {
    const generated = generateQr("https://esempio.it/x");
    expect(decodeQrMatrixValue(generated.matrixRows).payload).toBe("https://esempio.it/x");
    expect(decodeQrMatrixValue(generated.svg).payload).toBe("https://esempio.it/x");
    expect(decodeQrMatrixValue(JSON.parse(JSON.stringify(generated.matrixRows))).payload).toBe("https://esempio.it/x");
    expect(decodeQrMatrixValue(generated.matrix).payload).toBe("https://esempio.it/x");
    expect(decodeQrMatrixValue(generated.matrix.map((row) => [...row].map((cell) => !!cell))).payload).toBe("https://esempio.it/x");
    expect(readQrMatrix(generated.svg).source).toBe("svg");
    expect(readQrMatrix(generated.matrixRows.join("\n")).source).toBe("rows");
    expect(readQrMatrix(generated.matrixRows).source).toBe("matrix");
  });

  it("rejects a matrix whose data no longer verifies", () => {
    for (const vector of FIXTURE.vectors) {
      if (vector.expected_rejection !== undefined) continue;
      const generated = generateQr(vector.payload);
      const rows = [...generated.matrixRows];
      const row = 12;
      const column = 12;
      rows[row] = rows[row]!.slice(0, column) + (rows[row]![column] === "1" ? "0" : "1") + rows[row]!.slice(column + 1);
      let failed = false;
      try {
        decodeQrMatrixValue(rows);
      } catch (error) {
        failed = (error as Error).message === "QR_ERROR_CORRECTION_FAILED";
      }
      expect(failed, `${vector.name} must not decode a flipped module silently`).toBe(true);
    }
  });

  it("rejects structurally impossible input", async () => {
    expect(() => normalizeMatrixInput("")).toThrow("QR_INPUT_REQUIRED");
    expect(() => normalizeMatrixInput("non è una matrice")).toThrow("QR_INVALID_INPUT");
    expect(() => normalizeMatrixInput("1010\n1010")).toThrow("QR_INVALID_MATRIX");
    expect(() => normalizeMatrixInput([["0", "1"], ["1"]])).toThrow("QR_INVALID_MATRIX");
    expect(() => normalizeMatrixInput("x".repeat(64 * 1024 + 1))).toThrow("QR_INVALID_INPUT");
    expect(() => decodeQrMatrixValue(new Array(1001).fill([]))).toThrow("QR_INVALID_MATRIX");
    await expect(qrReaderModule.run({ matrix: "" }, context)).rejects.toThrow("QR_INPUT_REQUIRED");
  });

  it("refuses a symbol that declares an error-correction level it does not implement", () => {
    const generated = generateQr("ciao");
    const modules = generated.matrix.map((row) => [...row]);
    void reserveGeometry(QR_VERSION_SPECS[generated.version - 1]!);
    // Rewrite the format field to level M (0b00) and see the decoder refuse.
    const levelM = formatInformationForLevel(0, generated.mask);
    for (const { x, y, bit } of formatPositions(generated.size)) {
      modules[y]![x] = ((levelM >>> bit) & 1) === 1;
    }
    expect(() => decodeQrMatrixValue(modules)).toThrow("QR_UNSUPPORTED_ERROR_CORRECTION_LEVEL");
  });
});

describe("QR raster decoding", () => {
  it("reads a rendered symbol at every declared scale", () => {
    for (const vector of FIXTURE.vectors) {
      if (vector.expected_rejection !== undefined) continue;
      const generated = generateQr(vector.payload);
      for (const scale of FIXTURE.raster.scales) {
        const decoded = decodeQrFromRaster(rasterOf(generated.matrixRows, scale, FIXTURE.raster.quiet_zone_modules));
        expect(decoded, `${vector.name} @${scale}`).not.toBeNull();
        expect(decoded!.payload, `${vector.name} @${scale}`).toBe(vector.payload);
        expect(decoded!.source).toBe("image");
        expect(decoded!.errorCorrectionVerified).toBe(true);
        expect(decoded!.maskFromFormatInformation).toBe(true);
      }
    }
  });

  it("reads a rotated symbol at every declared quarter turn", () => {
    const generated = generateQr("https://esempio.it/strumenti?q=rotazione");
    for (const degrees of FIXTURE.raster.rotations_readable) {
      const rotated = transformRaster(rasterOf(generated.matrixRows, 6, 4), degrees / 90, false);
      expect(decodeQrFromRaster(rotated)?.payload, `${degrees}°`).toBe(generated.payload);
    }
  });

  it("reads a mirrored symbol, which a pure coordinate comparison would miss", () => {
    const generated = generateQr("https://esempio.it/specchio");
    const mirrored = transformRaster(rasterOf(generated.matrixRows, 6, 4), 0, true);
    const decoded = decodeQrFromRaster(mirrored);
    expect(decoded?.payload).toBe(generated.payload);
    if (FIXTURE.raster.mirrored_readable) expect(decoded?.errorCorrectionVerified).toBe(true);
  });

  it("returns nothing for a canvas with no symbol rather than inventing text", () => {
    const blank = rasterOf(generateQr("a").matrixRows, 6, 4);
    const white = { width: blank.width, height: blank.height, data: new Uint8ClampedArray(blank.width * blank.height * 4).fill(255) };
    expect(decodeQrFromRaster(white)).toBeNull();

    const noise = new Uint8ClampedArray(blank.width * blank.height * 4);
    for (let index = 0; index < noise.length; index += 4) {
      const value = (index * 2_654_435_761) % 256;
      noise[index] = value;
      noise[index + 1] = value;
      noise[index + 2] = value;
      noise[index + 3] = 255;
    }
    expect(decodeQrFromRaster({ width: blank.width, height: blank.height, data: noise })).toBeNull();
  });

  it("does not read a symbol whose colours are inverted", () => {
    const base = rasterOf(generateQr("https://esempio.it/invertito").matrixRows, 8, 4);
    const inverted = Uint8ClampedArray.from(base.data);
    for (let index = 0; index < inverted.length; index += 4) {
      inverted[index] = 255 - inverted[index]!;
      inverted[index + 1] = 255 - inverted[index + 1]!;
      inverted[index + 2] = 255 - inverted[index + 2]!;
    }
    expect(decodeQrFromRaster({ width: base.width, height: base.height, data: inverted })).toBeNull();
  });

  it("refuses an image too small or too large to hold a symbol", () => {
    expect(() => decodeQrFromRaster({ width: 10, height: 10, data: new Uint8ClampedArray(400) })).toThrow("QR_IMAGE_TOO_SMALL");
    expect(() => decodeQrFromRaster({ width: 8_000, height: 8_000, data: new Uint8ClampedArray(1) })).toThrow("QR_IMAGE_TOO_LARGE");
    expect(QR_RASTER_MAX_PIXELS).toBe(4_000_000);
  });

  it("does not read a raster whose symbol was tampered with", () => {
    const generated = generateQr("https://esempio.it/tampered");
    const rows = [...generated.matrixRows];
    rows[14] = rows[14]!.slice(0, 8) + (rows[14]![8] === "1" ? "0" : "1") + rows[14]!.slice(9);
    expect(decodeQrFromRaster(rasterOf(rows, 6, 4))).toBeNull();
  });

  it("reaches the same verdict through the tool module and the public reader", async () => {
    const generated = generateQr("attraverso il modulo");
    const pixels = rasterOf(generated.matrixRows, 6, 4);
    const viaModule = await qrReaderModule.run({ pixels }, context) as { payload: string };
    expect(viaModule.payload).toBe("attraverso il modulo");
    expect(readQrPixels(pixels).payload).toBe("attraverso il modulo");
    await expect(qrReaderModule.run({ pixels: { width: pixels.width, height: pixels.height, data: "no" } }, context)).rejects.toThrow("QR_INVALID_INPUT");
  });
});

/** Level M format word, written directly so the decoder can be shown refusing it. */
function formatInformationForLevel(errorLevelBits: number, mask: number): number {
  const value = (errorLevelBits << 3) | mask;
  let remainder = value << 10;
  for (let degree = 14; degree >= 10; degree -= 1) {
    if ((remainder & (1 << degree)) !== 0) remainder ^= 0x537 << (degree - 10);
  }
  return ((value << 10) | remainder) ^ 0x5412;
}

function formatPositions(size: number) {
  const positions: { x: number; y: number; bit: number }[] = [];
  for (let bit = 0; bit <= 5; bit += 1) positions.push({ x: 8, y: bit, bit });
  positions.push({ x: 8, y: 7, bit: 6 }, { x: 8, y: 8, bit: 7 }, { x: 7, y: 8, bit: 8 });
  for (let bit = 9; bit <= 14; bit += 1) positions.push({ x: 14 - bit, y: 8, bit });
  for (let bit = 0; bit <= 7; bit += 1) positions.push({ x: size - 1 - bit, y: 8, bit });
  for (let bit = 8; bit <= 14; bit += 1) positions.push({ x: 8, y: size - 15 + bit, bit });
  return positions;
}
