import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

// Preflight install destinations and verify them again after pnpm installs.
// The npm lockfiles remain authoritative.
const [directory = ".", probe] = process.argv.slice(2);
if (probe && !["--preflight", "--probe-buffer", "--probe-runtime"].includes(probe)) {
  throw new Error("Unknown post-install check: " + probe);
}
const root = resolve(directory);
const rootReal = realpathSync(root);
const modules = resolve(root, "node_modules");
const virtualStore = resolve(modules, ".pnpm");

// Do not resolve a link and then compare it against a second resolved link:
// both could point to another worktree's mutable directory.
function localDirectory(path, expected, required) {
  let entry;
  try {
    entry = lstatSync(path);
  } catch (error) {
    if (!required && error?.code === "ENOENT") return;
    throw error;
  }
  if (!entry.isDirectory() || entry.isSymbolicLink() || realpathSync(path) !== expected) {
    throw new Error("pnpm mutable install path escapes this worktree: " + path);
  }
}
localDirectory(modules, resolve(rootReal, "node_modules"), probe !== "--preflight");
localDirectory(virtualStore, resolve(rootReal, "node_modules/.pnpm"), probe !== "--preflight");
if (probe === "--preflight") {
  console.log("pnpm worktree install paths safe: " + root);
  process.exit(0);
}
const installed = JSON.parse(readFileSync(resolve(modules, ".modules.yaml"), "utf8"));
if (typeof installed.virtualStoreDir !== "string" ||
    resolve(modules, installed.virtualStoreDir) !== virtualStore) {
  throw new Error("pnpm virtual store is not the local .pnpm directory");
}
const contentStore = realpathSync(installed.storeDir);
if (statSync(root).dev !== statSync(contentStore).dev) {
  throw new Error("pnpm content store and worktree are on different volumes; hardlinks are unavailable");
}
if (probe === "--probe-buffer") {
  // Resolve from the physical safer-buffer package, not its hoisted symlink.
  const installedBufferFile = statSync(realpathSync(resolve(modules, "buffer/index.js")));
  if (installedBufferFile.nlink < 2) {
    throw new Error("buffer/index.js is not hardlinked to pnpm's content store");
  }
  const safer = realpathSync(resolve(modules, ".pnpm/node_modules/safer-buffer/package.json"));
  const fromSafer = createRequire(safer).resolve("buffer/");
  const rootBuffer = realpathSync(resolve(modules, "buffer"));
  if (realpathSync(dirname(fromSafer)) !== rootBuffer) {
    throw new Error("safer-buffer resolves a different buffer package: " + fromSafer);
  }
}
if (probe === "--probe-runtime") {
  // Build output must retain #274's independently pinned ONNX bytes. A strict
  // pnpm install must expose the actual locked runtime at the project root.
  const upstreamPackage = JSON.parse(readFileSync(resolve(modules, "onnxruntime-web/package.json"), "utf8"));
  const lock = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));
  const pinned = lock.packages["node_modules/onnxruntime-web"];
  const expectedVersion = "1.31.0-dev.20260914-8d85527a0";
  if (upstreamPackage.name !== "onnxruntime-web" || upstreamPackage.license !== "MIT" ||
      upstreamPackage.version !== expectedVersion || pinned?.version !== expectedVersion ||
      !pinned.integrity?.startsWith("sha512-") ||
      lock.packages[""].dependencies?.["onnxruntime-web"] !== expectedVersion) {
    throw new Error("ONNX runtime is not the pinned direct production dependency");
  }
  for (const [file, expected] of Object.entries({
    "ort-wasm-simd-threaded.mjs": "c57ca56328877353a575e51bbca6f18450027d6c9bf2307a2cb2c41363b4de9f",
    "ort-wasm-simd-threaded.wasm": "06ba057753da3847e4c24f02d91ab133455b0817c69a44993a9a53a2146df9e3",
  })) {
    const hash = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
    const source = resolve(modules, "onnxruntime-web/dist", file);
    const emitted = resolve(root, "dist/vendor/portrait-modnet", file);
    if (hash(source) !== expected || hash(emitted) !== expected) {
      throw new Error("ONNX runtime source/output identity mismatch: " + file);
    }
  }
  console.log("ONNX runtime locked package and distributed bytes verified");
}
console.log("pnpm local store and volume verified: " + root);
