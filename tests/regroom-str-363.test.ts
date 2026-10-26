import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { preflightAllocation, ImageResizeError } from "../src/engines/image/policy";
import { mutatePdf } from "../src/engines/pdf";
import { cleanCsvText, readBlobText } from "../src/engines/table/csv";
import { preflightHeavyLocalJob } from "../src/runtime/heavy-preflight";
import { assessMobileMemory363Compiled } from "../scripts/lib/mobile-memory-363-compiled";
import { assessMobileMemory363, MOBILE_363_EVIDENCE_DIR, MOBILE_363_FORMATS, MOBILE_363_PHASES, MOBILE_363_PLATFORMS, MOBILE_363_ROUTES, MOBILE_363_SIZES, validateMobile363PromotionIdentity, validateMobileMemory363 } from "../scripts/lib/mobile-memory-363";

const hash = (data: string) => createHash("sha256").update(data).digest("hex");
const revision = "a".repeat(40);
const fixtureHash = hash("STR-363 UNIT TEST ONLY - NOT A DEVICE MEASUREMENT");

// Synthetic UNIT fixtures exercise the receipt gate. They are never persisted as device evidence.
function fixtureReceipt() {
  return {
    schemaVersion: 1, ticket: "STR-363", evidenceKind: "SIMULATED_DEVICE_ONLY",
    physicalDeviceObserved: false, sourceRevision: revision, observedAt: "2026-10-20T09:00:00Z",
    cases: MOBILE_363_PLATFORMS.flatMap((platform) => MOBILE_363_FORMATS.flatMap((format) =>
      MOBILE_363_SIZES.flatMap((size) => MOBILE_363_PHASES.map((phase) => ({
        platform, format, size, phase, status: "PASS", compiledConsumer: true,
        device: { model: platform === "IOS_SIMULATOR" ? "iPhone test fixture" : "Android test fixture", osVersion: "unit", browser: "test-only", browserVersion: "0.0" },
        route: `/tools/${format}-test/`, routeSha256: fixtureHash,
        input: { bytes: 1024, sha256: fixtureHash },
        memory: { metric: "PROCESS_PSS_KB", before: 100, after: 100, peak: 110 },
        frame: { samples: 20, maxIntervalMs: 20 }, inputLatencyMs: 12, operationElapsedMs: 30,
        recovery: { cancel: "PASS", background: "PASS", retry: "PASS", reopen: "PASS", oom: "PREFLIGHT_RECOVERED", actualOomObserved: false },
        output: { bytes: 1040, sha256: fixtureHash, reopenedWith: "unit-only", reopenedIndependently: true, verifiedContent: "unit-only" },
        evidenceSource: "UNIT_FIXTURE_NOT_DEVICE_EVIDENCE",
      }))))),
  };
}

function plausibleButUnobserved() {
  const receipt = fixtureReceipt();
  receipt.cases.forEach((row) => {
    const ios = row.platform === "IOS_SIMULATOR";
    row.device = ios
      ? { model: "iPhone 18 Pro", osVersion: "iOS 27.0", browser: "Safari", browserVersion: "27.0" }
      : { model: "Pixel 7", osVersion: "Android 15", browser: "Chrome", browserVersion: "155.0.0" };
    row.route = MOBILE_363_ROUTES[row.format];
    Object.assign(row, {
      evidenceSource: `${MOBILE_363_EVIDENCE_DIR}/${row.platform.toLowerCase()}-${row.format}-${row.size.toLowerCase()}-${row.phase}.json`,
      evidenceSha256: fixtureHash,
    });
    row.output.reopenedWith = ios ? "PDF.js" : "sharp decoder";
    row.output.verifiedContent = "checksum and content checked";
  });
  return receipt;
}

