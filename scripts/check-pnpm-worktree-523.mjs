import { readFileSync, realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

// Run only after pnpm's isolated install. The npm lockfiles remain authoritative.
const [directory = ".", probe] = process.argv.slice(2);
if (probe && probe !== "--probe-buffer") throw new Error("Unknown post-install check: " + probe);
const root = resolve(directory);
const modules = resolve(root, "node_modules");
const installed = JSON.parse(readFileSync(resolve(modules, ".modules.yaml"), "utf8"));
const actualVirtualStore = realpathSync(resolve(modules, installed.virtualStoreDir));
const localVirtualStore = realpathSync(resolve(modules, ".pnpm"));
if (actualVirtualStore !== localVirtualStore) {
  throw new Error("pnpm virtual store is outside this worktree: " + actualVirtualStore);
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
console.log("pnpm local store and volume verified: " + root);
