/** #126 post-build evidence: compare distributed bytes and bundled npm sources
 * with the already audited #366 asset pins and runtime lockfile rows. */
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { allFiles } from "./donor-provenance-366";
import type { AssetPin366 } from "./donor-asset-pins-366";
import { RUNTIME_PAYLOAD_366 } from "./donor-public-runtime-366";

type PackageRow = { name: string; version: string; license: string; source: string; integrity: string };
type LockEntry = { version?: string; license?: string; resolved?: string; integrity?: string };

const GENERATED_RUNTIME = new Set([
  "vendor/portrait-modnet/ort-wasm-simd-threaded.mjs",
  "vendor/portrait-modnet/ort-wasm-simd-threaded.wasm",
]);

function digest(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** Rolldown emits source-free compiler helpers and thin export facades.
 * Refuse other unmapped JS, including any changed helper implementation. */
function knownGeneratedChunk366(path: string, code: string, files: ReadonlySet<string>): boolean {
  if (Buffer.byteLength(code) > 3_000) return false;
  const facade = code.match(/^import\{[^}]+\}from["']\.\/([^"']+\.js)["'];export\{[^}]+\};?$/u);
  if (facade) return files.has(`_astro/${facade[1]}`);
  // Rolldown also emits source-free direct re-export facades. Accept only a
  // pure symbol list targeting an existing chunk with its own source map.
  const reexport = code.match(/^export\{[\w$\s,]+\}from["']\.\/([\w.-]+\.js)["'];?$/u);
  if (reexport) return files.has(`_astro/${reexport[1]}`) && files.has(`_astro/${reexport[1]}.map`);
  if (/^_astro\/preload-helper\.[\w-]+\.js$/u.test(path)) {
    return code.includes("modulepreload") && code.includes("document.createElement") && code.includes("export{");
  }
  return /^_astro\/rolldown-runtime\.[\w-]+\.js$/u.test(path) &&
    code.includes("Object.create") && code.includes("getOwnPropertyDescriptor") &&
    code.includes("rolldown.rs/in-depth/bundling-cjs");
}

/** Built assets must have a pinned source; generated ONNX Runtime assets must
 * match the exact npm installation that Astro copies in astro.config.mjs. */
export function auditDistributedAssets366(
  root: string, pins: AssetPin366[], packages: PackageRow[], lockEntries: Record<string, LockEntry>,
) {
  const failures: string[] = [];
  const dist = resolve(root, "dist");
  if (!existsSync(dist) || !lstatSync(dist).isDirectory()) {
    return { failures: ["MISSING_DISTRIBUTION dist"], bundledPackages: [], bundledModuleAssets: [], verifiedFiles: 0 };
  }
  const emitted = allFiles(root, "dist");
  const files = new Set(emitted.filter((path) => !path.includes(":")).map((path) => path.slice("dist/".length)));
  const pinned = new Map(pins.filter((pin) => pin.path.startsWith("public/"))
    .map((pin) => [pin.path.slice("public/".length), pin]));
  let verifiedFiles = 0;
  const bundledPackages = new Set<string>();
  const bundledModuleAssets: { path: string; npmPackage: string; upstreamPath: string; sha256: string }[] = [];

  for (const marker of emitted.filter((path) => path.startsWith("SYMLINK:") || path.startsWith("UNKNOWN_TYPE:"))) {
    failures.push(`UNSAFE_DISTRIBUTED_ASSET ${marker.slice(marker.indexOf(":") + 1)}`);
  }
  for (const [relative, pin] of pinned) {
    if (!files.has(relative)) {
      failures.push(`MISSING_DISTRIBUTED_ASSET ${relative}`);
    } else if (digest(resolve(dist, relative)) !== pin.sha256) {
      failures.push(`DISTRIBUTED_ASSET_HASH_MISMATCH ${relative}`);
    } else {
      verifiedFiles++;
    }
  }

  const runtime = packages.find((entry) => entry.name === "onnxruntime-web");
  let installedRuntime: { name?: string; version?: string; license?: string } | null = null;
  try {
    installedRuntime = JSON.parse(readFileSync(resolve(root, "node_modules/onnxruntime-web/package.json"), "utf8"));
  } catch { /* Missing or invalid runtime package is unverified. */ }
  const runtimeVerified = runtime && installedRuntime?.name === runtime.name &&
    installedRuntime.version === runtime.version && installedRuntime.license === runtime.license;
  const pdfjs = packages.find((entry) => entry.name === "pdfjs-dist");
  let installedPdf: { name?: string; version?: string; license?: string } | null = null;
  try {
    installedPdf = JSON.parse(readFileSync(resolve(root, "node_modules/pdfjs-dist/package.json"), "utf8"));
  } catch { /* Missing/invalid PDF.js package prevents raw worker attestation. */ }
  const pdfVerified = pdfjs && installedPdf?.name === pdfjs.name &&
    installedPdf.version === pdfjs.version && installedPdf.license === pdfjs.license;
  const pdfWorkers = ["build/pdf.worker.mjs", "legacy/build/pdf.worker.mjs"] as const;
  for (const path of files) {
    if (pinned.has(path)) continue;
    if (GENERATED_RUNTIME.has(path)) {
      const filename = basename(path);
      const upstream = resolve(root, "node_modules/onnxruntime-web/dist", filename);
      if (!runtimeVerified || !existsSync(upstream) || !lstatSync(upstream).isFile() ||
          digest(resolve(dist, path)) !== digest(upstream)) {
        failures.push(`UNVERIFIED_GENERATED_RUNTIME ${path}`);
      } else {
        verifiedFiles++;
      }
    } else if (path.startsWith("_astro/") && path.endsWith(".mjs")) {
      // PDF.js ?url workers are opaque assets without JavaScript sourcemaps.
      // Prove their bytes against the locked, installed package.
      const isPdfWorker = /^_astro\/pdf\.worker[.-][\w-]+\.mjs$/u.test(path);
      const sha256 = digest(resolve(dist, path));
      const upstreamPath = isPdfWorker && pdfVerified ? pdfWorkers.find((candidate) => {
        const source = resolve(root, "node_modules/pdfjs-dist", candidate);
        return existsSync(source) && lstatSync(source).isFile() && digest(source) === sha256;
      }) : undefined;
      if (!upstreamPath || !pdfjs) {
        failures.push(`UNVERIFIED_DISTRIBUTED_ES_MODULE ${path}`);
      } else {
        verifiedFiles++;
        const npmPackage = `${pdfjs.name}@${pdfjs.version}`;
        bundledPackages.add(npmPackage);
        bundledModuleAssets.push({ path, npmPackage,
          upstreamPath: `node_modules/pdfjs-dist/${upstreamPath}`, sha256 });
      }
    } else if (RUNTIME_PAYLOAD_366.test(path) || path.startsWith("vendor/") ||
               ((path.endsWith(".js") || path.endsWith(".mjs")) && !path.startsWith("_astro/"))) {
      failures.push(`UNPINNED_DISTRIBUTED_ASSET ${path}`);
    }
  }
  for (const path of GENERATED_RUNTIME) {
    if (!files.has(path)) failures.push(`MISSING_GENERATED_RUNTIME ${path}`);
  }

  const scripts = [...files].filter((path) => path.startsWith("_astro/") && path.endsWith(".js"));
  if (!scripts.length) failures.push("MISSING_BUNDLED_SCRIPTS");
  for (const script of scripts) {
    if (!files.has(script + ".map") &&
        !knownGeneratedChunk366(script, readFileSync(resolve(dist, script), "utf8"), files)) {
      failures.push(`UNMAPPED_DISTRIBUTED_SCRIPT ${script}`);
    }
  }
  for (const mapPath of files) {
    if (!mapPath.startsWith("_astro/") || !mapPath.endsWith(".js.map")) continue;
    let sources: unknown;
    try { sources = JSON.parse(readFileSync(resolve(dist, mapPath), "utf8")).sources; }
    catch { failures.push(`INVALID_DISTRIBUTED_SOURCEMAP ${mapPath}`); continue; }
    if (!Array.isArray(sources) || sources.some((source) => typeof source !== "string")) {
      failures.push(`INVALID_DISTRIBUTED_SOURCEMAP ${mapPath}`);
      continue;
    }
    for (const source of sources as string[]) {
      const segments = source.replaceAll("\\", "/").split("node_modules/");
      if (segments.length === 1) continue;
      const names = segments.slice(1).map((part) =>
        part.startsWith("@") ? part.split("/").slice(0, 2).join("/") : part.split("/")[0]!).filter(Boolean);
      const name = names.at(-1)!;
      const locked = lockEntries[`node_modules/${names.join("/node_modules/")}`];
      const row = packages.find((entry) => entry.name === name &&
        entry.version === locked?.version && entry.license === locked?.license &&
        entry.source === locked?.resolved && entry.integrity === locked?.integrity);
      if (!row) failures.push(`UNVERIFIED_BUNDLED_PACKAGE ${mapPath} -> ${name}`);
      else bundledPackages.add(`${name}@${row.version}`);
    }
  }
  return { failures, bundledPackages: [...bundledPackages].sort(), bundledModuleAssets, verifiedFiles };
}
