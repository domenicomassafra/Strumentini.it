/** Bounded container preflight for image handoffs. The consumer still decodes normally. */
const FORMATS = {
  "image/png": { format: "png", extension: /\.png$/iu },
  "image/jpeg": { format: "jpeg", extension: /\.(?:jpe?g)$/iu },
  "image/webp": { format: "webp", extension: /\.webp$/iu },
} as const;

export function imageFormat028(mime: string) {
  return FORMATS[mime as keyof typeof FORMATS];
}

export function isPngBytes(bytes: Uint8Array): boolean {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  return bytes.byteLength >= 45
    && signature.every((value, index) => bytes[index] === value)
    && bytes[8] === 0 && bytes[9] === 0 && bytes[10] === 0 && bytes[11] === 13
    && bytes[12] === 73 && bytes[13] === 72 && bytes[14] === 68 && bytes[15] === 82
    && bytes[16] !== undefined && bytes[20] !== undefined
    && bytes.subarray(16, 20).some((value) => value !== 0)
    && bytes.subarray(20, 24).some((value) => value !== 0)
    && bytes.slice(-12).every((value, index) => value === [0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130][index]);
}

export function hasImageSignature028(mime: string, bytes: Uint8Array): boolean {
  if (mime === "image/png") return isPngBytes(bytes);
  if (mime === "image/jpeg") return bytes.length >= 12 && bytes[0] === 0xff && bytes[1] === 0xd8
    && bytes[2] === 0xff && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  if (mime === "image/webp") {
    if (bytes.length < 20) return false;
    const ascii = (at: number, value: string) => [...value].every((ch, i) => bytes[at + i] === ch.charCodeAt(0));
    const declaredLength = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true) + 8;
    return ascii(0, "RIFF") && ascii(8, "WEBP") && declaredLength === bytes.length
      && (["VP8 ", "VP8L", "VP8X"] as const).some((tag) => ascii(12, tag));
  }
  return false;
}
