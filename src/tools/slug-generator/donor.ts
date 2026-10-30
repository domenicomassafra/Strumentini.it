import slugify from "@sindresorhus/slugify";
import { generateSlug, type SlugResult } from "../../engines/text-writing";

/** Keep Unicode-script slugs that the ASCII transliterator would erase or rename. */
const NON_LATIN_LETTER = /[\p{L}--\p{Script=Latin}]/v;

export function generateDonorSlug(value: unknown): SlugResult {
  // The original engine owns validation, input-size refusals and rollback semantics.
  const legacy = generateSlug(value);
  const input = value as { text: string; lowercase?: boolean; maxLength?: number | string };
  if (NON_LATIN_LETTER.test(input.text)) return legacy;

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
