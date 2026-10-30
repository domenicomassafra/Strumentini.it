import { assertInputSize, invalid, type DeveloperWebResult } from "./types";

function assertLegalHtmlUnicode(input: string): void {
  for (let index = 0; index < input.length; index += 1) {
    const unit = input.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = input.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff || Number.isNaN(next)) invalid("INVALID_HTML_ENTITY", "Unpaired Unicode surrogate in HTML text.");
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      invalid("INVALID_HTML_ENTITY", "Unpaired Unicode surrogate in HTML text.");
    }
  }
}

function assertLegalHtmlNumericReferences(input: string): void {
  // Check code points before he applies WHATWG replacement for illegal references.
  for (const match of input.matchAll(/&#(?:x([\da-f]+)|(\d+));?/giu)) {
    const hexadecimal = match[1] !== undefined;
    const digits = (match[1] ?? match[2]!).replace(/^0+/u, "") || "0";
    if (digits.length > (hexadecimal ? 6 : 7)) invalid("INVALID_HTML_ENTITY", "HTML numeric entity is outside the Unicode range.");
    const codePoint = Number.parseInt(digits, hexadecimal ? 16 : 10);
    if (codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
      invalid("INVALID_HTML_ENTITY", "HTML numeric entity is not a Unicode scalar value.");
    }
  }
}

export async function htmlEntityOperation(input: string, mode: string, numeric = false, signal?: AbortSignal): Promise<DeveloperWebResult> {
  assertInputSize(input);
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
  assertLegalHtmlUnicode(input);
  const isDecode = mode === "decode" || mode === "from-entities";
  if (isDecode) assertLegalHtmlNumericReferences(input);

  // he@2.0.0 is bundled in a separate chunk, only downloaded on first use.
  const { decode, encode } = await import("he");
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
  const value = isDecode
    ? decode(input, { isAttributeValue: false })
    : encode(input, { useNamedReferences: !numeric, decimal: true });
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
  return { valid: true, mode, value, warning: "La decodifica delle entità converte testo: non esegue una sanificazione HTML." } as DeveloperWebResult;
}
