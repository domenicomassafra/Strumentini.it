/**
 * #415 original AC3 — runnable, bounded source-backed consumer sample.
 * This is ONE representative set of local engines, NOT 274 Gold certificates.
 * Direct producer bytes are independently read by fflate and node:zlib.
 * Unexamined routes, device runs, release receipts and runtime limits remain PENDING.
 */
import { createHash } from "node:crypto";
import { gunzipSync as gunzipIndependent } from "node:zlib";
import { resolve } from "node:path";
import { unzipSync as unzipIndependent } from "fflate";
import { describe, expect, it } from "vitest";
import { catalog } from "../src/generated/catalog";
import { qualityIndex } from "../src/generated/quality";
import { goldToolIds } from "../src/onboarding/quality";
import { auditCurrentProofMap415 } from "../scripts/audit-per-tool-proof-415";
import { createZip } from "../src/engines/file-privacy";
import { BATCH_410_MAX_FILE_BYTES, runBatchTextGzip410 } from "../src/runtime/batch-file-410";

const root = resolve(import.meta.dirname, "..");
const encoder = new TextEncoder();
const textFile = (name: string, content: string) => new File([content], name, { type: name.endsWith(".csv") ? "text/csv" : "text/plain" });
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const gzipBytes = async (item: { output?: { blob: Blob } }) => new Uint8Array(await item.output!.blob.arrayBuffer());

