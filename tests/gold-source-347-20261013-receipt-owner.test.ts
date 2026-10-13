/** #347: the shipped Gold projector cannot borrow a different tool's receipt path.
 * Synthetic source-current fixture ONLY. No live Gold receipt is reissued.
 */
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { currentEvidenceSourceFingerprint, currentRevision } from "../scripts/lib/current-revision";
import { buildSourceBoundGoldQualityIndex } from "../src/onboarding/quality";
import { catalog } from "../src/generated/catalog";

const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");

describe("#347 public Gold source-bound receipt ownership", () => {
  it("fails closed when a fully hashed real-tool receipt is stored under another tool's filename", async () => {
    const root = resolve(import.meta.dirname, "..");
    const tool = catalog.find(item => item.id === "business-day")!;
    const [original, sourceFingerprint, revision, manifest, registry, fixtureIndex] = await Promise.all([
      readFile(join(root, "quality/receipts/business-day.gold.json"), "utf8"),
      currentEvidenceSourceFingerprint(root), currentRevision(root),
      readFile(join(root, "src/tools/business-day/manifest.ts")),
      readFile(join(root, "quality/oracles/registry.json")),
      readFile(join(root, "quality/fixtures/index.json"), "utf8"),
    ]);
    const originalReceipt = JSON.parse(original) as Record<string, unknown>;
    const oracle = JSON.parse(registry.toString("utf8")) as { entries: { id: string }[] };
    expect(oracle.entries.some(entry => entry.id === tool.gold.oracleEntryId)).toBe(true);
    const fixtures = JSON.parse(fixtureIndex) as { families: { id: string; path: string }[] };
    const family = fixtures.families.find(entry => entry.id === "business-days")!;
    const fixtureBytes = await readFile(join(root, family.path));
    expect(tool.gold.fixtureFamilies).toEqual([family.id]);

    // Reissue only in an isolated directory. All identity hashes come from
    // the checkout's genuine current sources, never a guessed 64-char string.
    const receipt = {
      ...originalReceipt,
      syntheticFixtureOnly: true,
      revision, sourceFingerprint,
      oracleEntryId: tool.gold.oracleEntryId,
      fixtureFamilies: [...tool.gold.fixtureFamilies],
      runtime: tool.runtime,
      identities: {
        manifestSha256: sha256(manifest),
        oracleRegistrySha256: sha256(registry),
        [`fixture:${family.id}:sha256`]: sha256(fixtureBytes),
      },
    };
    const isolated = await mkdtemp(join(tmpdir(), "gold-source-347-owner-"));
    try {
      const render = async (receiptPath: string) => {
        const physical = join(isolated, receiptPath);
        await mkdir(dirname(physical), { recursive: true });
        await writeFile(physical, JSON.stringify(receipt, null, 2) + "\n");
        const diskBytes = await readFile(physical);
        const raw = { ...JSON.parse(diskBytes.toString("utf8")), receiptPath, receiptSha256: sha256(diskBytes) };
        return buildSourceBoundGoldQualityIndex([raw], [tool.id], sourceFingerprint);
      };
      const legitimate = await render("quality/receipts/date-time/business-day.gold.json");
      expect(legitimate.index.tools.map(entry => entry.toolId)).toEqual([tool.id]);
      const borrowed = await render("quality/receipts/date-time/another-tool.gold.json");
      expect(borrowed.index.tools).toEqual([]);
      expect(borrowed.excludedToolIds).toEqual([tool.id]);
      const nonGoldLeaf = await render("quality/receipts/date-time/business-day.json");
      expect(nonGoldLeaf.index.tools).toEqual([]);
      // No valid repository Gold is issued; the real public index is empty.
      const generated = await readFile(join(root, "src/generated/quality.ts"), "utf8");
      expect(generated).toContain('"tools": []');
    } finally {
      await rm(isolated, { recursive: true, force: true });
    }
  }, 20_000);
});
