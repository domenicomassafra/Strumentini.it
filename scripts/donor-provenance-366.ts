/**
 * #366: read-only provenance gate. No registry fetch, package installation or
 * adoption decision is implied by a recorded SPDX identifier or npm SRI.
 * Run: npx tsx scripts/donor-provenance-366.ts --check
 */
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { dirname, isAbsolute, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Reuse the already installed, production-lock-pinned npm semver 6.3.1.
// A lock entry's integrity/registry URL is not evidence that its version
// satisfies the consuming package's actual dependency contract.
const semver = createRequire(import.meta.url)("semver") as {
  validRange: (range: string) => string | null;
  satisfies: (version: string, range: string) => boolean;
};
function lockedVersionSatisfies(spec: unknown, version: unknown): boolean {
  return typeof spec === "string" && typeof version === "string"
    // semver 6 accepts an empty disjunction branch as a wildcard (e.g. "^9 ||").
    && spec.split("||").every((alternative) => alternative.trim().length > 0)
    && semver.validRange(spec) !== null && semver.satisfies(version, spec);
}

type LockEntry = {
  version?: string; license?: string; integrity?: string; resolved?: string; dev?: boolean; devOptional?: boolean;
  dependencies?: Record<string, string>; devDependencies?: Record<string, string>; optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>; peerDependenciesMeta?: Record<string, { optional?: boolean }>;
};
type Lock = { lockfileVersion?: number; packages?: Record<string, LockEntry> };
type Manifest = { dependencies?: Record<string, string>; devDependencies?: Record<string, string>; optionalDependencies?: Record<string, string> };
export type AssetPin366 = { path: string; sha256: string; license: string; version: string; source: string };
type Candidate = { name?: string; version?: string; license?: string; dist?: { integrity?: string; tarball?: string; shasum?: string }; dependencies?: Record<string, string> | null };
type Row = { name: string; version: string; license: string; source: string; integrity: string; scope: "production" };

// Whitelist of well-formed SPDX identifiers observed in this exact lockfile.
// New/compound expressions require review, not automatic acceptance.
const SPDX_IDS = new Set([
  "MIT", "Apache-2.0", "ISC", "BSD-2-Clause", "BSD-3-Clause",
  "Python-2.0", "CC-BY-4.0", "CC0-1.0", "BlueOak-1.0.0",
  "MPL-2.0", "LGPL-3.0", "LGPL-3.0-or-later", "AGPL-3.0-or-later",
]);
function knownSpdx(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  // Metadata must contain a valid expression, not just permitted identifiers.
  // Stripping parentheses previously accepted malformed declarations such as
  // `MIT(`, `MIT()` and `MIT(Apache-2.0)` as VERIFIED_METADATA. The allowlist
  // remains intentionally narrow; WITH exceptions and unknown ids are NO_GO.
  const tokens = value.match(/\(|\)|[A-Za-z0-9.+-]+/gu) ?? [];
  if (!tokens.length || tokens.join("") !== value.replace(/\s+/gu, "")) return false;
  let index = 0;
  function operand(): boolean {
    const token = tokens[index++];
    if (token === "(") {
      if (!expression() || tokens[index] !== ")") return false;
      index++;
      return true;
    }
    return token !== undefined && SPDX_IDS.has(token);
  }
  function expression(): boolean {
    if (!operand()) return false;
    while (tokens[index] === "AND" || tokens[index] === "OR") {
      index++;
      if (!operand()) return false;
    }
    return true;
  }
  return expression() && index === tokens.length;
}
function validSha512(value: unknown): value is string {
  if (typeof value !== "string" || !value.startsWith("sha512-")) return false;
  const encoded = value.slice(7);
  return /^[A-Za-z0-9+/]{86}==$/u.test(encoded) &&
    Buffer.from(encoded, "base64").length === 64 &&
    Buffer.from(encoded, "base64").toString("base64") === encoded;
}
function validSource(name: string, version: string, source: unknown): source is string {
  if (typeof source !== "string") return false;
  try {
    const url = new URL(source);
    return url.protocol === "https:" && url.hostname === "registry.npmjs.org" &&
      !url.username && !url.password && !url.search && !url.hash &&
      url.pathname === `/${name}/-/${name.split("/").at(-1)}-${version}.tgz`;
  } catch { return false; }
}
function packageName(path: string): string {
  return path.split("node_modules/").at(-1) || "";
}
function resolveDependency(name: string, from: string, entries: Record<string, LockEntry>): string | null {
  let at = from;
  while (at) {
    const candidate = `${at}/node_modules/${name}`;
    if (entries[candidate]) return candidate;
    const parent = dirname(at);
    at = parent === "." || parent === at ? "" : parent;
  }
  const top = `node_modules/${name}`;
  return entries[top] ? top : null;
}

/** A peer must resolve beside or above its consumer, never inside that consumer. */
function resolvePeerDependency(name: string, from: string, entries: Record<string, LockEntry>): string | null {
  let at = from;
  while (true) {
    // Each package-lock path is a sequence of node_modules package boundaries.
    // Skip the consumer's own descendants and (for scoped packages) @scope
    // folders; only an actual ancestor's node_modules can supply its peer.
    const boundary = at.lastIndexOf("node_modules/");
    if (boundary === -1) return null;
    const ancestor = at.slice(0, boundary);
    const candidate = ancestor + "node_modules/" + name;
    if (entries[candidate]) return candidate;
    if (!ancestor) return null;
    at = ancestor.endsWith("/") ? ancestor.slice(0, -1) : ancestor;
  }
}

/** Every production entry is audited, including nodes reached through nested dependency resolution. */
export function auditLockedPackages366(lock: Lock, manifest: Manifest) {
  const failures: string[] = [];
  const entries = lock.packages ?? {};
  if (lock.lockfileVersion !== 3 || !entries[""]) failures.push("INVALID_LOCKFILE_V3");
  if (JSON.stringify(entries[""]?.dependencies ?? {}) !== JSON.stringify(manifest.dependencies ?? {})) {
    failures.push("ROOT_PRODUCTION_DEPENDENCIES_DIFFER");
  }
  if (JSON.stringify(entries[""]?.devDependencies ?? {}) !== JSON.stringify(manifest.devDependencies ?? {})) {
    // Synthetic fixtures can omit devDependencies entirely; production manifest must still match.
    if (Object.keys(manifest.devDependencies ?? {}).length > 0 || Object.keys(entries[""]?.devDependencies ?? {}).length > 0) {
      failures.push("ROOT_DEV_DEPENDENCIES_DIFFER");
    }
  }
  if (JSON.stringify(entries[""]?.optionalDependencies ?? {}) !== JSON.stringify(manifest.optionalDependencies ?? {})) {
    failures.push("ROOT_OPTIONAL_DEPENDENCIES_DIFFER");
  }
  const production = Object.entries(entries).filter(([path, entry]) => path && !entry.dev && !entry.devOptional);
  const rows: Row[] = [];
  const metadataChecked = new Set<string>();
  function auditPackageMetadata(path: string, entry: LockEntry): void {
    if (metadataChecked.has(path)) return;
    metadataChecked.add(path);
    const name = packageName(path);
    const version = entry.version ?? "";
    if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.+-]+)?$/u.test(version)) failures.push(`UNKNOWN_VERSION ${path}`);
    if (!knownSpdx(entry.license)) failures.push(`UNKNOWN_LICENSE ${path}`);
    if (!validSha512(entry.integrity)) failures.push(`INVALID_SRI ${path}`);
    if (!validSource(name, version, entry.resolved)) failures.push(`UNVERIFIED_SOURCE ${path}`);
  }
  for (const [path, entry] of production) {
    auditPackageMetadata(path, entry);
    const name = packageName(path);
    const version = entry.version ?? "";
    rows.push({ name, version, license: entry.license ?? "UNKNOWN", source: entry.resolved ?? "UNKNOWN", integrity: entry.integrity ?? "UNKNOWN", scope: "production" });
    for (const [depName, spec] of Object.entries(entry.dependencies ?? {})) {
      const target = resolveDependency(depName, path, entries);
      if (!target) failures.push(`MISSING_TRANSITIVE ${path} -> ${depName}`);
      else if (entries[target]?.dev || entries[target]?.devOptional) failures.push(`DEV_ONLY_TRANSITIVE ${path} -> ${target}`);
      else if (!lockedVersionSatisfies(spec, entries[target]?.version)) {
        failures.push(`TRANSITIVE_VERSION_MISMATCH ${path} -> ${target} (${spec} vs ${entries[target]?.version ?? "UNKNOWN"})`);
      }
    }
    for (const [depName, spec] of Object.entries(entry.optionalDependencies ?? {})) {
      const target = resolveDependency(depName, path, entries);
      if (target && (entries[target]?.dev || entries[target]?.devOptional)) failures.push(`DEV_ONLY_OPTIONAL ${path} -> ${target}`);
      else if (target && !lockedVersionSatisfies(spec, entries[target]?.version)) {
        failures.push(`OPTIONAL_VERSION_MISMATCH ${path} -> ${target} (${spec} vs ${entries[target]?.version ?? "UNKNOWN"})`);
      }
    }
    for (const [peerName, spec] of Object.entries(entry.peerDependencies ?? {})) {
      // npm peers resolve at or above their consumer; unlike ordinary
      // dependencies, the consumer's own node_modules cannot satisfy a peer.
      const target = resolvePeerDependency(peerName, path, entries);
      const optional = entry.peerDependenciesMeta?.[peerName]?.optional === true;
      // Only explicitly optional peers may be absent. Present optional peers
      // still need valid production provenance and a compatible pinned version.
      if (!target) {
        if (!optional) failures.push("MISSING_PEER " + path + " -> " + peerName);
      } else if (entries[target]?.dev || (entries[target]?.devOptional && !optional)) {
        failures.push("DEV_ONLY_PEER " + path + " -> " + target);
      } else {
        // npm lock v3 devOptional denotes a dev dependency that ALSO supplies
        // an optional runtime peer; it is not necessarily dev-only. Validate
        // its metadata even though the ordinary production loop skips it.
        if (optional && entries[target]?.devOptional) auditPackageMetadata(target, entries[target]!);
        if (!lockedVersionSatisfies(spec, entries[target]?.version)) {
          const label = optional ? "OPTIONAL_PEER_VERSION_MISMATCH" : "PEER_VERSION_MISMATCH";
          failures.push(label + " " + path + " -> " + target + " (" + spec + " vs " + (entries[target]?.version ?? "UNKNOWN") + ")");
        }
      }
    }
  }
  for (const [name, spec] of Object.entries(manifest.dependencies ?? {})) {
    const target = entries[`node_modules/${name}`];
    if (!target) failures.push(`MISSING_DIRECT ${name}`);
    // A direct runtime dependency is necessarily production code even when a
    // lockfile erroneously marks its node dev/devOptional. Such a marker would
    // otherwise exclude it from every license, source and integrity check.
    else if (target.dev || target.devOptional) {
      failures.push(`DEV_ONLY_DIRECT ${name} -> node_modules/${name}`);
    }
    else if (!lockedVersionSatisfies(spec, target.version)) {
      failures.push(`DIRECT_VERSION_MISMATCH ${name} (${spec} vs ${target.version ?? "UNKNOWN"})`);
    }
  }
  for (const [name, spec] of Object.entries(manifest.optionalDependencies ?? {})) {
    const path = `node_modules/${name}`;
    const target = entries[path];
    // Optional means the package may be absent. Once present, it is still a
    // root runtime package and must satisfy its declared constraint.
    if (!target) continue;
    if (target.dev || target.devOptional) failures.push(`DEV_ONLY_ROOT_OPTIONAL ${name} -> ${path}`);
    else if (!lockedVersionSatisfies(spec, target.version)) {
      failures.push(`ROOT_OPTIONAL_VERSION_MISMATCH ${name} (${spec} vs ${target.version ?? "UNKNOWN"})`);
    }
  }
  rows.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
  return { status: failures.length ? "NO_GO" as const : "VERIFIED_METADATA" as const, rows, failures };
}

