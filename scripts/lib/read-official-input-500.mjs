import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { gunzipSync } from "node:zlib";

/**
 * Frozen snapshots retain the official original pathname and SHA-256.
 * Textual inputs are stored as .gz; XLSX workbooks are already ZIP files.
 * Always return the *original bytes* to the existing pin/schema validators.
 * No network or runtime fetch is involved.
 */
export function readOfficialInput(root, originalPath) {
  const path = resolve(root, originalPath);
  return extname(originalPath) === ".xlsx"
    ? readFileSync(path)
    : gunzipSync(readFileSync(`${path}.gz`), { maxOutputLength: 16 * 1024 * 1024 });
}
