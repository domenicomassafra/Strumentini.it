interface BitReader {
  readonly bytes: Uint8Array;
  offset: number;
  bitBuffer: number;
  bitCount: number;
}

interface HuffmanTable {
  readonly counts: Uint16Array;
  readonly symbols: Uint16Array;
}

const MAX_OUTPUT_BYTES = 50 * 1024 * 1024;
const LENGTH_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258] as const;
const LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0] as const;
const DISTANCE_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577] as const;
const DISTANCE_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13] as const;
const CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15] as const;

function readBits(reader: BitReader, count: number): number {
  while (reader.bitCount < count) {
    if (reader.offset >= reader.bytes.length) throw new Error("PDF_LIMIT: compressed stream ended unexpectedly");
    reader.bitBuffer |= (reader.bytes[reader.offset] ?? 0) << reader.bitCount;
    reader.offset += 1;
    reader.bitCount += 8;
  }
  const mask = count === 32 ? 0xffffffff : (1 << count) - 1;
  const value = reader.bitBuffer & mask;
  reader.bitBuffer = count === 32 ? 0 : reader.bitBuffer >>> count;
  reader.bitCount -= count;
  return value;
}

function alignReader(reader: BitReader): void {
  reader.bitBuffer = 0;
  reader.bitCount = 0;
}

function buildHuffman(lengths: ArrayLike<number>): HuffmanTable {
  const counts = new Uint16Array(16);
  for (let index = 0; index < lengths.length; index += 1) {
    const length = lengths[index] ?? 0;
    if (length < 0 || length > 15) throw new Error("MALFORMED_PDF: invalid Huffman code length");
    if (length > 0) counts[length] = (counts[length] ?? 0) + 1;
  }
  counts[0] = 0;
  const offsets = new Uint16Array(16);
  for (let length = 1; length < 15; length += 1) offsets[length + 1] = (offsets[length] ?? 0) + (counts[length] ?? 0);
  const symbols = new Uint16Array(lengths.length);
  for (let symbol = 0; symbol < lengths.length; symbol += 1) {
    const length = lengths[symbol] ?? 0;
    if (length === 0) continue;
    const offset = offsets[length] ?? 0;
    symbols[offset] = symbol;
    offsets[length] = offset + 1;
  }
  return { counts, symbols };
}

function decodeSymbol(reader: BitReader, table: HuffmanTable): number {
  let code = 0;
  let first = 0;
  let index = 0;
  for (let length = 1; length <= 15; length += 1) {
    code |= readBits(reader, 1);
    const count = table.counts[length] ?? 0;
    if (code - first < count) return table.symbols[index + code - first] ?? -1;
    index += count;
    first = (first + count) << 1;
    code <<= 1;
  }
  throw new Error("MALFORMED_PDF: invalid compressed Huffman code");
}

function fixedTables(): { readonly literals: HuffmanTable; readonly distances: HuffmanTable } {
  const literalLengths = new Uint8Array(288);
  literalLengths.fill(8, 0, 144);
  literalLengths.fill(9, 144, 256);
  literalLengths.fill(7, 256, 280);
  literalLengths.fill(8, 280, 288);
  return { literals: buildHuffman(literalLengths), distances: buildHuffman(new Uint8Array(32).fill(5)) };
}

function dynamicTables(reader: BitReader): { readonly literals: HuffmanTable; readonly distances: HuffmanTable } {
  const literalCount = readBits(reader, 5) + 257;
  const distanceCount = readBits(reader, 5) + 1;
  const codeLengthCount = readBits(reader, 4) + 4;
  const codeLengthLengths = new Uint8Array(19);
  for (let index = 0; index < codeLengthCount; index += 1) codeLengthLengths[CODE_LENGTH_ORDER[index] ?? 0] = readBits(reader, 3);
  const codeLengthTable = buildHuffman(codeLengthLengths);
  const lengths = new Uint8Array(literalCount + distanceCount);
  let index = 0;
  let previous = 0;
  while (index < lengths.length) {
    const symbol = decodeSymbol(reader, codeLengthTable);
    if (symbol < 0) throw new Error("MALFORMED_PDF: invalid code-length symbol");
    if (symbol < 16) {
      lengths[index] = symbol;
      previous = symbol;
      index += 1;
      continue;
    }
    let repeat = 0;
    let value = 0;
    if (symbol === 16) {
      if (index === 0) throw new Error("MALFORMED_PDF: repeat code has no previous length");
      repeat = readBits(reader, 2) + 3;
      value = previous;
    } else if (symbol === 17) {
      repeat = readBits(reader, 3) + 3;
    } else {
      repeat = readBits(reader, 7) + 11;
    }
    if (index + repeat > lengths.length) throw new Error("MALFORMED_PDF: code-length repeat exceeds table");
    for (let count = 0; count < repeat; count += 1) lengths[index + count] = value;
    index += repeat;
  }
  return { literals: buildHuffman(lengths.slice(0, literalCount)), distances: buildHuffman(lengths.slice(literalCount)) };
}