const HASH_256 = /^[a-f0-9]{64}$/u;
function safeAssetPath(root: string, name: string): string | null {
  if (!name || name.includes("\\") || isAbsolute(name) || name.split("/").includes("..")) return null;
  const full = resolve(root, name);
  return full.startsWith(resolve(root) + sep) ? full : null;
}
function validAssetSource(asset: AssetPin366): boolean {
  if (!URL.canParse(asset.source)) return false;
  const url = new URL(asset.source);
  return url.protocol === "https:" && url.hostname === "registry.npmjs.org" &&
    !url.username && !url.password && !url.search && !url.hash &&
    url.pathname.endsWith(`-${asset.version}.tgz`) &&
    url.pathname.includes("/-/");
}
function allFiles(root: string, dir: string): string[] {
  const absolute = safeAssetPath(root, dir);
  if (!absolute || !existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return allFiles(root, path);
    if (entry.isSymbolicLink()) return [`SYMLINK:${path}`];
    return entry.isFile() ? [path] : [`UNKNOWN_TYPE:${path}`];
  });
}
export function auditVendoredAssets366(root: string, assets: AssetPin366[], dirs: string[]) {
  const failures: string[] = [];
  const pinned = new Set<string>();
  for (const asset of assets) {
    const full = safeAssetPath(root, asset.path);
    if (!full || pinned.has(asset.path) || !dirs.some((dir) => asset.path.startsWith(dir + "/"))) {
      failures.push(`INVALID_ASSET_PATH ${asset.path}`); continue;
    }
    pinned.add(asset.path);
    if (!knownSpdx(asset.license)) failures.push(`UNKNOWN_ASSET_LICENSE ${asset.path}`);
    if (!/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/u.test(asset.version)) failures.push(`UNKNOWN_ASSET_VERSION ${asset.path}`);
    if (!validAssetSource(asset)) failures.push(`UNKNOWN_ASSET_SOURCE ${asset.path}`);
    if (!HASH_256.test(asset.sha256)) failures.push(`INVALID_ASSET_PIN ${asset.path}`);
    if (!existsSync(full)) { failures.push(`MISSING_ASSET ${asset.path}`); continue; }
    const stat = lstatSync(full);
    // Never follow a link into owner data or attempt unlimited reads of new assets.
    if (!stat.isFile() || stat.size > 64 * 1024 * 1024) {
      failures.push(`UNSAFE_ASSET_TYPE_OR_SIZE ${asset.path}`); continue;
    }
    const digest = createHash("sha256").update(readFileSync(full)).digest("hex");
    if (digest !== asset.sha256) failures.push(`ASSET_HASH_MISMATCH ${asset.path}`);
  }
  for (const dir of dirs) {
    if (!safeAssetPath(root, dir) || !existsSync(resolve(root, dir)) ||
      !lstatSync(resolve(root, dir)).isDirectory()) {
      failures.push(`MISSING_ASSET_DIRECTORY ${dir}`);
      continue;
    }
    for (const path of allFiles(root, dir)) {
      if (!pinned.has(path)) failures.push(`UNPINNED_ASSET ${path}`);
    }
  }
  return { status: failures.length ? "NO_GO" as const : "VERIFIED_METADATA" as const, files: assets.length, rows: assets, failures };
}

