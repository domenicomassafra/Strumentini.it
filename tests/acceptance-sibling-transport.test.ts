import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SIBLING_ACCEPTANCE } from "../scripts/acceptance/browser-performance-verdict.mjs";

const root = resolve(import.meta.dirname, "..");
const read = (path: string): string => readFileSync(resolve(root, path), "utf8");

const SIBLING_SCRIPTS = [
  "scripts/browser-acceptance.mjs",
  "scripts/acceptance-onboarding.mjs",
  "scripts/acceptance-telemetry.mjs",
  "scripts/acceptance-text-research.mjs",
  "scripts/acceptance-campaign-url.mjs",
  "scripts/acceptance-client-time-math.mjs",
  "scripts/acceptance-business-math.mjs",
  "scripts/acceptance-developer-web.mjs",
  "scripts/acceptance-directory.mjs",
  "scripts/acceptance-table-handoff.mjs",
  "scripts/acceptance-file-hash.mjs",
] as const;

describe("release acceptance sibling transport", () => {
  // These scripts used to spawn python3 -m http.server, which reset parallel browser
  // connections under load and turned a transport defect into a product failure.
  it("serves the compiled build through the one in-process dist server", () => {
    expect(read("scripts/acceptance/dist-server.ts")).toContain("export async function startDistServer(");
    for (const path of SIBLING_SCRIPTS) {
      const source = read(path);
      expect({ path, python: source.includes("python3") }).toEqual({ path, python: false });
      expect({ path, httpServer: source.includes("http.server") }).toEqual({ path, httpServer: false });
      expect({ path, shared: source.includes('tsImport("./acceptance/dist-server.ts"') }).toEqual({ path, shared: true });
      expect({ path, started: source.includes("await startDistServer(") }).toEqual({ path, started: true });
      expect({ path, closed: /await [\w?.]*\.close\(\);/.test(source) }).toEqual({ path, closed: true });
    }
  });

  it("keeps exactly the scripts the browser matrix reports as siblings", () => {
    const declared = SIBLING_ACCEPTANCE.map(({ script }: { readonly script: string }) => script);
    expect([...declared].sort()).toEqual([...SIBLING_SCRIPTS].sort());
  });
});
