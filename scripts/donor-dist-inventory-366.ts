/** #126 post-build evidence: compare distributed bytes and bundled npm sources
 * with the already audited #366 asset pins and runtime lockfile rows. */
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { allFiles } from "./donor-provenance-366";
import type { AssetPin366 } from "./donor-asset-pins-366";
import { RUNTIME_PAYLOAD_366 } from "./donor-public-runtime-366";

type PackageRow = { name: string; version: string; license: string; source: string; integrity: string };

const GENERATED_RUNTIME = new Set([
  "vendor/portrait-modnet/ort-wasm-simd-threaded.mjs",
  "vendor/portrait-modnet/ort-wasm-simd-threaded.wasm",
]);

function digest(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** Built assets must have a pinned source; generated ONNX Runtime assets must
 * match the exact npm installation that Astro copies in astro.config.mjs. */
export function auditDistributedAssets366(root: string, pins: AssetPin366[], packages: PackageRow[]) {
  const failures: string[] = [];
  const dist = resolve(root, "dist");
  if (!existsSync(dist) || !lstatSync(dist).isDirectory()) {
    return { failures: ["MISSING_DISTRIBUTION dist"], bundledPackages: [], verifiedFiles: 0 };
  }
  const emitted = allFiles(root, "dist");
  const files = new Set(emitted.filter((path) => !path.includes(":")).map((path) => path.slice("dist/".length)));
  const pinned = new Map(pins.filter((pin) => pin.path.startsWith("public/"))
    .map((pin) => [pin.path.slice("public/".length), pin]));
  let verifiedFiles = 0;

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
  for (const path of files) {
    if (pinned.has(path)) continue;
    if (GENERATED_RUNTIME.has(path)) {
      const filename = basename(path);
      const upstream = resolve(root, "node_modules/onnxruntime-web/dist", filename);
      if (!runtime || !existsSync(upstream) || !lstatSync(upstream).isFile() ||
          digest(resolve(dist, path)) !== digest(upstream)) {
        failures.push(`UNVERIFIED_GENERATED_RUNTIME ${path}`);
      } else {
        verifiedFiles++;
      }
    } else if (RUNTIME_PAYLOAD_366.test(path) || path.startsWith("vendor/") ||
               (path.endsWith(".js") && !path.startsWith("_astro/"))) {
      failures.push(`UNPINNED_DISTRIBUTED_ASSET ${path}`);
    }
  }
  for (const path of GENERATED_RUNTIME) {
    if (!files.has(path)) failures.push(`MISSING_GENERATED_RUNTIME ${path}`);
  }

  const packageNames = new Set(packages.map((entry) => entry.name));
  const bundledPackages = new Set<string>();
  const scripts = [...files].filter((path) => path.startsWith("_astro/") && path.endsWith(".js"));
  if (!scripts.length) failures.push("MISSING_BUNDLED_SCRIPTS");
  for (const script of scripts) {
    if (!files.has(script + ".map")) failures.push(`UNMAPPED_DISTRIBUTED_SCRIPT ${script}`);
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
      const tail = segments.at(-1)!;
      const name = tail.startsWith("@") ? tail.split("/").slice(0, 2).join("/") : tail.split("/")[0]!;
      if (!packageNames.has(name)) failures.push(`UNVERIFIED_BUNDLED_PACKAGE ${mapPath} -> ${name}`);
      else bundledPackages.add(name);
    }
  }
  return { failures, bundledPackages: [...bundledPackages].sort(), verifiedFiles };
}
