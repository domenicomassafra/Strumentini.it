/**
 * STR-366 primary source attestations: OFFLINE validation of shipped local bytes.
 *
 * Origin URLs and npm tarball SHA-512 SRI were independently read back during
 * the 2026-10-18 primary-source audit, recorded in the companion JSON.
 * This script intentionally makes no network request and does not recertify
 * the remote bytes; it only checks the immutable observations against local
 * copies, their mandatory font notices, and the fail-closed license status.
 */
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const PRIMARY_SOURCE_366_MANIFEST = "quality/reference-data/primary-source-366-2026-10-18.json";

type Source = { url: string; integrity: string; package: string; version: string; registryLicense: string };
type Asset = {
  path: string;
  bytes: number;
  sha256: string;
  evidence: "EXACT_UPSTREAM_BYTES" | "UNVERIFIED_LICENSE_AUTHORITY";
  sourceKind: string;
  sourceUrl: string | null;
  obligation: string;
  archivePath?: string;
  packageId?: string;
  additionalUpstreamUrl?: string;
};
export type PrimarySource366Manifest = {
  schemaVersion: number;
  capturedDate: string;
  decision: string;
  primaryNpmTarballs: Record<string, Source>;
  obligations: Record<string, string>;
  assets: Asset[];
  upstreamGoogleFontsGitCommit: string;
};

const SHA256 = /^[a-f0-9]{64}$/u;
const EXPECTED_COUNT = 27; // 8 WOFF2 + 4 OFL + 15 OCR assets
// Independently reviewed pin for the manifest *content*. Prevent changing only
// manifest URLs/hashes/claims while continuing to get a green offline result.
// This is an integrity check on the recorded evidence, not an upstream signature.
export const MANIFEST_SHA256_366 = "ca0d2a7278a9ae88513eb287dbe825338eac64eb1c48d25b95f731158c773bde";
const TESSDATA_COMMIT_366 = "806cd9adc8c6e8abc11c782db1818c990576bebc";
const FONT_FAMILIES: Readonly<Record<string, string>> = {
  archivo: "archivo",
  inter: "inter",
  "roboto-mono": "robotomono",
  "source-sans-3": "sourcesans3",
};

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function isCanonicalNpmSource(source: Source): boolean {
  // A registry prefix is not package identity: no unrelated distribution,
  // query, fragment, redirect-shaped path, or version substitution is valid.
  if (!/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/u.test(source.package) ||
      !/^\d+\.\d+\.\d+(?:-[0-9a-zA-Z.-]+)?$/u.test(source.version)) return false;
  const unscoped = source.package.split("/").at(-1)!;
  return source.url ===
    `https://registry.npmjs.org/${source.package}/-/${unscoped}-${source.version}.tgz`;
}

/** Validate each component before reading it. lstat on the final asset alone
 * misses symlinked parents (public/fonts, public/ocr-246/core, etc.). */
function safeLocalPath(root: string, canonicalRoot: string, path: string, type: "file" | "directory"): boolean {
  if (!path || isAbsolute(path) || path.split("/").some((part) => !part || part === "." || part === "..")) {
    return false;
  }
  let current = root;
  const parts = path.split("/");
  for (const [index, part] of parts.entries()) {
    current = resolve(current, part);
    try {
      const stat = lstatSync(current);
      if (stat.isSymbolicLink() || (index < parts.length - 1 && !stat.isDirectory()) ||
          (index === parts.length - 1 && !(type === "directory" ? stat.isDirectory() : stat.isFile()))) return false;
      const real = realpathSync(current);
      const inside = relative(canonicalRoot, real);
      if (inside === ".." || inside.startsWith(`..${sep}`) || isAbsolute(inside)) return false;
    } catch {
      return false;
    }
  }
  return true;
}

function shippedFiles(root: string, canonicalRoot: string): { paths: string[]; failures: string[] } {
  const paths: string[] = [];
  const failures: string[] = [];
  function visit(folder: string): void {
    if (!safeLocalPath(root, canonicalRoot, folder, "directory")) {
      failures.push(`UNSAFE_ASSET_DIRECTORY ${folder}`);
      return; // Never readdir through an unchecked ancestor.
    }
    for (const item of readdirSync(resolve(root, folder), { withFileTypes: true })) {
      const path = `${folder}/${item.name}`;
      if (item.isDirectory()) visit(path);
      else if (item.isFile()) paths.push(path);
      else {
        paths.push(path);
        failures.push(`UNSAFE_ASSET_PATH ${path}`);
      }
    }
  }
  visit("public/fonts");
  visit("public/ocr-246");
  return { paths: paths.toSorted(), failures };
}

