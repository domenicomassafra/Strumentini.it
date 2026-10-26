import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const verdictScript = resolve(import.meta.dirname, "../scripts/acceptance/browser-performance-verdict.mjs");

describe("browser-performance exit status", () => {
  it("exits nonzero when four acceptance checks fail despite passing static inspection", () => {
    const dir = mkdtempSync(join(tmpdir(), "browser-verdict-audit-"));
    try {
      const receipt = join(dir, "matrix.json");
      writeFileSync(receipt, JSON.stringify({
        staticInspection: { lazyEngineGate: "PASS", bundleBaseline: { gate: "PASS" } },
        browserMatrix: { requestedEngines: [{ engine: "chromium", status: "PASS" }] },
        freshAcceptance: [
          { command: "build", status: "PASS" },
          ...Array.from({ length: 4 }, (_, i) => ({ command: `acceptance-${i}`, status: "FAIL" })),
        ],
      }));
      const run = spawnSync(process.execPath, [verdictScript, receipt], { encoding: "utf8" });
      expect(run.status).toBe(1);
      expect(run.stdout).toContain('"failureCount":4');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
