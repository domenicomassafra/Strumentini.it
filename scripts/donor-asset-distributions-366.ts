/** Claimed npm packages for known checked-in donor paths.
 * These are namespace bindings, not proof of upstream bytes or legal rights.
 * Any unmatched vendored path must remain unverified in #366's audit. */
const DISTRIBUTIONS = [
  ["public/ocr-246/lang/", "@tesseract.js-data/ita"],
  ["public/ocr-246/core/", "tesseract.js-core"],
  ["public/ocr-246/vendor/", "tesseract.js"],
  ["src/engines/video/vendor/gifenc-mit-1.0.3/", "gifenc"],
] as const;

export function expectedAssetDistribution366(path: string): string | null {
  return DISTRIBUTIONS.find(([prefix]) => path.startsWith(prefix))?.[1] ?? null;
}
