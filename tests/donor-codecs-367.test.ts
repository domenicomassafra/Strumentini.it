import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { compressImageWithDonor47 } from "../src/engines/image/compression-donor-047";
import { makeCodecCorpus367, verifyCodecReadback367 } from "../scripts/donor-codecs-367";
import { assertDonorInventory367, assertDonorRun367 } from "../scripts/compare-jsquash-367";

const fixture = (name: string) => resolve(import.meta.dirname, `../quality/fixtures/image-metadata/${name}`);

describe("#367 real codec byte readback at a public output seam", () => {
  it("pins the prior receipt by SHA256 and rejects missing/substituted WASM inventory bytes", async () => {
    const receiptBytes = await readFile(resolve(import.meta.dirname, "../docs/codec-jsquash-367-2026-10-16.json"));
    expect(createHash("sha256").update(receiptBytes).digest("hex"))
      .toBe("c9c24dd7ee6989c69ae427ffa2265ec5974175727c90404ef2da3c7e217a98ad");
    const { assets } = JSON.parse(receiptBytes.toString("utf8"));
    expect(assets.wasm).toHaveLength(10);
    expect(() => assertDonorInventory367(assets, assets)).not.toThrow();
    expect(() => assertDonorInventory367({ ...assets, wasm: assets.wasm.slice(1) }, assets))
      .toThrow(/DONOR_PIN_MISMATCH/u);
    expect(() => assertDonorInventory367({ ...assets, wasm: assets.wasm.map((w: { sha256: string }, i: number) => i ? w : { ...w, sha256: "0".repeat(64) }) }, assets))
      .toThrow(/DONOR_PIN_MISMATCH/u);
    expect(() => assertDonorInventory367({ ...assets, packages: assets.packages.map((p: { version: string }, i: number) => i ? p : { ...p, version: "unreviewed" }) }, assets))
      .toThrow(/DONOR_PIN_MISMATCH/u);
  });

  it("refuses a false-green donor comparison even if a report contains other successful codecs", () => {
    const moduleUrl = "/.scratch/local-codec-367-20261016/node_modules/@jsquash/jpeg/index.js";
    const wasmPath = "/.scratch/local-codec-367-20261016/node_modules/@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm";
    const connectionViolation = { effectiveDirective: "connect-src", blockedURI: `http://127.0.0.1:1234${wasmPath}`, disposition: "enforce" };
    const wasmViolation = { effectiveDirective: "script-src", blockedURI: "wasm-eval", disposition: "enforce" };
    const passed = {
      engine: "fixture-engine",
      positiveControl: { status: "DONOR_ENCODED", size: 256, moduleUrl, wasmPath, moduleHttpStatus: 200, wasmHttpStatus: 200 },
      strictCsp: { status: "REFUSED", moduleUrl, violations: [connectionViolation] },
      evalBlockedCsp: { status: "REFUSED", moduleUrl, violations: [wasmViolation] },
      noConnectCsp: { status: "REFUSED", moduleUrl, violations: [connectionViolation] },
      cases: ["jpeg", "webp", "oxipng", "avif"].map((name) => ({ name, status: "DONOR_BYTES_REOPENED" })),
      remoteRequests: [] as string[], blockedOffsiteRequests: [] as string[], errors: [] as string[],
    };
    expect(() => assertDonorRun367(passed)).not.toThrow();
    for (const label of ["strictCsp", "evalBlockedCsp", "noConnectCsp"] as const) {
      expect(() => assertDonorRun367({ ...passed, [label]: { status: "REFUSED", moduleUrl, message: "404 Not Found", violations: [] } }))
        .toThrow(/CSP_CAUSE_UNPROVEN/u);
      expect(() => assertDonorRun367({ ...passed, [label]: { status: "REFUSED", moduleUrl,
        violations: [{ effectiveDirective: "img-src", blockedURI: "http://127.0.0.1:1234/img.png", disposition: "enforce" }] } }))
        .toThrow(/CSP_CAUSE_UNPROVEN/u);
      expect(() => assertDonorRun367({ ...passed, [label]: { status: "REFUSED", moduleUrl: "/different-module.js",
        violations: [connectionViolation, wasmViolation] } })).toThrow(/CSP_CAUSE_UNPROVEN/u);
    }
    expect(() => assertDonorRun367({ ...passed, positiveControl: { ...passed.positiveControl, wasmHttpStatus: 404 } }))
      .toThrow(/CSP_POSITIVE_CONTROL_MISSING/u);
    expect(() => assertDonorRun367({ ...passed, strictCsp: { status: "REFUSED", moduleUrl, violations: [wasmViolation] } }))
      .toThrow(/CSP_CAUSE_UNPROVEN/u);
    expect(() => assertDonorRun367({ ...passed, evalBlockedCsp: { status: "REFUSED", moduleUrl, violations: [],
      message: "CompileError: Refused to create a WebAssembly object because 'wasm-unsafe-eval' is not an allowed source of script in the Content Security Policy directive: \"script-src 'self'\"." } }))
      .not.toThrow();
    expect(() => assertDonorRun367({ ...passed, evalBlockedCsp: { status: "REFUSED", moduleUrl, violations: [],
      message: "TypeError: Failed to fetch" } })).toThrow(/CSP_CAUSE_UNPROVEN/u);
    expect(() => assertDonorRun367({ ...passed, evalBlockedCsp: { status: "UNEXPECTED_SUCCESS" } }))
      .toThrow(/CSP_UNEXPECTED_SUCCESS/u);
    expect(() => assertDonorRun367({ ...passed,
      cases: passed.cases.map((item) => item.name === "avif" ? { ...item, status: "INDEPENDENT_DECODER_REFUSED" } : item),
    })).toThrow(/MISSING_DECODER_PROOF/u);
    expect(() => assertDonorRun367({ ...passed, blockedOffsiteRequests: ["https://example.invalid/"] }))
      .toThrow(/BROWSER_EGRESS_OR_ERROR/u);
  });

  it("creates a bounded independent-codec corpus with real JPEG texture and PNG alpha", async () => {
    const corpus = await makeCodecCorpus367();
    expect(corpus.width * corpus.height).toBeLessThan(1_000_000);
    expect(corpus.alphaPng.length).toBeLessThan(4 * 1024 * 1024);
    expect(corpus.photoJpeg.length).toBeLessThan(4 * 1024 * 1024);
    const png = await sharp(corpus.alphaPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const jpg = await sharp(corpus.photoJpeg).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect([png.info.width, png.info.height, jpg.info.width, jpg.info.height])
      .toEqual([corpus.width, corpus.height, corpus.width, corpus.height]);
    const alpha = [...png.data].filter((_, at) => at % 4 === 3);
    expect(alpha).toContain(0);
    expect(alpha).toContain(128);
    expect(alpha).toContain(255);
    expect(jpg.data.every((value, at) => at % 4 !== 3 || value === 255)).toBe(true);
    expect(new Set(jpg.data.filter((_, at) => at % 4 === 0)).size).toBeGreaterThan(100);
  });

  it("independently reopens a local lossless PNG and preserves all RGBA pixels", async () => {
    const input = await readFile(fixture("transparent-2x2-rgba.png"));
    const result = await compressImageWithDonor47(new Blob([input], { type: "image/png" }), { mode: "png-lossless" });
    const verified = await verifyCodecReadback367(Buffer.from(await result.blob.arrayBuffer()), "image/png", {
      width: 2, height: 2, source: input, requirePixelsExact: true,
    });
    expect(verified.width).toBe(2);
    expect(verified.alphaExact).toBe(true);
    expect(verified.pixelsExact).toBe(true);
    expect(verified.sha256).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("rejects format spoofing even when a supplied MIME claims JPEG", async () => {
    const bytes = await readFile(fixture("transparent-2x2-rgba.png"));
    await expect(verifyCodecReadback367(bytes, "image/jpeg", { width: 2, height: 2 }))
      .rejects.toThrow(/FORMAT_MISMATCH/u);
  });

  it("rejects truncated output and dimension lies with decoder readback", async () => {
    const bytes = await readFile(fixture("transparent-2x2-rgba.png"));
    await expect(verifyCodecReadback367(bytes.subarray(0, 28), "image/png", { width: 2, height: 2 }))
      .rejects.toThrow(/DECODE_FAILED/u);
    await expect(verifyCodecReadback367(bytes, "image/png", { width: 3, height: 2 }))
      .rejects.toThrow(/DIMENSION_MISMATCH/u);
  });

  it("rejects alpha loss independently of image size and MIME", async () => {
    const source = await readFile(fixture("transparent-2x2-rgba.png"));
    const opaque = await sharp(source).flatten({ background: "white" }).png().toBuffer();
    await expect(verifyCodecReadback367(opaque, "image/png", { width: 2, height: 2, source }))
      .rejects.toThrow(/ALPHA_MISMATCH/u);
  });
});
