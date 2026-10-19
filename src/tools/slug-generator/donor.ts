import slugify from "@sindresorhus/slugify";
import { generateSlug, type SlugResult } from "../../engines/text-writing";

const LETTER = /\p{L}/u;
const LATIN = /\p{Script=Latin}/u;

/** Keep Unicode-script slugs that the ASCII transliterator would erase or rename. */
function containsNonLatinLetters(text: string): boolean {
  if (!/[^\x00-\x7f]/u.test(text)) return false;
  for (const character of text) {
    if (LETTER.test(character) && !LATIN.test(character)) return true;
  }
  return false;
}

export function generateDonorSlug(value: unknown): SlugResult {
  // The original engine owns validation, input-size refusals and rollback semantics.
  const legacy = generateSlug(value);
  const input = value as { text: string; lowercase?: boolean; maxLength?: number | string };
  if (containsNonLatinLetters(input.text)) return legacy;

  // Preserve existing punctuation and NFKD semantics; donor adds transliteration
  // for Latin letters that NFKD cannot decompose (ß, æ, œ, ø, ł, ...).
  const normalized = input.text.normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/['’]/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ");
  let slug = slugify(normalized, {
    separator: legacy.separator,
    lowercase: input.lowercase !== false,
    decamelize: false,
  });
  const maxLength = input.maxLength === undefined ? 0 : Number(input.maxLength);
  const codePoints = Array.from(slug);
  const truncated = maxLength > 0 && codePoints.length > maxLength;
  if (truncated) slug = codePoints.slice(0, maxLength).join("").replace(/[-_]$/u, "");
  return { ...legacy, slug, text: slug, truncated };
}
