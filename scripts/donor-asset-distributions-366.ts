/** Claimed npm packages for known checked-in donor paths.
 * These are namespace bindings, not proof of upstream bytes or legal rights.
 * Any unmatched vendored path must remain unverified in #366's audit. */
const DISTRIBUTIONS = [
  ["public/ocr-246/lang/", "@tesseract.js-data/ita"],
  ["public/ocr-246/core/", "tesseract.js-core"],
  ["public/ocr-246/vendor/", "tesseract.js"],
  ["src/engines/video/vendor/gifenc-mit-1.0.3/", "gifenc"],
] as const;

/** Same-origin model weights pinned to an immutable Hugging Face revision.
 * A model file is never inferred from its path alone: prefix, repository and
 * exact revision must match, and the file name must stay inside that prefix. */
const MODEL_DISTRIBUTIONS = [
  ["public/models/portrait-modnet/", "Xenova/modnet", "fa2fa546052fba4c08921230a26cc69a333fca12"],
] as const;

export function expectedAssetDistribution366(path: string): string | null {
  return DISTRIBUTIONS.find(([prefix]) => path.startsWith(prefix))?.[1] ?? null;
}

export function pinnedModelRevision366(
  path: string,
): { readonly repo: string; readonly revision: string; readonly prefix: string } | null {
  const entry = MODEL_DISTRIBUTIONS.find(([prefix]) => path.startsWith(prefix));
  if (!entry) return null;
  const [prefix, repo, revision] = entry;
  return { prefix, repo, revision };
}