/** Candidate snapshots can trigger refusal, but never authorize a new installation. */
export function auditCandidate366(candidate: Candidate, lockEntry: LockEntry | null, lock?: Lock) {
  const name = candidate.name ?? "UNKNOWN";
  const version = candidate.version ?? "UNKNOWN";
  const label = `${name}@${version}`;
  const failures: string[] = [];
  if (!knownSpdx(candidate.license)) failures.push(`UNKNOWN_LICENSE ${label}`);
  if (!/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/u.test(version)) failures.push(`UNKNOWN_VERSION ${label}`);
  if (!validSha512(candidate.dist?.integrity)) failures.push(`INVALID_SRI ${label}`);
  if (!validSource(name, version, candidate.dist?.tarball)) failures.push(`UNVERIFIED_SOURCE ${label}`);
  if (candidate.dist?.shasum && !/^[a-f0-9]{40}$/u.test(candidate.dist.shasum)) failures.push(`INVALID_SHASUM ${label}`);
  if (lockEntry && (lockEntry.version !== version || lockEntry.integrity !== candidate.dist?.integrity || lockEntry.license !== candidate.license)) {
    failures.push(`INSTALLED_LOCK_MISMATCH ${label}`);
  }
  if (!lockEntry) failures.push(`NO_INSTALLED_ARTIFACT ${label}`);
  for (const [dep, spec] of Object.entries(candidate.dependencies ?? {})) {
    const target = lock?.packages ? resolveDependency(dep, `node_modules/${name}`, lock.packages) : null;
    if (!target || !lockEntry || lockEntry.dependencies?.[dep] !== spec || !lock?.packages?.[target]?.integrity) {
      failures.push(`UNVERIFIED_TRANSITIVE ${dep} for ${label}`);
    }
  }
  return { name, version, license: candidate.license ?? "UNKNOWN", integrity: candidate.dist?.integrity ?? "UNKNOWN", source: candidate.dist?.tarball ?? "UNKNOWN", decision: "NO_ADOPT" as const, failures };
}