describe("STR-363 mobile S/M/L memory/recovery evidence", () => {
  it("records observed simulator crashes as failed cases while refusing to promote the matrix", () => {
    const receipt = fixtureReceipt();
    const failed = receipt.cases[0]!;
    Object.assign(failed, {
      status: "FAIL",
      failure: { kind: "CRASH", detail: "Chrome process exited during the observed PDF operation" },
      route: MOBILE_363_ROUTES.pdf,
      evidenceSource: `${MOBILE_363_EVIDENCE_DIR}/ios_simulator-pdf-s-cold.json`,
      evidenceSha256: fixtureHash,
    });
    expect(validateMobileMemory363(receipt)).toEqual([]);
    expect(assessMobileMemory363(receipt).status).toBe("BLOCKED");
    Object.assign(failed, { evidenceSha256: "invalid" });
    expect(validateMobileMemory363(receipt)).toContain("cases[0] observed failure lacks compiled/device/input evidence");
    Object.assign(failed, { evidenceSha256: fixtureHash });
    Object.assign(failed, { failure: { kind: "CRASH", detail: "" } });
    expect(validateMobileMemory363(receipt)).toContain("cases[0] observed failure requires kind and detail");
  });

  it("parses the complete 2 × 3 × 3 × 2 UNIT matrix but never promotes synthetic evidence", () => {
    const fixture = fixtureReceipt();
    expect(fixture.cases).toHaveLength(36);
    expect(validateMobileMemory363(fixture)).toEqual([]);
    expect(assessMobileMemory363(fixture).status).toBe("BLOCKED");
    expect(assessMobileMemory363(fixture).reasons).toContain("schema-only receipt has no verified compiled build or device logs");
    expect(validateMobile363PromotionIdentity(fixture)).toContain("cases[0] synthetic/unit/test marker cannot be device proof");
  });

  it("refuses fabricated and cross-platform identities even when every receipt field looks valid", () => {
    const plausible = plausibleButUnobserved();
    expect(validateMobileMemory363(plausible)).toEqual([]);
    expect(validateMobile363PromotionIdentity(plausible)).toEqual([]);
    expect(assessMobileMemory363(plausible).status).toBe("BLOCKED");
    plausible.cases[0]!.device.browser = "Chrome";
    expect(validateMobile363PromotionIdentity(plausible)).toContain("cases[0] iOS simulator/browser identity inconsistent");
    plausible.cases[0]!.device.browser = "Safari";
    Object.assign(plausible.cases[0]!, { evidenceSource: "unit_test_fake.json" });
    expect(validateMobile363PromotionIdentity(plausible)).toContain("cases[0] independently hashed local device trace missing");
  });

  it("binds candidate evidence to git HEAD, compiled route bytes and hashed trace files, never self-attests", async () => {
    const root = resolve(import.meta.dirname, "..");
    const plausible = plausibleButUnobserved();
    const wrongRevision = await assessMobileMemory363Compiled(plausible, root);
    expect(wrongRevision.status).toBe("BLOCKED");
    expect(wrongRevision.reasons).toContain("source revision does not match checked-out git HEAD");
    const actualRevision = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    plausible.sourceRevision = actualRevision;
    const missingProof = await assessMobileMemory363Compiled(plausible, root);
    expect(missingProof.status).toBe("BLOCKED");
    expect(missingProof.reasons.some((reason) => reason.includes("route SHA differs from compiled consumer"))).toBe(true);
    expect(missingProof.reasons.some((reason) => reason.includes("device trace unavailable/invalid"))).toBe(true);
  });

  it("fails closed for missing or forged simulator measurements", () => {
    const baseline = fixtureReceipt();
    const mutations: Array<(receipt: ReturnType<typeof fixtureReceipt>) => void> = [
      (receipt) => { receipt.physicalDeviceObserved = true; },
      (receipt) => { receipt.evidenceKind = "PHYSICAL_IOS"; },
      (receipt) => { receipt.cases[0]!.memory.peak = 0; },
      (receipt) => { receipt.cases[0]!.memory.metric = "POLICY_ESTIMATE"; },
      (receipt) => { receipt.cases[0]!.frame.samples = 0; },
      (receipt) => { receipt.cases[0]!.inputLatencyMs = -1; },
      (receipt) => { receipt.cases[0]!.recovery.cancel = "NOT_RUN"; },
      (receipt) => { receipt.cases[0]!.recovery.reopen = "NOT_RUN"; },
      (receipt) => { receipt.cases[0]!.output.reopenedIndependently = false; },
      (receipt) => { receipt.cases[0]!.routeSha256 = "missing"; },
      (receipt) => { receipt.cases[0]!.input.sha256 = "missing"; },
      (receipt) => { receipt.cases[0]!.device.browserVersion = ""; },
      (receipt) => { receipt.cases[0]!.recovery.actualOomObserved = true; },
      (receipt) => { receipt.cases.push({ ...receipt.cases[0]! }); },
    ];
    for (const change of mutations) {
      const receipt = structuredClone(baseline);
      change(receipt);
      expect(assessMobileMemory363(receipt).status).toBe("BLOCKED");
    }
    const missing = fixtureReceipt();
    missing.cases.pop();
    expect(validateMobileMemory363(missing)).toEqual([]);
    expect(assessMobileMemory363(missing).status).toBe("BLOCKED");
  });

  it("exercises bounded S/M/L image allocation, actual CSV output hash and independent reopen", () => {
    for (const [size, pixels, rows] of [["S", 64, 12], ["M", 512, 1200], ["L", 2048, 12000]] as const) {
      const allocation = preflightAllocation(pixels * pixels, pixels, pixels, Math.min(pixels, 1200), Math.min(pixels, 1200));
      expect(allocation.estimatedDecodedBytes).toBeGreaterThan(0);
      const csv = "id,value\n" + Array.from({ length: rows }, (_, index) => `${index},value-${index}\n`).join("");
      const originalHash = hash(csv);
      const cleaned = cleanCsvText(csv);
      expect(hash(cleaned.output)).toBe(originalHash);
      expect(cleanCsvText(cleaned.output).output).toBe(cleaned.output);
      expect(cleaned.rows).toBe(rows + 1);
      expect(size).toMatch(/^[SML]$/u);
    }
  });

  it("reopens transformed PDF and image fixtures S/M/L with independent consumers", async () => {
    for (const [size, pages, pixels] of [["S", 1, 64], ["M", 5, 512], ["L", 15, 2048]] as const) {
      const document = await PDFDocument.create();
      for (let index = 0; index < pages; index++) document.addPage([300, 400]);
      const originalPdf = await document.save({ useObjectStreams: false });
      const originalHash = createHash("sha256").update(originalPdf).digest("hex");
      const input = new Blob([Uint8Array.from(originalPdf)], { type: "application/pdf" });
      const cancelled = new AbortController();
      cancelled.abort();
      await expect(mutatePdf(input, { kind: "rotate", filename: "memory.pdf", rotations: { 1: 90 } }, cancelled.signal))
        .rejects.toMatchObject({ code: "CANCELLED" });
      const output = await mutatePdf(input, { kind: "rotate", filename: "memory.pdf", rotations: { 1: 90 } });
      const artifact = output[0]!.bytes;
      const opened = await PDFDocument.load(artifact);
      expect(opened.getPageCount()).toBe(pages);
      expect(opened.getPage(0).getRotation().angle).toBe(90);
      expect(createHash("sha256").update(artifact).digest("hex")).not.toBe(originalHash);

      // Sharp is an independent image decoder for this deterministic fixture test.
      const png = await sharp({ create: { width: pixels, height: pixels, channels: 3, background: "#436f9a" } }).png().toBuffer();
      const jpeg = await sharp(png).resize(Math.max(1, pixels / 2)).jpeg().toBuffer();
      const verified = await sharp(jpeg).metadata();
      expect(verified.format).toBe("jpeg");
      expect(verified.width).toBe(pixels / 2);
      expect(hash(size)).toMatch(/^[a-f\d]{64}$/u);
    }
  }, 20_000);

  it("rejects a controlled over-budget job without corrupting subsequent result", async () => {
    expect(() => preflightAllocation(1, 8192, 8192, 8192, 8192)).toThrow(ImageResizeError);
    const policy = { capabilities: { worker: "required" as const }, limits: { hardInputBytes: 1024, hardWorkingSetBytes: 2048 } };
    const caps = { worker: true, wasm: true, "image-decode": true };
    expect(preflightHeavyLocalJob(policy, { inputBytes: 2048, estimatedWorkingSetBytes: 4096 }, caps).resourceState).toBe("blocked");
    expect(preflightHeavyLocalJob(policy, { inputBytes: 128, estimatedWorkingSetBytes: 512 }, caps).state).toBe("supported");
    const aborted = new AbortController();
    aborted.abort();
    await expect(readBlobText(new Blob(["id,value\n1,ok\n"]), aborted.signal)).rejects.toMatchObject({ code: "CANCELLED" });
    const retry = cleanCsvText(await readBlobText(new Blob(["id,value\n1,ok\n"])));
    expect(hash(retry.output)).toBe(hash("id,value\n1,ok\n"));
  });

  it("checks the committed evidence matrix while keeping incomplete device acceptance blocked", () => {
    const receipt = JSON.parse(readFileSync(resolve(import.meta.dirname, "../quality/receipts/mobile-memory-363-simulated.json"), "utf8"));
    expect(receipt.cases).toHaveLength(36);
    expect(receipt.cases.every((entry: { status: string }) => ["PASS", "FAIL", "NOT_RUN"].includes(entry.status))).toBe(true);
    expect(receipt.physicalDeviceObserved).toBe(false);
    expect(validateMobileMemory363(receipt)).toEqual([]);
    expect(assessMobileMemory363(receipt).status).toBe("BLOCKED");
  });
});
