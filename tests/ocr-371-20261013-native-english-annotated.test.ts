/** Real native Vision English OCR on a pinned local synthetic image; no cloud, donor or mobile claims. */
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const onNativeHost = process.platform === "darwin" && process.arch === "arm64";
const annotatedEnglish = "Invoice number 12345 - Total USD 678.90";
const pinnedSha = "5cb42f37588b446ed54e8193caf6a3361bdacb81a8128fc50150987c6c6212e0";
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="240"><rect width="1280" height="240" fill="#fff"/><text x="42" y="130" font-family="Helvetica" font-size="48" fill="#111">${annotatedEnglish}</text></svg>`;

describe.skipIf(!onNativeHost)("#371 pinned English synthetic image / real offline macOS Vision", () => {
  let directory = "";
  let executable = "";
  let image = "";

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), "ocr371-english-native-"));
    executable = join(directory, "ocr-vision");
    const imageBytes = await sharp(Buffer.from(svg)).png().toBuffer();
    // Regression admission requires the exact visual input observed in the
    // source-bound study; a font or renderer change must not silently pass.
    expect(imageBytes.length).toBe(14270);
    expect(createHash("sha256").update(imageBytes).digest("hex")).toBe(pinnedSha);
    image = join(directory, "english-annotated.png");
    writeFileSync(image, imageBytes, { flag: "wx", mode: 0o600 });
    execFileSync("/usr/bin/swiftc", [
      resolve(import.meta.dirname, "../scripts/ocr-native-vision-371.swift"), "-o", executable,
    ], { timeout: 180_000, maxBuffer: 80_000 });
  }, 200_000);

  afterAll(() => {
    if (directory) rmSync(directory, { recursive: true, force: true });
  });

  const invoke = (sha256: string) => spawnSync(executable, [
    "--image", image, "--expected-sha256", sha256,
    "--expected-text", annotatedEnglish, "--language", "en-US",
  ], { encoding: "utf8", timeout: 40_000, maxBuffer: 64 * 1024,
    env: { ...process.env, HOME: directory, TMPDIR: directory },
  });

  it("measures actual English CER/WER and labels the one-fixture EN-only scope correctly", () => {
    const output = invoke(pinnedSha);
    expect(output.error).toBeUndefined();
    expect(output.status, output.stderr).toBe(0);
    expect(output.stderr).toBe("");
    const measured = JSON.parse(output.stdout) as Record<string, unknown>;
    expect(measured).toMatchObject({
      ticket: 371, decision: "NO_GO", language: "en-US",
      scope: "MACOS_VISION_LOCAL_SINGLE_HOST_SYNTHETIC_EN_ONLY",
      fileSha256: pinnedSha, inputBytes: 14270, imageWidth: 1280, imageHeight: 240,
      referenceText: annotatedEnglish, recognizedText: annotatedEnglish,
      exact: true, characterErrors: 0, characterErrorRate: 0,
      wordErrors: 0, wordErrorRate: 0, referenceWords: 7,
      candidateScoreMeaning: "UNCALIBRATED_NATIVE_MODEL_SCORE_NOT_A_PROBABILITY",
      nativeVisionAndXpcPeakMemory: "NOT_MEASURED", physicalIosAndroid: "NOT_RUN",
      englishComparativeQuality: "NOT_MEASURED",
      operatingSystemNetworkEgress: "NOT_ATTESTED_BY_COMPARATOR",
    });
    expect(measured.recognitionMs).toEqual(expect.any(Number));
    expect(measured.nativeProcessHighWaterRssBytes).toEqual(expect.any(Number));
    console.log(`#371 independent real Vision English OCR: ${JSON.stringify({
      sha256: pinnedSha, cer: measured.characterErrorRate, wer: measured.wordErrorRate,
      recognitionMs: measured.recognitionMs, processRssBytes: measured.nativeProcessHighWaterRssBytes,
      scope: measured.scope, decision: measured.decision,
    })}`);
  }, 60_000);

  it("refuses a mutated digest before running English OCR", () => {
    const output = invoke("0".repeat(64));
    expect(output.error).toBeUndefined();
    expect(output.status).toBe(2);
    expect(output.stdout).toBe("");
    expect(output.stderr).toContain("OCR371_REFUSED:SOURCE_SHA256_MISMATCH");
  }, 60_000);

  it("scores an independently pinned 90-degree uncorrected English variant", async () => {
    const rotated = await sharp(readFileSync(image)).rotate(90).png().toBuffer();
    const digest = createHash("sha256").update(rotated).digest("hex");
    expect(rotated.length).toBe(20172);
    expect(digest).toBe("a839a458bad2ab4846312b822b4661d873ede579d9abb1855ca36e1681a7fcc9");
    const rotatedPath = join(directory, "english-rotated-90.png");
    writeFileSync(rotatedPath, rotated, { flag: "wx", mode: 0o600 });
    const output = spawnSync(executable, [
      "--image", rotatedPath, "--expected-sha256", digest,
      "--expected-text", annotatedEnglish, "--language", "en-US",
    ], { encoding: "utf8", timeout: 40_000, maxBuffer: 64 * 1024 });
    expect(output.error).toBeUndefined();
    expect(output.status, output.stderr).toBe(0);
    const measured = JSON.parse(output.stdout) as Record<string, unknown>;
    expect(measured).toMatchObject({
      fileSha256: digest, inputBytes: 20172, imageWidth: 240, imageHeight: 1280,
      language: "en-US", decision: "NO_GO",
      scope: "MACOS_VISION_LOCAL_SINGLE_HOST_SYNTHETIC_EN_ONLY",
      referenceText: annotatedEnglish, recognizedText: annotatedEnglish,
      exact: true, characterErrorRate: 0, wordErrorRate: 0,
    });
    console.log(`#371 real Vision rotated EN: ${JSON.stringify({
      sha256: digest, cer: measured.characterErrorRate, wer: measured.wordErrorRate,
      recognitionMs: measured.recognitionMs, processRssBytes: measured.nativeProcessHighWaterRssBytes,
    })}`);
  }, 60_000);

  it.skipIf(!existsSync("/usr/bin/sandbox-exec"))(
    "recognizes English with the native process denied network access", () => {
      const output = spawnSync("/usr/bin/sandbox-exec", [
        "-p", "(version 1) (allow default) (deny network*)", executable,
        "--image", image, "--expected-sha256", pinnedSha,
        "--expected-text", annotatedEnglish, "--language", "en-US",
      ], { encoding: "utf8", timeout: 40_000, maxBuffer: 64 * 1024,
        env: { ...process.env, HOME: directory, TMPDIR: directory },
      });
      expect(output.error).toBeUndefined();
      expect(output.status, output.stderr).toBe(0);
      expect(JSON.parse(output.stdout)).toMatchObject({
        language: "en-US", recognizedText: annotatedEnglish, exact: true,
        scope: "MACOS_VISION_LOCAL_SINGLE_HOST_SYNTHETIC_EN_ONLY", decision: "NO_GO",
      });
    }, 60_000,
  );
});
