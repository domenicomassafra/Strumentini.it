import { existsSync, readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { compressPngLossless47 } from "../src/engines/image/png-lossless-47";
import { verifyGeneratedArtifact } from "../src/runtime/artifact-verifier";
import { evaluateFormatClaimEvidence } from "../src/quality/format-evidence";
import type { FormatOperationRow } from "../src/quality/format-operations";
import {
  auditFormatOperationCoverage65,
  loadFormatCoverage65,
  validateConversionOutputProof65,
  type FormatCoverage65,
} from "../scripts/format-operation-coverage";

const rows = JSON.parse(readFileSync(new URL("../quality/format-operations/registry.json", import.meta.url), "utf8")) as Record<string, unknown>[];
const evidence = JSON.parse(readFileSync(new URL("../quality/format-operations/coverage.json", import.meta.url), "utf8")) as FormatCoverage65;
const binary = JSON.parse(readFileSync(new URL("../quality/format-operations/conversion-output-proof.json", import.meta.url), "utf8")) as Record<string, unknown>;
const files = (name: string): boolean => existsSync(new URL(`../${name}`, import.meta.url));

describe("#65 exhaustive high-priority format-operation gate", () => {
  it("checks every direction against real engine, public route or declared engine-only implementation, executable proof and fidelity", () => {
    const report = loadFormatCoverage65();
    expect(report.errors).toEqual([]);
    expect(report.counts).toEqual({ IMPLEMENTED: 41, BLOCKED: 16, REFUSED: 6 });
    expect(report.rows).toHaveLength(63);
    expect(report.rows.filter((row) => row.classification === "IMPLEMENTED").every((row) =>
      !!row.engine && !!row.proof && !!row.fidelity && !!row.checks?.includes("fidelity") && (!!row.route || row.exposure === "engine-only"))).toBe(true);
    for (const id of ["convert-heic-jpeg", "convert-heic-png", "convert-heic-webp", "convert-heic-pdf"]) {
      expect(report.rows.find((row) => row.id === id)).toMatchObject({
        classification: "IMPLEMENTED", releaseEligible: false,
      });
      expect(report.rows.find((row) => row.id === id)?.releaseReason).toMatch(/synthetic HEIC/u);
    }
  });

  it("fails missing, duplicate, phantom and misclassified implementation rows", () => {
    const missing = rows.filter((row) => row.id !== "convert-heic-pdf");
    expect(auditFormatOperationCoverage65(missing, evidence, files).errors).toContain("missing high-priority format-operation row: convert-heic-pdf");
    const duplicate = [...rows, rows[0]];
    expect(auditFormatOperationCoverage65(duplicate, evidence, files).errors).toContain("duplicate format-operation id: compress-jpeg");
    const fakeImplemented = rows.map((row) => row.id === "compress-gzip" ? { ...row, state: "IMPLEMENT", reason: undefined } : row);
    expect(auditFormatOperationCoverage65(fakeImplemented, evidence, files).errors).toContain("IMPLEMENT row missing runnable route/engine proof: compress-gzip");
    const invented = { ...rows[0], id: "forged-operation", state: "IMPLEMENT", ticket: "fixture" };
    expect(auditFormatOperationCoverage65([...rows, invented], evidence, files).errors).toContain("untracked high-priority format-operation row: forged-operation");
  });

  it("fails advertised routes missing in source, missing executable tests, and engine-only routes disguised as public", () => {
    const original = evidence.implementationEvidence[0]!;
    const tamper = (patch: Record<string, unknown>) => ({ ...evidence,
      implementationEvidence: [{ ...original, ...patch }, ...evidence.implementationEvidence.slice(1)] }) as FormatCoverage65;
    expect(auditFormatOperationCoverage65(rows, tamper({ route: "invented-no-route" }), files).errors)
      .toContain("proof[0]: nonexistent route or conflicting exposure");
    expect(auditFormatOperationCoverage65(rows, tamper({ engine: "src/engines/fake/missing.ts" }), (path) => path !== "src/engines/fake/missing.ts" && files(path)).errors)
      .toContain("proof[0]: missing or invalid engine file");
    expect(auditFormatOperationCoverage65(rows, tamper({ test: "tests/absent.test.ts" }), (path) => path !== "tests/absent.test.ts" && files(path)).errors)
      .toContain("proof[0]: missing or invalid executable test source");
    expect(auditFormatOperationCoverage65(rows, tamper({ route: undefined, exposure: undefined }), files).errors)
      .toContain("proof[0]: no public route and no explicit engine-only disclosure");
  });

  it("fails missing size/target/fidelity evidence and unsourced refusal", () => {
    const targetIndex = evidence.implementationEvidence.findIndex((proof) => proof.ids.includes("compress-image-target-size"));
    const changed = evidence.implementationEvidence.map((proof, index) => index === targetIndex
      ? { ...proof, checks: ["signature", "reopen", "fidelity"] } : proof);
    expect(auditFormatOperationCoverage65(rows, { ...evidence, implementationEvidence: changed }, files).errors)
      .toContain("compress-image-target-size: missing actual-bytes verification contract");
    expect(auditFormatOperationCoverage65(rows, { ...evidence, implementationEvidence: changed }, files).errors)
      .toContain("compress-image-target-size: missing target verification contract");
    const refused = rows.map((row) => row.id === "compress-gzip" ? { ...row, reason: undefined } : row);
    expect(auditFormatOperationCoverage65(refused, evidence, files).errors.join(" ")).toMatch(/REFUSE rows require a reason/u);
  });

  it("measures a real PNG compressor result, independently reopens actual bytes, and refuses an unmet byte ceiling", async () => {
    const pixels = Buffer.alloc(128 * 128 * 4);
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 13; pixels[i + 1] = 55; pixels[i + 2] = 70; pixels[i + 3] = 255;
    }
    const before = await sharp(pixels, { raw: { width: 128, height: 128, channels: 4 } })
      .png({ compressionLevel: 0, palette: false }).toBuffer();
    const transformed = await compressPngLossless47(new Blob([new Uint8Array(before)], { type: "image/png" }));
    const final = new Uint8Array(await transformed.blob.arrayBuffer());
    const reopened = await sharp(final).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(reopened.info).toMatchObject({ width: 128, height: 128, channels: 4 });
    expect(reopened.data).toEqual(pixels);
    expect(transformed.originalBytes).toBe(before.length);
    expect(transformed.outputBytes).toBe(final.length);
    expect(transformed.savedBytes).toBe(before.length - final.length);
    expect(final.length).toBeLessThan(before.length);

    const row = rows.find((record) => record.id === "compress-png-lossless") as unknown as FormatOperationRow;
    const verification = await verifyGeneratedArtifact({
      kind: "image", name: "output.png", declaredMime: "image/png", bytes: final,
      fidelity: { fidelity: "lossless", statement: "Independent Sharp decode confirms RGBA values unchanged." },
      reopen: () => ({ ok: true, method: "sharp/libvips independent PNG decoder", facts: { width: 128, height: 128 } }),
    });
    expect(verification.success).toBe(true);
    const targetMet = evaluateFormatClaimEvidence(row, {
      operationId: row.id, beforeBytes: before.length, targetBytes: final.length, verification,
    });
    const targetMissed = evaluateFormatClaimEvidence(row, {
      operationId: row.id, beforeBytes: before.length, targetBytes: final.length - 1, verification,
    });
    expect(targetMet.record).toMatchObject({ beforeBytes: before.length, afterBytes: final.length,
      deltaBytes: final.length - before.length, target: { bytes: final.length, met: true } });
    expect(targetMissed.record?.target).toEqual({ bytes: final.length - 1, met: false });
  });

  it("rejects forged binary proof for every implemented image/PDF conversion", () => {
    const typedRows = rows as unknown as FormatOperationRow[];
    expect(validateConversionOutputProof65(binary, evidence, typedRows)).toEqual([]);
    const observations = binary.directions as Array<Record<string, unknown>>;
    const first = observations[0]!;
    const sabotage = (mutated: Record<string, unknown>[]) => validateConversionOutputProof65({ ...binary, directions: mutated }, evidence, typedRows);
    expect(sabotage(observations.slice(1)).join(" ")).toMatch(/Missing browser conversion binary evidence/u);
    expect(sabotage([{ ...first, signature: [1, 2, 3, 4, 5, 6, 7, 8] }, ...observations.slice(1)]).join(" ")).toMatch(/output signature\/MIME mismatch/u);
    expect(sabotage([{ ...first, outputBytes: 0 }, ...observations.slice(1)]).join(" ")).toMatch(/missing real before\/after bytes/u);
    expect(sabotage([{ ...first, reopen: null }, ...observations.slice(1)]).join(" ")).toMatch(/independent reopen absent/u);
  });
});