export function verifyPrimarySource366(
  root: string,
  injected?: PrimarySource366Manifest,
): { decision: "NO_GO"; files: number; exactUpstream: number; unresolved: number; failures: string[] } {
  const failures: string[] = [];
  // Resolve and check the nominated root *before* reading a manifest or a
  // directory: an external symlinked root must not inherit trusted assets.
  const absoluteRoot = resolve(root);
  let canonicalRoot: string;
  try {
    if (!lstatSync(absoluteRoot).isDirectory() || lstatSync(absoluteRoot).isSymbolicLink()) {
      throw new Error("Symlink or non-directory root");
    }
    canonicalRoot = realpathSync(absoluteRoot);
  } catch {
    return { decision: "NO_GO", files: 0, exactUpstream: 0, unresolved: 0, failures: ["UNSAFE_ASSET_ROOT"] };
  }
  if (!injected && !safeLocalPath(absoluteRoot, canonicalRoot, PRIMARY_SOURCE_366_MANIFEST, "file")) {
    return { decision: "NO_GO", files: 0, exactUpstream: 0, unresolved: 0, failures: ["UNSAFE_SOURCE_MANIFEST"] };
  }
  const manifest = injected ?? JSON.parse(readFileSync(resolve(absoluteRoot, PRIMARY_SOURCE_366_MANIFEST), "utf8")) as PrimarySource366Manifest;
  const paths = new Set<string>();
  const commit = manifest.upstreamGoogleFontsGitCommit;
  if (manifest.schemaVersion !== 1 || manifest.decision !== "NO_GO" || !/^[0-9a-f]{40}$/u.test(commit)) {
    failures.push("INVALID_MANIFEST_OR_NO_GO_STATUS");
  }
  if (sha256(Buffer.from(JSON.stringify(manifest))) !== MANIFEST_SHA256_366) {
    failures.push("MANIFEST_ATTESTATION_MISMATCH");
  }
  for (const [id, source] of Object.entries(manifest.primaryNpmTarballs)) {
    const integrity = source.integrity;
    if (!isCanonicalNpmSource(source) ||
        !/^sha512-[a-zA-Z0-9+/]+=*$/u.test(integrity) ||
        Buffer.from(integrity.slice(7), "base64").length !== 64) failures.push(`INVALID_NPM_SOURCE ${id}`);
  }
  const shipped = shippedFiles(absoluteRoot, canonicalRoot);
  failures.push(...shipped.failures);
  const actualPaths = new Set(shipped.paths);
  let exactUpstream = 0;
  let unresolved = 0;
  for (const asset of manifest.assets) {
    if (paths.has(asset.path)) failures.push(`DUPLICATE_ASSET ${asset.path}`);
    paths.add(asset.path);
    const normalized = resolve(root, asset.path);
    const relativePath = relative(root, normalized);
    if (!asset.path.startsWith("public/fonts/") && !asset.path.startsWith("public/ocr-246/") ||
        relativePath.startsWith("..") || relativePath.includes(`${sep}..${sep}`) ||
        relativePath !== asset.path) {
      failures.push(`OUT_OF_SCOPE_ASSET ${asset.path}`);
      continue;
    }
    if (!actualPaths.has(asset.path) || !safeLocalPath(absoluteRoot, canonicalRoot, asset.path, "file")) {
      failures.push(`MISSING_OR_NONREGULAR_ASSET ${asset.path}`);
      continue;
    }
    const bytes = readFileSync(normalized);
    if (!SHA256.test(asset.sha256) || bytes.byteLength !== asset.bytes || sha256(bytes) !== asset.sha256) {
      failures.push(`LOCAL_BYTE_MISMATCH ${asset.path}`);
    }
    if (!(asset.obligation in manifest.obligations) || !manifest.obligations[asset.obligation]?.trim()) {
      failures.push(`MISSING_OBLIGATION ${asset.path}`);
    }
    if (asset.evidence === "EXACT_UPSTREAM_BYTES") exactUpstream += 1;
    else if (asset.evidence === "UNVERIFIED_LICENSE_AUTHORITY") unresolved += 1;
    else failures.push(`INVALID_EVIDENCE_CLASS ${asset.path}`);
    if (asset.packageId) {
      const source = manifest.primaryNpmTarballs[asset.packageId];
      if (!source || asset.sourceUrl !== source.url ||
          !asset.archivePath?.startsWith("package/") || asset.archivePath.includes("..")) {
        failures.push(`INVALID_TARBALL_MAPPING ${asset.path}`);
      }
    } else if (asset.evidence === "EXACT_UPSTREAM_BYTES" &&
        !asset.path.startsWith("public/fonts/") &&
        !(asset.path === "public/ocr-246/lang/UPSTREAM-APACHE-2.0.LICENSE" &&
          asset.sourceKind === "git-immutable" &&
          asset.sourceUrl ===
            `https://raw.githubusercontent.com/naptha/tessdata/${TESSDATA_COMMIT_366}/LICENSE`)) {
      failures.push(`UNMAPPED_EXACT_UPSTREAM ${asset.path}`);
    }
    if (asset.path.endsWith(".woff2")) {
      if (asset.evidence !== "EXACT_UPSTREAM_BYTES" ||
          !/^https:\/\/fonts\.gstatic\.com\/s\/[a-z0-9]+\/v[0-9]+\/.+\.woff2$/u.test(asset.sourceUrl ?? "") ||
          asset.obligation !== "font-ofl") failures.push(`INVALID_FONT_ORIGIN ${asset.path}`);
      const family = Object.entries(FONT_FAMILIES).find(([name]) => asset.path.endsWith("/" + name + "-latin.woff2") ||
        asset.path.endsWith("/" + name + "-latin-ext.woff2"))?.[1];
      if (!family || !paths.has(`public/fonts/${family}-OFL-1.1.txt`) &&
          !manifest.assets.some((entry) => entry.path === `public/fonts/${family}-OFL-1.1.txt`)) {
        failures.push(`FONT_MISSING_LICENSE ${asset.path}`);
      }
    }
    if (asset.path.endsWith("-OFL-1.1.txt")) {
      const family = asset.path.split("/").at(-1)?.replace("-OFL-1.1.txt", "");
      const expectedUrl = `https://raw.githubusercontent.com/google/fonts/${commit}/ofl/${family}/OFL.txt`;
      if (!Object.values(FONT_FAMILIES).includes(family ?? "") ||
          asset.sourceUrl !== expectedUrl || asset.evidence !== "EXACT_UPSTREAM_BYTES" ||
          !bytes.includes(Buffer.from("SIL OPEN FONT LICENSE")) ||
          !bytes.includes(Buffer.from("Version 1.1")) || !bytes.includes(Buffer.from("Copyright"))) {
        failures.push(`INVALID_OFFICIAL_OFL ${asset.path}`);
      }
    }
    if (asset.path === "public/ocr-246/lang/NPM-PACKAGE-MIT.LICENSE") {
      if (asset.evidence !== "UNVERIFIED_LICENSE_AUTHORITY" ||
          asset.sourceUrl !== null || asset.obligation !== "ocr-ita" ||
          !bytes.includes(Buffer.from("<year> <copyright holders>"))) {
        failures.push("MIT_TEMPLATE_FALSE_CERTIFICATION");
      }
    }
    if (asset.path === "public/ocr-246/lang/ita.traineddata.gz") {
      if (asset.sourceKind !== "npm-tarball-sri-validated-and-git-immutable" ||
          asset.additionalUpstreamUrl !==
            `https://raw.githubusercontent.com/naptha/tessdata/${TESSDATA_COMMIT_366}/4.0.0/ita.traineddata.gz`) {
        failures.push("ITALIAN_MODEL_GIT_SOURCE_NOT_PINNED");
      }
    }
  }
  for (const path of actualPaths) if (!paths.has(path)) failures.push(`UNPINNED_DISTRIBUTED_ASSET ${path}`);
  for (const path of paths) if (!actualPaths.has(path)) failures.push(`PINNED_ASSET_NOT_DISTRIBUTED ${path}`);
  if (paths.size !== EXPECTED_COUNT || exactUpstream !== 26 || unresolved !== 1) {
    failures.push(`UNEXPECTED_COVERAGE ${paths.size}/${exactUpstream}/${unresolved}`);
  }
  if (!manifest.obligations["ocr-ita"]?.includes("NO_GO")) failures.push("MISSING_OCR_LICENSE_BLOCKER");
  return { decision: "NO_GO", files: paths.size, exactUpstream, unresolved, failures };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const report = verifyPrimarySource366(root);
  console.log(JSON.stringify(report, null, 2));
  if (report.failures.length) process.exitCode = 1;
}
