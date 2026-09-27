export interface TextInspection {
  bytes: number;
  codeUnits: number;
  codePoints: number;
  words: number;
  lines: number;
}

export interface InvisibleCharacter {
  codePoint: string;
  offset: number;
  name: string;
}

const WORD = /[\p{L}\p{N}\p{M}]+(?:['’][\p{L}\p{N}\p{M}]+)*/gu;
const FORMAT_CHARACTER = /\p{Cf}/u;
const FORMAT_NAMES = new Map<number, string>([
  [0x00ad, "SOFT HYPHEN"],
  [0x200b, "ZERO WIDTH SPACE"],
  [0x200c, "ZERO WIDTH NON-JOINER"],
  [0x200d, "ZERO WIDTH JOINER"],
  [0x200e, "LEFT-TO-RIGHT MARK"],
  [0x200f, "RIGHT-TO-LEFT MARK"],
  [0xfeff, "ZERO WIDTH NO-BREAK SPACE"],
]);

export function inspectText(text: string): TextInspection {
  return {
    bytes: new TextEncoder().encode(text).byteLength,
    codeUnits: text.length,
    codePoints: Array.from(text).length,
    words: Array.from(text.matchAll(WORD)).length,
    lines: text.length === 0 ? 0 : text.split(/\r\n|\r|\n/u).length,
  };
}

export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n|\r/gu, "\n")
    .split("\n")
    .map((line) => line.replace(/[^\S\r\n]+/gu, " ").trim())
    .join("\n")
    .trim();
}

export function findInvisibleCharacters(text: string): InvisibleCharacter[] {
  const found: InvisibleCharacter[] = [];
  let offset = 0;
  for (const character of text) {
    if (FORMAT_CHARACTER.test(character)) {
      const value = character.codePointAt(0);
      if (value !== undefined) {
        found.push({
          codePoint: `U+${value.toString(16).toUpperCase().padStart(4, "0")}`,
          offset,
          name: FORMAT_NAMES.get(value) ?? "FORMAT CHARACTER",
        });
      }
    }
    offset += character.length;
  }
  return found;
}
