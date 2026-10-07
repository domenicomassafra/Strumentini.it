import { mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { currentEvidenceSourceFingerprint } from "../scripts/lib/current-revision";

const execFileAsync = promisify(execFile);

describe("evidence source fingerprint", () => {
  it("represents a tracked working-tree deletion instead of crashing", async () => {
    const root = await mkdtemp(join(tmpdir(), "strumentini-fingerprint-"));
    try {
      await execFileAsync("git", ["init"], { cwd: root });
      await writeFile(join(root, "package.json"), '{"name":"fixture"}\n', "utf8");
      await execFileAsync("git", ["add", "package.json"], { cwd: root });
      const before = await currentEvidenceSourceFingerprint(root);
      await unlink(join(root, "package.json"));
      const after = await currentEvidenceSourceFingerprint(root);
      expect(after).toMatch(/^[a-f0-9]{64}$/u);
      expect(after).not.toBe(before);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