describe("#415 representative independent real engine proof (source-only, no Gold)", () => {
  it("maps every live catalog tool to job, limit status, source identity and current proof OR explicit PENDING", async () => {
    const map = await auditCurrentProofMap415(root);
    expect(map.scope).toBe("source-local-readonly-no-release");
    expect(map.entries).toHaveLength(274);
    expect(new Set(map.entries.map((item) => item.toolId)).size).toBe(274);
    expect(new Set(map.entries.map((item) => item.route)).size).toBe(274);
    expect(map.entries.map((item) => item.toolId).toSorted()).toEqual(catalog.map((tool) => tool.id).toSorted());
    for (const entry of map.entries) {
      expect(entry.route, entry.toolId).toBe(`/tools/${entry.toolId}`);
      expect(entry.jobs.length, entry.toolId).toBeGreaterThan(0);
      expect(entry.inputs.length, entry.toolId).toBeGreaterThan(0);
      expect(entry.source.manifestPresent && entry.source.pagePresent, entry.toolId).toBe(true);
      expect(entry.registryBinding, entry.toolId).toBe("REGISTERED");
      expect(["DECLARED_HANDOFF_LIMITS_ONLY", "PENDING_RUNTIME_LIMIT_ATTESTATION"], entry.toolId).toContain(entry.limitsStatus);
      if (entry.limitsStatus === "PENDING_RUNTIME_LIMIT_ATTESTATION") expect(entry.limits).toEqual([]);
      if (entry.currentProof === "PENDING") expect(entry.currentReceipt, entry.toolId).toBeNull();
      else expect(entry.currentReceipt, entry.toolId).toMatch(/^quality\/receipts\/[a-z0-9_/-]+\.gold\.json$/u);
    }
    const publicGoldIds = goldToolIds(qualityIndex);
    expect(map.summary).toMatchObject({
      tools: 274, sourceErrors: 0,
      runtimeLimitsPending: 231, registryBindingsPending: 0,
    });
    expect(map.summary.verified + map.summary.pending).toBe(274);
    expect(map.entries.filter((item) => item.limitsStatus === "DECLARED_HANDOFF_LIMITS_ONLY")).toHaveLength(43);
    expect(map.entries.filter((item) => item.currentProof === "PENDING").every((item) => item.currentReceipt === null)).toBe(true);
    // Public Gold is source-fingerprint-bound; the stricter audit also requires
    // each receipt to name this exact Git HEAD. A receipt from a parent commit
    // may stay in the public projection but must remain PENDING in this audit.
    // No audited positive may come from outside the public Gold candidates.
    expect(map.entries.filter((item) => item.currentProof === "VERIFIED")
      .every((item) => publicGoldIds.has(item.toolId) && item.currentReceipt !== null)).toBe(true);
  }, 20_000);

  it("checks real catalog ZIP creator output using independent ZIP reader; rejected and cancelled attempts preserve earlier bytes", async () => {
    const route = catalog.find((tool) => tool.id === "zip-creator");
    expect(route).toMatchObject({ id: "zip-creator", route: "/tools/zip-creator" });
    const fixture = [textFile("first.txt", "source-bound first\n"), textFile("second.csv", "a,b\n1,2\n")];
    const success = await createZip({ files: fixture });
    expect(success.operation).toBe("zip-creator");
    expect(success.blob).toBeInstanceOf(Blob);
    const originalBytes = new Uint8Array(await (success.blob as Blob).arrayBuffer());
    const originalSha256 = hash(originalBytes);
    const unpacked = unzipIndependent(originalBytes);
    expect(Object.keys(unpacked).toSorted()).toEqual(["first.txt", "second.csv"]);
    expect(new TextDecoder().decode(unpacked["first.txt"])).toBe("source-bound first\n");
    expect(new TextDecoder().decode(unpacked["second.csv"])).toBe("a,b\n1,2\n");

    await expect(createZip({ files: ["not-a-File"] })).rejects.toMatchObject({
      name: "FilePrivacyError", code: "INVALID_INPUT",
    });
    const cancel = new AbortController();
    cancel.abort();
    await expect(createZip({ files: fixture }, cancel.signal)).rejects.toMatchObject({ code: "CANCELLED" });
    expect(hash(new Uint8Array(await (success.blob as Blob).arrayBuffer()))).toBe(originalSha256);
    expect(fixture.map((file) => file.size)).toEqual([encoder.encode("source-bound first\n").length, encoder.encode("a,b\n1,2\n").length]);
  });

  it("refuses malformed/truncated/huge items without outputs; retains valid earlier/later outputs and cancels without partial publication", async () => {
    const priorInput = textFile("first.txt", "Keep verified data — α\n");
    const validLater = textFile("last.csv", "one,two\n3,4\n");
    const rejected = new File([new Uint8Array([0xff, 0xfe, 0x00])], "not-utf8.csv", { type: "text/csv" });
    const huge = new File([new Uint8Array(BATCH_410_MAX_FILE_BYTES + 1)], "over-limit.txt", { type: "text/plain" });
    const truncated = textFile("truncated.txt", "source was longer than one byte");
    Object.defineProperty(truncated, "arrayBuffer", { value: async () => encoder.encode("s").buffer });

    const outputs = await runBatchTextGzip410([priorInput, rejected, huge, truncated, validLater]);
    expect(outputs.map((item) => [item.status, item.reason ?? null])).toEqual([
      ["success", null], ["unsupported", "UNSUPPORTED_ENCODING"],
      ["unsupported", "FILE_TOO_LARGE"], ["unsupported", "UNSUPPORTED_ENCODING"], ["success", null],
    ]);
    expect(outputs.slice(1, 4).every((item) => item.output === undefined)).toBe(true);
    const priorCompressed = await gzipBytes(outputs[0]!);
    const priorSha256 = hash(priorCompressed);
    expect(gunzipIndependent(priorCompressed)).toEqual(Buffer.from(encoder.encode("Keep verified data — α\n")));
    expect(gunzipIndependent(await gzipBytes(outputs[4]!))).toEqual(Buffer.from(encoder.encode("one,two\n3,4\n")));

    const aborter = new AbortController();
    const cancelled = await runBatchTextGzip410([
      textFile("ok.txt", "verified before cancel"), textFile("blocked.txt", "no partial content"), textFile("later.txt", "not run"),
    ], { signal: aborter.signal, onItem(item) { if (item.status === "success") aborter.abort(); } });
    expect(cancelled.map((item) => [item.status, item.reason ?? null])).toEqual([
      ["success", null], ["cancelled", "CANCELLED"], ["cancelled", "CANCELLED"],
    ]);
    expect(cancelled[1]!.output).toBeUndefined();
    expect(cancelled[2]!.output).toBeUndefined();
    expect(new TextDecoder().decode(gunzipIndependent(await gzipBytes(cancelled[0]!)))).toBe("verified before cancel");
    // Never retroactively corrupt the completed Blob when a later job refuses,
    // a truncated read is encountered or a different batch is cancelled.
    expect(hash(await gzipBytes(outputs[0]!))).toBe(priorSha256);
    expect(await priorInput.text()).toBe("Keep verified data — α\n");
  }, 20_000);
});
