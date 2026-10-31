import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { lstatSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const checker = resolve(import.meta.dirname, "check-pnpm-worktree-523.mjs");
function fixture(fn) {
  const base = mkdtempSync(join(tmpdir(), "str523-store-"));
  const root = join(base, "worktree");
  const separate = join(base, "separate");
  const store = join(base, "shared-content-store");
  mkdirSync(root);
  mkdirSync(separate);
  mkdirSync(store);
  function check(mode) {
    return spawnSync(process.execPath, [checker, root, mode].filter(Boolean), { encoding: "utf8" });
  }
  try {
    return fn({ root, separate, store, check });
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}
function installMetadata(modules, store, virtualStoreDir = ".pnpm") {
  writeFileSync(join(modules, ".modules.yaml"), JSON.stringify({ virtualStoreDir, storeDir: store }));
}
test("accepts a fresh worktree and a genuine local virtual store", () => fixture(({ root, store, check }) => {
  assert.equal(check("--preflight").status, 0);
  const modules = join(root, "node_modules");
  mkdirSync(join(modules, ".pnpm"), { recursive: true });
  installMetadata(modules, store);
  assert.equal(lstatSync(modules).isSymbolicLink(), false);
  assert.equal(check("--preflight").status, 0);
  assert.equal(check().status, 0);
}));
test("rejects symlinked node_modules before and after install", () => fixture(({ root, separate, store, check }) => {
  const foreignModules = join(separate, "node_modules");
  mkdirSync(join(foreignModules, ".pnpm"), { recursive: true });
  installMetadata(foreignModules, store);
  symlinkSync(foreignModules, join(root, "node_modules"), "dir");
  for (const mode of ["--preflight", null]) {
    const result = check(mode);
    assert.notEqual(result.status, 0, result.stdout);
    assert.match(result.stderr, /mutable install path escapes/);
  }
}));
test("rejects symlinked .pnpm pointing into another worktree", () => fixture(({ root, separate, store, check }) => {
  const modules = join(root, "node_modules");
  mkdirSync(modules);
  const foreignVirtualStore = join(separate, "node_modules", ".pnpm");
  mkdirSync(foreignVirtualStore, { recursive: true });
  symlinkSync(foreignVirtualStore, join(modules, ".pnpm"), "dir");
  installMetadata(modules, store);
  for (const mode of ["--preflight", null]) {
    const result = check(mode);
    assert.notEqual(result.status, 0, result.stdout);
    assert.match(result.stderr, /mutable install path escapes/);
  }
}));
test("rejects metadata with a foreign virtual store", () => fixture(({ root, separate, store, check }) => {
  const modules = join(root, "node_modules");
  mkdirSync(join(modules, ".pnpm"), { recursive: true });
  installMetadata(modules, store, separate);
  for (const mode of ["--preflight", null]) {
    const result = check(mode);
    assert.notEqual(result.status, 0, result.stdout);
    assert.match(result.stderr, /not the local/);
  }
}));
test("rejects symlinked metadata before and after install", () => fixture(({ root, separate, store, check }) => {
  const modules = join(root, "node_modules");
  mkdirSync(join(modules, ".pnpm"), { recursive: true });
  const foreign = join(separate, ".modules.yaml");
  writeFileSync(foreign, JSON.stringify({ virtualStoreDir: ".pnpm", storeDir: store }));
  symlinkSync(foreign, join(modules, ".modules.yaml"));
  for (const mode of ["--preflight", null]) {
    const result = check(mode);
    assert.notEqual(result.status, 0, result.stdout);
    assert.match(result.stderr, /mutable install metadata escapes/);
  }
}));
