export type DigestAlgorithm = "SHA-256" | "SHA-384" | "SHA-512";

export function base64EncodeBytes(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(
      offset,
      Math.min(offset + chunkSize, bytes.length),
    );
    binary += Array.from(chunk, (byte) => String.fromCharCode(byte)).join("");
  }
  return btoa(binary);
}

export function base64DecodeBytes(encoded: string): Uint8Array {
  try {
    const binary = atob(encoded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new Error("INVALID_BASE64");
  }
}

export function base64EncodeUtf8(text: string): string {
  return base64EncodeBytes(new TextEncoder().encode(text));
}

export function base64DecodeUtf8(encoded: string): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(
      base64DecodeBytes(encoded),
    );
  } catch {
    throw new Error("INVALID_UTF8_BASE64");
  }
}

function asBytes(input: string | Uint8Array): Uint8Array {
  return typeof input === "string" ? new TextEncoder().encode(input) : input;
}

export async function digestHex(
  input: string | Uint8Array,
  algorithm: DigestAlgorithm = "SHA-256",
): Promise<string> {
  const bytes = Uint8Array.from(asBytes(input));
  const digest = await crypto.subtle.digest(algorithm, bytes.buffer);
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function verifyDigestHex(
  input: string | Uint8Array,
  expectedHex: string,
  algorithm: DigestAlgorithm = "SHA-256",
): Promise<boolean> {
  if (!/^[0-9a-f]+$/iu.test(expectedHex)) return false;
  return (await digestHex(input, algorithm)) === expectedHex.toLowerCase();
}
