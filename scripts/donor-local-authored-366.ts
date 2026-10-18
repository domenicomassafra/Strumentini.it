/** Exact first-party evidence: Git source commit and blob (SHA-1) plus
 * the separate SHA-256 asset register. Only these four files are authored
 * locally; nothing in this list grants rights over adjacent donor payloads.
 * The historical commit:path relation was recorded from Git, but is not
 * reauthenticated in shallow CI checkouts. Blob/content identity is checked;
 * neither commit-tree membership nor legal ownership is certified here. */
import { createHash } from "node:crypto";

const GIT_PINS: ReadonlyMap<string, readonly [string, string]> = new Map([
  ["src/engines/pdf/vendor/pdfstudio/PROVENANCE.md",
    ["c0f099557839b377471f4321edd0f87106a66c9d", "4bb455d6cb1ebca50a06d7f65a37ba2711e894e7"]],
  ["src/engines/video/vendor/gifenc-mit-1.0.3/README.md",
    ["9b394fdfbf4d37bf54678bba762b79e7c66b3304", "06cac3d38f9646465516b05b18a572d57a67c39b"]],
  ["src/engines/video/vendor/gifenc-mit-1.0.3/index.d.mts",
    ["9b394fdfbf4d37bf54678bba762b79e7c66b3304", "e11bd8fec69d3067fc6edec7a9a95e5607387628"]],
  ["src/engines/video/vendor/mediabunny-mpl-1.61.3/README.md",
    ["d1be7c10122c8103bcbba9e179eda3640b1b2d04", "15d62331471498f7bd3f3674682d04195c6e2c58"]],
] as const);

export function isLocalAuthored366(path: string): boolean {
  return GIT_PINS.has(path);
}

export function verifyLocalAuthored366(
  asset: { path: string; license: string; version: string; source: string },
  bytes: Buffer,
): boolean {
  const pin = GIT_PINS.get(asset.path);
  if (!pin || asset.license !== "LOCAL_AUTHORED" || asset.version !== "GIT" ||
    asset.source !== `git:${pin[0]}:${pin[1]}`) return false;
  const gitBlob = createHash("sha1")
    .update(`blob ${bytes.byteLength}\0`).update(bytes).digest("hex");
  return gitBlob === pin[1];
}
