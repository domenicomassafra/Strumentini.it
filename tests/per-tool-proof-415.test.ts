import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { unzipSync } from "fflate";
import { catalog } from "../src/generated/catalog";
import { createProofMap415, probeReceipt415, auditCurrentProofMap415 } from "../scripts/audit-per-tool-proof-415";
import { batchChecksumManifest, createZip } from "../src/engines/file-privacy";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const fingerprint = "a".repeat(64);
const revision = "b".repeat(40);

describe("#415 auditable claim/limit/proof map", () => {
  it("covers every one of the 274 live catalog routes with actual jobs and independent-proof pending statuses", async () => {
    const current = await auditCurrentProofMap415(resolve(import.meta.dirname, ".."));
    expect(current.entries).toHaveLength(274);
    expect(new Set(current.entries.map(row => row.route)).size).toBe(274);
    expect(current.entries.map(row => row.toolId).toSorted()).toEqual(catalog.map(tool => tool.id).toSorted());
    expect(current.entries.every(row => row.jobs.length > 0 && row.inputs.length > 0 && row.source.manifestPresent && row.source.pagePresent)).toBe(true);
    expect(current.entries.every(row => row.currentProof !== "VERIFIED" || row.currentReceipt?.startsWith("quality/receipts/"))).toBe(true);
    expect(current.summary.verified + current.summary.pending).toBe(274);
    expect(current.summary.sourceErrors).toBe(0);
    // Historical Gold is explicitly NOT a current source-bound receipt.
    expect(current.summary.verified).toBe(0);
    expect(current.summary.pending).toBe(274);
    const csv = current.entries.find(row=>row.toolId === "csv-dedupe")!;
    expect(csv.limits).toContainEqual({kind:"handoff-accepts",maxBytes:10*1024*1024,format:"csv"});
    expect(csv.historicalIndexReceipt).toBe("quality/receipts/table-ops/csv-dedupe.gold.json");
    expect(csv.currentReceipt).toBeNull();
    const pdf = current.entries.find(row=>row.toolId === "pdf-merge")!;
    expect(pdf.limitsStatus).toBe("PENDING_RUNTIME_LIMIT_ATTESTATION");
  }, 20_000); // Hashing 271 live source manifests/receipts can exceed 5s on shared CI CPUs.

  it("refuses missing or duplicate routes, aliasing, missing jobs and forged current quality candidate", () => {
    expect(() => createProofMap415([catalog[0]!, catalog[0]!], new Map(), new Map())).toThrow();
    expect(() => createProofMap415([{...catalog[0]!, jobs:[]}],new Map(),new Map())).toThrow();
    expect(() => createProofMap415([{...catalog[0]!,route:"/tools/../evil"}],new Map(),new Map())).toThrow();
  });

  it("accepts internally consistent source-bound raw receipt fixture and rejects stale/tampered cases", () => {
    const receiptPath = "quality/receipts/business-day.gold.json";
    const original = JSON.stringify({toolId:"business-day",status:"GOLD",schemaVersion:1,
      revision,sourceFingerprint:fingerprint,runtime:{location:"LOCAL",network:"forbidden"},
      oracleEntryId:"cand-083",fixtureFamilies:["business-days"],goldEligible:true,
      identities:{manifestSha256:hash("live-manifest")} });
    const probe = {toolId:"business-day",path:receiptPath,content:original,
      expectedSha256:hash(original),fingerprint,revision,
      currentManifestSha256:hash("live-manifest")};
    expect(probeReceipt415(probe)).toBe(true);
    expect(probeReceipt415({...probe,expectedSha256:"0".repeat(64)})).toBe(false);
    expect(probeReceipt415({...probe,fingerprint:"c".repeat(64)})).toBe(false);
    expect(probeReceipt415({...probe,revision:"d".repeat(40)})).toBe(false);
    expect(probeReceipt415({...probe,path:"../../secret"})).toBe(false);
    expect(probeReceipt415({...probe,content:original.replace('"GOLD"','"PENDING"')})).toBe(false);
    expect(probeReceipt415({...probe,content:"{bad-json"})).toBe(false);
    expect(probeReceipt415({...probe,toolId:"pdf-merge"})).toBe(false);
    expect(probeReceipt415({...probe,content:original.replace('"goldEligible":true','"goldEligible":false')})).toBe(false);
  });

  it("fails closed when a hashed GOLD receipt claims a stale per-route manifest despite current fingerprint/revision", () => {
    // Independent, adversarial source fixture: source byte A is the checked
    // current manifest, source byte B is an older manifest's claimed identity.
    // Receipt JSON and external SHA-256 remain internally consistent, so
    // validating only the receipt blob or global fingerprint is insufficient.
    const sourceManifest = 'export const manifest = { jobs: ["calculate current rate"], runtime: { location: "LOCAL", network: "forbidden" } };';
    const oldManifest = 'export const manifest = { jobs: ["calculate old rate"], runtime: { location: "LOCAL", network: "forbidden" } };';
    const record = {
      toolId: "rate-converter", schemaVersion: 1, status: "GOLD", goldEligible: true,
      revision, sourceFingerprint: fingerprint,
      runtime: { location: "LOCAL", network: "forbidden" },
      oracleEntryId: "cand-001", fixtureFamilies: ["currency"],
      identities: { manifestSha256: hash(oldManifest) },
    };
    const staleBytes = JSON.stringify(record);
    const base = {
      toolId: record.toolId, path: "quality/receipts/client-time-math/rate-converter.gold.json",
      content: staleBytes, expectedSha256: hash(staleBytes), fingerprint, revision,
      currentManifestSha256: hash(sourceManifest),
    };
    expect(probeReceipt415(base)).toBe(false);
    const currentBytes = JSON.stringify({ ...record, identities: { manifestSha256: hash(sourceManifest) } });
    expect(probeReceipt415({ ...base, content: currentBytes, expectedSha256: hash(currentBytes) })).toBe(true);
    expect(probeReceipt415({ ...base, currentManifestSha256: undefined })).toBe(false);
  });

  it("checks two independent local producer outputs: checksum manifest versus Node crypto, ZIP versus fflate unzip", async () => {
    // Real consumer-side bytes, NOT synthetic Gold receipts or UI claims.
    const left = new File(["abc"], "known.txt", { type: "text/plain" });
    const right = new File(["a,b\n1,2\n"], "rows.csv", { type: "text/csv" });
    const manifest = await batchChecksumManifest({ files: [left, right] });
    const expectedManifest = [
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad  known.txt",
      hash("a,b\n1,2\n") + "  rows.csv",
      "",
    ].join("\n");
    expect(manifest.manifest).toEqual(expectedManifest);
    expect(manifest.count).toBe(2);
    const archive = await createZip({ files: [left, right] });
    expect(archive.operation).toBe("zip-creator");
    expect(archive.blob).toBeInstanceOf(Blob);
    const decompressed = unzipSync(new Uint8Array(await (archive.blob as Blob).arrayBuffer()));
    expect(Object.keys(decompressed).toSorted()).toEqual(["known.txt", "rows.csv"]);
    expect(new TextDecoder().decode(decompressed["known.txt"])).toBe("abc");
    expect(new TextDecoder().decode(decompressed["rows.csv"])).toBe("a,b\n1,2\n");
  });
});