function appendBytes(output: number[], bytes: Uint8Array, start: number, length: number): void {
  if (length < 0 || start < 0 || start + length > bytes.length) throw new Error("MALFORMED_PDF: invalid stored block");
  for (let index = 0; index < length; index += 1) output.push(bytes[start + index] ?? 0);
}

function inflateRaw(reader: BitReader): Uint8Array {
  const output: number[] = [];
  let final = false;
  while (!final) {
    final = readBits(reader, 1) === 1;
    const type = readBits(reader, 2);
    if (type === 0) {
      alignReader(reader);
      if (reader.offset + 4 > reader.bytes.length) throw new Error("MALFORMED_PDF: truncated stored block");
      const length = (reader.bytes[reader.offset] ?? 0) | ((reader.bytes[reader.offset + 1] ?? 0) << 8);
      const complement = (reader.bytes[reader.offset + 2] ?? 0) | ((reader.bytes[reader.offset + 3] ?? 0) << 8);
      reader.offset += 4;
      if ((length ^ 0xffff) !== complement) throw new Error("MALFORMED_PDF: stored block length check failed");
      appendBytes(output, reader.bytes, reader.offset, length);
      reader.offset += length;
      if (output.length > MAX_OUTPUT_BYTES) throw new Error("PDF_LIMIT: decompressed stream exceeds the local limit");
      continue;
    }
    if (type === 3) throw new Error("MALFORMED_PDF: reserved compressed block type");
    const tables = type === 1 ? fixedTables() : dynamicTables(reader);
    while (true) {
      const symbol = decodeSymbol(reader, tables.literals);
      if (symbol < 0 || symbol > 285) throw new Error("MALFORMED_PDF: invalid literal/length symbol");
      if (symbol < 256) {
        output.push(symbol);
        if (output.length > MAX_OUTPUT_BYTES) throw new Error("PDF_LIMIT: decompressed stream exceeds the local limit");
        continue;
      }
      if (symbol === 256) break;
      const lengthIndex = symbol - 257;
      const length = (LENGTH_BASE[lengthIndex] ?? 0) + readBits(reader, LENGTH_EXTRA[lengthIndex] ?? 0);
      const distanceSymbol = decodeSymbol(reader, tables.distances);
      if (distanceSymbol < 0 || distanceSymbol >= DISTANCE_BASE.length) throw new Error("MALFORMED_PDF: invalid distance symbol");
      const distance = (DISTANCE_BASE[distanceSymbol] ?? 0) + readBits(reader, DISTANCE_EXTRA[distanceSymbol] ?? 0);
      if (distance > output.length) throw new Error("MALFORMED_PDF: distance exceeds output window");
      const start = output.length - distance;
      for (let index = 0; index < length; index += 1) output.push(output[start + index] ?? 0);
      if (output.length > MAX_OUTPUT_BYTES) throw new Error("PDF_LIMIT: decompressed stream exceeds the local limit");
    }
  }
  return Uint8Array.from(output);
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

export function inflateZlib(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 6) throw new Error("MALFORMED_PDF: truncated Flate stream");
  const cmf = bytes[0] ?? 0;
  const flg = bytes[1] ?? 0;
  if ((cmf & 0x0f) !== 8 || ((cmf << 8) | flg) % 31 !== 0) throw new Error("MALFORMED_PDF: unsupported Flate header");
  const reader: BitReader = { bytes, offset: 2, bitBuffer: 0, bitCount: 0 };
  const output = inflateRaw(reader);
  alignReader(reader);
  if (reader.offset + 4 <= bytes.length) {
    const expected = ((bytes[reader.offset] ?? 0) << 24) | ((bytes[reader.offset + 1] ?? 0) << 16) | ((bytes[reader.offset + 2] ?? 0) << 8) | (bytes[reader.offset + 3] ?? 0);
    const actual = adler32(output);
    if (expected >>> 0 !== actual) throw new Error("MALFORMED_PDF: Flate checksum failed");
  }
  return output;
}

export function inflatePdfStream(bytes: Uint8Array): Uint8Array {
  return inflateZlib(bytes);
}
