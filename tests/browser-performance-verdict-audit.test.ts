import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { browserPerformanceVerdict } from "../scripts/acceptance/browser-performance-verdict.mjs";
import { SIBLING_ACCEPTANCE } from "../scripts/acceptance/browser-performance-siblings.mjs";

const verdictScript = resolve(import.meta.dirname, "../scripts/acceptance/browser-performance-verdict.mjs");

describe("browser-performance exit status", () => {
  it("only passes with every expected browser and sibling acceptance observed", () => {
    const engines = ["chromium", "firefox", "webkit"].map((engine) => ({ engine, status: "PASS" }));
    const requiredCommands = [
      "npm run build",
      ...engines.map(({ engine }) => `node scripts/acceptance/browser-performance-matrix.mjs (${engine})`),
      ...SIBLING_ACCEPTANCE.map(({ command }) => command),
    ];
    const receipt = {
      staticInspection: { lazyEngineGate: "PASS", bundleBaseline: { gate: "PASS" } },
      browserMatrix: { requestedEngines: engines },
      freshAcceptance: requiredCommands.map((command) => ({ command, status: "PASS" })),
    };
    expect(browserPerformanceVerdict(receipt).status).toBe("PASS");
    expect(browserPerformanceVerdict({ ...receipt, browserMatrix: { requestedEngines: engines.slice(1) } }).status).toBe("NO_GO");
    expect(browserPerformanceVerdict({ ...receipt, freshAcceptance: receipt.freshAcceptance.slice(1) }).status).toBe("NO_GO");
    expect(browserPerformanceVerdict({ ...receipt, freshAcceptance: [...receipt.freshAcceptance, receipt.freshAcceptance[0]] }).status).toBe("NO_GO");
  });

  it("rejects incomplete browser and acceptance evidence even when every recorded status is PASS", () => {
    const receipt = {
      staticInspection: { lazyEngineGate: "PASS", bundleBaseline: { gate: "PASS" } },
      browserMatrix: { requestedEngines: [{ engine: "chromium", status: "PASS" }] },
      freshAcceptance: [{ command: "npm run build", status: "PASS" }],
    };
    const requiredEngines = ["chromium", "firefox", "webkit"];
    const requiredCommands = ["npm run build", "npm run acceptance:onboarding"];
    expect(browserPerformanceVerdict(receipt, requiredEngines, requiredCommands).status).toBe("NO_GO");
  });

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
      for (let i = 0; i < 4; i += 1) expect(run.stdout).toContain(`acceptance:acceptance-${i}:FAIL`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
