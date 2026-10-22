import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { inspectReleaseWorkingTree162 } from "../scripts/lib/release-evidence-worktree-162";
import { currentEvidenceSourceFingerprint } from "../scripts/lib/current-revision";

function git(root: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function workspace(): string {
  const root = mkdtempSync(join(tmpdir(), "release-evidence-162-"));
  git(root, "init", "-q");
  mkdirSync(join(root, "src"));
  mkdirSync(join(root, "quality/receipts/browser-performance"), { recursive: true });
  writeFileSync(join(root, "src/tool.ts"), "export const tool = 1;\n");
  writeFileSync(join(root, "quality/receipts/browser-performance/fresh-browser-matrix.json"), "{}\n");
  git(root, "add", ".");
  git(root, "-c", "user.name=Regression", "-c", "user.email=regression@example.invalid", "commit", "-qm", "baseline");
  return root;
}

describe("#162 release evidence status after acceptance writes", () => {
  it("allows unstaged, regular regenerated receipt bytes while preserving the exact source fingerprint", async () => {
    const root = workspace();
    try {
      const before = await currentEvidenceSourceFingerprint(root);
      const receipt = "quality/receipts/browser-performance/fresh-browser-matrix.json";
      writeFileSync(join(root, receipt), '{"observed":"fresh"}\n');
      expect(git(root, "status", "--porcelain")).toContain(receipt); // original release dirty predicate: RED
      const status = inspectReleaseWorkingTree162(root);
      expect(status).toEqual({ dirty: false, evidencePaths: [receipt] });
      expect(await currentEvidenceSourceFingerprint(root)).toBe(before);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("allows only ordinary untracked receipt files and rejects changes to source, missing evidence, staged receipts and links", () => {
    const root = workspace();
    try {
      const receipt = "quality/receipts/browser-performance/fresh-browser-matrix.json";
      const generated = "quality/receipts/android-chrome-avd-277-output.jpg";
      writeFileSync(join(root, generated), "new simulated capture\n");
      expect(inspectReleaseWorkingTree162(root)).toEqual({ dirty: false, evidencePaths: [generated] });
      writeFileSync(join(root, "src/tool.ts"), "export const tool = 2;\n");
      expect(inspectReleaseWorkingTree162(root).dirty).toBe(true);
      git(root, "add", "src/tool.ts");
      expect(inspectReleaseWorkingTree162(root).dirty).toBe(true);
      git(root, "reset", "-q", "--", "src/tool.ts");
      writeFileSync(join(root, "src/tool.ts"), "export const tool = 1;\n");
      git(root, "add", receipt); // unchanged index is harmless
      writeFileSync(join(root, receipt), "{\"new\":true}\n");
      expect(inspectReleaseWorkingTree162(root).dirty).toBe(false);
      git(root, "add", receipt);
      expect(inspectReleaseWorkingTree162(root).dirty).toBe(true);
      git(root, "reset", "-q", "--", receipt);
      rmSync(join(root, receipt));
      expect(inspectReleaseWorkingTree162(root).dirty).toBe(true);
      writeFileSync(join(root, receipt), "{}\n");
      rmSync(join(root, generated));
      symlinkSync(join(root, "src/tool.ts"), join(root, generated));
      expect(inspectReleaseWorkingTree162(root).dirty).toBe(true);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
