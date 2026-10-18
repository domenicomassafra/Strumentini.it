/** Strict identity of public Google Fonts bytes against #366 primary manifest.
 * No network request, invented semver, or assumed redistribution clearance. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MANIFEST_SHA256_366, PRIMARY_SOURCE_366_MANIFEST } from "./verify-primary-source-366";

export function verifiedFontPrimary366(root: string, asset: {
  path: string; license: string; version: string; source: string; sha256: string;
}): boolean {
  if (!asset.path.startsWith("public/fonts/") || asset.license !== "OFL-1.1") return false;
  try {
    const manifest = JSON.parse(readFileSync(resolve(root, PRIMARY_SOURCE_366_MANIFEST), "utf8"));
    const digest = createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
    if (digest !== MANIFEST_SHA256_366) return false;
    const original = manifest.assets.find((row: { path: string }) => row.path === asset.path);
    if (!original || original.evidence !== "EXACT_UPSTREAM_BYTES" ||
        original.sourceUrl !== asset.source || original.sha256 !== asset.sha256) return false;
    const cdn = asset.source.match(/^https:\/\/fonts\.gstatic\.com\/s\/[a-z0-9]+\/v([0-9]+)\/[a-zA-Z0-9_-]+\.woff2$/u);
    if (asset.path.endsWith(".woff2")) return !!cdn && asset.version === `gfonts-v${cdn[1]}`;
    if (asset.path.endsWith("-OFL-1.1.txt")) {
      return asset.version === `git-${manifest.upstreamGoogleFontsGitCommit}` &&
        asset.source.startsWith(`https://raw.githubusercontent.com/google/fonts/${manifest.upstreamGoogleFontsGitCommit}/ofl/`) &&
        asset.source.endsWith("/OFL.txt");
    }
  } catch {
    return false;
  }
  return false;
}
