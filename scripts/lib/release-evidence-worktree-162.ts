/**
 * #162: acceptance updates tracked receipts in place. These observations are
 * allowed to change between recording and release admission, but source edits,
 * staged changes, deleted evidence and unsafe paths still prohibit publication.
 *
 * This only classifies Git worktree changes. Every receipt still goes through
 * the existing SHA/source fingerprint, content, runtime and rollback validators.
 */
import { execFileSync } from "node:child_process";
import { lstatSync } from "node:fs";
import { resolve, sep } from "node:path";

export interface ReleaseEvidenceWorktree162 {
  readonly dirty: boolean;
  readonly evidencePaths: readonly string[];
}

function safeReceiptFile(root: string, path: string): boolean {
  if (!path.startsWith("quality/receipts/") || path.includes("\\") ||
      path.split("/").some((part) => part === "" || part === "." || part === "..")) return false;
  const absoluteRoot = resolve(root);
  let absolute = absoluteRoot;
  try {
    const parts = path.split("/");
    for (const [index, part] of parts.entries()) {
      absolute = resolve(absolute, part);
      if (!absolute.startsWith(absoluteRoot + sep)) return false;
      const info = lstatSync(absolute);
      if (info.isSymbolicLink() || (index < parts.length - 1 ? !info.isDirectory() : !info.isFile())) {
        return false;
      }
    }
  } catch {
    return false;
  }
  return true;
}

/** Fail closed for anything except an unstaged, regular receipt update. */
export function inspectReleaseWorkingTree162(root: string): ReleaseEvidenceWorktree162 {
  const output = execFileSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignore-submodules=none"], {
    cwd: root, encoding: "buffer", maxBuffer: 16 * 1024 * 1024,
  });
  const records = output.toString("utf8").split("\0").filter(Boolean);
  const evidencePaths: string[] = [];
  let dirty = false;
  for (let index = 0; index < records.length; index++) {
    const entry = records[index]!;
    const state = entry.slice(0, 2);
    const path = entry.slice(3);
    if (state.includes("R") || state.includes("C")) index++; // porcelain -z rename/copy carries a second path
    const unstagedReceipt = (state === " M" || state === "??") && safeReceiptFile(root, path);
    if (unstagedReceipt) evidencePaths.push(path);
    else dirty = true;
  }
  return { dirty, evidencePaths: evidencePaths.sort() };
}
