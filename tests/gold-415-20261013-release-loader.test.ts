/** #415: the release loader must preserve a supplied malformed Gold flag as a refusal. */
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadGoldReceipts } from "../scripts/validate-release";
import { probeReceipt415, readCurrentFixtureHashes415 } from "../scripts/audit-per-tool-proof-415";
import { currentEvidenceSourceFingerprint, currentRevision } from "../scripts/lib/current-revision";
import { catalog } from "../src/generated/catalog";
import { validateGoldReceipts, type ToolCertificationReceipt } from "../src/release/validation";

const root = resolve(import.meta.dirname, "..");
const tool = catalog.find((entry) => entry.id === "business-day")!;
const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");

describe("#415 release receipt JSON loader retains strict Gold-eligibility semantics", () => {
  it("rejects supplied nonboolean values and preserves valid boolean/omitted legacy receipts", async () => {
    const [manifest, page, registry, fixtureIndex, fingerprint, revision] = await Promise.all([
      readFile(resolve(root, `src/tools/${tool.id}/manifest.ts`)),
      readFile(resolve(root, `src/pages/tools/${tool.id}.astro`)),
      readFile(resolve(root, "quality/oracles/registry.json")),
      readFile(resolve(root, "quality/fixtures/index.json"), "utf8"),
      currentEvidenceSourceFingerprint(root), currentRevision(root),
    ]);
    expect(page.length).toBeGreaterThan(0);
    const registered = JSON.parse(registry.toString("utf8")) as { entries: { id: string }[] };
    expect(registered.entries.some((entry) => entry.id === tool.gold.oracleEntryId)).toBe(true);
    const index = JSON.parse(fixtureIndex) as { families: { id: string; path: string }[] };
    const fixtureHashes = await readCurrentFixtureHashes415(root, tool.gold.fixtureFamilies, index.families);
    expect(fixtureHashes).not.toBeNull();
    const manifestSha256 = sha256(manifest);
    const registrySha256 = sha256(registry);

    // No production receipt is created or changed. Only isolated temporary
    // JSON is read by the actual release CLI loader, then removed in finally.
    const temporary = await mkdtemp(join(tmpdir(), "gold-415-release-loader-"));
    try {
      const receiptFile = join(temporary, "business-day.gold.json");
      for (const [label, value, supplied, accepted] of [
        ["valid", true, true, true],
        ["legacy omitted", undefined, false, true],
        ["explicit false", false, true, false],
        ["null", null, true, false],
        ["string false", "false", true, false],
        ["string true", "true", true, false],
        ["number zero", 0, true, false],
        ["number one", 1, true, false],
        ["array", [], true, false],
        ["object", {}, true, false],
      ] as const) {
        const receipt: Record<string, unknown> = {
          toolId: tool.id, status: "GOLD", schemaVersion: 1,
          revision, sourceFingerprint: fingerprint, runtime: tool.runtime,
          oracleEntryId: tool.gold.oracleEntryId, fixtureFamilies: tool.gold.fixtureFamilies,
          identities: {
            manifestSha256, oracleRegistrySha256: registrySha256,
            ...Object.fromEntries([...fixtureHashes!].map(([family, digest]) => [`fixture:${family}:sha256`, digest])),
          },
        };
        if (supplied) receipt.goldEligible = value;
        const content = JSON.stringify(receipt);
        await writeFile(receiptFile, content, "utf8");

        const probeAccepted = probeReceipt415({
          toolId: tool.id, path: `quality/receipts/${tool.id}.gold.json`, content,
          expectedSha256: sha256(content), fingerprint, revision,
          currentManifestSha256: manifestSha256,
          currentOracleRegistrySha256: registrySha256,
          currentFixtureSha256ByFamily: fixtureHashes!,
        });
        expect(probeAccepted, `${label}: authenticated actual source and fixture bytes`).toBe(accepted);

        const parsed = JSON.parse(content) as ToolCertificationReceipt;
        const direct = validateGoldReceipts([{ id: tool.id, route: tool.route }], [parsed], revision, fingerprint);
        expect(direct.length === 0, `${label}: raw JSON canonical validation`).toBe(accepted);

        const loaded = await loadGoldReceipts(temporary);
        expect(loaded).toHaveLength(1);
        expect(Object.hasOwn(loaded[0]!, "goldEligible"), `${label}: preserve own-property presence`).toBe(supplied);
        const findings = validateGoldReceipts([{ id: tool.id, route: tool.route }], loaded, revision, fingerprint);
        expect(findings.length === 0, `${label}: CLI loader → canonical validator`).toBe(accepted);
      }
      // Unparseable JSON or a top-level JSON null supplies no receipt; the
      // canonical validator must see it as missing rather than Gold.
      for (const invalidJson of ["null", "{not-json"]) {
        await writeFile(receiptFile, invalidJson, "utf8");
        const loaded = await loadGoldReceipts(temporary);
        expect(loaded, `malformed receipt ${invalidJson}`).toEqual([]);
        expect(validateGoldReceipts([{ id: tool.id, route: tool.route }], loaded, revision, fingerprint)
          .map((item) => item.code)).toContain("GOLD_RECEIPT_MISSING");
      }
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });
});