export function parseAssetPins366(document: string): AssetPin366[] {
  const match = document.match(/<!-- ASSET-PINS-366-BEGIN -->([\s\S]*?)<!-- ASSET-PINS-366-END -->/u);
  if (!match?.[1]?.trim()) throw new Error("MISSING_ASSET_PIN_REGISTER");
  return match[1].trim().split("\n").map((line) => {
    const parts = line.split("\t");
    if (parts.length !== 5) throw new Error(`INVALID_ASSET_PIN_LINE ${line}`);
    const [path = "", sha256 = "", license = "", version = "", source = ""] = parts;
    return { path, sha256, license, version, source };
  });
}

export const VENDORED_DIRS_366 = [
  "public/ocr-246", "public/fonts", "src/engines/video/vendor", "src/engines/pdf/vendor",
];

export function auditRepository366(root: string) {
  const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as Manifest;
  const lock = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8")) as Lock;
  const pins = parseAssetPins366(readFileSync(resolve(root, "docs/donor-provenance-366-2026-10-11.md"), "utf8"));
  const packages = auditLockedPackages366(lock, manifest);
  const assets = auditVendoredAssets366(root, pins, VENDORED_DIRS_366);
  const snapshots = JSON.parse(readFileSync(resolve(root, "docs/audit-2026-10-10/donor-packages.json"), "utf8")) as Candidate[];
  const candidates = snapshots.map((item) => auditCandidate366(item, lock.packages?.[`node_modules/${item.name}`] ?? null, lock));
  return { status: packages.failures.length || assets.failures.length ? "NO_GO" as const : "VERIFIED_METADATA" as const, packages, assets, candidates };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const report = auditRepository366(root);
  if (process.argv.includes("--matrix")) {
    console.log(JSON.stringify({ status: report.status, installedProduction: report.packages.rows,
      vendoredAssets: report.assets, candidates: report.candidates }, null, 2));
  } else console.log(JSON.stringify({ status: report.status, productionPackages: report.packages.rows.length,
    assetFiles: report.assets.files, donorCandidates: report.candidates.map(({ name, version, license, decision, failures }) =>
      ({ name, version, license, decision, failures })),
    failures: [...report.packages.failures, ...report.assets.failures] }, null, 2));
  if (process.argv.includes("--check") && report.status === "NO_GO") process.exitCode = 1;
}
