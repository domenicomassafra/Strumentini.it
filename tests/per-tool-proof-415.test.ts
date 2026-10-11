import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { catalog } from "../src/generated/catalog";
import { createProofMap415, probeReceipt415, auditCurrentProofMap415 } from "../scripts/audit-per-tool-proof-415";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const fingerprint = "a".repeat(64);
const revision = "b".repeat(40);

describe("#415 auditable claim/limit/proof map", () => {
  it("covers every one of the 269 live catalog routes with actual jobs and independent-proof pending statuses", async () => {
    const current = await auditCurrentProofMap415(resolve(import.meta.dirname, ".."));
    expect(current.entries).toHaveLength(269);
    expect(new Set(current.entries.map(row => row.route)).size).toBe(269);
    expect(current.entries.map(row => row.toolId).toSorted()).toEqual(catalog.map(tool => tool.id).toSorted());
    expect(current.entries.every(row => row.jobs.length > 0 && row.inputs.length > 0 && row.source.manifestPresent && row.source.pagePresent)).toBe(true);
    expect(current.entries.every(row => row.currentProof !== "VERIFIED" || row.currentReceipt?.startsWith("quality/receipts/"))).toBe(true);
    expect(current.summary.verified + current.summary.pending).toBe(269);
    expect(current.summary.sourceErrors).toBe(0);
    // Historical Gold is explicitly NOT a current source-bound receipt.
    expect(current.summary.verified).toBe(0);
    expect(current.summary.pending).toBe(269);
    const csv = current.entries.find(row=>row.toolId === "csv-dedupe")!;
    expect(csv.limits).toContainEqual({kind:"handoff-accepts",maxBytes:10*1024*1024,format:"csv"});
    expect(csv.historicalIndexReceipt).toBe("quality/receipts/table-ops/csv-dedupe.gold.json");
    expect(csv.currentReceipt).toBeNull();
    const pdf = current.entries.find(row=>row.toolId === "pdf-merge")!;
    expect(pdf.limitsStatus).toBe("PENDING_RUNTIME_LIMIT_ATTESTATION");
  });

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
      expectedSha256:hash(original),fingerprint,revision};
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
});
